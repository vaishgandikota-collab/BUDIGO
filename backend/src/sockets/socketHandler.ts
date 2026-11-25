import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { inMemoryMembers } from '../controllers/roomController';
import { inMemoryLocations } from '../controllers/locationController';
import { GeofenceService } from '../services/geofenceService';
import { getSupabase } from '../config/supabase';

interface SocketUser {
  id: string;
  displayName: string;
  currentRoomId?: string;
}

export function setupSocketHandlers(io: Server) {
  // Middleware to authenticate socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      if (ENV.NODE_ENV !== 'production' && token.startsWith('test_user_')) {
        (socket as any).user = {
          id: token,
          displayName: `User ${token.replace('test_user_', '')}`,
        };
        return next();
      }

      const decoded: any = jwt.verify(token, ENV.JWT_SECRET);
      (socket as any).user = {
        id: decoded.id || decoded.sub,
        displayName: decoded.displayName || decoded.full_name || 'Traveler',
      };
      return next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user: SocketUser = (socket as any).user;
    console.log(`[Socket.IO] User connected: ${user.displayName} (${user.id})`);

    // Join personal user room for direct notifications
    socket.join(`user:${user.id}`);

    // Join Travel Room channel
    socket.on('room:join', async (data: { roomId: string }) => {
      const { roomId } = data;
      if (!roomId) return;

      socket.join(`room:${roomId}`);
      user.currentRoomId = roomId;

      console.log(`[Socket.IO] ${user.displayName} joined room: ${roomId}`);

      // Broadcast to room that member is online
      io.to(`room:${roomId}`).emit('room:member-status', {
        userId: user.id,
        roomId,
        status: 'On the Way',
        online: true,
      });
    });

    // Handle incoming real-time GPS location from mobile
    const socketLastUpdateMap = new Map<string, number>();

    socket.on('location:update', async (data: {
      roomId: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      speed?: number;
      heading?: number;
      timestamp?: number;
    }) => {
      const { roomId, latitude, longitude, accuracy, speed, heading, timestamp } = data;
      if (!roomId || typeof latitude !== 'number' || typeof longitude !== 'number') return;
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

      // Rate limit socket updates to max 1 per 600ms per user to avoid socket flooding
      const key = `${roomId}:${user.id}`;
      const now = Date.now();
      const last = socketLastUpdateMap.get(key);
      if (last && now - last < 600) return;
      socketLastUpdateMap.set(key, now);

      // Verify membership & sharing permissions
      let sharingEnabled = true;
      let displayName = user.displayName;
      let markerColor = '#D1956A';
      let status = 'On the Way';

      const supabase = getSupabase();
      if (supabase) {
        const { data: memberData } = await supabase
          .from('room_members')
          .select('*')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .single();

        if (!memberData || !memberData.location_sharing_enabled) {
          return;
        }
        displayName = memberData.display_name;
        markerColor = memberData.marker_color;
        status = memberData.status || 'On the Way';
      } else {
        const members = inMemoryMembers.get(roomId) || [];
        const member = members.find((m) => m.user_id === user.id);
        if (!member || !member.location_sharing_enabled) {
          return;
        }
        displayName = member.display_name;
        markerColor = member.marker_color;
        status = member.status || 'On the Way';
      }

      const locationRecord = {
        room_id: roomId,
        user_id: user.id,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        updated_at: new Date(timestamp || now).toISOString(),
      };

      inMemoryLocations.set(key, locationRecord);

      // Broadcast to all other devices in the travel room
      socket.to(`room:${roomId}`).emit('location:broadcast', {
        ...locationRecord,
        displayName,
        markerColor,
        status,
      });
    });

    // Leave room channel
    socket.on('room:leave', (data: { roomId: string }) => {
      const { roomId } = data;
      if (!roomId) return;

      socket.leave(`room:${roomId}`);
      io.to(`room:${roomId}`).emit('room:member-left', {
        userId: user.id,
        roomId,
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] User disconnected: ${user.displayName}`);
      if (user.currentRoomId) {
        io.to(`room:${user.currentRoomId}`).emit('room:member-status', {
          userId: user.id,
          roomId: user.currentRoomId,
          status: 'Offline',
          online: false,
        });
      }
    });
  });
}

