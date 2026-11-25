import {
  CandidatePlace,
  ParticipantStartPoint,
  ParticipantRouteInfo,
  ScoredMeetingPointCandidate,
} from '../types';

export interface RouteMatrixCalculator {
  (
    origins: ParticipantStartPoint[],
    destinations: CandidatePlace[]
  ): Promise<Map<string, Map<string, { distanceMeters: number; durationSeconds: number }>>>;
}

/**
 * Minimax Meeting Point Optimizer
 * 
 * Objectives:
 * 1. Primary: Minimize maximum individual travel time: min max_i(T_i).
 * 2. Secondary: Minimize total group travel duration: min sum_i(T_i).
 * 3. Fairness: Penalizes high variance in arrival times so all buddies arrive together.
 * 4. Venue Quality: Considers Google Places rating.
 * 
 * Completeness Guarantee:
 * Never claims a meeting point is optimal if its route matrix is incomplete.
 * Missing or unreachable participants disqualify candidate from top tier.
 */
export function rankMeetingPointCandidates(
  participants: ParticipantStartPoint[],
  candidates: CandidatePlace[],
  routeMatrix: Map<string, Map<string, { distanceMeters: number; durationSeconds: number }>>
): ScoredMeetingPointCandidate[] {
  if (participants.length === 0 || candidates.length === 0) {
    return [];
  }

  // 1. Deduplicate candidates by placeId
  const uniqueCandidates: CandidatePlace[] = [];
  const seenPlaceIds = new Set<string>();
  for (const c of candidates) {
    if (!seenPlaceIds.has(c.placeId)) {
      seenPlaceIds.add(c.placeId);
      uniqueCandidates.push(c);
    }
  }

  const scored: (ScoredMeetingPointCandidate & { isComplete: boolean })[] = [];

  for (const candidate of uniqueCandidates) {
    const candidateId = candidate.placeId;
    const destMap = routeMatrix.get(candidateId);

    const routes: ParticipantRouteInfo[] = [];
    let maxDuration = 0;
    let totalDuration = 0;
    const durations: number[] = [];
    let isComplete = true;

    for (const p of participants) {
      const routeInfo = destMap?.get(p.userId);

      // Verify completeness: every participant must have a valid route to this venue
      if (!routeInfo || typeof routeInfo.durationSeconds !== 'number' || routeInfo.durationSeconds <= 0) {
        isComplete = false;
        routes.push({
          userId: p.userId,
          distanceMeters: routeInfo?.distanceMeters || 0,
          durationSeconds: 999999, // Unreachable penalty
        });
        durations.push(999999);
        maxDuration = 999999;
        totalDuration += 999999;
        continue;
      }

      routes.push({
        userId: p.userId,
        distanceMeters: routeInfo.distanceMeters,
        durationSeconds: routeInfo.durationSeconds,
      });

      durations.push(routeInfo.durationSeconds);
      if (routeInfo.durationSeconds > maxDuration) {
        maxDuration = routeInfo.durationSeconds;
      }
      totalDuration += routeInfo.durationSeconds;
    }

    const avgDuration = totalDuration / participants.length;

    // Variance calculation (standard deviation in travel time)
    const validDurations = durations.filter((d) => d < 999999);
    const validAvg = validDurations.length > 0
      ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
      : 0;

    const variance = validDurations.length > 0
      ? validDurations.reduce((acc, curr) => acc + Math.pow(curr - validAvg, 2), 0) / validDurations.length
      : 0;
    const stdDevSeconds = Math.sqrt(variance);

    // Compute Minimax Composite Ranking Score (0 - 100 higher is better)
    // Incomplete candidates receive 0 ranking score
    let rankingScore = 0;

    if (isComplete) {
      // 1. Minimax component (lower max duration = higher score): weight 50%
      const maxDurationScore = Math.max(0, 100 - (maxDuration / 1800) * 50);

      // 2. Total duration efficiency: weight 25%
      const avgDurationScore = Math.max(0, 100 - (avgDuration / 1800) * 50);

      // 3. Fairness (arrival clustering - low std dev): weight 15%
      const fairnessScore = Math.max(0, 100 - (stdDevSeconds / 600) * 50);

      // 4. Place Quality / Rating boost (4.0 - 5.0 stars): weight 10%
      const ratingScore = ((candidate.rating || 4.2) / 5) * 100;

      rankingScore = Number(
        (
          maxDurationScore * 0.5 +
          avgDurationScore * 0.25 +
          fairnessScore * 0.15 +
          ratingScore * 0.1
        ).toFixed(1)
      );
    }

    scored.push({
      candidate,
      routes,
      maxTravelTimeSeconds: Math.round(maxDuration),
      totalTravelTimeSeconds: Math.round(totalDuration),
      avgTravelTimeSeconds: Math.round(avgDuration),
      rankingScore,
      isComplete,
    });
  }

  // Sort: Complete candidates strictly ahead of incomplete candidates
  // Then Primary: Lowest maximum individual travel time (Minimax)
  // Then Secondary: Lowest total travel time
  // Then Tertiary: Ranking score
  scored.sort((a, b) => {
    // 0. Complete matrices strictly prioritized
    if (a.isComplete !== b.isComplete) {
      return a.isComplete ? -1 : 1;
    }

    // 1. Primary: Lowest maximum travel time (Minimax)
    if (Math.abs(a.maxTravelTimeSeconds - b.maxTravelTimeSeconds) > 60) {
      return a.maxTravelTimeSeconds - b.maxTravelTimeSeconds;
    }

    // 2. Secondary: Lowest total travel time
    if (Math.abs(a.totalTravelTimeSeconds - b.totalTravelTimeSeconds) > 120) {
      return a.totalTravelTimeSeconds - b.totalTravelTimeSeconds;
    }

    // 3. Tertiary: Ranking score (includes fairness variance & rating)
    return b.rankingScore - a.rankingScore;
  });

  return scored.map(({ isComplete, ...rest }) => rest);
}
