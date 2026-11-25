import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { TripProgressCard } from '../../components/room/TripProgressCard';
import { useRoom } from '../../hooks/useRoom';
import { useAuth } from '../../hooks/useAuth';

export default function TripProgressScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { room, members, isLoading } = useRoom(roomId);
  const { user } = useAuth();

  if (isLoading || !room) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const arrivedCount = members.filter((m) => m.status === 'Arrived').length;
  const travellingCount = members.length - arrivedCount;

  // Find max ETA among travelling members for group completion estimate
  const maxEtaSeconds = members.reduce((max, m) => {
    return Math.max(max, m.eta_seconds || 0);
  }, 0);
  const groupEtaMins = Math.round(maxEtaSeconds / 60);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Live Trip Progress"
        subtitle={room.room_name}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Group Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Group Journey Overview</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{arrivedCount}</Text>
              <Text style={styles.statLabel}>Arrived</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{travellingCount}</Text>
              <Text style={styles.statLabel}>On the Way</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: Colors.primary }]}>
                {groupEtaMins > 0 ? `${groupEtaMins}m` : 'Ready'}
              </Text>
              <Text style={styles.statLabel}>Est. Group ETA</Text>
            </View>
          </View>
        </View>

        {/* Individual Member Cards */}
        <Text style={styles.sectionTitle}>Individual Progress</Text>
        {members.map((member) => (
          <TripProgressCard
            key={member.id}
            member={member}
            isCurrentUser={member.user_id === user?.id}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.mutedText,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
});

