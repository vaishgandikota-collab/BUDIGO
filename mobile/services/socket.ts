import { io, Socket } from 'socket.io-client';
import { Config } from '../constants/config';
import { api } from './api';

class SocketService {
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;

  async connect(): Promise<Socket> {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = await api.initToken();

    this.socket = io(Config.SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    this.socket.on('connect', () => {
      console.log('[Budigo Socket] Connected to realtime server with ID:', this.socket?.id);
      if (this.currentRoomId) {
        this.joinRoom(this.currentRoomId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Budigo Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[Budigo Socket] Connection error:', error.message);
    });

    return this.socket;
  }

  joinRoom(roomId: string) {
    this.currentRoomId = roomId;
    if (this.socket?.connected) {
      this.socket.emit('room:join', { roomId });
    }
  }

  leaveRoom(roomId: string) {
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
    }
    if (this.socket?.connected) {
      this.socket.emit('room:leave', { roomId });
    }
  }

  sendLocationUpdate(params: {
    roomId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  }) {
    if (this.socket?.connected) {
      this.socket.emit('location:update', params);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentRoomId = null;
  }
}

export const socketService = new SocketService();

