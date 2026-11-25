import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { RoomMember } from '../../types';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';

interface MemberListItemProps {
  member: RoomMember;
  isCurrentUser?: boolean;
  onPress?: () => void;
}

export const MemberListItem: React.FC<MemberListItemProps> = ({
  member,
  isCurrentUser = false,
  onPress,
}) => {
  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return '--';
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatEta = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return '--';
    if (seconds < 60) return 'Arriving';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.container}
    >
      <View style={styles.left}>
        <Avatar
          name={member.display_name}
          size={42}
          markerColor={member.marker_color}
        />
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {member.display_name}
            </Text>
            {isCurrentUser && <Text style={styles.youTag}>(You)</Text>}
            {member.member_role === 'creator' && (
              <Text style={styles.creatorTag}>👑 Host</Text>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Dist: {formatDistance(member.distance_to_dest_meters)}
            </Text>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.metaText}>
              ETA: {formatEta(member.eta_seconds)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.right}>
        <Badge status={member.status} />
        {!member.location_sharing_enabled && (
          <Text style={styles.pausedText}>Sharing Paused</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nameBlock: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  youTag: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
    flexShrink: 0,
  },
  creatorTag: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '700',
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    color: Colors.mutedText,
  },
  bullet: {
    marginHorizontal: 4,
    color: Colors.mutedText,
    fontSize: 10,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pausedText: {
    fontSize: 10,
    color: Colors.error,
    fontWeight: '600',
  },
});

