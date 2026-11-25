import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { Room, RoomMember, LiveLocation, MeetingPoint } from '../types';

export const DEMO_ROOM: Room = {
  id: 'demo_room_hyderabad',
  room_code: 'BUDI26',
  room_name: 'Hyderabad Weekend Trip',
  creator_id: 'user_aarav',
  destination_name: 'Tank Bund / Hussain Sagar',
  destination_address: 'Hussain Sagar Promenade, Hyderabad, Telangana 500004',
  destination_latitude: 17.4239,
  destination_longitude: 78.4738,
  destination_place_id: 'ChIJa5sujFWXyzsRnU6EzGNTcCU',
  status: 'active',
  created_at: new Date().toISOString(),
};

export const DEMO_MEMBERS: RoomMember[] = [
  {
    id: 'rm_1',
    room_id: 'demo_room_hyderabad',
    user_id: 'user_aarav',
    display_name: 'Aarav Sharma',
    marker_color: '#D1956A', // Terracotta (Host)
    member_role: 'creator',
    joined_at: new Date().toISOString(),
    location_sharing_enabled: true,
    status: 'On the Way',
    distance_to_dest_meters: 2400,
    eta_seconds: 420,
  },
  {
    id: 'rm_2',
    room_id: 'demo_room_hyderabad',
    user_id: 'user_diya',
    display_name: 'Diya Patel',
    marker_color: '#2EC4B6', // Mint Teal
    member_role: 'member',
    joined_at: new Date().toISOString(),
    location_sharing_enabled: true,
    status: 'On the Way',
    distance_to_dest_meters: 5100,
    eta_seconds: 780,
  },
  {
    id: 'rm_3',
    room_id: 'demo_room_hyderabad',
    user_id: 'user_rohan',
    display_name: 'Rohan Verma',
    marker_color: '#3A86FF', // Ocean Blue
    member_role: 'member',
    joined_at: new Date().toISOString(),
    location_sharing_enabled: true,
    status: 'Arrived',
    distance_to_dest_meters: 80,
    eta_seconds: 0,
  },
];

export const DEMO_LOCATIONS: Map<string, LiveLocation> = new Map<string, LiveLocation>([
  [
    'user_aarav',
    {
      room_id: 'demo_room_hyderabad',
      user_id: 'user_aarav',
      latitude: 17.4085,
      longitude: 78.4730,
      accuracy: 5,
      speed: 8.5,
      heading: 45,
      distance_to_dest_meters: 2400,
      eta_seconds: 420,
      status: 'On the Way',
      displayName: 'Aarav Sharma',
      markerColor: '#D1956A',
      updated_at: new Date().toISOString(),
    },
  ],
  [
    'user_diya',
    {
      room_id: 'demo_room_hyderabad',
      user_id: 'user_diya',
      latitude: 17.3850,
      longitude: 78.4867,
      accuracy: 8,
      speed: 12.2,
      heading: 320,
      distance_to_dest_meters: 5100,
      eta_seconds: 780,
      status: 'On the Way',
      displayName: 'Diya Patel',
      markerColor: '#2EC4B6',
      updated_at: new Date().toISOString(),
    },
  ],
  [
    'user_rohan',
    {
      room_id: 'demo_room_hyderabad',
      user_id: 'user_rohan',
      latitude: 17.4245,
      longitude: 78.4740,
      accuracy: 3,
      speed: 0,
      heading: 0,
      distance_to_dest_meters: 80,
      eta_seconds: 0,
      status: 'Arrived',
      displayName: 'Rohan Verma',
      markerColor: '#3A86FF',
      updated_at: new Date().toISOString(),
    },
  ],
]);

export const DEMO_MEETING_POINT: MeetingPoint = {
  id: 'mp_demo_1',
  room_id: 'demo_room_hyderabad',
  place_name: 'Eat Street Promenade',
  address: 'Necklace Road, Hussain Sagar, Hyderabad',
  category: 'Promenade / Food Court',
  latitude: 17.4265,
  longitude: 78.4720,
  ranking_score: 9.4,
  maximum_travel_time: 780,
  total_travel_time: 1200,
  average_travel_time: 400,
  is_confirmed: true,
  created_at: new Date().toISOString(),
};

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [locations, setLocations] = useState<Map<string, LiveLocation>>(new Map());
  const [confirmedMeetingPoint, setConfirmedMeetingPoint] = useState<MeetingPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoomData = useCallback(async () => {
    let targetId = roomId;

    try {
      setIsLoading(true);
      setError(null);

      // If no valid id or default 'room' route, attempt to get active user's latest trip
      if (!targetId || targetId === 'room' || targetId === 'demo') {
        const tripsRes = await api.getMyTrips().catch(() => ({ trips: [] }));
        if (tripsRes.trips && tripsRes.trips.length > 0) {
          targetId = tripsRes.trips[0].id;
        } else {
          // Fallback to active demo travel room
          setRoom(DEMO_ROOM);
          setMembers(DEMO_MEMBERS);
          setLocations(new Map(DEMO_LOCATIONS));
          setConfirmedMeetingPoint(DEMO_MEETING_POINT);
          setIsLoading(false);
          return;
        }
      }

      // Primary fetch: Room details
      const roomRes = await api.getRoom(targetId);
      if (roomRes.success && roomRes.room) {
        setRoom(roomRes.room);
        if (roomRes.room.room_members) {
          setMembers(roomRes.room.room_members);
        }
      } else {
        // Fallback to demo room if room not found in DB
        setRoom(DEMO_ROOM);
        setMembers(DEMO_MEMBERS);
        setLocations(new Map(DEMO_LOCATIONS));
        setConfirmedMeetingPoint(DEMO_MEETING_POINT);
        setIsLoading(false);
        return;
      }

      // Secondary fetches in parallel with graceful fallbacks
      const [membersResult, locsResult, mpsResult] = await Promise.allSettled([
        api.getRoomMembers(targetId),
        api.getRoomLocations(targetId),
        api.getMeetingPoints(targetId),
      ]);

      if (membersResult.status === 'fulfilled' && membersResult.value?.members) {
        setMembers(membersResult.value.members);
      }

      if (locsResult.status === 'fulfilled' && locsResult.value?.locations) {
        const locMap = new Map<string, LiveLocation>();
        for (const loc of locsResult.value.locations) {
          locMap.set(loc.user_id, loc);
        }
        setLocations(locMap);
      }

      if (mpsResult.status === 'fulfilled' && mpsResult.value?.meetingPoints) {
        const confirmed = mpsResult.value.meetingPoints.find((mp) => mp.is_confirmed);
        if (confirmed) {
          setConfirmedMeetingPoint(confirmed);
        }
      }
    } catch (err: any) {
      console.warn('[useRoom] Error loading room, using resilient demo travel room:', err);
      // Graceful demo fallback on network/auth error
      setRoom(DEMO_ROOM);
      setMembers(DEMO_MEMBERS);
      setLocations(new Map(DEMO_LOCATIONS));
      setConfirmedMeetingPoint(DEMO_MEETING_POINT);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);

  // Connect to Socket.IO and listen for realtime updates
  useEffect(() => {
    if (!roomId) return;
    const currentRoomId = roomId;

    let isMounted = true;

    async function initSocket() {
      await socketService.connect();
      socketService.joinRoom(currentRoomId);

      // 1. Live location broadcast from other buddies
      socketService.on('location:broadcast', (data: LiveLocation & { displayName?: string; markerColor?: string }) => {
        if (!isMounted) return;
        setLocations((prev) => {
          const updated = new Map(prev);
          updated.set(data.user_id, data);
          return updated;
        });

        // Also update member status in member list
        if (data.status) {
          setMembers((prev) =>
            prev.map((m) =>
              m.user_id === data.user_id
                ? {
                    ...m,
                    status: data.status!,
                    distance_to_dest_meters: data.distance_to_dest_meters,
                    eta_seconds: data.eta_seconds,
                  }
                : m
            )
          );
        }
      });

      // 2. Member joined
      socketService.on('room:member-joined', (newMember: RoomMember) => {
        if (!isMounted) return;
        setMembers((prev) => {
          if (prev.some((m) => m.id === newMember.id)) return prev;
          return [...prev, newMember];
        });
      });

      // 3. Member left
      socketService.on('room:member-left', (data: { userId: string }) => {
        if (!isMounted) return;
        setMembers((prev) => prev.filter((m) => m.user_id !== data.userId));
        setLocations((prev) => {
          const updated = new Map(prev);
          updated.delete(data.userId);
          return updated;
        });
      });

      // 4. Destination changed
      socketService.on('room:destination-changed', (updatedRoom: Room) => {
        if (!isMounted) return;
        setRoom(updatedRoom);
      });

      // 5. Confirmed meeting point
      socketService.on('meeting:confirmed', (mp: MeetingPoint) => {
        if (!isMounted) return;
        setConfirmedMeetingPoint(mp);
      });

      // 6. Member sharing status changed
      socketService.on('location:sharing-changed', (data: { userId: string; enabled: boolean }) => {
        if (!isMounted) return;
        setMembers((prev) =>
          prev.map((m) =>
            m.user_id === data.userId ? { ...m, location_sharing_enabled: data.enabled } : m
          )
        );
        if (!data.enabled) {
          setLocations((prev) => {
            const updated = new Map(prev);
            updated.delete(data.userId);
            return updated;
          });
        }
      });
    }

    initSocket();

    return () => {
      isMounted = false;
      socketService.leaveRoom(roomId);
      socketService.off('location:broadcast');
      socketService.off('room:member-joined');
      socketService.off('room:member-left');
      socketService.off('room:destination-changed');
      socketService.off('meeting:confirmed');
      socketService.off('location:sharing-changed');
    };
  }, [roomId]);

  return {
    room,
    members,
    locations,
    confirmedMeetingPoint,
    isLoading,
    error,
    refreshRoom: fetchRoomData,
  };
}

