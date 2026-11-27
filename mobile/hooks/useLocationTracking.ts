import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationService, LocationSubscription, GPSLocationPoint } from '../services/location';
import { api } from '../services/api';
import { socketService } from '../services/socket';

export type TrackingState = 'active' | 'paused' | 'unavailable' | 'stale';

export function useLocationTracking(roomId: string | undefined, active = true) {
  const [isSharing, setIsSharing] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [trackingState, setTrackingState] = useState<TrackingState>('active');
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentTelemetry, setCurrentTelemetry] = useState<GPSLocationPoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<LocationSubscription | null>(null);
  const lastDispatchedRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const isStationaryRef = useRef<boolean>(false);

  // Broadcast function with movement threshold check
  const dispatchLocation = useCallback(
    async (loc: GPSLocationPoint) => {
      if (!roomId || !isSharing) return;

      const now = Date.now();
      const last = lastDispatchedRef.current;
      let computedSpeed = loc.speed;

      if (last) {
        const dist = LocationService.calculateDistance(
          { latitude: loc.latitude, longitude: loc.longitude },
          { latitude: last.lat, longitude: last.lon }
        );

        const elapsedMs = now - last.time;
        if ((computedSpeed === null || computedSpeed === undefined) && elapsedMs > 1000) {
          computedSpeed = dist / (elapsedMs / 1000);
        }

        // Stationary check: moved < 8 meters and speed < 1 m/s
        const isStationary = dist < 8 && (computedSpeed === null || computedSpeed < 1.0);
        isStationaryRef.current = isStationary;

        // If stationary, only transmit once every 45 seconds to conserve battery
        if (isStationary && elapsedMs < 45000) {
          return;
        }

        // If moving, throttle to max 1 update per 3.5 seconds
        if (!isStationary && elapsedMs < 3500) {
          return;
        }
      }

      const enrichedLoc: GPSLocationPoint = {
        ...loc,
        speed: computedSpeed ?? 0,
      };

      lastDispatchedRef.current = { lat: loc.latitude, lon: loc.longitude, time: now };
      setCurrentCoords({ latitude: loc.latitude, longitude: loc.longitude });
      setCurrentTelemetry(enrichedLoc);
      setTrackingState('active');

      const payload = {
        roomId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy ?? undefined,
        speed: enrichedLoc.speed ?? undefined,
        heading: loc.heading ?? undefined,
        timestamp: loc.timestamp,
      };

      // 1. Socket.IO low latency peer distribution
      socketService.sendLocationUpdate(payload);

      // 2. Persist to REST / PostgreSQL and read back computed distance/ETA
      try {
        const res = await api.updateLocation(payload);
        // Feed the server-computed distance & ETA back into local telemetry
        if (res && (res.distanceMeters !== undefined || res.etaSeconds !== undefined)) {
          setCurrentTelemetry((prev) => prev ? {
            ...prev,
            distance_to_dest_meters: res.distanceMeters,
            eta_seconds: res.etaSeconds,
            status: res.status,
          } as any : prev);
        }
      } catch (err) {
        console.warn('[useLocationTracking] REST update error:', err);
      }
    },
    [roomId, isSharing]
  );

  useEffect(() => {
    let isMounted = true;

    async function initTracking() {
      if (!roomId || !active) {
        setTrackingState('paused');
        return;
      }

      if (!isSharing) {
        setTrackingState('paused');
        if (subscriptionRef.current) {
          subscriptionRef.current.remove();
          subscriptionRef.current = null;
        }
        return;
      }

      try {
        const granted = await LocationService.requestForegroundPermission();
        if (!isMounted) return;
        setHasPermission(granted);

        if (!granted) {
          setTrackingState('unavailable');
          setError('Location permission denied. Enable in device settings to share live GPS.');
          return;
        }

        // 1. Warm-up instant fix from last-known GPS cache
        const lastKnown = await LocationService.getLastKnownLocation();
        if (isMounted && lastKnown) {
          setCurrentCoords({ latitude: lastKnown.latitude, longitude: lastKnown.longitude });
          setCurrentTelemetry(lastKnown);
        }

        // 2. Immediate fresh GPS fix
        const initialLoc = await LocationService.getCurrentLocation();
        if (!isMounted) return;
        await dispatchLocation(initialLoc);

        // 3. Start high-frequency adaptive watch
        subscriptionRef.current = await LocationService.watchLocation(
          (loc) => {
            if (!isMounted) return;
            dispatchLocation(loc);
          },
          {
            distanceInterval: 10, // 10 meters adaptive movement
            timeInterval: 4000,   // 4 seconds interval
          }
        );
      } catch (err: any) {
        if (isMounted) {
          setTrackingState('unavailable');
          setError(err.message || 'Error tracking GPS.');
        }
      }
    }

    initTracking();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [roomId, active, isSharing, dispatchLocation]);

  const toggleSharing = async () => {
    if (!roomId) return;
    const newState = !isSharing;
    setIsSharing(newState);
    setTrackingState(newState ? 'active' : 'paused');

    try {
      await api.toggleLocationSharing(roomId, newState);
    } catch (err) {
      console.warn('[useLocationTracking] Failed to toggle sharing:', err);
    }
  };

  return {
    isSharing,
    hasPermission,
    trackingState,
    currentCoords,
    currentTelemetry,
    error,
    toggleSharing,
  };
}
