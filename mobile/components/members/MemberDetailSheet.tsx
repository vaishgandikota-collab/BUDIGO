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
  onClose: () => void;
}

export const MemberDetailSheet: React.FC<MemberDetailSheetProps> = ({
  visible,
  member,
  location,
  destinationName,
  onClose,
}) => {
  if (!member) return null;

  const speedKmh = location?.speed ? (location.speed * 3.6).toFixed(1) : '0';
  const distanceKm = location?.distance_to_dest_meters
    ? (location.distance_to_dest_meters / 1000).toFixed(1)
    : '--';
  const etaMins = location?.eta_seconds
    ? Math.round(location.eta_seconds / 60)
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

