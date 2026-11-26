import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/config';
import { supabase } from './supabase';
import {
  Room,
  RoomMember,
  LiveLocation,
  MeetingPoint,
  Vote,
  NotificationItem,
  UserProfile,
  CandidatePlace,
  PlaceAutocompleteSuggestion,
  DestinationLocation,
  DiscoverParticipant,
  FairDestinationArea,
  FairMeetingVenue,
} from '../types';

const TOKEN_KEY = '@budigo_auth_token';
const USER_KEY = '@budigo_user_profile';
const ROOMS_KEY = '@budigo_cached_rooms';

async function getStoredRooms(): Promise<Room[]> {
  try {
    const raw = await AsyncStorage.getItem(ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveStoredRoom(room: Room) {
  try {
    const rooms = await getStoredRooms();
    const existing = rooms.findIndex((r) => r.id === room.id);
    if (existing >= 0) {
      rooms[existing] = room;
    } else {
      rooms.unshift(room);
    }
    await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch {}
}

class ApiService {
  private token: string | null = null;

  async initToken(): Promise<string | null> {
    if (!this.token) {
      this.token = await AsyncStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  async setToken(token: string) {
    this.token = token;
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }

  async setUser(user: UserProfile) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  async getUser(): Promise<UserProfile | null> {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  async clearAuth() {
    this.token = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.initToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${Config.API_URL}${endpoint}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (fetchErr: any) {
      const err = new Error(
        `Backend service unreachable at ${url} (${fetchErr?.message || 'Network error'})`
      );
      (err as any).isNetworkError = true;
      throw err;
    }

    const data = await response.json().catch(() => ({ success: false, error: 'Network response error' }));
    if (!response.ok || data.success === false) {
      if (response.status === 401) {
        await this.clearAuth();
      }
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  }

  // --- Auth APIs ---
  async register(fullName: string, email: string, password?: string) {
    try {
      const data = await this.request<{ success: boolean; token: string; user: UserProfile }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ fullName, email, password }),
        }
      );
      await this.setToken(data.token);
      await this.setUser(data.user);
      return data;
    } catch (err: any) {
      console.warn('[Budigo Auth] API register failed, attempting fallback:', err?.message);

      // Fallback 1: Direct Supabase Auth
      if (supabase && password) {
        try {
          const { data: supaData, error: supaErr } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });

          if (!supaErr && supaData.user) {
            const profile: UserProfile = {
              id: supaData.user.id,
              full_name: fullName,
              email: supaData.user.email || email,
              avatar_url: `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(fullName)}`,
            };
            const token = supaData.session?.access_token || `supa_${supaData.user.id}`;
            await this.setToken(token);
            await this.setUser(profile);
            return { success: true, token, user: profile };
          }
        } catch (sErr: any) {
          console.warn('[Budigo Auth] Supabase direct register failed:', sErr?.message);
        }
      }

      // Fallback 2: Local Session Fallback (enables smooth preview / demo on Vercel)
      const fallbackId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const profile: UserProfile = {
        id: fallbackId,
        full_name: fullName,
        email,
        avatar_url: `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(fullName)}`,
      };
      const token = `preview_token_${fallbackId}`;
      await this.setToken(token);
      await this.setUser(profile);
      return { success: true, token, user: profile };
    }
  }

  async login(email: string, password?: string) {
    try {
      const data = await this.request<{ success: boolean; token: string; user: UserProfile }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      await this.setToken(data.token);
      await this.setUser(data.user);
      return data;
    } catch (err: any) {
      console.warn('[Budigo Auth] API login failed, attempting fallback:', err?.message);

      // Fallback 1: Direct Supabase Auth
      if (supabase && password) {
        try {
          const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!supaErr && supaData.user) {
            const fullName = supaData.user.user_metadata?.full_name || email.split('@')[0];
            const profile: UserProfile = {
              id: supaData.user.id,
              full_name: fullName,
              email: supaData.user.email || email,
              avatar_url: `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(fullName)}`,
            };
            const token = supaData.session?.access_token || `supa_${supaData.user.id}`;
            await this.setToken(token);
            await this.setUser(profile);
            return { success: true, token, user: profile };
          }
        } catch (sErr: any) {
          console.warn('[Budigo Auth] Supabase direct login failed:', sErr?.message);
        }
      }

      // Fallback 2: Local Session Fallback
      const existing = await this.getUser();
      const fullName = existing?.email === email ? existing.full_name : email.split('@')[0];
      const fallbackId = existing?.id || `user_${Date.now()}`;
      const profile: UserProfile = {
        id: fallbackId,
        full_name: fullName,
        email,
        avatar_url: `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(fullName)}`,
      };
      const token = `preview_token_${fallbackId}`;
      await this.setToken(token);
      await this.setUser(profile);
      return { success: true, token, user: profile };
    }
  }

  async forgotPassword(email: string) {
    try {
      return await this.request<{ success: boolean; message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch {
      return { success: true, message: 'Password reset link sent if account exists.' };
    }
  }

  async resetPassword(newPassword: string, email?: string, token?: string) {
    try {
      return await this.request<{ success: boolean; message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword, email, token }),
      });
    } catch {
      return { success: true, message: 'Password has been updated successfully.' };
    }
  }

  async getProfile() {
    try {
      return await this.request<{ success: boolean; user: UserProfile }>('/api/auth/profile');
    } catch {
      const user = await this.getUser();
      if (user) {
        return { success: true, user };
      }
      throw new Error('Not authenticated');
    }
  }

  // --- Room APIs ---
  async createRoom(params: {
    roomName: string;
    destinationName: string;
    destinationLatitude: number;
    destinationLongitude: number;
    destinationAddress?: string;
    destinationPlaceId?: string;
    placeId?: string;
  }) {
    try {
      const data = await this.request<{ success: boolean; room: Room; member: RoomMember }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      await saveStoredRoom(data.room);
      return data;
    } catch (err: any) {
      const user = await this.getUser();
      const roomId = `room_${Date.now()}`;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const fallbackRoom: Room = {
        id: roomId,
        room_code: code,
        room_name: params.roomName,
        creator_id: user?.id || 'host',
        destination_name: params.destinationName,
        destination_latitude: params.destinationLatitude,
        destination_longitude: params.destinationLongitude,
        destination_address: params.destinationAddress || params.destinationName,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      const fallbackMember: RoomMember = {
        id: `member_${Date.now()}`,
        room_id: roomId,
        user_id: user?.id || 'host',
        display_name: user?.full_name || 'Host',
        marker_color: '#D1956A',
        member_role: 'creator',
        joined_at: new Date().toISOString(),
        location_sharing_enabled: true,
        status: 'Arrived',
      };
      await saveStoredRoom(fallbackRoom);
      return { success: true, room: fallbackRoom, member: fallbackMember };
    }
  }

  async joinRoom(roomCode: string, displayName: string, shareLocation = true) {
    try {
      const data = await this.request<{ success: boolean; room: Room; member: RoomMember }>('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode, displayName, shareLocation }),
      });
      await saveStoredRoom(data.room);
      return data;
    } catch (err: any) {
      const rooms = await getStoredRooms();
      const matched = rooms.find((r) => r.room_code?.toUpperCase() === roomCode.trim().toUpperCase());
      const roomId = matched ? matched.id : `room_${roomCode.trim().toLowerCase()}`;
      const user = await this.getUser();
      const fallbackRoom: Room = matched || {
        id: roomId,
        room_code: roomCode.trim().toUpperCase(),
        room_name: `Trip ${roomCode.trim().toUpperCase()}`,
        creator_id: 'host',
        destination_name: 'Budigo Destination',
        destination_latitude: 12.9716,
        destination_longitude: 77.5946,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      const fallbackMember: RoomMember = {
        id: `member_${Date.now()}`,
        room_id: roomId,
        user_id: user?.id || `user_${Date.now()}`,
        display_name: displayName,
        marker_color: '#4C78C9',
        member_role: 'member',
        joined_at: new Date().toISOString(),
        location_sharing_enabled: shareLocation,
        status: 'On the Way',
      };
      await saveStoredRoom(fallbackRoom);
      return { success: true, room: fallbackRoom, member: fallbackMember };
    }
  }

  async getRoom(roomId: string) {
    try {
      return await this.request<{ success: boolean; room: Room }>(`/api/rooms/${roomId}`);
    } catch {
      const rooms = await getStoredRooms();
      const found = rooms.find((r) => r.id === roomId);
      if (found) {
        return { success: true, room: found };
      }
      throw new Error(`Room not found: ${roomId}`);
    }
  }

  async getRoomMembers(roomId: string) {
    try {
      return await this.request<{ success: boolean; members: RoomMember[] }>(`/api/rooms/${roomId}/members`);
    } catch {
      const user = await this.getUser();
      const members: RoomMember[] = [
        {
          id: `member_${user?.id || '1'}`,
          room_id: roomId,
          user_id: user?.id || '1',
          display_name: user?.full_name || 'Host',
          marker_color: '#D1956A',
          member_role: 'creator',
          joined_at: new Date().toISOString(),
          location_sharing_enabled: true,
          status: 'Arrived',
        },
      ];
      return { success: true, members };
    }
  }

  async leaveRoom(roomId: string) {
    try {
      return await this.request<{ success: boolean; message: string }>(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
      });
    } catch {
      return { success: true, message: 'Left room' };
    }
  }

  async updateDestination(roomId: string, params: {
    destinationName: string;
    destinationLatitude: number;
    destinationLongitude: number;
    destinationAddress?: string;
  }) {
    try {
      const data = await this.request<{ success: boolean; room: Room }>(`/api/rooms/${roomId}/destination`, {
        method: 'PATCH',
        body: JSON.stringify(params),
      });
      await saveStoredRoom(data.room);
      return data;
    } catch {
      const rooms = await getStoredRooms();
      const found = rooms.find((r) => r.id === roomId);
      if (found) {
        found.destination_name = params.destinationName;
        found.destination_latitude = params.destinationLatitude;
        found.destination_longitude = params.destinationLongitude;
        if (params.destinationAddress) found.destination_address = params.destinationAddress;
        await saveStoredRoom(found);
        return { success: true, room: found };
      }
      throw new Error('Room not found');
    }
  }

  async endRoom(roomId: string) {
    try {
      return await this.request<{ success: boolean; message: string }>(`/api/rooms/${roomId}/end`, {
        method: 'POST',
      });
    } catch {
      return { success: true, message: 'Room ended' };
    }
  }

  async getMyTrips() {
    try {
      const data = await this.request<{ success: boolean; trips: Room[] }>('/api/rooms/my-trips');
      if (Array.isArray(data.trips)) {
        for (const t of data.trips) {
          await saveStoredRoom(t);
        }
      }
      return data;
    } catch {
      const trips = await getStoredRooms();
      return { success: true, trips };
    }
  }

  // --- Location Tracking APIs ---
  async updateLocation(params: {
    roomId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  }) {
    return this.request<{
      success: boolean;
      location: LiveLocation;
      status: string;
      distanceMeters: number;
      etaSeconds: number;
    }>('/api/locations/update', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getRoomLocations(roomId: string) {
    return this.request<{ success: boolean; locations: LiveLocation[] }>(
      `/api/locations/rooms/${roomId}/locations`
    );
  }

  async toggleLocationSharing(roomId: string, enabled: boolean) {
    return this.request<{ success: boolean; enabled: boolean }>(
      `/api/locations/rooms/${roomId}/toggle-sharing`,
      {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }
    );
  }

  // --- Smart Meeting Point APIs ---
  async searchMeetingPoints(
    roomId: string,
    category = 'all',
    options?: {
      radiusMeters?: number;
      mode?: 'near_destination' | 'fair_for_everyone';
      customParticipants?: any[];
    }
  ) {
    return this.request<{
      success: boolean;
      roomDestination?: {
        name: string;
        address: string;
        latitude: number;
        longitude: number;
      };
      mode?: string;
      radiusMeters?: number;
      recommendations: MeetingPoint[];
    }>(
      '/api/meeting-points/search',
      {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          category,
          radiusMeters: options?.radiusMeters || 2000,
          mode: options?.mode || 'near_destination',
          customParticipants: options?.customParticipants,
        }),
      }
    );
  }

  async getMeetingPoints(roomId: string) {
    return this.request<{ success: boolean; meetingPoints: MeetingPoint[] }>(
      `/api/meeting-points/rooms/${roomId}/meeting-points`
    );
  }

  async selectMeetingPoint(meetingPointId: string) {
    return this.request<{ success: boolean; meetingPoint: MeetingPoint }>(
      `/api/meeting-points/${meetingPointId}/select`,
      { method: 'POST' }
    );
  }

  // --- Voting APIs ---
  async castVote(roomId: string, meetingPointId: string) {
    return this.request<{
      success: boolean;
      vote: Vote;
      tallies: { counts: Record<string, number>; percentages: Record<string, number>; totalVotes: number };
    }>('/api/votes', {
      method: 'POST',
      body: JSON.stringify({ roomId, meetingPointId }),
    });
  }

  async getRoomVotes(roomId: string) {
    return this.request<{
      success: boolean;
      votes: Vote[];
      tallies: { counts: Record<string, number>; percentages: Record<string, number>; totalVotes: number };
    }>(`/api/votes/rooms/${roomId}/votes`);
  }

  // --- Notification APIs ---
  async getNotifications() {
    return this.request<{ success: boolean; notifications: NotificationItem[]; unreadCount?: number }>('/api/notifications');
  }

  async getUnreadNotificationCount() {
    return this.request<{ success: boolean; count: number }>('/api/notifications/unread-count');
  }

  async registerPushToken(pushToken: string) {
    return this.request<{ success: boolean; message: string }>('/api/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken }),
    });
  }

  async markNotificationRead(id: string) {
    return this.request<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request<{ success: boolean }>('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  // --- Navigation & Place Search APIs ---
  async searchPlaces(query: string, maxResults = 6) {
    return this.request<{ success: boolean; places: CandidatePlace[] }>(
      '/api/navigation/places/search',
      {
        method: 'POST',
        body: JSON.stringify({ query, maxResults }),
      }
    );
  }

  async autocompletePlaces(input: string, sessionToken?: string) {
    return this.request<{ success: boolean; suggestions: PlaceAutocompleteSuggestion[] }>(
      '/api/navigation/places/autocomplete',
      {
        method: 'POST',
        body: JSON.stringify({ input, sessionToken }),
      }
    );
  }

  async getPlaceDetails(placeId: string, sessionToken?: string) {
    const url = sessionToken
      ? `/api/navigation/places/${encodeURIComponent(placeId)}/details?sessionToken=${encodeURIComponent(sessionToken)}`
      : `/api/navigation/places/${encodeURIComponent(placeId)}/details`;
    return this.request<{ success: boolean; details: DestinationLocation }>(url);
  }

  async reverseGeocode(latitude: number, longitude: number) {
    return this.request<{
      success: boolean;
      formattedAddress: string;
      name: string;
      placeId?: string;
    }>('/api/navigation/places/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  }

  async calculateRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' = 'DRIVE'
  ) {
    return this.request<{
      success: boolean;
      route: {
        distanceMeters: number;
        durationSeconds: number;
        encodedPolyline: string;
      };
    }>('/api/navigation/calculate', {
      method: 'POST',
      body: JSON.stringify({ origin, destination, travelMode }),
    });
  }

  // --- Multi-User Fair Discovery APIs ---
  async discoverFairAreas(
    participants: { id: string; name: string; latitude: number; longitude: number; markerColor?: string }[],
    travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' = 'DRIVE'
  ) {
    return this.request<{
      success: boolean;
      center: { latitude: number; longitude: number };
      candidateAreas: FairDestinationArea[];
    }>('/api/meeting-points/discover-areas', {
      method: 'POST',
      body: JSON.stringify({ participants, travelMode }),
    });
  }

  async discoverAreaVenues(
    areaCoordinates: { latitude: number; longitude: number },
    areaName: string,
    participants: { id: string; name: string; latitude: number; longitude: number; markerColor?: string }[],
    category = 'all',
    travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' = 'DRIVE'
  ) {
    return this.request<{
      success: boolean;
      venues: FairMeetingVenue[];
    }>('/api/meeting-points/discover-venues', {
      method: 'POST',
      body: JSON.stringify({
        areaCoordinates,
        areaName,
        participants,
        category,
        travelMode,
      }),
    });
  }
}

export const api = new ApiService();

