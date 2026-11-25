import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { decodePolyline } from '../utils/polyline';
import { LiveLocation, Room } from '../types';
import { LocationService } from '../services/location';

export interface MemberRouteData {
  userId: string;
  coordinates: { latitude: number; longitude: number }[];
  distanceMeters: number;
  durationSeconds: number;
  markerColor: string;
  isCurrentUser: boolean;
}

export function useRoomRoutes(
  room: Room | null,
  locations: Map<string, LiveLocation>,
  currentUserId?: string
) {
  const [routes, setRoutes] = useState<Map<string, MemberRouteData>>(new Map());
  const lastFetchedLocRef = useRef<Map<string, { lat: number; lon: number }>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!room || !room.destination_latitude || !room.destination_longitude) return;

    const dest = {
      latitude: room.destination_latitude,
      longitude: room.destination_longitude,
    };

    locations.forEach(async (loc, userId) => {
      // Don't calculate if user sharing is paused or no coordinates
      if (!loc.latitude || !loc.longitude) return;

      const last = lastFetchedLocRef.current.get(userId);
      const currentPt = { latitude: loc.latitude, longitude: loc.longitude };

      // Check if route already exists and user hasn't moved significantly (> 120 meters)
      if (last) {
        const movedDist = LocationService.calculateDistance(currentPt, {
          latitude: last.lat,
          longitude: last.lon,
        });
        if (movedDist < 120) {
          return;
        }
      }

      // Avoid duplicate concurrent in-flight requests for same user
      if (inFlightRef.current.has(userId)) return;
      inFlightRef.current.add(userId);

      try {
        const res = await api.calculateRoute(currentPt, dest, 'DRIVE');
        let polyPoints: { latitude: number; longitude: number }[] = [];

        if (res.route?.encodedPolyline) {
          polyPoints = decodePolyline(res.route.encodedPolyline);
        }

        // Fallback to straight line if decoding produced empty
        if (polyPoints.length === 0) {
          polyPoints = [currentPt, dest];
        }

        lastFetchedLocRef.current.set(userId, { lat: loc.latitude, lon: loc.longitude });

        setRoutes((prev) => {
          const updated = new Map(prev);
          updated.set(userId, {
            userId,
            coordinates: polyPoints,
            distanceMeters: res.route?.distanceMeters || loc.distance_to_dest_meters || 0,
            durationSeconds: res.route?.durationSeconds || loc.eta_seconds || 0,
            markerColor: loc.markerColor || '#D1956A',
            isCurrentUser: userId === currentUserId,
          });
          return updated;
        });
      } catch (err) {
        // Fallback gracefully on quota or network error
        const fallbackCoords = [currentPt, dest];
        setRoutes((prev) => {
          const updated = new Map(prev);
          updated.set(userId, {
            userId,
            coordinates: fallbackCoords,
            distanceMeters: loc.distance_to_dest_meters || 0,
            durationSeconds: loc.eta_seconds || 0,
            markerColor: loc.markerColor || '#D1956A',
            isCurrentUser: userId === currentUserId,
          });
          return updated;
        });
      } finally {
        inFlightRef.current.delete(userId);
      }
    });
  }, [room, locations, currentUserId]);

  return routes;
}

