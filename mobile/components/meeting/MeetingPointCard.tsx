import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Colors } from '../../constants/colors';
import { MeetingPoint } from '../../types';
import { Button } from '../common/Button';

interface MeetingPointCardProps {
  meetingPoint: MeetingPoint;
  rankIndex: number;
  isSelected?: boolean;
  destinationName?: string;
  mode?: 'near_destination' | 'fair_for_everyone';
  onSelect: () => void;
  onViewOnMap?: () => void;
  onVote?: () => void;
  isCreator?: boolean;
}

export const MeetingPointCard: React.FC<MeetingPointCardProps> = ({
  meetingPoint,
  rankIndex,
  isSelected = false,
  destinationName = 'Destination',
  mode = 'near_destination',
  onSelect,
  onViewOnMap,
  onVote,
  isCreator = false,
}) => {
  const isTopThree = rankIndex < 3;
  const isBest = rankIndex === 0;

  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return '--';
    if (meters < 1000) return `${meters} m road`;
    return `${(meters / 1000).toFixed(1)} km road`;
  };

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return '--';
    if (seconds < 60) return '< 1 min';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  };

  const maxMins = Math.round(meetingPoint.maximum_travel_time / 60);
  const avgMins = Math.round(meetingPoint.average_travel_time / 60);

  const getRankBadgeText = () => {
    if (rankIndex === 0) return '🏆 #1 TOP PICK NEAR DESTINATION';
    if (rankIndex === 1) return '⭐ #2 HIGHLY RECOMMENDED';
    if (rankIndex === 2) return '⭐ #3 GREAT CHOICE';
    return `#${rankIndex + 1} NEARBY VENUE`;
  };

  const openGoogleMaps = () => {
    if (meetingPoint.google_maps_uri) {
      Linking.openURL(meetingPoint.google_maps_uri);
    } else {
      const query = encodeURIComponent(`${meetingPoint.place_name}, ${meetingPoint.address || ''}`);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    }
  };

  return (
    <View
      style={[
        styles.card,
        isTopThree && styles.topCard,
        isBest && styles.bestCard,
        isSelected && styles.selectedCard,
      ]}
    >
      {/* Rank Header Badge */}
      <View style={[styles.badgeContainer, !isTopThree && styles.subtleBadge]}>
        <Text style={[styles.badgeText, !isTopThree && styles.subtleBadgeText]}>
          {getRankBadgeText()}
        </Text>
        {meetingPoint.open_status_text && (
          <View style={[styles.statusPill, meetingPoint.open_now ? styles.openPill : styles.closedPill]}>
            <Text style={[styles.statusText, meetingPoint.open_now ? styles.openText : styles.closedText]}>
              {meetingPoint.open_now ? '🟢 Open Now' : '🔴 Closed'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {/* Place Title & Rating */}
        <View style={styles.headerRow}>
          <View style={styles.titleInfo}>
            <Text style={styles.placeName}>{meetingPoint.place_name}</Text>
            {meetingPoint.address ? (
              <Text style={styles.address} numberOfLines={2}>
                📍 {meetingPoint.address}
              </Text>
            ) : null}
          </View>

          {typeof meetingPoint.rating === 'number' && (
            <View style={styles.ratingBox}>
              <Text style={styles.ratingText}>★ {meetingPoint.rating.toFixed(1)}</Text>
              {meetingPoint.user_rating_count ? (
                <Text style={styles.reviewCount}>({meetingPoint.user_rating_count})</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* METRICS DISPLAY */}
        {mode === 'near_destination' ? (
          /* Proximity & Driving Route Metrics From Destination */
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Road Distance</Text>
              <Text style={[styles.metricValue, { color: Colors.primary }]}>
                {formatDistance(meetingPoint.distance_from_dest_meters)}
              </Text>
              <Text style={styles.metricSub} numberOfLines={1}>
                From {destinationName}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Drive Time</Text>
              <Text style={styles.metricValue}>
                🚗 {formatDuration(meetingPoint.driving_time_from_dest_seconds)}
              </Text>
              <Text style={styles.metricSub}>Google Routes API</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Match Score</Text>
              <Text style={[styles.metricValue, { color: '#27AE60' }]}>
                {meetingPoint.ranking_score}%
              </Text>
              <Text style={styles.metricSub}>Proximity & Rating</Text>
            </View>
          </View>
        ) : (
          /* Minimax Fairness Metrics */
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Max Arrival Time</Text>
              <Text style={[styles.metricValue, { color: Colors.primary }]}>
                {maxMins} mins
              </Text>
              <Text style={styles.metricSub}>Fairness: Everyone ≤ {maxMins}m</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Average Travel</Text>
              <Text style={styles.metricValue}>{avgMins} mins</Text>
              <Text style={styles.metricSub}>Minimax Match: {meetingPoint.ranking_score}%</Text>
            </View>
          </View>
        )}

        {/* Participant ETAs for Fair Mode */}
        {mode === 'fair_for_everyone' && meetingPoint.routes && meetingPoint.routes.length > 0 && (
          <View style={styles.routesList}>
            <Text style={styles.routesHeader}>Individual Member ETAs:</Text>
            <View style={styles.routePills}>
              {meetingPoint.routes.map((r, i) => (
                <View key={i} style={[styles.routePill, { borderColor: r.marker_color || Colors.primary }]}>
                  <View style={[styles.pillDot, { backgroundColor: r.marker_color || Colors.primary }]} />
                  <Text style={styles.pillText}>
                    {r.user_display_name || `Member ${i + 1}`}: {Math.round(r.duration_seconds / 60)}m
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {onViewOnMap && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.mapBtn, isSelected && styles.mapBtnActive]}
              onPress={onViewOnMap}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>
                {isSelected ? '📍 Showing Route' : '🗺️ View on Map'}
              </Text>
            </TouchableOpacity>
          )}

          {onVote && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.voteBtn]}
              onPress={onVote}
              activeOpacity={0.8}
            >
              <Text style={styles.voteBtnText}>🗳️ Vote</Text>
            </TouchableOpacity>
          )}

          {isCreator && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.confirmBtn]}
              onPress={onSelect}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>✓ Confirm</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.navIconBtn}
            onPress={openGoogleMaps}
            activeOpacity={0.7}
            accessibilityLabel="Open in Google Maps"
          >
            <Text style={styles.navIconText}>↗️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginVertical: 6,
    borderWidth: 1.2,
    borderColor: '#EAE6E1',
    overflow: 'hidden',
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  topCard: {
    borderColor: '#D1956A',
  },
  bestCard: {
    borderColor: '#D1956A',
    borderWidth: 2,
    shadowOpacity: 0.14,
  },
  selectedCard: {
    borderColor: '#27AE60',
    borderWidth: 2,
    backgroundColor: '#FCFDFB',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D1956A',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  subtleBadge: {
    backgroundColor: '#FAF5F2',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtleBadgeText: {
    color: '#D1956A',
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  openPill: {
    backgroundColor: '#EAF8EE',
  },
  closedPill: {
    backgroundColor: '#FDECEC',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  openText: {
    color: '#27AE60',
  },
  closedText: {
    color: '#E53935',
  },
  content: {
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleInfo: {
    flex: 1,
    marginRight: 8,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  address: {
    fontSize: 12,
    color: Colors.mutedText,
    marginTop: 3,
    lineHeight: 16,
  },
  ratingBox: {
    backgroundColor: '#FEF6ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F8D8B6',
    alignItems: 'center',
    minWidth: 46,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B78103',
  },
  reviewCount: {
    fontSize: 9,
    color: Colors.mutedText,
    marginTop: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EFEAE5',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#EAE6E1',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 9,
    color: Colors.mutedText,
    marginTop: 2,
  },
  routesList: {
    marginTop: 10,
  },
  routesHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.mutedText,
    marginBottom: 4,
  },
  routePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  mapBtn: {
    backgroundColor: Colors.white,
    borderColor: '#D1956A',
  },
  mapBtnActive: {
    backgroundColor: '#FAF0E6',
    borderColor: '#D1956A',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D1956A',
  },
  voteBtn: {
    backgroundColor: Colors.white,
    borderColor: '#D8D4CF',
  },
  voteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  confirmBtn: {
    backgroundColor: '#D1956A',
    borderColor: '#D1956A',
  },
  confirmBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  navIconBtn: {
    backgroundColor: '#F0ECE8',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconText: {
    fontSize: 13,
  },
});
