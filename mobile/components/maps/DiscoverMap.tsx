import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { DiscoverParticipant, FairDestinationArea, FairMeetingVenue } from '../../types';
import { Colors } from '../../constants/colors';

interface DiscoverMapProps {
  participants: DiscoverParticipant[];
  selectedArea?: FairDestinationArea | null;
  selectedVenue?: FairMeetingVenue | null;
  style?: any;
  height?: number | string;
}

export const DiscoverMap: React.FC<DiscoverMapProps> = ({
  participants,
  selectedArea,
  selectedVenue,
  style,
  height = 360,
}) => {
  return (
    <View style={[styles.container, height ? { height } : undefined, style]}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>🗺️ Multi-Participant Map</Text>
        <Text style={styles.subtitle}>
          {participants.length} Friend{participants.length === 1 ? '' : 's'} Active
        </Text>
        {selectedVenue ? (
          <Text style={styles.venue}>⭐ Meeting Venue: {selectedVenue.name}</Text>
        ) : selectedArea ? (
          <Text style={styles.venue}>📍 Destination Area: {selectedArea.name}</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 360,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FAF5F2',
    borderWidth: 1,
    borderColor: '#EAE6E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  venue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
