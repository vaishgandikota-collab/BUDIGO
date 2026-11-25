import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { api } from '../../services/api';
import { LocationService } from '../../services/location';

export default function JoinRoomScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [shareLocation, setShareLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ roomCode?: string; displayName?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fill display name from current user profile if available
    api.getUser().then((u) => {
      if (u?.full_name) {
        setDisplayName(u.full_name);
      }
    });
  }, []);

  const handleJoin = async () => {
    setGeneralError(null);
    const errs: { roomCode?: string; displayName?: string } = {};
    if (!roomCode.trim()) errs.roomCode = 'Please enter a 6-character room code';
    if (!displayName.trim()) errs.displayName = 'Please enter your display name';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      setLoading(true);

      // Ensure user is authenticated with a valid UUID session before calling join
      const u = await api.getUser();
      const token = await api.initToken();
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!u || !token || !UUID_REGEX.test(u.id)) {
        await api.clearAuth();
        const guestEmail = `${displayName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'buddy'}_${Date.now()}@budigo.app`;
        await api.login(guestEmail, 'password123');
      }

      // Verify GPS permission if sharing enabled (on native only)
      if (shareLocation && Platform.OS !== 'web') {
        const granted = await LocationService.requestForegroundPermission();
        if (!granted) {
          Alert.alert(
            'Location Required',
            'To join with live location sharing, GPS permission is needed. You can also join with sharing paused.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Join with Sharing Paused',
                onPress: () => performJoin(false),
              },
            ]
          );
          setLoading(false);
          return;
        }
      }

      await performJoin(shareLocation);
    } catch (err: any) {
      setGeneralError(err.message || 'Invalid room code or unable to join');
      if (Platform.OS !== 'web') {
        Alert.alert('Join Failed', err.message || 'Invalid room code');
      }
      setLoading(false);
    }
  };

  const performJoin = async (sharingEnabled: boolean) => {
    try {
      const res = await api.joinRoom(roomCode.trim().toUpperCase(), displayName.trim(), sharingEnabled);
      
      // On web, navigate immediately to the shared map
      if (Platform.OS === 'web') {
        router.replace(`/room/${res.room.id}`);
        return;
      }

      Alert.alert(
        'Connected to Trip! 🎒',
        `Joined "${res.room.room_name}". Your marker color is assigned.`,
        [
          {
            text: 'Open Shared Map',
            onPress: () => router.replace(`/room/${res.room.id}`),
          },
        ]
      );
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to connect to room');
      if (Platform.OS !== 'web') {
        Alert.alert('Join Failed', err.message || 'Failed to connect to room');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Join a Travel Room" />

      <ScrollView contentContainerStyle={styles.scroll}>
        {generalError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {generalError}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.subtext}>
            Enter the 6-character room code shared by your friend to join the live tracking session.
          </Text>

          <Input
            label="Room Code"
            placeholder="e.g. BUD482"
            autoCapitalize="characters"
            maxLength={10}
            value={roomCode}
            onChangeText={(text) => {
              setRoomCode(text.toUpperCase());
              if (errors.roomCode) setErrors((prev) => ({ ...prev, roomCode: undefined }));
              setGeneralError(null);
            }}
            error={errors.roomCode}
            style={styles.codeInput}
          />

          <Input
            label="Your Display Name"
            placeholder="e.g. Bhavna"
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
              setGeneralError(null);
            }}
            error={errors.displayName}
          />

          {/* Privacy Explanation & Switch */}
          <View style={styles.switchBox}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchTitle}>Share Live Location</Text>
              <Text style={styles.switchDesc}>
                Broadcasts your GPS position to other buddies in this room. You can pause anytime.
              </Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={shareLocation ? Colors.primary : Colors.white}
            />
          </View>
        </View>

        <Button
          title="Connect to Room"
          onPress={handleJoin}
          loading={loading}
          size="lg"
          style={styles.joinBtn}
        />
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
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  subtext: {
    fontSize: 14,
    color: Colors.mutedText,
    marginBottom: 20,
    lineHeight: 20,
  },
  codeInput: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    color: Colors.primary,
  },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  switchDesc: {
    fontSize: 11,
    color: Colors.mutedText,
    marginTop: 2,
    lineHeight: 16,
  },
  joinBtn: {
    marginTop: 24,
  },
  errorBanner: {
    backgroundColor: '#FDEDEC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F5B7B1',
  },
  errorBannerText: {
    fontSize: 13,
    color: '#C0392B',
    fontWeight: '600',
  },
});
