import { calculateHaversineDistance } from '../algorithms/haversine';
import { GeoCoordinate, MemberStatus } from '../types';

interface ProximityState {
  consecutiveCloseChecks: number;
  hasNotifiedArrival: boolean;
  lastMovingTimestamp: number;
  lastLat: number;
  lastLon: number;
  hasNotifiedStationary: boolean;
}

const ARRIVAL_PROXIMITY_THRESHOLD_METERS = 100; // 100 meters
const REQUIRED_CONSECUTIVE_CHECKS = 2; // Require 2 consecutive checks to avoid GPS noise false-positives
const MAX_ACCEPTABLE_ACCURACY_METERS = 30; // Ignore wild GPS jumps with >30m accuracy
const STATIONARY_TIME_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes stationary
const STATIONARY_RADIUS_METERS = 35; // Moved less than 35m in that time

export class GeofenceService {
  // In-memory state tracking per user & room
  private static tracker = new Map<string, ProximityState>();

  private static getKey(roomId: string, userId: string): string {
    return `${roomId}:${userId}`;
  }

  /**
   * Evaluates location against destination to determine if member has arrived or is near
   */
  static evaluateArrival(
    roomId: string,
    userId: string,
    currentLocation: { latitude: number; longitude: number; accuracy?: number; speed?: number },
    destination: GeoCoordinate
  ): {
    status: MemberStatus;
    distanceMeters: number;
    triggerArrivalNotification: boolean;
  } {
    const key = this.getKey(roomId, userId);
    let state = this.tracker.get(key);
    if (!state) {
      state = {
        consecutiveCloseChecks: 0,
        hasNotifiedArrival: false,
        lastMovingTimestamp: Date.now(),
        lastLat: currentLocation.latitude,
        lastLon: currentLocation.longitude,
        hasNotifiedStationary: false,
      };
      this.tracker.set(key, state);
    }

    const distanceMeters = Math.round(
      calculateHaversineDistance(currentLocation, destination)
    );

    const accuracyOk = (currentLocation.accuracy ?? 10) <= MAX_ACCEPTABLE_ACCURACY_METERS;

    // Check proximity
    if (distanceMeters <= ARRIVAL_PROXIMITY_THRESHOLD_METERS && accuracyOk) {
      state.consecutiveCloseChecks += 1;

      if (state.consecutiveCloseChecks >= REQUIRED_CONSECUTIVE_CHECKS) {
        const triggerNotification = !state.hasNotifiedArrival;
        state.hasNotifiedArrival = true;
        return {
          status: 'Arrived',
          distanceMeters,
          triggerArrivalNotification: triggerNotification,
        };
      }
      return {
        status: 'Near Destination',
        distanceMeters,
        triggerArrivalNotification: false,
      };
    } else {
      state.consecutiveCloseChecks = 0;
    }

    if (distanceMeters <= 500) {
      return {
        status: 'Near Destination',
        distanceMeters,
        triggerArrivalNotification: false,
      };
    }

    // Check movement speed
    const isMoving = (currentLocation.speed ?? 0) > 1.5; // > 1.5 m/s (~5.4 km/h)
    return {
      status: isMoving ? 'Moving' : 'On the Way',
      distanceMeters,
      triggerArrivalNotification: false,
    };
  }

  /**
   * Checks if user has been stationary for an extended period
   */
  static checkStationary(
    roomId: string,
    userId: string,
    currentLocation: { latitude: number; longitude: number }
  ): boolean {
    const key = this.getKey(roomId, userId);
    const state = this.tracker.get(key);
    if (!state) return false;

    const distFromLast = calculateHaversineDistance(
      { latitude: state.lastLat, longitude: state.lastLon },
      currentLocation
    );

    const now = Date.now();

    if (distFromLast > STATIONARY_RADIUS_METERS) {
      // User moved
      state.lastLat = currentLocation.latitude;
      state.lastLon = currentLocation.longitude;
      state.lastMovingTimestamp = now;
      state.hasNotifiedStationary = false;
      return false;
    }

    // Has stayed within radius
    const elapsed = now - state.lastMovingTimestamp;
    if (elapsed >= STATIONARY_TIME_THRESHOLD_MS && !state.hasNotifiedStationary) {
      state.hasNotifiedStationary = true;
      return true; // Trigger stationary alert
    }

    return false;
  }

  static clearUser(roomId: string, userId: string) {
    this.tracker.delete(this.getKey(roomId, userId));
  }
}

