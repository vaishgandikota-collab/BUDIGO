import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';
import { LiveLocation, RoomMember } from '../../types';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

interface MemberDetailSheetProps {
  visible: boolean;
  member?: RoomMember;
  location?: LiveLocation;
  destinationName: string;
  destinationCoords?: { latitude: number; longitude: number };
  onClose: () => void;
}

export const MemberDetailSheet: React.FC<MemberDetailSheetProps> = ({
  visible,
  member,
  location,
  destinationName,
  destinationCoords,
  onClose,
}) => {
  if (!member) return null;

  // Compute distance locally via Haversine if server didn't provide it
  let computedDistMeters = location?.distance_to_dest_meters ?? member.distance_to_dest_meters;
  let computedEtaSecs = location?.eta_seconds ?? member.eta_seconds;
  if ((computedDistMeters === undefined || computedDistMeters === null) && location && destinationCoords) {
    const R = 6371e3;
    const phi1 = (location.latitude * Math.PI) / 180;
    const phi2 = (destinationCoords.latitude * Math.PI) / 180;
    const dPhi = ((destinationCoords.latitude - location.latitude) * Math.PI) / 180;
    const dLam = ((destinationCoords.longitude - location.longitude) * Math.PI) / 180;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
    computedDistMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  if ((computedEtaSecs === undefined || computedEtaSecs === null) && computedDistMeters !== undefined) {
    const gpsSpeed = location?.speed ?? 0;
    if (gpsSpeed > 0.5) {
      computedEtaSecs = Math.round(computedDistMeters / gpsSpeed);
    } else {
      // Estimate at ~30 km/h average city speed
      computedEtaSecs = Math.round((computedDistMeters / 1000) / 30 * 3600);
    }
  }

  const speedKmh = location?.speed ? (location.speed * 3.6).toFixed(1) : '0';
  const distanceKm = computedDistMeters !== undefined && computedDistMeters !== null
    ? (computedDistMeters / 1000).toFixed(1)
    : '--';
  const etaMins = computedEtaSecs !== undefined && computedEtaSecs !== null
    ? Math.round(computedEtaSecs / 60)
    : '--';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.profileHeader}>
              <Avatar
                name={member.display_name}
                size={52}
                markerColor={member.marker_color}
              />
              <View style={styles.profileInfo}>
                <Text style={styles.name}>{member.display_name}</Text>
                <Text style={styles.role}>
                  {member.member_role === 'creator' ? 'Trip Organizer' : 'Travel Buddy'}
                </Text>
              </View>
              <Badge status={member.status} />
            </View>

            {/* Key Metrics */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Distance</Text>
                <Text style={styles.statValue}>{distanceKm} km</Text>
                <Text style={styles.statSub} numberOfLines={1}>to {destinationName}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>ETA</Text>
                <Text style={[styles.statValue, { color: Colors.primary }]}>{etaMins} mins</Text>
                <Text style={styles.statSub}>Estimated arrival</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Current Speed</Text>
                <Text style={styles.statValue}>{speedKmh} km/h</Text>
                <Text style={styles.statSub}>GPS Telemetry</Text>
              </View>
            </View>

            {/* Live Telemetry Info */}
            <View style={styles.metaCard}>
              <Text style={styles.metaRow}>
                🎯 Assigned Marker Color: <Text style={{ color: member.marker_color, fontWeight: '700' }}>● {member.marker_color}</Text>
              </Text>
              <Text style={styles.metaRow}>
                📡 Location Sharing: <Text style={{ fontWeight: '700' }}>{member.location_sharing_enabled ? 'Active' : 'Paused'}</Text>
              </Text>
              {location?.updated_at && (
                <Text style={styles.metaRow}>
                  ⏱️ Last Reported: {new Date(location.updated_at).toLocaleTimeString()}
                </Text>
              )}
            </View>

            <Button title="Close" variant="secondary" onPress={onClose} style={{ marginTop: 14 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(71, 68, 89, 0.4)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 14,
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  role: {
    fontSize: 13,
    color: Colors.mutedText,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.mutedText,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 3,
  },
  statSub: {
    fontSize: 10,
    color: Colors.mutedText,
    marginTop: 2,
    textAlign: 'center',
  },
  metaCard: {
    backgroundColor: '#FAF8FA',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 6,
  },
  metaRow: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
});

