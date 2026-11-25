export type MemberStatus =
  | 'Not Started'
  | 'On the Way'
  | 'Moving'
  | 'Stopped'
  | 'Near Destination'
  | 'Arrived'
  | 'Offline';

export const USER_PALETTE: readonly string[] = [
  '#D1956A', // Terracotta
  '#4C78C9', // Blue
  '#419A77', // Green
  '#8B6BC1', // Purple
  '#E47776', // Coral
  '#329D9B', // Teal
  '#C39A43', // Mustard
  '#D36F9B', // Pink
  '#626DBA', // Indigo
  '#E58A47', // Orange
] as const;

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  phone?: string;
  created_at: string;
}

export interface Room {
  id: string;
  room_code: string;
  room_name: string;
  creator_id: string;
  destination_name: string;
  destination_latitude: number;
  destination_longitude: number;
  destination_address?: string;
  destination_place_id?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  ended_at?: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  marker_color: string;
  member_role: 'creator' | 'member';
  joined_at: string;
  location_sharing_enabled: boolean;
  status: MemberStatus;
  last_seen_at?: string;
  profile?: UserProfile;
}

export interface LiveLocation {
  id?: string;
  room_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  distance_to_dest_meters?: number;
  eta_seconds?: number;
  status?: MemberStatus;
  displayName?: string;
  markerColor?: string;
  updated_at: string;
  member?: RoomMember;
}

export interface MeetingPoint {
  id: string;
  room_id: string;
  place_id?: string;
  place_name: string;
  category?: string;
  latitude: number;
  longitude: number;
  address?: string;
  photo_url?: string;
  rating?: number;
  user_rating_count?: number;
  open_now?: boolean;
  open_status_text?: string;
  google_maps_uri?: string;
  distance_from_dest_meters?: number;
  driving_time_from_dest_seconds?: number;
  dest_route_polyline?: string;
  ranking_score: number;
  maximum_travel_time: number;
  total_travel_time: number;
  average_travel_time: number;
  is_confirmed: boolean;
  created_at: string;
  routes?: MeetingPointRoute[];
  votes_count?: number;
  has_voted?: boolean;
}

export interface MeetingPointRoute {
  id?: string;
  meeting_point_id: string;
  user_id: string;
  distance_meters: number;
  duration_seconds: number;
  polyline?: string;
  user_display_name?: string;
  marker_color?: string;
}

export interface Vote {
  id: string;
  room_id: string;
  meeting_point_id: string;
  user_id: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  room_id?: string;
  title: string;
  message: string;
  notification_type:
    | 'room:member-joined'
    | 'room:member-left'
    | 'location:sharing-changed'
    | 'location:sharing-disabled'
    | 'trip:arrived'
    | 'trip:stationary'
    | 'meeting:recommendations'
    | 'meeting:vote'
    | 'meeting:vote-completed'
    | 'meeting:confirmed'
    | 'meeting:reached'
    | 'room:destination-changed';
  data?: Record<string, any>;
  read_at?: string;
  created_at: string;
}

// Geospatial & Optimization Types
export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface ParticipantStartPoint {
  userId: string;
  displayName: string;
  markerColor: string;
  latitude: number;
  longitude: number;
}

export interface CandidatePlace {
  placeId: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  rating?: number;
  userRatingCount?: number;
  openNow?: boolean;
  openStatusText?: string;
  googleMapsUri?: string;
  primaryType?: string;
  photoUrl?: string;
  distanceFromDestMeters?: number;
  drivingTimeFromDestSeconds?: number;
  destRoutePolyline?: string;
}

export interface ParticipantRouteInfo {
  userId: string;
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
}

export interface ScoredMeetingPointCandidate {
  candidate: CandidatePlace;
  routes: ParticipantRouteInfo[];
  maxTravelTimeSeconds: number;
  totalTravelTimeSeconds: number;
  avgTravelTimeSeconds: number;
  rankingScore: number;
}

export interface DiscoverParticipantInput {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  markerColor?: string;
}

export interface FairDestinationArea {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  maxTravelTimeSeconds: number;
  totalTravelTimeSeconds: number;
  avgTravelTimeSeconds: number;
  timeSpreadSeconds: number;
  participantRoutes: {
    userId: string;
    userName: string;
    markerColor: string;
    distanceMeters: number;
    durationSeconds: number;
  }[];
}

export interface FairMeetingVenue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
  category: string;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  openNow?: boolean;
  openStatusText?: string;
  googleMapsUri?: string;
  maxTravelTimeSeconds: number;
  totalTravelTimeSeconds: number;
  avgTravelTimeSeconds: number;
  timeSpreadSeconds: number;
  rankingScore: number;
  participantRoutes: {
    userId: string;
    userName: string;
    markerColor: string;
    distanceMeters: number;
    durationSeconds: number;
    polyline?: string;
  }[];
}

