import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';

export default function MemberDetailsScreen() {
  const params = useLocalSearchParams<{
    name: string;
    role: string;
    color: string;
    status: string;
    distance?: string;
    eta?: string;
    speed?: string;
    destinationName?: string;
  }>();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Buddy Details" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          <Avatar
            name={params.name || 'Traveler'}
            size={72}
            markerColor={params.color || Colors.primary}
          />
          <Text style={styles.name}>{params.name || 'Traveler'}</Text>
          <Text style={styles.role}>{params.role === 'creator' ? '👑 Room Organizer' : '🎒 Travel Member'}</Text>
          <Badge status={params.status || 'On the Way'} style={{ marginTop: 10 }} />
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Live Telemetry</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{params.distance || '4.8 km'}</Text>
              <Text style={styles.statLbl}>Remaining</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: Colors.primary }]}>{params.eta || '12 min'}</Text>
              <Text style={styles.statLbl}>Estimated ETA</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{params.speed || '35 km/h'}</Text>
              <Text style={styles.statLbl}>Current Speed</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoRow}>
            🎯 Assigned Map Marker: <Text style={{ color: params.color || Colors.primary, fontWeight: '700' }}>● {params.color}</Text>
          </Text>
          <Text style={styles.infoRow}>
            🏁 Destination: <Text style={{ fontWeight: '700' }}>{params.destinationName || 'Baga Beach, North Goa'}</Text>
          </Text>
          <Text style={styles.infoRow}>
            📡 Realtime Sync: <Text style={{ color: Colors.success, fontWeight: '700' }}>Active via Socket.IO</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  role: {
    fontSize: 13,
    color: Colors.mutedText,
    marginTop: 2,
  },
  statsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
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
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLbl: {
    fontSize: 11,
    color: Colors.mutedText,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  infoRow: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
});

