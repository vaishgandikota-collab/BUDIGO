import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { RoomMember } from '../../types';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';

interface TripProgressCardProps {
  member: RoomMember;
  isCurrentUser?: boolean;
}

export const TripProgressCard: React.FC<TripProgressCardProps> = ({ member, isCurrentUser = false }) => {
  const distance = member.distance_to_dest_meters ?? 0;
  const isArrived = member.status === 'Arrived';
  const etaMins = Math.round((member.eta_seconds || 0) / 60);

  // Compute progress percentage: based on remaining distance vs nominal trip length
  const progressPercent = isArrived
    ? 100
    : Math.max(8, Math.min(95, Math.round(100 - (distance / 20000) * 100)));

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.userInfo}>
          <Avatar name={member.display_name} size={42} markerColor={member.marker_color} />
          <View style={styles.userText}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {member.display_name} {isCurrentUser ? '(You)' : ''}
              </Text>
              {member.member_role === 'creator' && (
                <View style={styles.hostBadge}>
                  <Text style={styles.hostBadgeText}>Host</Text>
                </View>
              )}
            </View>
            <Text style={styles.remaining}>
              {isArrived
                ? '🏁 Safely Arrived at Destination'
                : `🛣️ ${(distance / 1000).toFixed(1)} km remaining • ⏱️ ${etaMins > 0 ? `${etaMins}m ETA` : 'Calculating'}`}
            </Text>
          </View>
        </View>
        <Badge status={member.status} />
      </View>

      {/* Progress Bar in assigned persistent color */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              { width: `${progressPercent}%`, backgroundColor: member.marker_color },
            ]}
          />
        </View>
        <Text style={[styles.percentText, { color: member.marker_color }]}>
          {progressPercent}%
        </Text>
      </View>

      {/* Telemetry Footer */}
      <View style={styles.footerRow}>
        <Text style={styles.telemetryText}>
          GPS Status: {member.location_sharing_enabled ? 'Broadcasting' : 'Sharing Paused'}
        </Text>
        <Text style={styles.telemetryText}>
          Last Update: {member.last_seen_at ? new Date(member.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userText: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  hostBadge: {
    backgroundColor: '#FAF0E6',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hostBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  remaining: {
    fontSize: 12,
    color: Colors.mutedText,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ECEAE8',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '800',
    width: 40,
    textAlign: 'right',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2EFEB',
  },
  telemetryText: {
    fontSize: 11,
    color: Colors.mutedText,
  },
});
