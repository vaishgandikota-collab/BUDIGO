import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getSupabase } from '../config/supabase';
import { updateLocationSchema } from '../validators/locationValidator';
import { inMemoryRooms, inMemoryMembers } from './roomController';
import { inMemoryMeetingPoints } from './meetingPointController';
import { LiveLocation, MemberStatus } from '../types';
import { GeofenceService } from '../services/geofenceService';
import { NotificationService } from '../services/notificationService';
import { GoogleMapsService } from '../services/googleMapsService';

export const inMemoryLocations = new Map<string, LiveLocation>();
const lastRestUpdateMap = new Map<string, number>();

export class LocationController {
  static async updateLocation(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = updateLocationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const userId = req.user!.id;
      const { roomId, latitude, longitude, accuracy, speed, heading } = parsed.data;

      // Rate limit REST updates per user & room (max 1 per 500ms)
      const throttleKey = `${roomId}:${userId}`;
      const nowMs = Date.now();
      const lastTime = lastRestUpdateMap.get(throttleKey);
      if (lastTime && nowMs - lastTime < 500) {
        const cached = inMemoryLocations.get(throttleKey);
        if (cached) {
          return res.json({
            success: true,
            location: cached,
            status: cached.status || 'Moving',
            distanceMeters: cached.distance_to_dest_meters || 0,
            etaSeconds: cached.eta_seconds || 0,
            throttled: true,
          });
        }
      }
      lastRestUpdateMap.set(throttleKey, nowMs);

      // 1. Validate room existence & member sharing permission
      const supabase = getSupabase();
      let room: any = null;
      let member: any = null;

      if (supabase) {
        const { data: rmData } = await supabase
          .from('room_members')
          .select('*, rooms(*)')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .single();

        if (!rmData) {
          return res.status(403).json({ success: false, error: 'Unauthorized: Not a member of this room' });
        }

        member = rmData;
        room = rmData.rooms;
      } else {
        room = inMemoryRooms.get(roomId);
        const members = inMemoryMembers.get(roomId) || [];
        member = members.find((m) => m.user_id === userId);

        if (!room || !member) {
          return res.status(403).json({ success: false, error: 'Unauthorized: Not a member of this room' });
        }
      }

      // Check if location sharing is enabled
      if (!member.location_sharing_enabled) {
        return res.status(403).json({
          success: false,
          error: 'Location sharing is disabled for this user. Enable sharing first.',
        });
      }

      // 2. Evaluate arrival & proximity against room destination
      const destination = {
        latitude: room.destination_latitude,
        longitude: room.destination_longitude,
      };

      const arrivalResult = GeofenceService.evaluateArrival(
        roomId,
        userId,
        { latitude, longitude, accuracy, speed },
        destination
      );

      // Estimate ETA based on remaining distance and current speed (or average 40 km/h)
      const speedMs = (speed && speed > 1) ? speed : (35 * 1000) / 3600;
      const etaSeconds = Math.round(arrivalResult.distanceMeters / speedMs);

      const locationRecord: LiveLocation = {
        room_id: roomId,
        user_id: userId,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        distance_to_dest_meters: arrivalResult.distanceMeters,
        eta_seconds: etaSeconds,
        updated_at: new Date().toISOString(),
      };

      const io = req.app.get('io');

      // 3. Persist location & update member travel status
      if (supabase) {
        await supabase.from('live_locations').upsert(
          {
            room_id: roomId,
            user_id: userId,
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            distance_to_dest_meters: arrivalResult.distanceMeters,
            eta_seconds: etaSeconds,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'room_id,user_id' }
        );

        await supabase
          .from('room_members')
          .update({
            status: arrivalResult.status,
            last_seen_at: new Date().toISOString(),
          })
          .eq('room_id', roomId)
          .eq('user_id', userId);
      } else {
        inMemoryLocations.set(`${roomId}:${userId}`, locationRecord);
        member.status = arrivalResult.status;
        member.last_seen_at = new Date().toISOString();
      }

      // 4. Handle Arrival Notification if triggered
      if (arrivalResult.triggerArrivalNotification) {
        await NotificationService.notifyRoom(
          roomId,
          `${member.display_name} has arrived! 🎉`,
          `${member.display_name} safely reached ${room.destination_name}.`,
          'trip:arrived',
          { userId, roomId, destinationName: room.destination_name },
          io
        );
      }

      // Check confirmed meeting point arrival
      let confirmedMp: any = null;
      if (supabase) {
        const { data: dbMp } = await supabase
          .from('meeting_points')
          .select('*')
          .eq('room_id', roomId)
          .eq('is_confirmed', true)
          .maybeSingle();
        confirmedMp = dbMp;
      } else {
        const mps = inMemoryMeetingPoints.get(roomId) || [];
        confirmedMp = mps.find((p) => p.is_confirmed);
      }

      if (confirmedMp) {
        const mpResult = GeofenceService.evaluateArrival(
          `${roomId}_mp`,
          userId,
          { latitude, longitude, accuracy, speed },
          { latitude: confirmedMp.latitude, longitude: confirmedMp.longitude }
        );
        if (mpResult.triggerArrivalNotification) {
          await NotificationService.notifyRoom(
            roomId,
            `${member.display_name} reached meeting point! 📍`,
            `${member.display_name} arrived at ${confirmedMp.place_name}.`,
            'meeting:reached',
            { userId, roomId, meetingPointName: confirmedMp.place_name },
            io
          );
        }
      }

      // 5. Broadcast to room via Socket.IO
      if (io) {
        io.to(`room:${roomId}`).emit('location:broadcast', {
          ...locationRecord,
          displayName: member.display_name,
          markerColor: member.marker_color,
          status: arrivalResult.status,
        });

        io.to(`room:${roomId}`).emit('trip:progress', {
          userId,
          roomId,
          status: arrivalResult.status,
          distanceMeters: arrivalResult.distanceMeters,
          etaSeconds,
        });
      }

      return res.json({
        success: true,
        location: locationRecord,
        status: arrivalResult.status,
        distanceMeters: arrivalResult.distanceMeters,
        etaSeconds,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRoomLocations(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const userId = req.user!.id;
      const supabase = getSupabase();

      if (supabase) {
        // First verify requesting user is a member or the creator
        const [{ data: memberCheck }, { data: roomCheck }] = await Promise.all([
          supabase.from('room_members').select('id').eq('room_id', roomId).eq('user_id', userId).maybeSingle(),
          supabase.from('rooms').select('creator_id').eq('id', roomId).maybeSingle(),
        ]);

        if (!memberCheck && roomCheck?.creator_id !== userId) {
          return res.status(403).json({ success: false, error: 'Unauthorized to view room locations' });
        }

        const [{ data: locations, error: locError }, { data: members }] = await Promise.all([
          supabase.from('live_locations').select('*').eq('room_id', roomId),
          supabase.from('room_members').select('user_id, display_name, marker_color, location_sharing_enabled, status').eq('room_id', roomId),
        ]);

        if (locError) return res.status(500).json({ success: false, error: locError.message });

        const memberMap = new Map((members || []).map((m: any) => [m.user_id, m]));
        const formattedLocations = (locations || [])
          .filter((loc: any) => {
            const m = memberMap.get(loc.user_id);
            return m ? m.location_sharing_enabled : true;
          })
          .map((loc: any) => {
            const m = memberMap.get(loc.user_id);
            return {
              ...loc,
              displayName: m?.display_name || 'Travel Buddy',
              markerColor: m?.marker_color || '#D1956A',
              status: m?.status || 'On the Way',
            };
          });

        return res.json({ success: true, locations: formattedLocations });
      }

      // In memory
      const members = inMemoryMembers.get(roomId) || [];
      const isMember = members.some((m) => m.user_id === userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Unauthorized to view room locations' });
      }

      const activeLocations: any[] = [];
      const now = Date.now();

      for (const m of members) {
        if (!m.location_sharing_enabled) continue;
        const loc = inMemoryLocations.get(`${roomId}:${m.user_id}`);
        if (loc) {
          const ageMs = now - new Date(loc.updated_at).getTime();
          const isStale = ageMs > 5 * 60 * 1000; // > 5 minutes

          activeLocations.push({
            ...loc,
            displayName: m.display_name,
            markerColor: m.marker_color,
            status: isStale ? 'Offline' : m.status,
            isStale,
          });
        }
      }

      return res.json({ success: true, locations: activeLocations });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async toggleLocationSharing(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const userId = req.user!.id;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, error: 'enabled boolean is required' });
      }

      const supabase = getSupabase();
      if (supabase) {
        await supabase
          .from('room_members')
          .update({
            location_sharing_enabled: enabled,
            status: enabled ? 'On the Way' : 'Offline',
          })
          .eq('room_id', roomId)
          .eq('user_id', userId);
      } else {
        const members = inMemoryMembers.get(roomId) || [];
        const m = members.find((x) => x.user_id === userId);
        if (m) {
          m.location_sharing_enabled = enabled;
          m.status = enabled ? 'On the Way' : 'Offline';
        }
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${roomId}`).emit('location:sharing-changed', {
          userId,
          roomId,
          enabled,
        });
      }

      if (!enabled) {
        await NotificationService.notifyRoom(
          roomId,
          'Location Sharing Disabled 🔕',
          'A traveler paused live location sharing.',
          'location:sharing-disabled',
          { userId, roomId },
          io,
          userId
        );
      }

      return res.json({
        success: true,
        message: `Location sharing ${enabled ? 'enabled' : 'stopped'} successfully`,
        enabled,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

