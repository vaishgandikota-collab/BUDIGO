import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

export interface LocationSubscription {
  remove: () => void;
}

export interface GPSLocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export class LocationService {
  /**
   * Prompts user with explanation before requesting foreground location
   */
  static async requestForegroundPermission(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      if (existingStatus === 'granted') {
        return true;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn('[LocationService] Foreground permission check error:', err);
      return false;
    }
  }

  /**
   * Requests background location permissions with context
   */
  static async requestBackgroundPermission(): Promise<boolean> {
    try {
      const fgGranted = await this.requestForegroundPermission();
      if (!fgGranted) return false;

      const { status: existingBg } = await Location.getBackgroundPermissionsAsync();
      if (existingBg === 'granted') {
        return true;
      }

      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn('[LocationService] Background permission check error:', err);
      return false;
    }
  }

  /**
   * Retrieves last-known cached GPS position for instant warm fix
   */
  static async getLastKnownLocation(): Promise<GPSLocationPoint | null> {
    try {
      const loc = await Location.getLastKnownPositionAsync();
      if (!loc) return null;
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Obtains current accurate GPS position with High Accuracy
   */
  static async getCurrentLocation(): Promise<GPSLocationPoint> {
    const isGranted = await this.requestForegroundPermission();
    if (!isGranted) {
      throw new Error('Location permission not granted. Please enable location in device settings.');
    }

    // Try last known first if available within 30 seconds
    const last = await this.getLastKnownLocation();
    if (last && Date.now() - last.timestamp < 30000 && (last.accuracy ?? 100) <= 30) {
      return last;
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      heading: loc.coords.heading,
      timestamp: loc.timestamp,
    };
  }

  /**
   * Checks whether the GPS reading has acceptable accuracy (<= 35m)
   */
  static isAccuracyAcceptable(accuracy: number | null | undefined): boolean {
    if (accuracy === null || accuracy === undefined) return true;
    return accuracy <= 35;
  }

  /**
   * Distance between two points in meters using Haversine
   */
  static calculateDistance(
    p1: { latitude: number; longitude: number },
    p2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // meters
    const phi1 = (p1.latitude * Math.PI) / 180;
    const phi2 = (p2.latitude * Math.PI) / 180;
    const deltaPhi = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const deltaLambda = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Starts adaptive location watching with stationary back-off & accuracy filter
   */
  static async watchLocation(
    onLocationUpdate: (loc: GPSLocationPoint) => void,
    options = {
      distanceInterval: 10,  // minimum 10 meters movement before event
      timeInterval: 4000,    // minimum 4 seconds between reports
    }
  ): Promise<LocationSubscription> {
    const isGranted = await this.requestForegroundPermission();
    if (!isGranted) {
      throw new Error('Location permission not granted.');
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: options.distanceInterval,
        timeInterval: options.timeInterval,
      },
      (loc) => {
        // Filter wild noise jumps with accuracy > 35m
        if (!this.isAccuracyAcceptable(loc.coords.accuracy)) {
          return;
        }

        onLocationUpdate({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
          timestamp: loc.timestamp,
        });
      }
    );

    return sub;
  }
}
