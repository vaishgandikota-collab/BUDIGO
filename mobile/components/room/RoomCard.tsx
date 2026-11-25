import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Room } from '../../types';
import { Badge } from '../common/Badge';

interface RoomCardProps {
  room: Room;
  onPress: () => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onPress }) => {
  const memberCount = room.room_members?.length || 1;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleArea}>
          <Text style={styles.roomName} numberOfLines={1}>
            {room.room_name}
          </Text>
          <View style={styles.codePill}>
            <Text style={styles.codeText}>#{room.room_code}</Text>
          </View>
        </View>
        <Badge
          label={room.status === 'active' ? 'Live Trip' : 'Completed'}
          color={room.status === 'active' ? Colors.success : Colors.mutedText}
        />
      </View>

      <View style={styles.destinationRow}>
        <Text style={styles.destPin}>📍</Text>
        <Text style={styles.destText} numberOfLines={1}>
          {room.destination_name}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.memberCount}>👥 {memberCount} {memberCount === 1 ? 'member' : 'members'}</Text>
        <Text style={styles.actionPrompt}>Tap to open map →</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  roomName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  codePill: {
    backgroundColor: '#F3EFEF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  destPin: {
    fontSize: 14,
  },
  destText: {
    fontSize: 14,
    color: Colors.mutedText,
    fontWeight: '500',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2EDF0',
  },
  memberCount: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  actionPrompt: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
});

