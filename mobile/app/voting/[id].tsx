import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { VoteOptionCard } from '../../components/meeting/VoteOptionCard';
import { Button } from '../../components/common/Button';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { MeetingPoint } from '../../types';

export default function VotingScreen() {
  const { id: roomId, initialPick } = useLocalSearchParams<{ id: string; initialPick?: string }>();
  const router = useRouter();

  const [meetingPoints, setMeetingPoints] = useState<MeetingPoint[]>([]);
  const [selectedMpId, setSelectedMpId] = useState<string | null>(initialPick || null);
  const [tallies, setTallies] = useState<{
    counts: Record<string, number>;
    percentages: Record<string, number>;
    totalVotes: number;
  }>({ counts: {}, percentages: {}, totalVotes: 0 });
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const loadData = async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const [mpsRes, votesRes] = await Promise.all([
        api.getMeetingPoints(roomId),
        api.getRoomVotes(roomId),
      ]);

      setMeetingPoints(mpsRes.meetingPoints);
      setTallies(votesRes.tallies);

      // Pre-select if user already voted
      const myVote = mpsRes.meetingPoints.find((mp) => mp.has_voted);
      if (myVote) setSelectedMpId(myVote.id);
    } catch (err: any) {
      console.warn('[VotingScreen] Error loading votes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for live incoming votes via Socket.IO
    socketService.on('meeting:vote', (data: { tallies: typeof tallies }) => {
      setTallies(data.tallies);
    });

    return () => {
      socketService.off('meeting:vote');
    };
  }, [roomId]);

  const handleCastVote = async (mpId: string) => {
    if (!roomId) return;
    try {
      setSelectedMpId(mpId);
      setVoting(true);
      const res = await api.castVote(roomId, mpId);
      setTallies(res.tallies);
    } catch (err: any) {
      Alert.alert('Vote Failed', err.message || 'Could not record vote');
    } finally {
      setVoting(false);
    }
  };

  const handleConfirmWinner = async () => {
    if (!selectedMpId) {
      Alert.alert('Select Location', 'Please pick a meeting point to confirm');
      return;
    }

    try {
      await api.selectMeetingPoint(selectedMpId);
      Alert.alert('Confirmed! 📍', 'Winning meeting point confirmed for all members.', [
        { text: 'Back to Map', onPress: () => router.replace(`/room/${roomId}`) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Only host can confirm final meeting point');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Group Voting"
        subtitle={`Total Votes Cast: ${tallies.totalVotes}`}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>Vote for your preferred spot 🗳️</Text>
          <Text style={styles.promptDesc}>
            Cast your vote for the spot that fits best. You can adjust your pick until the host locks it in.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.optionsList}>
            {meetingPoints.map((mp) => {
              const count = tallies.counts[mp.id] || 0;
              const percentage = tallies.percentages[mp.id] || 0;
              const isSelected = selectedMpId === mp.id;

              return (
                <VoteOptionCard
                  key={mp.id}
                  meetingPoint={mp}
                  voteCount={count}
                  percentage={percentage}
                  isSelected={isSelected}
                  onVote={() => handleCastVote(mp.id)}
                  disabled={voting}
                />
              );
            })}
          </View>
        )}

        {/* Creator Confirmation Action */}
        <View style={styles.footerAction}>
          <Button
            title="Confirm Winning Spot for Group"
            onPress={handleConfirmWinner}
            size="lg"
            disabled={!selectedMpId}
          />
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
  },
  promptCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  promptDesc: {
    fontSize: 13,
    color: Colors.mutedText,
    marginTop: 4,
    lineHeight: 18,
  },
  optionsList: {
    gap: 4,
  },
  footerAction: {
    marginTop: 24,
    marginBottom: 20,
  },
});

