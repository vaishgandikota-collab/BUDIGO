import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { MeetingPoint } from '../../types';

interface VoteOptionCardProps {
  meetingPoint: MeetingPoint;
  voteCount: number;
  percentage: number;
  isSelected: boolean;
  onVote: () => void;
  disabled?: boolean;
}

export const VoteOptionCard: React.FC<VoteOptionCardProps> = ({
  meetingPoint,
  voteCount,
  percentage,
  isSelected,
  onVote,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onVote}
      disabled={disabled}
      style={[styles.container, isSelected && styles.selectedContainer]}
    >
      <View style={styles.topRow}>
        <View style={styles.left}>
          <View style={[styles.radio, isSelected && styles.radioSelected]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{meetingPoint.place_name}</Text>
            <Text style={styles.timeSub}>
              Max ETA: {Math.round(meetingPoint.maximum_travel_time / 60)} min • Rating: ★{' '}
              {meetingPoint.rating || 4.5}
            </Text>
          </View>
        </View>

        <View style={styles.voteStats}>
          <Text style={styles.percentText}>{percentage}%</Text>
          <Text style={styles.voteCount}>{voteCount} {voteCount === 1 ? 'vote' : 'votes'}</Text>
        </View>
      </View>

      {/* Voting Bar */}
      <View style={styles.track}>
        <View
          style={[
            styles.bar,
            {
              width: `${percentage}%`,
              backgroundColor: isSelected ? Colors.primary : '#B6B2BE',
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedContainer: {
    borderColor: Colors.primary,
    backgroundColor: '#FCFAF8',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  timeSub: {
    fontSize: 12,
    color: Colors.mutedText,
    marginTop: 2,
  },
  voteStats: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  percentText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  voteCount: {
    fontSize: 11,
    color: Colors.mutedText,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.lightGrey,
    marginTop: 12,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
});

