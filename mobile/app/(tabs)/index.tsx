import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { api } from '../../services/api';
import { Room, UserProfile } from '../../types';
import { Avatar } from '../../components/common/Avatar';
import { RoomCard } from '../../components/room/RoomCard';
import { Button } from '../../components/common/Button';

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [trips, setTrips] = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [globalSharing, setGlobalSharing] = useState(true);

  const loadData = async () => {
    try {
      const [userRes, tripsRes] = await Promise.all([
        api.getProfile().catch(() => ({ user: null })),
        api.getMyTrips().catch(() => ({ trips: [] })),
      ]);

      if (userRes.user) setUser(userRes.user);

      // Use actual trips returned from backend
      const loadedTrips = tripsRes.trips || [];
      setTrips(loadedTrips);
    } catch (err) {
      console.warn('[HomeScreen] Load data error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activeTrip = trips.find((t) => t.status === 'active');
  const recentTrips = trips.filter((t) => t.id !== activeTrip?.id);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hey {user?.full_name?.split(' ')[0] || 'Traveler'} 👋</Text>
            <Text style={styles.subtitle}>Where is the crew heading today?</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Avatar name={user?.full_name || 'Budigo User'} size={46} />
          </TouchableOpacity>
        </View>

        {/* Quick Location Sharing Status Card */}
        <View style={styles.privacyCard}>
          <View style={styles.privacyLeft}>
            <View style={[styles.privacyDot, { backgroundColor: globalSharing ? Colors.success : Colors.mutedText }]} />
            <View>
              <Text style={styles.privacyTitle}>
                {globalSharing ? 'GPS Sharing Active' : 'GPS Sharing Paused'}
              </Text>
              <Text style={styles.privacySub}>
                {globalSharing ? 'Visible to room members' : 'Location concealed'}
              </Text>
            </View>
          </View>
          <Switch
            value={globalSharing}
            onValueChange={setGlobalSharing}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={globalSharing ? Colors.primary : Colors.white}
          />
        </View>

        {/* Primary Action Buttons: Create & Join */}
        <View style={styles.actionGrid}>
          {/* Create Room */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/room/create')}
            style={[styles.actionCard, styles.createCard]}
          >
            <LinearGradient
              colors={['#E59E75', Colors.primary]}
              style={styles.cardGradient}
            >
              <View style={styles.iconCircle}>
                <Text style={styles.actionIcon}>➕</Text>
              </View>
              <Text style={styles.actionTitle}>Create a Room</Text>
              <Text style={styles.actionDesc}>Plan trip & invite your buddies</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Join Room */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/room/join')}
            style={[styles.actionCard, styles.joinCard]}
          >
            <View style={styles.joinCardInner}>
              <View style={[styles.iconCircle, styles.joinIconCircle]}>
                <Text style={styles.actionIcon}>🔑</Text>
              </View>
              <Text style={[styles.actionTitle, styles.joinTitle]}>Join a Room</Text>
              <Text style={styles.actionDesc}>Enter 6-char code</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Current Active Trip Banner */}
        {activeTrip ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Trip</Text>
              <TouchableOpacity onPress={() => router.push(`/room/${activeTrip.id}`)}>
                <Text style={styles.viewLiveText}>View Live Map 🗺️</Text>
              </TouchableOpacity>
            </View>

            <RoomCard
              room={activeTrip}
              onPress={() => router.push(`/room/${activeTrip.id}`)}
            />
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyTitle}>No active trips</Text>
            <Text style={styles.emptyDesc}>Create a room or join a buddy's code to begin tracking!</Text>
            <Button
              title="Start a Trip Now"
              onPress={() => router.push('/room/create')}
              style={{ marginTop: 14 }}
            />
          </View>
        )}

        {/* Recent Trips Section */}
        {recentTrips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Journeys</Text>
            {recentTrips.map((trip) => (
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.mutedText,
    marginTop: 3,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  privacyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  privacyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  privacySub: {
    fontSize: 11,
    color: Colors.mutedText,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    height: 148,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  createCard: {},
  cardGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  joinCard: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  joinCardInner: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinIconCircle: {
    backgroundColor: '#F3EFEF',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
  },
  joinTitle: {
    color: Colors.textPrimary,
  },
  actionDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  viewLiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.mutedText,
    textAlign: 'center',
    marginTop: 4,
  },
});

