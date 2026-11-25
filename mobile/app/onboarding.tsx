import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { Button } from '../components/common/Button';
import { LocationService } from '../services/location';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    icon: '🗺️',
    title: 'Travel Together',
    subtitle: 'Create a shared travel room in seconds. Invite your friends with a 6-character room code and travel as one unified group.',
    accent: '#D1956A',
  },
  {
    id: 2,
    icon: '📍',
    title: 'Track Your Buddies',
    subtitle: 'Real-time GPS tracking with a distinct color for every traveler. See individual ETAs, road routes, and proximity alerts.',
    accent: '#4C78C9',
  },
  {
    id: 3,
    icon: '⚡',
    title: 'Smart Meeting Points',
    subtitle: 'Minimax optimization analyzes road networks and travel times to find the fairest common meeting point where nobody waits.',
    accent: '#419A77',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@budigo_onboarded', 'true');
      // Proactively prompt user for location permission with clear explanation
      await LocationService.requestForegroundPermission();
    } catch (e) {}
    router.replace('/(auth)/login');
  };

  const nextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      finishOnboarding();
    }
  };

  const slide = SLIDES[currentSlide];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar with Skip */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>BUDIGO</Text>
        {currentSlide < SLIDES.length - 1 ? (
          <TouchableOpacity onPress={finishOnboarding} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Main Slide Card */}
      <View style={styles.slideContainer}>
        <View style={[styles.iconCircle, { backgroundColor: `${slide.accent}15`, borderColor: slide.accent }]}>
          <Text style={styles.slideIcon}>{slide.icon}</Text>
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        {currentSlide === 1 && (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionTitle}>🔒 Privacy First Location Sharing</Text>
            <Text style={styles.permissionDesc}>
              Location is only shared with approved buddies inside your active travel room. You can pause or stop sharing anytime.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomBar}>
        {/* Pagination Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentSlide === index ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <Button
          title={currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          onPress={nextSlide}
          size="lg"
          style={{ width: '100%' }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  brand: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.mutedText,
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  slideIcon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.mutedText,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  permissionDesc: {
    fontSize: 12,
    color: Colors.mutedText,
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: Colors.border,
  },
});

