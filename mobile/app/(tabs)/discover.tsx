import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Share,
  Linking,
  Modal,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { DiscoverMap } from '../../components/maps/DiscoverMap';
import { api } from '../../services/api';
import {
  DiscoverParticipant,
  FairDestinationArea,
  FairMeetingVenue,
  PlaceAutocompleteSuggestion,
} from '../../types';

// Preset color palette for friend markers
const FRIEND_COLORS = [
  '#D1956A', // Terracotta
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

// Curated 1-click test scenarios across Hyderabad
const PRESET_SCENARIOS = [
  {
    label: '2 Friends',
    subtitle: 'Gachibowli + Secunderabad',
    participants: [
      {
        id: 'p1',
        name: 'Rahul (Tech Hub)',
        address: 'Gachibowli Junction, Hyderabad',
        latitude: 17.4399,
        longitude: 78.3489,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[0],
      },
      {
        id: 'p2',
        name: 'Priya (Old City/North)',
        address: 'Secunderabad Clock Tower, Secunderabad',
        latitude: 17.4399,
        longitude: 78.4983,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[1],
      },
    ],
  },
  {
    label: '3 Friends',
    subtitle: 'Madhapur + Banjara + Charminar',
    participants: [
      {
        id: 'p1',
        name: 'Rahul (Madhapur)',
        address: 'Madhapur Metro Station, Hyderabad',
        latitude: 17.4483,
        longitude: 78.3915,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[0],
      },
      {
        id: 'p2',
        name: 'Priya (Banjara Hills)',
        address: 'Road No. 12, Banjara Hills, Hyderabad',
        latitude: 17.4156,
        longitude: 78.4357,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[1],
      },
      {
        id: 'p3',
        name: 'Amit (Charminar)',
        address: 'Charminar Historic Quarter, Hyderabad',
        latitude: 17.3616,
        longitude: 78.4747,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[2],
      },
    ],
  },
  {
    label: '4 Friends',
    subtitle: 'Cross-City Convergence',
    participants: [
      {
        id: 'p1',
        name: 'Rahul (Kukatpally)',
        address: 'Kukatpally Housing Board Colony, Hyderabad',
        latitude: 17.4933,
        longitude: 78.3995,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[0],
      },
      {
        id: 'p2',
        name: 'Priya (Dilsukhnagar)',
        address: 'Dilsukhnagar Bus Depot, Hyderabad',
        latitude: 17.3688,
        longitude: 78.5247,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[1],
      },
      {
        id: 'p3',
        name: 'Amit (Hitec City)',
        address: 'Cyber Towers, Hitec City, Hyderabad',
        latitude: 17.4504,
        longitude: 78.3808,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[2],
      },
      {
        id: 'p4',
        name: 'Sneha (Uppal)',
        address: 'Uppal Stadium Circle, Hyderabad',
        latitude: 17.4018,
        longitude: 78.5593,
        source: 'manual' as const,
        markerColor: FRIEND_COLORS[3],
      },
    ],
  },
];

const VENUE_CATEGORIES = [
  { id: 'all', label: 'All Venues', icon: '✨' },
  { id: 'cafe', label: 'Cafés', icon: '☕' },
  { id: 'restaurant', label: 'Restaurants', icon: '🍽️' },
  { id: 'shopping_mall', label: 'Malls', icon: '🛍️' },
  { id: 'park', label: 'Parks', icon: '🌳' },
  { id: 'tourist_attraction', label: 'Attractions', icon: '🏛️' },
  { id: 'hotel', label: 'Hotels', icon: '🏨' },
  { id: 'parking', label: 'Parking', icon: '🅿️' },
  { id: 'transit_station', label: 'Metro & Transit', icon: '🚆' },
];

export default function DiscoverScreen() {
  const router = useRouter();

  // --- State ---
  const [participants, setParticipants] = useState<DiscoverParticipant[]>(
    PRESET_SCENARIOS[0].participants
  );
  const [travelMode, setTravelMode] = useState<'DRIVE' | 'WALK' | 'BICYCLE'>('DRIVE');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Tier 1 (Areas)
  const [candidateAreas, setCandidateAreas] = useState<FairDestinationArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<FairDestinationArea | null>(null);
  const [isSearchingAreas, setIsSearchingAreas] = useState(false);

  // Tier 2 (Venues)
  const [venues, setVenues] = useState<FairMeetingVenue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<FairMeetingVenue | null>(null);
  const [isSearchingVenues, setIsSearchingVenues] = useState(false);

  // Modal / Add Participant State
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [addMode, setAddMode] = useState<'gps' | 'manual'>('manual');
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceAutocompleteSuggestion[]>([]);
  const [selectedPlaceSuggestion, setSelectedPlaceSuggestion] = useState<{
    placeId: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  // Search debounce
  const debounceTimer = useRef<any>(null);

  // Auto-search autocomplete suggestions as user types
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        setIsSearchingPlaces(true);
        const res = await api.autocompletePlaces(searchQuery.trim());
        if (res.success && res.suggestions) {
          setSuggestions(res.suggestions);
        }
      } catch (err) {
        console.warn('[Discover] Autocomplete failed:', err);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 280);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  // Handle GPS location addition
  const handleUseGPS = async () => {
    try {
      setIsLocatingGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to detect your current position.'
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = loc.coords;
      let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      let detectedName = 'My Current Location';

      try {
        const rev = await api.reverseGeocode(latitude, longitude);
        if (rev && rev.formattedAddress) {
          address = rev.formattedAddress;
          detectedName = rev.name || 'My Location';
        }
      } catch (e) {
        console.warn('[Discover] Reverse geocode error:', e);
      }

      const nextIndex = participants.length;
      const newFriend: DiscoverParticipant = {
        id: `p_${Date.now()}`,
        name: newName.trim() || `Friend ${nextIndex + 1} (GPS)`,
        address,
        latitude,
        longitude,
        source: 'gps',
        timestamp: new Date().toISOString(),
        markerColor: FRIEND_COLORS[nextIndex % FRIEND_COLORS.length],
      };

      setParticipants([...participants, newFriend]);
      setIsAddModalVisible(false);
      setNewName('');
      resetDiscovery();
    } catch (err: any) {
      Alert.alert('GPS Location Error', err.message || 'Unable to retrieve GPS coordinates.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  // Handle selecting an autocomplete suggestion
  const handleSelectSuggestion = async (sug: PlaceAutocompleteSuggestion) => {
    try {
      setIsSearchingPlaces(true);
      const detailsRes = await api.getPlaceDetails(sug.placeId);
      if (detailsRes.success && detailsRes.details) {
        const d = detailsRes.details;
        setSelectedPlaceSuggestion({
          placeId: sug.placeId,
          name: sug.mainText || d.destinationName,
          address: d.destinationAddress || sug.fullText,
          latitude: d.latitude,
          longitude: d.longitude,
        });
      }
    } catch (err: any) {
      Alert.alert('Place Selection Error', err.message || 'Could not fetch place coordinates.');
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  // Confirm manual addition
  const handleAddManualParticipant = () => {
    if (!selectedPlaceSuggestion) {
      Alert.alert('Location Required', 'Please search and select a location from the suggestions.');
      return;
    }

    const nextIndex = participants.length;
    const newFriend: DiscoverParticipant = {
      id: `p_${Date.now()}`,
      name: newName.trim() || selectedPlaceSuggestion.name,
      address: selectedPlaceSuggestion.address,
      latitude: selectedPlaceSuggestion.latitude,
      longitude: selectedPlaceSuggestion.longitude,
      placeId: selectedPlaceSuggestion.placeId,
      source: 'manual',
      timestamp: new Date().toISOString(),
      markerColor: FRIEND_COLORS[nextIndex % FRIEND_COLORS.length],
    };

    setParticipants([...participants, newFriend]);
    setIsAddModalVisible(false);
    setNewName('');
    setSearchQuery('');
    setSuggestions([]);
    setSelectedPlaceSuggestion(null);
    resetDiscovery();
  };

  // Remove participant
  const handleRemoveParticipant = (id: string) => {
    if (participants.length <= 2) {
      Alert.alert('Minimum Participants', 'At least 2 friends are needed to calculate fair convergence.');
      return;
    }
    setParticipants(participants.filter((p) => p.id !== id));
    resetDiscovery();
  };

  // Reset discovery results when inputs change
  const resetDiscovery = () => {
    setCandidateAreas([]);
    setSelectedArea(null);
    setVenues([]);
    setSelectedVenue(null);
  };

  // Load a preset scenario
  const handleLoadPreset = (index: number) => {
    const preset = PRESET_SCENARIOS[index];
    if (preset) {
      setParticipants(preset.participants);
      resetDiscovery();
    }
  };

  // --- Tier 1: Discover Fair Destination Areas ---
  const handleFindFairAreas = async () => {
    if (participants.length < 2) {
      Alert.alert('Add Friends', 'Please add at least 2 friends with locations.');
      return;
    }

    try {
      setIsSearchingAreas(true);
      setSelectedArea(null);
      setVenues([]);
      setSelectedVenue(null);

      const res = await api.discoverFairAreas(
        participants.map((p) => ({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          markerColor: p.markerColor,
        })),
        travelMode
      );

      if (res.success && res.candidateAreas) {
        setCandidateAreas(res.candidateAreas);
        if (res.candidateAreas.length > 0) {
          handleSelectArea(res.candidateAreas[0]);
        }
      }
    } catch (err: any) {
      Alert.alert('Fair Area Calculation Error', err.message || 'Unable to discover destination areas.');
    } finally {
      setIsSearchingAreas(false);
    }
  };

  // --- Tier 2: Select Area & Discover Venues ---
  const handleSelectArea = async (area: FairDestinationArea, categoryOverride?: string) => {
    setSelectedArea(area);
    setSelectedVenue(null);

    const cat = categoryOverride || selectedCategory;
    try {
      setIsSearchingVenues(true);
      const res = await api.discoverAreaVenues(
        { latitude: area.latitude, longitude: area.longitude },
        area.name,
        participants.map((p) => ({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          markerColor: p.markerColor,
        })),
        cat,
        travelMode
      );

      if (res.success && res.venues) {
        setVenues(res.venues);
        if (res.venues.length > 0) {
          setSelectedVenue(res.venues[0]);
        }
      }
    } catch (err: any) {
      console.warn('[Discover] Venues discovery error:', err);
    } finally {
      setIsSearchingVenues(false);
    }
  };

  // Switch travel mode (DRIVE, WALK, BICYCLE)
  const handleChangeTravelMode = (mode: 'DRIVE' | 'WALK' | 'BICYCLE') => {
    if (mode === travelMode) return;
    setTravelMode(mode);
    if (selectedArea) {
      handleSelectArea(selectedArea);
    } else if (candidateAreas.length > 0) {
      handleFindFairAreas();
    }
  };

  // Switch venue category filter
  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    if (selectedArea) {
      handleSelectArea(selectedArea, catId);
    }
  };

  // Share meeting point plan
  const handleSharePlan = async () => {
    if (!selectedVenue) return;

    const friendBreakdown = selectedVenue.participantRoutes
      .map((r) => {
        const distKm = (r.distanceMeters / 1000).toFixed(1);
        const etaMins = Math.round(r.durationSeconds / 60);
        return `• ${r.userName}: ${etaMins} mins (${distKm} km)`;
      })
      .join('\n');

    const message = `🎉 Budigo Fair Meeting Point Recommendation!\n\n` +
      `📍 Venue: ${selectedVenue.name}\n` +
      `📌 Address: ${selectedVenue.address}\n` +
      `⭐ Rating: ${selectedVenue.rating || '4.5'} ★\n` +
      `⚖️ Group Fairness: Max ${Math.round(selectedVenue.maxTravelTimeSeconds / 60)} mins | Avg ${Math.round(selectedVenue.avgTravelTimeSeconds / 60)} mins\n\n` +
      `Friend Road Travel Times (${travelMode.toLowerCase()}):\n${friendBreakdown}\n\n` +
      `Navigate on Google Maps: ${selectedVenue.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedVenue.name + ' ' + selectedVenue.address)}`}`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: `Budigo Meeting: ${selectedVenue.name}`, text: message });
          return;
        } catch (e) {}
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(message);
        Alert.alert('Plan Copied', 'Fair meeting summary copied to clipboard!');
      }
    } else {
      Share.share({ message });
    }
  };

  // Open Google Maps navigation
  const handleOpenGoogleMaps = () => {
    if (!selectedVenue) return;
    const url =
      selectedVenue.googleMapsUri ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        selectedVenue.name + ' ' + selectedVenue.address
      )}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Fair Meeting Finder"
        subtitle="Multi-User Road Travel Optimization"
        showBack={false}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Banner / Explanation */}
        <View style={styles.banner}>
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>⚡ Minimax Fairness Engine</Text>
          </View>
          <Text style={styles.bannerTitle}>Group Convergence & Fair Midpoints</Text>
          <Text style={styles.bannerDesc}>
            Add multiple friends starting from different locations. Budigo calculates actual road
            travel times via Google Routes API and discovers meeting areas where{' '}
            <Text style={{ fontWeight: '700', color: Colors.primary }}>
              no single friend is left with an unfair commute.
            </Text>
          </Text>

          {/* Quick Preset Buttons */}
          <View style={styles.presetSection}>
            <Text style={styles.presetLabel}>Quick Scenarios:</Text>
            <View style={styles.presetRow}>
              {PRESET_SCENARIOS.map((scenario, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.presetButton}
                  onPress={() => handleLoadPreset(idx)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetButtonText}>{scenario.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Section 1: Participants Management */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            1. Friends' Starting Locations ({participants.length})
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>+ Add Friend</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.participantsList}>
          {participants.map((p, index) => (
            <View key={p.id} style={styles.participantCard}>
              <View style={[styles.avatarCircle, { backgroundColor: p.markerColor }]}>
                <Text style={styles.avatarText}>{p.name.substring(0, 2).toUpperCase()}</Text>
              </View>

              <View style={styles.participantInfo}>
                <View style={styles.participantTopRow}>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View
                    style={[
                      styles.sourceTag,
                      p.source === 'gps' ? styles.sourceTagGps : styles.sourceTagManual,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sourceTagText,
                        p.source === 'gps' ? styles.sourceTagGpsText : styles.sourceTagManualText,
                      ]}
                    >
                      {p.source === 'gps' ? '📍 GPS' : '🔍 Search'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.participantAddress} numberOfLines={2}>
                  {p.address}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveParticipant(p.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Section 2: Interactive Convergence Map */}
        <View style={[styles.sectionHeader, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>2. Multi-Participant Map</Text>
          <Text style={styles.mapSubtitle}>Live road routes & auto-fit pins</Text>
        </View>

        <View style={styles.mapWrapper}>
          <DiscoverMap
            participants={participants}
            selectedArea={selectedArea}
            selectedVenue={selectedVenue}
            height={360}
          />
        </View>

        {/* Travel Mode Selector */}
        <View style={styles.travelModeContainer}>
          <Text style={styles.travelModeTitle}>Group Travel Mode:</Text>
          <View style={styles.travelModeRow}>
            {(
              [
                { mode: 'DRIVE', label: '🚗 Driving' },
                { mode: 'WALK', label: '🚶 Walking' },
                { mode: 'BICYCLE', label: '🚲 Cycling' },
              ] as const
            ).map((item) => (
              <TouchableOpacity
                key={item.mode}
                style={[
                  styles.travelModeChip,
                  travelMode === item.mode && styles.travelModeChipActive,
                ]}
                onPress={() => handleChangeTravelMode(item.mode)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.travelModeChipText,
                    travelMode === item.mode && styles.travelModeChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Big CTA: Calculate Fair Meeting Areas */}
        <View style={styles.ctaContainer}>
          <Button
            title={
              isSearchingAreas
                ? 'Evaluating Road Routes via Google APIs...'
                : '⚡ Find Fair Meeting Areas'
            }
            onPress={handleFindFairAreas}
            loading={isSearchingAreas}
            disabled={isSearchingAreas || participants.length < 2}
            size="lg"
            style={{ width: '100%' }}
          />
        </View>

        {/* Section 3: Tier 1 Destination Areas */}
        {candidateAreas.length > 0 && (
          <View style={styles.tierSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                3. Top Destination Areas ({candidateAreas.length})
              </Text>
              <Text style={styles.badgeHint}>Ranked by Minimax fairness</Text>
            </View>

            {candidateAreas.map((area, idx) => {
              const isSelected = selectedArea?.id === area.id;
              const maxMin = Math.round(area.maxTravelTimeSeconds / 60);
              const avgMin = Math.round(area.avgTravelTimeSeconds / 60);
              const spreadMin = Math.round(area.timeSpreadSeconds / 60);

              return (
                <TouchableOpacity
                  key={area.id}
                  style={[styles.areaCard, isSelected && styles.areaCardSelected]}
                  onPress={() => handleSelectArea(area)}
                  activeOpacity={0.8}
                >
                  <View style={styles.areaCardTop}>
                    <View style={styles.areaRankBadge}>
                      <Text style={styles.areaRankText}>
                        {idx === 0 ? '🏆 #1 Most Fair' : `#${idx + 1} Candidate`}
                      </Text>
                    </View>
                    <Text style={styles.areaCategoryText}>
                      {area.category?.replace(/_/g, ' ').toUpperCase() || 'COMMERCIAL HUB'}
                    </Text>
                  </View>

                  <Text style={styles.areaName}>{area.name}</Text>
                  <Text style={styles.areaAddress}>{area.address}</Text>

                  {/* Group Road Stats */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricValue}>{maxMin}m</Text>
                      <Text style={styles.metricLabel}>Max Commute</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricValue}>{avgMin}m</Text>
                      <Text style={styles.metricLabel}>Avg Commute</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricValue}>±{spreadMin}m</Text>
                      <Text style={styles.metricLabel}>Fairness Spread</Text>
                    </View>
                  </View>

                  {/* Per Friend Time Pills */}
                  <View style={styles.participantPillsRow}>
                    {area.participantRoutes.map((r) => (
                      <View
                        key={r.userId}
                        style={[styles.participantPill, { borderColor: r.markerColor }]}
                      >
                        <View
                          style={[styles.pillDot, { backgroundColor: r.markerColor }]}
                        />
                        <Text style={styles.pillText}>
                          {r.userName.split(' ')[0]}: {Math.round(r.durationSeconds / 60)}m
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.areaActionRow}>
                    <Text
                      style={[
                        styles.areaSelectLink,
                        isSelected && { color: Colors.primary, fontWeight: '700' },
                      ]}
                    >
                      {isSelected ? '✓ Area Active & Venues Loaded' : 'Explore Venues in this Area →'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Section 4: Tier 2 Venues in Selected Area */}
        {selectedArea && (
          <View style={styles.tierSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  4. Meeting Venues in {selectedArea.name}
                </Text>
                <Text style={styles.badgeHint}>
                  {isSearchingVenues
                    ? 'Discovering real venues...'
                    : `${venues.length} Google Places discovered`}
                </Text>
              </View>
            </View>

            {/* Category Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {VENUE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => handleSelectCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat.id && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.icon} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isSearchingVenues ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>
                  Querying Google Places & Routes for venues in {selectedArea.name}...
                </Text>
              </View>
            ) : venues.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No Venues in this Category</Text>
                <Text style={styles.emptySubtitle}>
                  Try selecting 'All Venues' or 'Cafés' to see nearby spots.
                </Text>
              </View>
            ) : (
              venues.map((venue, idx) => {
                const isSelected = selectedVenue?.id === venue.id;
                const maxMins = Math.round(venue.maxTravelTimeSeconds / 60);
                const avgMins = Math.round(venue.avgTravelTimeSeconds / 60);

                return (
                  <TouchableOpacity
                    key={venue.id}
                    style={[styles.venueCard, isSelected && styles.venueCardSelected]}
                    onPress={() => setSelectedVenue(venue)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.venueTopRow}>
                      <View style={styles.venueBadge}>
                        <Text style={styles.venueBadgeText}>
                          {idx === 0 ? '⭐ Best Group Match' : `#${idx + 1}`}
                        </Text>
                      </View>
                      {venue.rating && (
                        <View style={styles.ratingBadge}>
                          <Text style={styles.ratingText}>⭐ {venue.rating.toFixed(1)}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.venueName}>{venue.name}</Text>
                    <Text style={styles.venueAddress} numberOfLines={2}>
                      {venue.address}
                    </Text>

                    <View style={styles.venueStatsRow}>
                      <View style={styles.venueStatItem}>
                        <Text style={styles.venueStatValue}>{maxMins} mins</Text>
                        <Text style={styles.venueStatLabel}>Max Travel</Text>
                      </View>
                      <View style={styles.venueStatItem}>
                        <Text style={styles.venueStatValue}>{avgMins} mins</Text>
                        <Text style={styles.venueStatLabel}>Avg Travel</Text>
                      </View>
                      <View style={styles.venueStatItem}>
                        <Text
                          style={[
                            styles.venueStatValue,
                            venue.openNow === true
                              ? { color: '#10B981' }
                              : venue.openNow === false
                              ? { color: '#EF4444' }
                              : {},
                          ]}
                        >
                          {venue.openNow === true
                            ? 'Open Now'
                            : venue.openNow === false
                            ? 'Closed'
                            : 'Verified'}
                        </Text>
                        <Text style={styles.venueStatLabel}>Status</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.venueSelectBtn,
                        isSelected && styles.venueSelectBtnActive,
                      ]}
                      onPress={() => setSelectedVenue(venue)}
                    >
                      <Text
                        style={[
                          styles.venueSelectBtnText,
                          isSelected && styles.venueSelectBtnTextActive,
                        ]}
                      >
                        {isSelected ? '✓ Selected (Routes Shown Above)' : 'View Road Routes on Map'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Section 5: Selected Venue Participant Breakdown & Actions */}
        {selectedVenue && (
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownHeader}>
              <View>
                <Text style={styles.breakdownBadge}>SELECTED FAIR VENUE</Text>
                <Text style={styles.breakdownTitle}>{selectedVenue.name}</Text>
                <Text style={styles.breakdownSubtitle}>{selectedVenue.address}</Text>
              </View>
            </View>

            <Text style={styles.breakdownSectionTitle}>
              Road Route Breakdown for Every Friend:
            </Text>

            <View style={styles.breakdownTable}>
              {selectedVenue.participantRoutes.map((r) => {
                const p = participants.find((item) => item.id === r.userId);
                const distKm = (r.distanceMeters / 1000).toFixed(1);
                const etaMins = Math.round(r.durationSeconds / 60);

                return (
                  <View key={r.userId} style={styles.breakdownRow}>
                    <View style={styles.breakdownFriendCol}>
                      <View
                        style={[
                          styles.breakdownAvatar,
                          { backgroundColor: (p && p.markerColor) || r.markerColor || Colors.primary },
                        ]}
                      >
                        <Text style={styles.breakdownAvatarText}>
                          {r.userName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.breakdownFriendName}>{r.userName}</Text>
                        <Text style={styles.breakdownFriendOrigin} numberOfLines={1}>
                          {p?.address || 'Starting Location'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.breakdownStatCol}>
                      <Text style={styles.breakdownStatKm}>{distKm} km</Text>
                      <Text style={styles.breakdownStatEta}>{etaMins} mins ETA</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Fairness Summary Box */}
            <View style={styles.fairnessSummaryBox}>
              <Text style={styles.fairnessSummaryTitle}>Group Fairness Metrics</Text>
              <Text style={styles.fairnessSummaryText}>
                • Maximum individual commute: {Math.round(selectedVenue.maxTravelTimeSeconds / 60)} mins
              </Text>
              <Text style={styles.fairnessSummaryText}>
                • Average group commute: {Math.round(selectedVenue.avgTravelTimeSeconds / 60)} mins
              </Text>
              <Text style={styles.fairnessSummaryText}>
                • Travel time difference: ±{Math.round(selectedVenue.timeSpreadSeconds / 60)} mins spread
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={styles.openMapsButton}
                onPress={handleOpenGoogleMaps}
                activeOpacity={0.8}
              >
                <Text style={styles.openMapsButtonText}>🧭 Open in Google Maps</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleSharePlan}
                activeOpacity={0.8}
              >
                <Text style={styles.shareButtonText}>📤 Share Meeting Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Participant Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Friend's Location</Text>
              <TouchableOpacity
                onPress={() => setIsAddModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Mode Switcher: GPS vs Manual */}
            <View style={styles.modalTabs}>
              <TouchableOpacity
                style={[styles.modalTab, addMode === 'manual' && styles.modalTabActive]}
                onPress={() => setAddMode('manual')}
              >
                <Text
                  style={[styles.modalTabText, addMode === 'manual' && styles.modalTabTextActive]}
                >
                  🔍 Search Address
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTab, addMode === 'gps' && styles.modalTabActive]}
                onPress={() => setAddMode('gps')}
              >
                <Text
                  style={[styles.modalTabText, addMode === 'gps' && styles.modalTabTextActive]}
                >
                  📍 Use GPS Live
                </Text>
              </TouchableOpacity>
            </View>

            {/* Friend Name Input */}
            <Text style={styles.inputLabel}>Friend's Name:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Rahul, Priya, Alex"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />

            {addMode === 'manual' ? (
              <View>
                <Text style={styles.inputLabel}>Search Starting Address or Landmark:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Tank Bund, Gachibowli, Jubilee Hills..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                {isSearchingPlaces && (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.inlineLoadingText}>Searching Google Places...</Text>
                  </View>
                )}

                {/* Autocomplete Suggestions */}
                {suggestions.length > 0 && (
                  <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
                    {suggestions.map((sug) => (
                      <TouchableOpacity
                        key={sug.placeId}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectSuggestion(sug)}
                      >
                        <Text style={styles.suggestionMain}>{sug.mainText}</Text>
                        <Text style={styles.suggestionSecondary} numberOfLines={1}>
                          {sug.secondaryText}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Selected Place Badge */}
                {selectedPlaceSuggestion && (
                  <View style={styles.selectedPlaceCard}>
                    <Text style={styles.selectedPlaceTitle}>
                      ✓ {selectedPlaceSuggestion.name}
                    </Text>
                    <Text style={styles.selectedPlaceAddress} numberOfLines={2}>
                      {selectedPlaceSuggestion.address}
                    </Text>
                  </View>
                )}

                <Button
                  title="Confirm & Add Friend"
                  onPress={handleAddManualParticipant}
                  disabled={!selectedPlaceSuggestion}
                  style={{ marginTop: 14 }}
                />
              </View>
            ) : (
              <View style={styles.gpsBox}>
                <Text style={styles.gpsDesc}>
                  Detect current device GPS location using Expo Location and resolve human-readable
                  address via Google reverse geocoding.
                </Text>
                <Button
                  title={isLocatingGPS ? 'Detecting GPS...' : '📍 Use My Live GPS'}
                  onPress={handleUseGPS}
                  loading={isLocatingGPS}
                  size="md"
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 48,
  },
  banner: {
    backgroundColor: Colors.white,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FAF5F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  bannerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  bannerDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  presetSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0ECE8',
    paddingTop: 12,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  presetButton: {
    backgroundColor: '#F8F5F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  badgeHint: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  participantsList: {
    gap: 8,
    marginBottom: 12,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  participantInfo: {
    flex: 1,
  },
  participantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  sourceTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceTagGps: {
    backgroundColor: '#E0F2FE',
  },
  sourceTagManual: {
    backgroundColor: '#FEF3C7',
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sourceTagGpsText: {
    color: '#0369A1',
  },
  sourceTagManualText: {
    color: '#B45309',
  },
  participantAddress: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  removeButton: {
    padding: 6,
    marginLeft: 8,
  },
  removeButtonText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  mapSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  mapWrapper: {
    marginBottom: 14,
  },
  travelModeContainer: {
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  travelModeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  travelModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  travelModeChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#FAF5F2',
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  travelModeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  travelModeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  travelModeChipTextActive: {
    color: Colors.white,
  },
  ctaContainer: {
    marginBottom: 20,
  },
  tierSection: {
    marginBottom: 24,
  },
  areaCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  areaCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFDFB',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  areaCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  areaRankBadge: {
    backgroundColor: '#FAF5F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  areaRankText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  areaCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  areaName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  areaAddress: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F8F5F7',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  participantPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  participantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  areaActionRow: {
    borderTopWidth: 1,
    borderTopColor: '#F0ECE8',
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  areaSelectLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  categoryChipTextActive: {
    color: Colors.white,
  },
  loadingBox: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyBox: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  venueCard: {
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  venueCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFDFB',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  venueTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  venueBadge: {
    backgroundColor: '#FAF5F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  venueBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  venueName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  venueAddress: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: 10,
  },
  venueStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  venueStatItem: {
    flex: 1,
    backgroundColor: '#F8F5F7',
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  venueStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  venueStatLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 1,
    fontWeight: '600',
  },
  venueSelectBtn: {
    backgroundColor: '#FAF5F2',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  venueSelectBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  venueSelectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  venueSelectBtnTextActive: {
    color: Colors.white,
  },
  breakdownCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 24,
  },
  breakdownHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE8',
    paddingBottom: 10,
    marginBottom: 12,
  },
  breakdownBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  breakdownSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  breakdownSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  breakdownTable: {
    gap: 8,
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F5F7',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  breakdownFriendCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  breakdownAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownAvatarText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  breakdownFriendName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  breakdownFriendOrigin: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  breakdownStatCol: {
    alignItems: 'flex-end',
  },
  breakdownStatKm: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  breakdownStatEta: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  fairnessSummaryBox: {
    backgroundColor: '#FAF5F2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    marginBottom: 14,
  },
  fairnessSummaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  fairnessSummaryText: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  openMapsButton: {
    flex: 1,
    backgroundColor: '#474459',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  openMapsButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  shareButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalClose: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textMuted,
    padding: 4,
  },
  modalTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modalTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F8F5F7',
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  modalTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  modalTabTextActive: {
    color: Colors.white,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#F8F5F7',
    borderWidth: 1,
    borderColor: '#EAE6E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inlineLoadingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  suggestionsList: {
    maxHeight: 180,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6E1',
    borderRadius: 10,
    marginBottom: 12,
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE8',
  },
  suggestionMain: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  suggestionSecondary: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  selectedPlaceCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  selectedPlaceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  selectedPlaceAddress: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  gpsBox: {
    backgroundColor: '#F8F5F7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    marginBottom: 12,
    alignItems: 'center',
  },
  gpsDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
