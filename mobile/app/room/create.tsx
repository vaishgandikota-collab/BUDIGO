import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { api } from '../../services/api';
import { Room, UserProfile, CandidatePlace, PlaceAutocompleteSuggestion } from '../../types';
import { DestinationPreviewMap } from '../../components/maps/DestinationPreviewMap';

const PRESET_DESTINATIONS = [
  {
    name: 'Baga Beach, North Goa',
    address: 'Baga Beach Rd, Calangute, Goa 403516',
    lat: 15.5553,
    lon: 73.7517,
    placeId: 'ChIJ_96h2BzqvzsR4ME17sBmcLo',
    tag: '🏖️ Goa',
  },
  {
    name: 'Marine Drive Promenade, Mumbai',
    address: 'Netaji Subhash Chandra Bose Rd, Mumbai 400020',
    lat: 18.9432,
    lon: 72.8236,
    placeId: 'ChIJbU60Mw_P5zsRFlKqXwZ_UvU',
    tag: '🌊 Mumbai',
  },
  {
    name: 'Connaught Place Central Hub, Delhi',
    address: 'Connaught Circle, New Delhi 110001',
    lat: 28.6315,
    lon: 77.2167,
    placeId: 'ChIJVX48n8_jDDkR1p1p1x1x1x1',
    tag: '🏛️ Delhi',
  },
  {
    name: 'Indiranagar 100ft Rd, Bengaluru',
    address: 'Indiranagar, Bengaluru, Karnataka 560038',
    lat: 12.9784,
    lon: 77.6408,
    placeId: 'ChIJbU60Mw_P5zsRFlKqXwZ_Uv2',
    tag: '🌳 Bengaluru',
  },
  {
    name: 'Taj Mahal, Agra',
    address: 'Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001',
    lat: 27.1751,
    lon: 78.0421,
    placeId: 'ChIJbf8C1yFxdDkR3n12P4DkKt0',
    tag: '🕌 Agra',
  },
  {
    name: 'Hawa Mahal, Jaipur',
    address: 'Hawa Mahal Rd, Badi Choupad, J.D.A. Market, Jaipur, Rajasthan 302002',
    lat: 26.9239,
    lon: 75.8267,
    placeId: 'ChIJq7K2K26yDTkRz9Z9z9Z9z9Z',
    tag: '🏰 Jaipur',
  },
];

export default function CreateRoomScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [roomName, setRoomName] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationPlaceId, setDestinationPlaceId] = useState('');
  const [destinationLat, setDestinationLat] = useState(15.5553);
  const [destinationLon, setDestinationLon] = useState(73.7517);
  const [manualLatStr, setManualLatStr] = useState('15.5553');
  const [manualLonStr, setManualLonStr] = useState('73.7517');
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [isCustomSelected, setIsCustomSelected] = useState(false);

  // Google Places Autocomplete & Search State with Session Token & Request Tracking
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<PlaceAutocompleteSuggestion[]>([]);
  const [searchResults, setSearchResults] = useState<CandidatePlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<any>(null);
  const searchSeqRef = useRef<number>(0);

  // RFC4122 v4 UUID generator for Google Places Autocomplete Session Tokens
  const generateUUIDv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
  const sessionTokenRef = useRef<string>(generateUUIDv4());

  // Google Routes API Navigation Preview State
  const [travelMode, setTravelMode] = useState<'DRIVE' | 'WALK' | 'BICYCLE'>('DRIVE');
  const [routePreview, setRoutePreview] = useState<{
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline?: string;
  } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errors, setErrors] = useState<{ roomName?: string; destinationName?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const u = await api.getUser();
      const token = await api.initToken();
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (u && token) {
        if (u.id && !UUID_REGEX.test(u.id)) {
          await api.clearAuth();
          const authRes = await api.login('aarav@budigo.app', 'password123');
          setCurrentUser(authRes.user);
          return;
        }
        setCurrentUser(u);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  const handleQuickLogin = async () => {
    try {
      setAuthLoading(true);
      setGeneralError(null);
      const res = await api.login('aarav@budigo.app', 'password123');
      setCurrentUser(res.user);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to sign in as demo host');
    } finally {
      setAuthLoading(false);
    }
  };

  // Compute live route navigation preview from user location to destination
  const updateRoutePreview = async (
    destLat: number,
    destLon: number,
    mode: 'DRIVE' | 'WALK' | 'BICYCLE' = travelMode
  ) => {
    try {
      setRouteLoading(true);
      setRouteError(null);

      // Default origin is central Hyderabad (17.3850, 78.4867) or user current location
      const origin = { latitude: 17.3850, longitude: 78.4867 };
      const dest = { latitude: destLat, longitude: destLon };

      const res = await api.calculateRoute(origin, dest, mode);
      if (res.success && res.route) {
        setRoutePreview(res.route);
      }
    } catch (err: any) {
      console.warn('[CreateRoom] Route calculation error:', err);
      setRouteError('Route preview unavailable');
    } finally {
      setRouteLoading(false);
    }
  };

  // Perform Google Places Autocomplete with session token and race-condition cancellation
  const performSearch = async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setAutocompleteSuggestions([]);
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const currentSeq = ++searchSeqRef.current;

    try {
      setSearching(true);
      setSearchError(null);

      // 1. Fetch Autocomplete Suggestions with current session token
      const autoRes = await api.autocompletePlaces(trimmed, sessionTokenRef.current);

      // Check if another search request was issued while waiting
      if (currentSeq !== searchSeqRef.current) return;

      if (autoRes.success && autoRes.suggestions && autoRes.suggestions.length > 0) {
        setAutocompleteSuggestions(autoRes.suggestions);

        // Automatically fetch Place Details for the top suggestion to extract coordinates!
        const top = autoRes.suggestions[0];
        try {
          const detRes = await api.getPlaceDetails(top.placeId, sessionTokenRef.current);
          if (currentSeq !== searchSeqRef.current) return;

          if (detRes.success && detRes.details) {
            setDestinationLat(detRes.details.latitude);
            setDestinationLon(detRes.details.longitude);
            setManualLatStr(detRes.details.latitude.toString());
            setManualLonStr(detRes.details.longitude.toString());
            setDestinationPlaceId(detRes.details.placeId);
            if (!destinationAddress.trim()) {
              setDestinationAddress(detRes.details.destinationAddress || top.fullText);
            }
            setIsCustomSelected(true);
            updateRoutePreview(detRes.details.latitude, detRes.details.longitude, travelMode);
          }
        } catch {
          // If details endpoint fails, fallback gracefully
        }
      } else {
        // Fallback to text search
        const res = await api.searchPlaces(trimmed, 6);
        if (currentSeq !== searchSeqRef.current) return;

        if (res.success && res.places && res.places.length > 0) {
          setSearchResults(res.places);
          const topPlace = res.places[0];
          setDestinationLat(topPlace.latitude);
          setDestinationLon(topPlace.longitude);
          setManualLatStr(topPlace.latitude.toString());
          setManualLonStr(topPlace.longitude.toString());
          setDestinationPlaceId(topPlace.placeId);
          if (!destinationAddress.trim()) {
            setDestinationAddress(topPlace.address);
          }
          setIsCustomSelected(true);
          updateRoutePreview(topPlace.latitude, topPlace.longitude, travelMode);
        } else {
          setAutocompleteSuggestions([]);
          setSearchResults([]);
          setSearchError('No matching places found. Try another landmark, city, or address.');
        }
      }
    } catch (err: any) {
      if (currentSeq !== searchSeqRef.current) return;

      const msg = err?.message || '';
      if (msg.includes('404')) {
        setSearchError('Search endpoint not found. Please ensure backend is updated.');
      } else if (msg.includes('403') || msg.includes('REQUEST_DENIED')) {
        setSearchError('Google Places API key access denied. Please verify API key.');
      } else if (msg.includes('Network') || msg.includes('Failed to fetch')) {
        setSearchError('Network error connecting to search service.');
      } else {
        setSearchError(`Search error: ${msg || 'Unable to retrieve location suggestions'}`);
      }
      setAutocompleteSuggestions([]);
      setSearchResults([]);
    } finally {
      if (currentSeq === searchSeqRef.current) {
        setSearching(false);
      }
    }
  };

  const handleDestinationChange = (text: string) => {
    setDestinationName(text);
    if (errors.destinationName) {
      setErrors((prev) => ({ ...prev, destinationName: undefined }));
    }

    // Debounce search by 300ms
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(text);
      }, 300);
    } else {
      setAutocompleteSuggestions([]);
      setSearchResults([]);
      setSearchError(null);
    }
  };

  // Select an Autocomplete suggestion and fetch exact Place Details
  const selectSuggestion = async (sugg: PlaceAutocompleteSuggestion) => {
    try {
      setSearching(true);
      setSearchError(null);
      setDestinationName(sugg.mainText);
      setDestinationAddress(sugg.fullText);
      setDestinationPlaceId(sugg.placeId);
      setAutocompleteSuggestions([]);
      setSearchResults([]);

      // Fetch exact coordinates from Place Details endpoint using session token
      const detRes = await api.getPlaceDetails(sugg.placeId, sessionTokenRef.current);
      if (detRes.success && detRes.details) {
        setDestinationLat(detRes.details.latitude);
        setDestinationLon(detRes.details.longitude);
        setManualLatStr(detRes.details.latitude.toString());
        setManualLonStr(detRes.details.longitude.toString());
        setDestinationName(detRes.details.destinationName || sugg.mainText);
        setDestinationAddress(detRes.details.destinationAddress || sugg.fullText);
        setDestinationPlaceId(detRes.details.placeId);
        setIsCustomSelected(true);
        updateRoutePreview(detRes.details.latitude, detRes.details.longitude, travelMode);
      }
      // Reset session token for next search session
      sessionTokenRef.current = generateUUIDv4();
    } catch (err: any) {
      console.warn('[CreateRoom] Place details error:', err);
      // Reset session token on error as well
      sessionTokenRef.current = generateUUIDv4();
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = (place: CandidatePlace) => {
    setDestinationName(place.name);
    setDestinationAddress(place.address);
    setDestinationPlaceId(place.placeId);
    setDestinationLat(place.latitude);
    setDestinationLon(place.longitude);
    setManualLatStr(place.latitude.toString());
    setManualLonStr(place.longitude.toString());
    setIsCustomSelected(true);
    setAutocompleteSuggestions([]);
    setSearchResults([]);
    setSearchError(null);
    if (errors.destinationName) {
      setErrors((prev) => ({ ...prev, destinationName: undefined }));
    }
    setGeneralError(null);
    updateRoutePreview(place.latitude, place.longitude, travelMode);
  };

  const selectPreset = (preset: typeof PRESET_DESTINATIONS[0]) => {
    setDestinationName(preset.name);
    setDestinationAddress(preset.address);
    setDestinationPlaceId(preset.placeId || '');
    setDestinationLat(preset.lat);
    setDestinationLon(preset.lon);
    setManualLatStr(preset.lat.toString());
    setManualLonStr(preset.lon.toString());
    setIsCustomSelected(true);
    setAutocompleteSuggestions([]);
    setSearchResults([]);
    setSearchError(null);
    if (errors.destinationName) {
      setErrors((prev) => ({ ...prev, destinationName: undefined }));
    }
    setGeneralError(null);
    updateRoutePreview(preset.lat, preset.lon, travelMode);
  };

  const applyManualCoords = () => {
    const lat = parseFloat(manualLatStr);
    const lon = parseFloat(manualLonStr);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Invalid Latitude', 'Please enter a valid latitude between -90 and 90');
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      Alert.alert('Invalid Longitude', 'Please enter a valid longitude between -180 and 180');
      return;
    }
    setDestinationLat(lat);
    setDestinationLon(lon);
    setIsCustomSelected(true);
    setShowManualCoords(false);
  };

  const copyCode = () => {
    if (!createdRoom) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(createdRoom.room_code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCreate = async () => {
    setGeneralError(null);
    const errs: { roomName?: string; destinationName?: string } = {};
    if (!roomName.trim()) errs.roomName = 'Please enter a trip name';
    if (!destinationName.trim()) errs.destinationName = 'Please choose a destination';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      setLoading(true);

      let targetLat = destinationLat;
      let targetLon = destinationLon;
      let targetAddress = destinationAddress.trim() || destinationName.trim();
      let targetPlaceId = destinationPlaceId;

      // Automatically geocode the destination if coordinates are default and not Baga Beach
      const isDefaultGoa = targetLat === 15.5553 && targetLon === 73.7517;
      const isNotGoaName =
        !destinationName.toLowerCase().includes('baga') &&
        !destinationName.toLowerCase().includes('goa');

      if (isDefaultGoa && isNotGoaName) {
        try {
          const autoRes = await api.autocompletePlaces(destinationName.trim());
          if (autoRes.success && autoRes.suggestions && autoRes.suggestions.length > 0) {
            const topSugg = autoRes.suggestions[0];
            const detRes = await api.getPlaceDetails(topSugg.placeId);
            if (detRes.success && detRes.details) {
              targetLat = detRes.details.latitude;
              targetLon = detRes.details.longitude;
              targetPlaceId = detRes.details.placeId;
              if (!destinationAddress.trim()) {
                targetAddress = detRes.details.destinationAddress || topSugg.fullText;
              }
            }
          } else {
            const geoRes = await api.searchPlaces(destinationName.trim(), 1);
            if (geoRes.success && geoRes.places && geoRes.places.length > 0) {
              const topPlace = geoRes.places[0];
              targetLat = topPlace.latitude;
              targetLon = topPlace.longitude;
              targetPlaceId = topPlace.placeId;
              if (!destinationAddress.trim()) {
                targetAddress = topPlace.address;
              }
            }
          }
        } catch {
          // If network geocode lookup fails, proceed with current coordinates
        }
      }

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let user = currentUser;
      const token = await api.initToken();
      if (!user || !token || !UUID_REGEX.test(user.id)) {
        try {
          await api.clearAuth();
          const authRes = await api.login('aarav@budigo.app', 'password123');
          user = authRes.user;
          setCurrentUser(user);
        } catch {
          setGeneralError('Please sign in before creating a room.');
          setLoading(false);
          return;
        }
      }

      const res = await api.createRoom({
        roomName: roomName.trim(),
        destinationName: destinationName.trim(),
        destinationAddress: targetAddress,
        destinationLatitude: targetLat,
        destinationLongitude: targetLon,
        destinationPlaceId: targetPlaceId,
      });

      // Set state so the code and details are visibly displayed on-screen
      setCreatedRoom(res.room);

      // Native fallback alert if on mobile
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Room Created! 🎉',
          `Your room code is ${res.room.room_code}. Share it with your friends!`,
          [
            {
              text: 'Open Live Map',
              onPress: () => router.replace(`/room/${res.room.id}`),
            },
          ]
        );
      }
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('uuid')) {
        // Self-heal stale non-UUID token and retry
        try {
          await api.clearAuth();
          const authRes = await api.login('aarav@budigo.app', 'password123');
          setCurrentUser(authRes.user);
          const retryRes = await api.createRoom({
            roomName: roomName.trim(),
            destinationName: destinationName.trim(),
            destinationAddress: destinationAddress.trim() || destinationName.trim(),
            destinationLatitude: destinationLat,
            destinationLongitude: destinationLon,
            destinationPlaceId,
          });
          setCreatedRoom(retryRes.room);
          return;
        } catch (retryErr: any) {
          setGeneralError(retryErr.message);
        }
      } else {
        setGeneralError(err.message || 'Something went wrong creating the room');
      }

      if (Platform.OS !== 'web') {
        Alert.alert('Error Creating Room', err.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Create a Travel Room" />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* SUCCESS STATE */}
        {createdRoom ? (
          <View style={styles.successCard}>
            <View style={styles.successIconBadge}>
              <Text style={styles.successIcon}>🎉</Text>
            </View>
            <Text style={styles.successHeading}>Trip Room Created!</Text>
            <Text style={styles.successSubheading}>
              Share this unique 6-character room code with your friends so they can join your live map:
            </Text>

            {/* Room Code Callout */}
            <TouchableOpacity activeOpacity={0.8} onPress={copyCode} style={styles.codeContainer}>
              <Text style={styles.codeLabel}>YOUR ROOM CODE</Text>
              <Text style={styles.codeText}>{createdRoom.room_code}</Text>
              <View style={styles.copyBadge}>
                <Text style={styles.copyBadgeText}>{copied ? '✓ Copied to clipboard!' : 'Tap to copy code'}</Text>
              </View>
            </TouchableOpacity>

            {/* Trip Details Summary */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Trip Name:</Text>
                <Text style={styles.summaryValue}>{createdRoom.room_name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Destination:</Text>
                <Text style={styles.summaryValue}>{createdRoom.destination_name}</Text>
              </View>
              {createdRoom.destination_address && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Address:</Text>
                  <Text style={styles.summaryValue} numberOfLines={2}>
                    {createdRoom.destination_address}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Coordinates:</Text>
                <Text style={styles.summaryValue}>
                  {createdRoom.destination_latitude?.toFixed(4)}° N, {createdRoom.destination_longitude?.toFixed(4)}° E
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <Button
              title="Enter Live Travel Room 🗺️"
              onPress={() => router.replace(`/room/${createdRoom.id}`)}
              size="lg"
              style={styles.openRoomBtn}
            />

            <TouchableOpacity
              style={styles.anotherBtn}
              onPress={() => {
                setCreatedRoom(null);
                setRoomName('');
                setDestinationName('');
                setDestinationAddress('');
                setDestinationPlaceId('');
                setIsCustomSelected(false);
              }}
            >
              <Text style={styles.anotherBtnText}>+ Create another trip room</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* FORM STATE */
          <>
            {/* Auth Banner if not signed in */}
            {!currentUser && (
              <View style={styles.authBanner}>
                <View style={styles.authBannerHeader}>
                  <Text style={styles.authBannerTitle}>💡 Sign-in Required</Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                    <Text style={styles.authBannerLink}>Go to Login →</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.authBannerText}>
                  A room creator account is needed to host a trip. Click below for 1-tap test host sign-in:
                </Text>
                <Button
                  title="⚡ Quick Sign-In as Host (Aarav)"
                  size="sm"
                  variant="outline"
                  onPress={handleQuickLogin}
                  loading={authLoading}
                  style={styles.quickAuthBtn}
                />
              </View>
            )}

            {/* General Error Banner */}
            {generalError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {generalError}</Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.sectionHeading}>Trip Details</Text>

              <Input
                label="Trip Name"
                placeholder="e.g. Goa Weekend Trip"
                value={roomName}
                onChangeText={(text) => {
                  setRoomName(text);
                  if (errors.roomName) setErrors((prev) => ({ ...prev, roomName: undefined }));
                }}
                error={errors.roomName}
              />

              {/* Destination Search Section */}
              <View style={styles.destinationSection}>
                <View style={styles.destinationHeaderRow}>
                  <Text style={styles.destinationLabel}>Destination or Landmark</Text>
                  {searching && (
                    <View style={styles.searchingBadge}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.searchingText}>Searching Google Places...</Text>
                    </View>
                  )}
                </View>

                <View style={styles.searchBarRow}>
                  <View style={styles.searchInputWrapper}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Type any place (e.g. Baga Beach, Taj Mahal, Charminar)..."
                      placeholderTextColor={Colors.mutedText}
                      value={destinationName}
                      onChangeText={handleDestinationChange}
                      onBlur={() => destinationName.trim().length >= 2 && performSearch(destinationName)}
                      onSubmitEditing={() => performSearch(destinationName)}
                      returnKeyType="search"
                    />
                    {destinationName.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setDestinationName('');
                          setDestinationPlaceId('');
                          setAutocompleteSuggestions([]);
                          setSearchResults([]);
                          setIsCustomSelected(false);
                        }}
                        style={styles.clearBtn}
                      >
                        <Text style={styles.clearBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.searchActionBtn}
                    onPress={() => performSearch(destinationName)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.searchActionBtnText}>Search 🔍</Text>
                  </TouchableOpacity>
                </View>

                {errors.destinationName && (
                  <Text style={styles.fieldErrorText}>{errors.destinationName}</Text>
                )}

                {/* Search Error Notice */}
                {searchError && (
                  <Text style={styles.searchNoticeText}>ℹ️ {searchError}</Text>
                )}

                {/* Live Place Autocomplete Suggestions Dropdown */}
                {autocompleteSuggestions.length > 0 && (
                  <View style={styles.searchResultsContainer}>
                    <Text style={styles.resultsHeader}>Google Places Suggestions:</Text>
                    {autocompleteSuggestions.map((sugg, idx) => (
                      <TouchableOpacity
                        key={sugg.placeId || idx}
                        style={styles.resultItem}
                        onPress={() => selectSuggestion(sugg)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.resultIconCol}>
                          <Text style={styles.resultPinIcon}>📍</Text>
                        </View>
                        <View style={styles.resultInfoCol}>
                          <Text style={styles.resultName} numberOfLines={1}>
                            {sugg.mainText}
                          </Text>
                          {sugg.secondaryText ? (
                            <Text style={styles.resultAddress} numberOfLines={1}>
                              {sugg.secondaryText}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Fallback Text Search Results Dropdown */}
                {autocompleteSuggestions.length === 0 && searchResults.length > 0 && (
                  <View style={styles.searchResultsContainer}>
                    <Text style={styles.resultsHeader}>Select from Google Places:</Text>
                    {searchResults.map((place, idx) => (
                      <TouchableOpacity
                        key={place.placeId || idx}
                        style={styles.resultItem}
                        onPress={() => selectPlace(place)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.resultIconCol}>
                          <Text style={styles.resultPinIcon}>📍</Text>
                        </View>
                        <View style={styles.resultInfoCol}>
                          <View style={styles.resultTitleRow}>
                            <Text style={styles.resultName} numberOfLines={1}>
                              {place.name}
                            </Text>
                            {place.rating && (
                              <Text style={styles.ratingBadge}>★ {place.rating.toFixed(1)}</Text>
                            )}
                          </View>
                          <Text style={styles.resultAddress} numberOfLines={2}>
                            {place.address}
                          </Text>
                          <Text style={styles.resultCoords}>
                            {place.latitude.toFixed(4)}° N, {place.longitude.toFixed(4)}° E
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Selected Place Confirmation Box with LIVE GOOGLE MAP PREVIEW */}
                {isCustomSelected && (
                  <View style={styles.selectedPlaceCard}>
                    <View style={styles.selectedPlaceHeader}>
                      <Text style={styles.selectedBadgeText}>✓ DESTINATION CONFIRMED</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setIsCustomSelected(false);
                          setShowManualCoords(true);
                        }}
                      >
                        <Text style={styles.editCoordsLink}>Edit Pin ✏️</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.selectedPlaceName}>📍 {destinationName}</Text>
                    {destinationAddress ? (
                      <Text style={styles.selectedPlaceAddress}>{destinationAddress}</Text>
                    ) : null}
                    <View style={styles.selectedCoordsRow}>
                      <Text style={styles.selectedCoordsText}>
                        GPS: {destinationLat.toFixed(4)}° N, {destinationLon.toFixed(4)}° E
                      </Text>
                    </View>

                    {/* LIVE GOOGLE MAP CAMERA & DESTINATION MARKER PREVIEW */}
                    <DestinationPreviewMap
                      latitude={destinationLat}
                      longitude={destinationLon}
                      destinationName={destinationName}
                      destinationAddress={destinationAddress}
                      height={180}
                    />

                    {/* GOOGLE ROUTES API NAVIGATION PREVIEW */}
                    <View style={styles.routePreviewBox}>
                      <View style={styles.routeHeaderRow}>
                        <Text style={styles.routeHeaderTitle}>🗺️ Google Routes Navigation</Text>
                        {routeLoading && <ActivityIndicator size="small" color={Colors.primary} />}
                      </View>

                      {/* Travel Mode Selector */}
                      <View style={styles.modeSelectorRow}>
                        {(['DRIVE', 'WALK', 'BICYCLE'] as const).map((mode) => (
                          <TouchableOpacity
                            key={mode}
                            style={[
                              styles.modePill,
                              travelMode === mode && styles.modePillActive,
                            ]}
                            onPress={() => {
                              setTravelMode(mode);
                              updateRoutePreview(destinationLat, destinationLon, mode);
                            }}
                          >
                            <Text
                              style={[
                                styles.modePillText,
                                travelMode === mode && styles.modePillTextActive,
                              ]}
                            >
                              {mode === 'DRIVE' ? '🚗 Drive' : mode === 'WALK' ? '🚶 Walk' : '🚲 Bicycle'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Route Stats */}
                      {routePreview ? (
                        <View style={styles.routeStatsRow}>
                          <View style={styles.routeStatCol}>
                            <Text style={styles.routeStatLabel}>Road Distance</Text>
                            <Text style={styles.routeStatValue}>
                              {(routePreview.distanceMeters / 1000).toFixed(1)} km
                            </Text>
                          </View>
                          <View style={styles.routeStatDivider} />
                          <View style={styles.routeStatCol}>
                            <Text style={styles.routeStatLabel}>Travel Duration</Text>
                            <Text style={styles.routeStatValue}>
                              {Math.floor(routePreview.durationSeconds / 3600) > 0
                                ? `${Math.floor(routePreview.durationSeconds / 3600)} hr ${Math.round((routePreview.durationSeconds % 3600) / 60)} min`
                                : `${Math.round(routePreview.durationSeconds / 60)} min`}
                            </Text>
                          </View>
                          <View style={styles.routeStatDivider} />
                          <View style={styles.routeStatCol}>
                            <Text style={styles.routeStatLabel}>Engine</Text>
                            <Text style={[styles.routeStatValue, { color: '#27AE60' }]}>
                              Google Routes
                            </Text>
                          </View>
                        </View>
                      ) : routeError ? (
                        <Text style={styles.routeErrorNotice}>⚠️ {routeError}</Text>
                      ) : null}
                    </View>
                  </View>
                )}

                {/* Optional Custom Address Input */}
                <Input
                  label="Address / Landmark Notes (Optional)"
                  placeholder="e.g. Near West Gate, Parking Lot A"
                  value={destinationAddress}
                  onChangeText={setDestinationAddress}
                  containerStyle={styles.addressInputContainer}
                />

                {/* Collapsible Manual GPS Coordinates */}
                <TouchableOpacity
                  onPress={() => setShowManualCoords(!showManualCoords)}
                  style={styles.manualCoordsToggle}
                >
                  <Text style={styles.manualCoordsToggleText}>
                    {showManualCoords ? '▼ Hide GPS Coordinates' : '▶ Custom GPS Coordinates (Latitude / Longitude)'}
                  </Text>
                </TouchableOpacity>

                {showManualCoords && (
                  <View style={styles.manualCoordsBox}>
                    <Text style={styles.manualCoordsHint}>
                      Enter exact GPS coordinates (e.g. for campsites, private villas, or off-road spots):
                    </Text>
                    <View style={styles.coordsInputRow}>
                      <View style={styles.coordCol}>
                        <Text style={styles.coordInputLabel}>Latitude (-90 to 90)</Text>
                        <TextInput
                          style={styles.coordTextInput}
                          value={manualLatStr}
                          onChangeText={setManualLatStr}
                          placeholder="e.g. 15.5553"
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.coordCol}>
                        <Text style={styles.coordInputLabel}>Longitude (-180 to 180)</Text>
                        <TextInput
                          style={styles.coordTextInput}
                          value={manualLonStr}
                          onChangeText={setManualLonStr}
                          placeholder="e.g. 73.7517"
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <Button
                      title="Apply GPS Coordinates"
                      variant="outline"
                      size="sm"
                      onPress={applyManualCoords}
                      style={styles.applyCoordsBtn}
                    />
                  </View>
                )}

                {/* Quick Popular Ideas */}
                <Text style={styles.presetsLabel}>⚡ Or Choose a Popular Quick Idea:</Text>
                <View style={styles.presetsList}>
                  {PRESET_DESTINATIONS.map((preset, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => selectPreset(preset)}
                      style={[
                        styles.presetChip,
                        destinationName === preset.name && styles.presetChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          destinationName === preset.name && styles.presetTextActive,
                        ]}
                      >
                        {preset.tag} {preset.name.split(',')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Selected Coordinates Callout */}
            <View style={styles.coordBox}>
              <View>
                <Text style={styles.coordTitle}>Target Destination Coordinates:</Text>
                <Text style={styles.coordSubtitle}>
                  {destinationName ? destinationName : 'No destination selected'}
                </Text>
              </View>
              <Text style={styles.coordValue}>
                {destinationLat.toFixed(4)}° N, {destinationLon.toFixed(4)}° E
              </Text>
            </View>

            <Button
              title="Create Room & Get Code"
              onPress={handleCreate}
              loading={loading}
              size="lg"
              style={styles.createBtn}
            />
          </>
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
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  destinationSection: {
    marginBottom: 8,
  },
  destinationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  destinationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchingText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  searchBarRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 14,
    color: Colors.mutedText,
    fontWeight: '700',
  },
  searchActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchActionBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  fieldErrorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
    fontWeight: '500',
  },
  searchNoticeText: {
    fontSize: 12,
    color: Colors.mutedText,
    marginTop: 6,
    fontStyle: 'italic',
  },
  searchResultsContainer: {
    backgroundColor: '#FAFAF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: 10,
    padding: 8,
    maxHeight: 260,
  },
  resultsHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 6,
    paddingHorizontal: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  resultIconCol: {
    width: 28,
    alignItems: 'center',
  },
  resultPinIcon: {
    fontSize: 18,
  },
  resultInfoCol: {
    flex: 1,
    marginLeft: 6,
  },
  resultTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  ratingBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resultAddress: {
    fontSize: 12,
    color: Colors.mutedText,
    marginTop: 2,
  },
  resultCoords: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  selectedPlaceCard: {
    backgroundColor: '#F3FAF6',
    borderWidth: 1.5,
    borderColor: '#3D9873',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  selectedPlaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3D9873',
    letterSpacing: 0.8,
  },
  editCoordsLink: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  selectedPlaceName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  selectedPlaceAddress: {
    fontSize: 12,
    color: Colors.mutedText,
    marginBottom: 4,
  },
  selectedCoordsRow: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedCoordsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D7558',
  },
  addressInputContainer: {
    marginTop: 14,
  },
  manualCoordsToggle: {
    paddingVertical: 8,
    marginBottom: 6,
  },
  manualCoordsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  manualCoordsBox: {
    backgroundColor: '#F8F5F7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  manualCoordsHint: {
    fontSize: 12,
    color: Colors.mutedText,
    marginBottom: 8,
  },
  coordsInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  coordCol: {
    flex: 1,
  },
  coordInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  coordTextInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  applyCoordsBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  presetsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.mutedText,
    marginTop: 10,
    marginBottom: 8,
  },
  presetsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: Colors.background,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FAF2EC',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  presetTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  coordBox: {
    backgroundColor: '#EAE6EA',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coordTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  coordSubtitle: {
    fontSize: 12,
    color: Colors.mutedText,
    marginTop: 2,
    maxWidth: 200,
  },
  coordValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  createBtn: {
    marginTop: 24,
  },
  // Auth banner
  authBanner: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0D4BE',
  },
  authBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  authBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  authBannerLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  authBannerText: {
    fontSize: 12,
    color: Colors.mutedText,
    lineHeight: 18,
    marginBottom: 10,
  },
  quickAuthBtn: {
    alignSelf: 'flex-start',
  },
  // Error banner
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
  // Success Card
  successCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EDF8F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 32,
  },
  successHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubheading: {
    fontSize: 14,
    color: Colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  codeContainer: {
    backgroundColor: '#FAF2EC',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  codeText: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 6,
  },
  copyBadge: {
    marginTop: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  copyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  summaryBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.mutedText,
    width: 90,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  openRoomBtn: {
    width: '100%',
    marginBottom: 12,
  },
  anotherBtn: {
    paddingVertical: 10,
  },
  anotherBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Route Navigation Preview Styles
  routePreviewBox: {
    marginTop: 12,
    backgroundColor: '#FAF7F5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modePillTextActive: {
    color: Colors.white,
  },
  routeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  routeStatCol: {
    alignItems: 'center',
    flex: 1,
  },
  routeStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#EAE6E1',
  },
  routeStatLabel: {
    fontSize: 10,
    color: Colors.mutedText,
    marginBottom: 2,
  },
  routeStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  routeErrorNotice: {
    fontSize: 11,
    color: '#E67E22',
    fontStyle: 'italic',
  },
});
