import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Elegant entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Check auth status and navigate
    const timer = setTimeout(async () => {
      try {
        const hasOnboarded = await AsyncStorage.getItem('@budigo_onboarded');
        const token = await api.initToken();

        if (!hasOnboarded) {
          router.replace('/onboarding');
        } else if (token) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      } catch (e) {
        router.replace('/onboarding');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={[Colors.gradient.start, '#EFEAEB', Colors.background]}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Modern App Emblem */}
        <View style={styles.logoContainer}>
          <View style={styles.outerRing}>
            <View style={styles.innerEmblem}>
              <Text style={styles.emblemIcon}>🧭</Text>
            </View>
          </View>
          <View style={styles.orbitDot1} />
          <View style={styles.orbitDot2} />
        </View>

        {/* Brand Name */}
        <Text style={styles.brandTitle}>BUDIGO</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Your buddies, one journey.</Text>

        <View style={styles.loadingBarContainer}>
          <View style={styles.loadingBar} />
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  outerRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  innerEmblem: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemIcon: {
    fontSize: 42,
  },
  orbitDot1: {
    position: 'absolute',
    top: 6,
    right: 18,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  orbitDot2: {
    position: 'absolute',
    bottom: 8,
    left: 20,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4C78C9',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  brandTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 4,
    fontFamily: 'System',
  },
  tagline: {
    fontSize: 16,
    color: Colors.mutedText,
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  loadingBarContainer: {
    width: 140,
    height: 4,
    backgroundColor: Colors.lightGrey,
    borderRadius: 2,
    marginTop: 36,
    overflow: 'hidden',
  },
  loadingBar: {
    width: '60%',
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
});

