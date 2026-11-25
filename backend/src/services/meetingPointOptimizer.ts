import { calculateCentroid } from '../algorithms/haversine';
import { rankMeetingPointCandidates } from '../algorithms/minimaxOptimizer';
import { GoogleMapsService } from './googleMapsService';
import {
  ParticipantStartPoint,
  CandidatePlace,
  ScoredMeetingPointCandidate,
} from '../types';

export class MeetingPointOptimizer {
  /**
   * Discovers and ranks meeting points for a set of participants
   */
  static async findOptimalMeetingPoints(
    participants: ParticipantStartPoint[],
    category = 'cafe',
    customCandidates?: CandidatePlace[]
  ): Promise<ScoredMeetingPointCandidate[]> {
    if (participants.length === 0) {
      throw new Error('At least one participant location is required for meeting point discovery.');
    }

    // 1. Calculate geographic centroid of all participants
    const centroid = calculateCentroid(
      participants.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
    );

    // 2. Discover candidate places around centroid (or use provided custom candidates)
    let candidates: CandidatePlace[] = customCandidates || [];
    if (candidates.length === 0) {
      candidates = await GoogleMapsService.searchNearbyPlaces(centroid, category);
    }

    if (candidates.length === 0) {
      throw new Error('No candidate meeting points discovered in this region.');
    }

    // 3. Compute road route matrix (travel distance & time for every participant -> every candidate)
    const routeMatrix = await GoogleMapsService.computeRouteMatrix(participants, candidates);

    // 4. Run Minimax & Total Group Travel Time Optimization
    const ranked = rankMeetingPointCandidates(participants, candidates, routeMatrix);

    // 5. Return top 3 recommendations
    return ranked.slice(0, 3);
  }
}

