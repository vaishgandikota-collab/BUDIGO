import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { Avatar } from '../../components/common/Avatar';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [locationEnabled, setLocationEnabled] = useState(true);
  const [backgroundTracking, setBackgroundTracking] = useState(true);
  const [arrivalPush, setArrivalPush] = useState(true);
  const [meetingAlerts, setMeetingAlerts] = useState(true);

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Are you sure you want to log out of Budigo?')
        : true;
      if (confirmed) {
        await logout();
        router.replace('/(auth)/login');
      }
      return;
    }
    Alert.alert('Sign Out', 'Are you sure you want to log out of Budigo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Profile & Settings" showBack={false} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar
            name={user?.full_name || 'Guest Traveler'}
            size={72}
            markerColor={Colors.primary}
          />
          <Text style={styles.profileName}>{user?.full_name || 'Guest Traveler'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'Not signed in'}</Text>
          {user ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Verified Traveler</Text>
            </View>
          ) : (
            <Button
              title="Sign In / Register"
              size="sm"
              onPress={() => router.push('/(auth)/login')}
              style={{ marginTop: 12 }}
            />
          )}
        </View>

        {/* Location & Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location & Privacy</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>GPS Location Sharing</Text>
                <Text style={styles.rowSubtitle}>Broadcast coordinates during active trips</Text>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={locationEnabled ? Colors.primary : Colors.white}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Background Tracking</Text>
                <Text style={styles.rowSubtitle}>Keep buddies updated when app is minimized</Text>
              </View>
              <Switch
                value={backgroundTracking}
                onValueChange={setBackgroundTracking}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={backgroundTracking ? Colors.primary : Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Notification Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Buddy Arrival Alerts</Text>
                <Text style={styles.rowSubtitle}>Notify when a friend reaches the spot</Text>
              </View>
              <Switch
                value={arrivalPush}
                onValueChange={setArrivalPush}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={arrivalPush ? Colors.primary : Colors.white}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Meeting Point Recommendations</Text>
                <Text style={styles.rowSubtitle}>Alerts when minimax finds an optimal stop</Text>
              </View>
              <Switch
                value={meetingAlerts}
                onValueChange={setMeetingAlerts}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={meetingAlerts ? Colors.primary : Colors.white}
              />
            </View>
          </View>
        </View>

        {/* App Info & Logout */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Version</Text>
              <Text style={styles.infoVal}>Budigo v1.0.0 (Production Build)</Text>
            </View>
          </View>

          {user && (
            <Button
              title="Log Out"
              variant="danger"
              onPress={handleLogout}
              style={{ marginTop: 18 }}
            />
          )}
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
    padding: 16,
    paddingBottom: 36,
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.mutedText,
    marginTop: 3,
  },
  verifiedBadge: {
    backgroundColor: '#EDF8F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.mutedText,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.lightGrey,
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.mutedText,
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

