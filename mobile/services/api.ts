import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/config';
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
    const response = await fetch(url, {
      ...options,
      headers,
    });

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
  }

  async login(email: string, password?: string) {
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
  }

  async forgotPassword(email: string) {
    return this.request<{ success: boolean; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(newPassword: string, email?: string, token?: string) {
    return this.request<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword, email, token }),
    });
  }

  async getProfile() {
    return this.request<{ success: boolean; user: UserProfile }>('/api/auth/profile');
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
    return this.request<{ success: boolean; room: Room; member: RoomMember }>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async joinRoom(roomCode: string, displayName: string, shareLocation = true) {
    return this.request<{ success: boolean; room: Room; member: RoomMember }>('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode, displayName, shareLocation }),
    });
  }

  async getRoom(roomId: string) {
    return this.request<{ success: boolean; room: Room }>(`/api/rooms/${roomId}`);
  }

  async getRoomMembers(roomId: string) {
    return this.request<{ success: boolean; members: RoomMember[] }>(`/api/rooms/${roomId}/members`);
  }

  async leaveRoom(roomId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/rooms/${roomId}/leave`, {
      method: 'POST',
    });
  }

  async updateDestination(roomId: string, params: {
    destinationName: string;
    destinationLatitude: number;
    destinationLongitude: number;
    destinationAddress?: string;
  }) {
    return this.request<{ success: boolean; room: Room }>(`/api/rooms/${roomId}/destination`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  }

  async endRoom(roomId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/rooms/${roomId}/end`, {
      method: 'POST',
    });
  }

  async getMyTrips() {
    return this.request<{ success: boolean; trips: Room[] }>('/api/rooms/my-trips');
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

  // --- Route Navigation APIs ---
  async calculateRoute(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }, travelMode = 'DRIVE') {
    return this.request<{
      success: boolean;
      route: { distanceMeters: number; durationSeconds: number; encodedPolyline: string };
    }>('/api/routes/calculate', {
      method: 'POST',
      body: JSON.stringify({ origin, destination, travelMode }),
    });
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

