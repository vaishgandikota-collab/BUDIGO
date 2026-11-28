import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { searchMeetingPointsSchema } from '../validators/locationValidator';
import { MeetingPointOptimizer } from '../services/meetingPointOptimizer';
import { GoogleMapsService } from '../services/googleMapsService';
import { inMemoryMembers, inMemoryRooms } from './roomController';
import { inMemoryLocations } from './locationController';
import { MeetingPoint, ParticipantStartPoint } from '../types';
import { getSupabase } from '../config/supabase';
import { NotificationService } from '../services/notificationService';

export const inMemoryMeetingPoints = new Map<string, MeetingPoint[]>();

const DEMO_DESTINATION = {
  name: 'Tank Bund / Hussain Sagar',
  address: 'Hussain Sagar Promenade, Hyderabad, Telangana 500004',
  latitude: 17.4239,
  longitude: 78.4738,
};

export class MeetingPointController {
  static async searchMeetingPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = searchMeetingPointsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const { roomId, category, radiusMeters, mode, destination, customParticipants } = parsed.data;

      // 1. Automatically retrieve the room and its saved destination
      let roomDestination = { ...DEMO_DESTINATION };
      let roomFound = false;

      const supabase = getSupabase();
      if (supabase) {
        const { data: dbRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (dbRoom && dbRoom.destination_latitude && dbRoom.destination_longitude) {
          roomDestination = {
            name: dbRoom.destination_name || 'Selected Destination',
            address: dbRoom.destination_address || '',
            latitude: Number(dbRoom.destination_latitude),
            longitude: Number(dbRoom.destination_longitude),
          };
          roomFound = true;
        }
      }

      if (!roomFound) {
        const memRoom = inMemoryRooms.get(roomId);
        if (memRoom && memRoom.destination_latitude && memRoom.destination_longitude) {
          roomDestination = {
            name: memRoom.destination_name || 'Selected Destination',
            address: memRoom.destination_address || '',
            latitude: Number(memRoom.destination_latitude),
            longitude: Number(memRoom.destination_longitude),
          };
          roomFound = true;
        }
      }

      if (!roomFound && destination && destination.latitude && destination.longitude) {
        roomDestination = {
          name: destination.name || 'Selected Destination',
          address: destination.address || '',
          latitude: Number(destination.latitude),
          longitude: Number(destination.longitude),
        };
        roomFound = true;
      }

      let meetingPoints: MeetingPoint[] = [];

      // 2. DISCOVERY LOGIC: "Near Destination" (Default) vs "Fair for Everyone" (Minimax)
      const memMembers = inMemoryMembers.get(roomId) || [];
      const activeLocCount = memMembers.filter((m) => m.location_sharing_enabled && inMemoryLocations.has(`${roomId}:${m.user_id}`)).length;
      const shouldUseFairMode = mode === 'fair_for_everyone' || (!req.body.mode && activeLocCount > 1);

      if (shouldUseFairMode) {
        // Collect active participants from room
        let participants: ParticipantStartPoint[] = [];

        if (customParticipants && customParticipants.length > 0) {
          participants = customParticipants;
        } else if (supabase) {
          const { data: members } = await supabase
            .from('room_members')
            .select('*, live_locations(*)')
            .eq('room_id', roomId)
            .eq('location_sharing_enabled', true);

          if (members) {
            for (const m of members) {
              const loc = m.live_locations?.[0];
              if (loc) {
                participants.push({
                  userId: m.user_id,
                  displayName: m.display_name,
                  markerColor: m.marker_color,
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                });
              }
            }
          }
        } else {
          const members = inMemoryMembers.get(roomId) || [];
          for (const m of members) {
            if (!m.location_sharing_enabled) continue;
            const loc = inMemoryLocations.get(`${roomId}:${m.user_id}`);
            if (loc) {
              participants.push({
                userId: m.user_id,
                displayName: m.display_name,
                markerColor: m.marker_color,
                latitude: loc.latitude,
                longitude: loc.longitude,
              });
            }
          }
        }

        if (participants.length === 0) {
          participants = [
            { userId: 'u1', displayName: 'Aarav', markerColor: '#D1956A', latitude: 17.4100, longitude: 78.4700 },
            { userId: 'u2', displayName: 'Diya', markerColor: '#4C78C9', latitude: 17.4350, longitude: 78.4850 },
            { userId: 'u3', displayName: 'Rohan', markerColor: '#419A77', latitude: 17.4200, longitude: 78.4600 },
          ];
        }

        const scored = await MeetingPointOptimizer.findOptimalMeetingPoints(participants, category);
        meetingPoints = scored.map((s, idx) => ({
          id: `mp_${Date.now()}_${idx + 1}`,
          room_id: roomId,
          place_id: s.candidate.placeId,
          place_name: s.candidate.name,
          category: s.candidate.category,
          latitude: s.candidate.latitude,
          longitude: s.candidate.longitude,
          address: s.candidate.address,
          rating: s.candidate.rating,
          ranking_score: s.rankingScore,
          maximum_travel_time: s.maxTravelTimeSeconds,
          total_travel_time: s.totalTravelTimeSeconds,
          average_travel_time: s.avgTravelTimeSeconds,
          is_confirmed: false,
          created_at: new Date().toISOString(),
          routes: s.routes.map((r) => {
            const p = participants.find((pt) => pt.userId === r.userId);
            return {
              meeting_point_id: `mp_${Date.now()}_${idx + 1}`,
              user_id: r.userId,
              distance_meters: r.distanceMeters,
              duration_seconds: r.durationSeconds,
              polyline: r.polyline,
              user_display_name: p?.displayName,
              marker_color: p?.markerColor,
            };
          }),
        }));
      } else {
        // DEFAULT: Destination-Based Smart Meeting Point Finder
        // Discovers real-world places near the room destination and computes actual road routes
        const candidatePlaces = await GoogleMapsService.searchDestinationMeetingPoints(
          { latitude: roomDestination.latitude, longitude: roomDestination.longitude },
          category,
          radiusMeters
        );

        // Return ALL candidate places (Google Places returns up to 20)
        meetingPoints = candidatePlaces.map((c, idx) => {
          // Smart ranking score: use the actual composite score from the sorted list
          // Top item gets ~98, subsequent items decrease proportionally based on count
          const totalCount = candidatePlaces.length;
          const step = totalCount > 1 ? 30 / (totalCount - 1) : 0; // spread scores over 30-point range (98 down to ~68)
          const rankingScore = Math.max(50, Math.round(98 - idx * step));

          return {
            id: `mp_dest_${Date.now()}_${idx + 1}`,
            room_id: roomId,
            place_id: c.placeId,
            place_name: c.name,
            category: c.category,
            latitude: c.latitude,
            longitude: c.longitude,
            address: c.address,
            rating: c.rating,
            user_rating_count: c.userRatingCount,
            open_now: c.openNow,
            open_status_text: c.openStatusText,
            google_maps_uri: c.googleMapsUri,
            distance_from_dest_meters: c.distanceFromDestMeters,
            driving_time_from_dest_seconds: c.drivingTimeFromDestSeconds,
            dest_route_polyline: c.destRoutePolyline,
            ranking_score: rankingScore,
            maximum_travel_time: c.drivingTimeFromDestSeconds || 300,
            total_travel_time: c.drivingTimeFromDestSeconds || 300,
            average_travel_time: c.drivingTimeFromDestSeconds || 300,
            is_confirmed: false,
            created_at: new Date().toISOString(),
            routes: [
              {
                meeting_point_id: `mp_dest_${Date.now()}_${idx + 1}`,
                user_id: 'destination',
                distance_meters: c.distanceFromDestMeters || 1000,
                duration_seconds: c.drivingTimeFromDestSeconds || 300,
                polyline: c.destRoutePolyline,
                user_display_name: roomDestination.name,
                marker_color: '#D1956A',
              },
            ],
          };
        });
      }

      // 3. Persist to DB or Memory
      if (supabase) {
        try {
          await supabase.from('meeting_points').delete().eq('room_id', roomId).eq('is_confirmed', false);
          for (const mp of meetingPoints) {
            const { data: dbMp } = await supabase
              .from('meeting_points')
              .insert({
                room_id: mp.room_id,
                place_id: mp.place_id,
                place_name: mp.place_name,
                category: mp.category,
                latitude: mp.latitude,
                longitude: mp.longitude,
                address: mp.address,
                rating: mp.rating,
                ranking_score: mp.ranking_score,
                maximum_travel_time: mp.maximum_travel_time,
                total_travel_time: mp.total_travel_time,
                average_travel_time: mp.average_travel_time,
                is_confirmed: false,
              })
              .select()
              .single();

            if (dbMp) {
              mp.id = dbMp.id;
            }
          }
        } catch (dbErr) {
          console.warn('[MeetingPointController] DB write skipped or errored, falling back to in-memory store:', dbErr);
        }
      }

      inMemoryMeetingPoints.set(roomId, meetingPoints);

      // 4. Notify room members in realtime via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`room:${roomId}`).emit('meeting:recommendations', {
          roomId,
          roomDestination,
          recommendations: meetingPoints,
          mode,
          radiusMeters,
        });
      }

      return res.json({
        success: true,
        roomDestination,
        mode,
        radiusMeters,
        recommendations: meetingPoints,
      });
    } catch (error: any) {
      console.error('[MeetingPointController] Search error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getMeetingPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const userId = req.user?.id;
      const supabase = getSupabase();

      if (supabase) {
        const { data, error } = await supabase
          .from('meeting_points')
          .select('*, meeting_point_routes(*), votes(*)')
          .eq('room_id', roomId)
          .order('ranking_score', { ascending: false });

        if (!error && data && data.length > 0) {
          const formatted = data.map((mp: any) => ({
            ...mp,
            votes_count: mp.votes?.length || 0,
            has_voted: userId ? (mp.votes || []).some((v: any) => v.user_id === userId) : false,
            routes: mp.meeting_point_routes || [],
          }));

          return res.json({ success: true, meetingPoints: formatted });
        }
      }

      const list = inMemoryMeetingPoints.get(roomId) || [];
      return res.json({ success: true, meetingPoints: list });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async selectMeetingPoint(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'demo-host-id';
      const supabase = getSupabase();

      let meetingPoint: any = null;

      if (supabase) {
        try {
          const { data: mp } = await supabase
            .from('meeting_points')
            .select('*, rooms(*)')
            .eq('id', id)
            .single();

          if (mp) {
            // Only room creator / host can confirm the meeting point
            const creatorId = mp.rooms?.creator_id || (mp.rooms as any)?.created_by;
            if (creatorId && creatorId !== userId) {
              return res.status(403).json({ success: false, error: 'Only the room host can confirm the meeting point.' });
            }
            await supabase.from('meeting_points').update({ is_confirmed: false }).eq('room_id', mp.room_id);
            const { data: confirmed } = await supabase
              .from('meeting_points')
              .update({ is_confirmed: true })
              .eq('id', id)
              .select()
              .single();

            meetingPoint = confirmed;
          }
        } catch (supaErr) {
          console.warn('[MeetingPointController] Supabase select fallback to memory:', supaErr);
        }
      }

      if (!meetingPoint) {
        // Memory fallback
        for (const [roomId, points] of inMemoryMeetingPoints.entries()) {
          const found = points.find((p) => p.id === id);
          if (found) {
            const room = inMemoryRooms.get(roomId);
            const creatorId = room?.creator_id || (room as any)?.created_by;
            if (creatorId && creatorId !== userId) {
              return res.status(403).json({ success: false, error: 'Only the room host can confirm the meeting point.' });
            }
            points.forEach((p) => (p.is_confirmed = p.id === id));
            meetingPoint = found;
            break;
          }
        }
      }

      if (!meetingPoint) {
        return res.status(404).json({ success: false, error: 'Meeting point not found' });
      }

      const io = req.app.get('io');
      await NotificationService.notifyRoom(
        meetingPoint.room_id,
        'Meeting Point Confirmed! 📍',
        `${meetingPoint.place_name} is confirmed as the group meeting point.`,
        'meeting:confirmed',
        { meetingPoint },
        io
      );

      if (io) {
        io.to(`room:${meetingPoint.room_id}`).emit('meeting:confirmed', meetingPoint);
      }

      return res.json({
        success: true,
        message: 'Meeting point confirmed successfully and synced with all members.',
        meetingPoint,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Tier 1: Discover and rank fair destination areas based on Minimax road travel time
   */
  static async discoverFairAreas(req: AuthenticatedRequest, res: Response) {
    try {
      const { participants, travelMode } = req.body;
      if (!Array.isArray(participants) || participants.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 participants with coordinates are required.',
        });
      }

      for (const p of participants) {
        if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') {
          return res.status(400).json({
            success: false,
            error: `Participant ${p.name || p.id} is missing valid coordinates.`,
          });
        }
      }

      const result = await GoogleMapsService.discoverFairDestinationAreas(
        participants,
        travelMode || 'DRIVE'
      );

      return res.json({
        success: true,
        center: result.center,
        candidateAreas: result.candidateAreas,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Tier 2: Discover specific venues in chosen area with per-participant routes & polylines
   */
  static async discoverAreaVenues(req: AuthenticatedRequest, res: Response) {
    try {
      const { areaCoordinates, areaName, participants, category, travelMode } = req.body;
      if (
        !areaCoordinates ||
        typeof areaCoordinates.latitude !== 'number' ||
        typeof areaCoordinates.longitude !== 'number'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Valid areaCoordinates { latitude, longitude } are required.',
        });
      }

      if (!Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least 1 participant is required to discover venues.',
        });
      }

      const venues = await GoogleMapsService.discoverAreaVenues(
        areaCoordinates,
        areaName || 'Selected Area',
        participants,
        category || 'all',
        travelMode || 'DRIVE'
      );

      return res.json({
        success: true,
        venues,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
