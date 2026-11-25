import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { RoomCard } from '../../components/room/RoomCard';
import { Button } from '../../components/common/Button';
import { api } from '../../services/api';
import { Room } from '../../types';

export default function MyTripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = async () => {
    try {
      const res = await api.getMyTrips().catch(() => ({ trips: [] }));
      setTrips(res.trips || []);
    } catch (e) {
      console.warn('[MyTrips] Load error:', e);
      setTrips([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="My Trips"
        showBack={false}
        rightAction={
          <Button
            title="+ New"
            size="sm"
            onPress={() => router.push('/room/create')}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTrips(); }} />}
      >
        {trips.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyTitle}>No Trips Found</Text>
            <Text style={styles.emptySub}>Create a new room or join with a room code.</Text>
            <Button
              title="Create Trip"
              onPress={() => router.push('/room/create')}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {trips.map((trip) => (
              <RoomCard
                key={trip.id}
                room={trip}
                onPress={() => router.push(`/room/${trip.id}`)}
              />
            ))}
          </View>
        )}
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
    padding: 16,
  },
  list: {
    gap: 4,
  },
  empty: {
    padding: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.mutedText,
    textAlign: 'center',
  },
});

