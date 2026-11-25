import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getSupabase } from '../config/supabase';
import { createRoomSchema, joinRoomSchema, updateDestinationSchema } from '../validators/roomValidator';
import { Room, RoomMember, USER_PALETTE } from '../types';
import { NotificationService } from '../services/notificationService';

// Fallback in-memory store for instant zero-dependency execution
export const inMemoryRooms = new Map<string, Room>();
export const inMemoryMembers = new Map<string, RoomMember[]>();

export async function generateUniqueRoomCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const supabase = getSupabase();

  for (let attempt = 0; attempt < 12; attempt++) {
    let code = 'BUD';
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (supabase) {
      const { data } = await supabase.from('rooms').select('id').eq('room_code', code).single();
      if (!data) return code;
    } else {
      let isTaken = false;
      for (const r of inMemoryRooms.values()) {
        if (r.room_code === code) {
          isTaken = true;
          break;
        }
      }
      if (!isTaken) return code;
    }
  }

  // Fallback high-entropy code if dense
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `BUD${suffix}`;
}

export function pickUnusedMarkerColor(existingMembers: RoomMember[]): string {
  const usedColors = new Set(existingMembers.map((m) => m.marker_color));
  for (const color of USER_PALETTE) {
    if (!usedColors.has(color)) {
      return color;
    }
  }
  // If more than 10 members, cycle cleanly
  return USER_PALETTE[existingMembers.length % USER_PALETTE.length];
}

export class RoomController {
  static async createRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = createRoomSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const userId = req.user!.id;
      const userName = req.user!.displayName || 'Travel Creator';
      const { roomName, destinationName, destinationLatitude, destinationLongitude, destinationAddress } = parsed.data;
      let destinationPlaceId = (parsed.data as any).destinationPlaceId || (parsed.data as any).placeId || '';

      // Automatically extract coordinates from Google Places if destination is typed or default
      let finalLat = destinationLatitude;
      let finalLon = destinationLongitude;
      let finalAddress = destinationAddress || destinationName;

      const isDefaultCoords = (finalLat === 15.5553 && finalLon === 73.7517) || (!finalLat && !finalLon);
      const isNotBaga = !destinationName.toLowerCase().includes('baga');
      if (isDefaultCoords && isNotBaga) {
        try {
          const { GoogleMapsService } = await import('../services/googleMapsService');
          const places = await GoogleMapsService.searchPlacesByText(destinationName, 1);
          if (places && places.length > 0) {
            finalLat = places[0].latitude;
            finalLon = places[0].longitude;
            if (!destinationAddress) {
              finalAddress = places[0].address;
            }
            if (!destinationPlaceId && places[0].placeId) {
              destinationPlaceId = places[0].placeId;
            }
          }
        } catch (e) {
          console.warn('[RoomController] Auto-geocode failed, using submitted coordinates:', e);
        }
      }

      const roomCode = await generateUniqueRoomCode();
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const newRoom: Room = {
        id: roomId,
        room_code: roomCode,
        room_name: roomName,
        creator_id: userId,
        destination_name: destinationName,
        destination_latitude: finalLat,
        destination_longitude: finalLon,
        destination_address: finalAddress,
        destination_place_id: destinationPlaceId || undefined,
        status: 'active',
        created_at: now,
      };

      const creatorMember: RoomMember = {
        id: `rm_${Date.now()}_1`,
        room_id: roomId,
        user_id: userId,
        display_name: userName,
        marker_color: USER_PALETTE[0], // Terracotta for creator
        member_role: 'creator',
        joined_at: now,
        location_sharing_enabled: true,
        status: 'Not Started',
      };

      const supabase = getSupabase();
      if (supabase) {
        const insertPayload: any = {
          room_code: roomCode,
          room_name: roomName,
          creator_id: userId,
          destination_name: destinationName,
          destination_latitude: finalLat,
          destination_longitude: finalLon,
          destination_address: finalAddress,
        };
        if (destinationPlaceId) {
          insertPayload.destination_place_id = destinationPlaceId;
        }

        let { data: dbRoom, error: roomError } = await supabase
          .from('rooms')
          .insert(insertPayload)
          .select()
          .single();

        if (roomError && roomError.message && roomError.message.includes('destination_place_id')) {
          delete insertPayload.destination_place_id;
          const retry = await supabase.from('rooms').insert(insertPayload).select().single();
          dbRoom = retry.data;
          roomError = retry.error;
        }

        if (roomError) {
          return res.status(500).json({ success: false, error: roomError.message });
        }

        const { data: dbMember } = await supabase.from('room_members').insert({
          room_id: dbRoom.id,
          user_id: userId,
          display_name: userName,
          marker_color: USER_PALETTE[0],
          member_role: 'creator',
          location_sharing_enabled: true,
          status: 'Not Started',
        }).select().single();

        return res.status(201).json({
          success: true,
          room: dbRoom,
          member: dbMember || { ...creatorMember, room_id: dbRoom.id },
        });
      }

      // Memory store
      inMemoryRooms.set(roomId, newRoom);
      inMemoryMembers.set(roomId, [creatorMember]);

      return res.status(201).json({
        success: true,
        room: newRoom,
        member: creatorMember,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async joinRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = joinRoomSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const userId = req.user!.id;
      const { roomCode, displayName, shareLocation } = parsed.data;

      const supabase = getSupabase();
      if (supabase) {
        const { data: room, error: roomErr } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode.toUpperCase())
          .single();

        if (roomErr || !room) {
          return res.status(404).json({ success: false, error: 'Travel room code not found. Please check the code.' });
        }

        if (room.status !== 'active') {
          return res.status(400).json({ success: false, error: 'This travel room has ended and is no longer active.' });
        }

        const { data: existingMembers } = await supabase
          .from('room_members')
          .select('*')
          .eq('room_id', room.id);

        const membersList = (existingMembers || []) as RoomMember[];
        const alreadyMember = membersList.find((m) => m.user_id === userId);

        if (alreadyMember) {
          return res.json({
            success: true,
            room,
            member: alreadyMember,
            message: 'Reconnected to room',
          });
        }

        const assignedColor = pickUnusedMarkerColor(membersList);

        const { data: newMember, error: joinErr } = await supabase
          .from('room_members')
          .insert({
            room_id: room.id,
            user_id: userId,
            display_name: displayName,
            marker_color: assignedColor,
            member_role: 'member',
            location_sharing_enabled: shareLocation,
            status: 'Not Started',
          })
          .select()
          .single();

        if (joinErr) {
          return res.status(500).json({ success: false, error: joinErr.message });
        }

        const io = req.app.get('io');
        await NotificationService.notifyRoom(
          room.id,
          'New Traveler Joined! 👋',
          `${displayName} joined the trip!`,
          'room:member-joined',
          { member: newMember },
          io,
          userId
        );

        return res.status(200).json({
          success: true,
          room,
          member: newMember,
        });
      }

      // Memory mode
      let targetRoom: Room | undefined;
      for (const r of inMemoryRooms.values()) {
        if (r.room_code.toUpperCase() === roomCode.toUpperCase()) {
          targetRoom = r;
          break;
        }
      }

      if (!targetRoom) {
        return res.status(404).json({ success: false, error: 'Travel room code not found. Please check the code.' });
      }

      if (targetRoom.status !== 'active') {
        return res.status(400).json({ success: false, error: 'This travel room has ended and is no longer active.' });
      }

      const roomMembers = inMemoryMembers.get(targetRoom.id) || [];
      const existing = roomMembers.find((m) => m.user_id === userId);
      if (existing) {
        return res.json({ success: true, room: targetRoom, member: existing });
      }

      const assignedColor = pickUnusedMarkerColor(roomMembers);
      const newMember: RoomMember = {
        id: `rm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        room_id: targetRoom.id,
        user_id: userId,
        display_name: displayName,
        marker_color: assignedColor,
        member_role: 'member',
        joined_at: new Date().toISOString(),
        location_sharing_enabled: shareLocation,
        status: 'Not Started',
      };

      roomMembers.push(newMember);
      inMemoryMembers.set(targetRoom.id, roomMembers);

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${targetRoom.id}`).emit('room:member-joined', newMember);
      }

      await NotificationService.notifyRoom(
        targetRoom.id,
        'New Traveler Joined! 👋',
        `${displayName} joined the trip!`,
        'room:member-joined',
        { member: newMember },
        io,
        userId
      );

      return res.status(200).json({
        success: true,
        room: targetRoom,
        member: newMember,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const userId = req.user!.id;
      const supabase = getSupabase();

      if (supabase) {
        const { data: room, error } = await supabase
          .from('rooms')
          .select('*, room_members(*)')
          .eq('id', roomId)
          .single();

        if (error || !room) {
          return res.status(404).json({ success: false, error: 'Room not found' });
        }

        const isMember = (room.room_members || []).some((m: any) => m.user_id === userId);
        if (!isMember && room.creator_id !== userId) {
          return res.status(403).json({ success: false, error: 'Unauthorized: You are not a member of this room' });
        }

        return res.json({ success: true, room });
      }

      const room = inMemoryRooms.get(roomId);
      if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }

      const members = inMemoryMembers.get(roomId) || [];
      const isMember = members.some((m) => m.user_id === userId);
      if (!isMember && room.creator_id !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized: You are not a member of this room' });
      }

      return res.json({ success: true, room: { ...room, room_members: members } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const userId = req.user!.id;
      const supabase = getSupabase();

      if (supabase) {
        const [{ data: check }, { data: roomCheck }] = await Promise.all([
          supabase.from('room_members').select('id').eq('room_id', roomId).eq('user_id', userId).maybeSingle(),
          supabase.from('rooms').select('creator_id').eq('id', roomId).maybeSingle(),
        ]);

        if (!check && roomCheck?.creator_id !== userId) {
          return res.status(403).json({ success: false, error: 'Unauthorized: You are not a member of this room' });
        }

        const { data, error } = await supabase
          .from('room_members')
          .select('*')
          .eq('room_id', roomId);

        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, members: data || [] });
      }

      const members = inMemoryMembers.get(roomId) || [];
      const isMember = members.some((m) => m.user_id === userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Unauthorized: You are not a member of this room' });
      }

      return res.json({ success: true, members });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async leaveRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const userId = req.user!.id;

      const supabase = getSupabase();
      if (supabase) {
        await supabase
          .from('room_members')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', userId);
      } else {
        const members = inMemoryMembers.get(roomId) || [];
        inMemoryMembers.set(roomId, members.filter((m) => m.user_id !== userId));
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${roomId}`).emit('room:member-left', { userId, roomId });
      }

      await NotificationService.notifyRoom(
        roomId,
        'Member Left Trip 🚶',
        'A member has left the travel room.',
        'room:member-left',
        { userId, roomId },
        io,
        userId
      );

      return res.json({ success: true, message: 'Successfully left travel room' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async updateDestination(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const userId = req.user!.id;
      const parsed = updateDestinationSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const { destinationName, destinationLatitude, destinationLongitude, destinationAddress } = parsed.data;

      let finalLat = destinationLatitude;
      let finalLon = destinationLongitude;
      let finalAddress = destinationAddress || destinationName;

      // Auto-geocode if coordinates were not provided or default
      const isDefaultCoords = (finalLat === 15.5553 && finalLon === 73.7517) || (!finalLat && !finalLon);
      const isNotBaga = !destinationName.toLowerCase().includes('baga');
      if (isDefaultCoords && isNotBaga) {
        try {
          const { GoogleMapsService } = await import('../services/googleMapsService');
          const places = await GoogleMapsService.searchPlacesByText(destinationName, 1);
          if (places && places.length > 0) {
            finalLat = places[0].latitude;
            finalLon = places[0].longitude;
            if (!destinationAddress) finalAddress = places[0].address;
          }
        } catch (e) {
          console.warn('[RoomController] Auto-geocode failed on update:', e);
        }
      }

      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from('rooms')
          .update({
            destination_name: destinationName,
            destination_latitude: finalLat,
            destination_longitude: finalLon,
            destination_address: finalAddress,
          })
          .eq('id', roomId)
          .eq('creator_id', userId)
          .select()
          .single();

        if (error) return res.status(403).json({ success: false, error: 'Only room creator can update destination' });

        const io = req.app.get('io');
        if (io) {
          io.to(`room:${roomId}`).emit('room:destination-changed', data);
        }

        await NotificationService.notifyRoom(
          roomId,
          'Destination Updated! 🎯',
          `Trip destination changed to ${destinationName}.`,
          'room:destination-changed',
          { destinationName, destinationAddress },
          io,
          userId
        );

        return res.json({ success: true, room: data });
      }

      const room = inMemoryRooms.get(roomId);
      if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
      if (room.creator_id !== userId) {
        return res.status(403).json({ success: false, error: 'Only room creator can update destination' });
      }

      room.destination_name = destinationName;
      room.destination_latitude = destinationLatitude;
      room.destination_longitude = destinationLongitude;
      room.destination_address = destinationAddress;

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${roomId}`).emit('room:destination-changed', room);
      }

      await NotificationService.notifyRoom(
        roomId,
        'Destination Updated! 🎯',
        `Trip destination changed to ${destinationName}.`,
        'room:destination-changed',
        { destinationName, destinationAddress },
        io,
        userId
      );

      return res.json({ success: true, room });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async endRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const userId = req.user!.id;
      const now = new Date().toISOString();

      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase
          .from('rooms')
          .update({ status: 'completed', ended_at: now })
          .eq('id', roomId)
          .eq('creator_id', userId);

        if (error) return res.status(403).json({ success: false, error: 'Only creator can end room' });
      } else {
        const room = inMemoryRooms.get(roomId);
        if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
        if (room.creator_id !== userId) {
          return res.status(403).json({ success: false, error: 'Only creator can end room' });
        }
        room.status = 'completed';
        room.ended_at = now;
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${roomId}`).emit('room:ended', { roomId });
      }

      return res.json({ success: true, message: 'Trip completed and room ended successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getMyTrips(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const supabase = getSupabase();

      if (supabase) {
        const { data, error } = await supabase
          .from('room_members')
          .select('rooms(*)')
          .eq('user_id', userId);

        if (error) return res.status(500).json({ success: false, error: error.message });
        const rooms = (data || []).map((d: any) => d.rooms);
        return res.json({ success: true, trips: rooms });
      }

      const trips: Room[] = [];
      for (const [roomId, members] of inMemoryMembers.entries()) {
        if (members.some((m) => m.user_id === userId)) {
          const r = inMemoryRooms.get(roomId);
          if (r) trips.push(r);
        }
      }

      return res.json({ success: true, trips });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

