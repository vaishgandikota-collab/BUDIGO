import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { MeetingPointCard } from '../../components/meeting/MeetingPointCard';
import { api } from '../../services/api';
import { MeetingPoint } from '../../types';

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '✨' },
  { key: 'cafe', label: 'Cafés', icon: '☕' },
  { key: 'restaurant', label: 'Restaurants', icon: '🍽️' },
  { key: 'shopping_mall', label: 'Malls', icon: '🛍️' },
  { key: 'tourist_attraction', label: 'Attractions', icon: '🏛️' },
  { key: 'park', label: 'Parks', icon: '🌳' },
  { key: 'hotel', label: 'Hotels', icon: '🏨' },
  { key: 'parking', label: 'Parking', icon: '🅿️' },
  { key: 'transit_station', label: 'Transit', icon: '🚇' },
];

const RADIUS_OPTIONS = [
  { meters: 1000, label: '1 km' },
  { meters: 2000, label: '2 km' },
  { meters: 5000, label: '5 km' },
  { meters: 10000, label: '10 km' },
];

// Interactive Web Map Component for Meeting Points
const MeetingPointsMapFrame = ({
  destination,
  meetingPoints,
  selectedId,
}: {
  destination: { name: string; address?: string; latitude: number; longitude: number };
  meetingPoints: MeetingPoint[];
  selectedId: string | null;
}) => {
  const selectedPoint = meetingPoints.find((m) => m.id === selectedId) || meetingPoints[0];
  const destLat = destination.latitude;
  const destLon = destination.longitude;

  // Prepare map data
  const pointsData = meetingPoints.map((mp, idx) => ({
    id: mp.id,
    rank: idx + 1,
    name: mp.place_name,
    category: mp.category || 'Spot',
    address: mp.address || '',
    lat: mp.latitude,
    lon: mp.longitude,
    dist: mp.distance_from_dest_meters ? `${(mp.distance_from_dest_meters / 1000).toFixed(1)} km` : '',
    time: mp.driving_time_from_dest_seconds ? `${Math.round(mp.driving_time_from_dest_seconds / 60)} min` : '',
    polyline: mp.dest_route_polyline || '',
    isSelected: mp.id === selectedId,
  }));

  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .dest-pin {
      background: #D1956A;
      border: 3px solid #FFFFFF;
      color: #FFFFFF;
      font-size: 16px;
      font-weight: 800;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .mp-pin {
      background: #474459;
      border: 2px solid #FFFFFF;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 800;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    .mp-pin-top {
      background: #D1956A;
      width: 36px;
      height: 36px;
      font-size: 14px;
      border: 3px solid #FFD700;
    }
    .mp-pin-selected {
      background: #27AE60 !important;
      border: 3px solid #FFFFFF !important;
      transform: scale(1.18);
      box-shadow: 0 4px 14px rgba(39, 174, 96, 0.6);
      z-index: 1000 !important;
    }
    .custom-ctrl {
      background: #FFFFFF;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      padding: 6px 10px;
      font-weight: 700;
      font-size: 12px;
      color: #474459;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      border: 1px solid #EAE6E1;
      margin-bottom: 8px;
    }
    .custom-ctrl:hover {
      background: #FAF5F2;
      color: #D1956A;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    function decodePolyline(encoded) {
      if (!encoded) return [];
      var points = [];
      var index = 0, len = encoded.length;
      var lat = 0, lng = 0;
      while (index < len) {
        var b, shift = 0, result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push([lat / 1e5, lng / 1e5]);
      }
      return points;
    }

    var map = L.map('map', { zoomControl: false }).setView([${destLat}, ${destLon}], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var group = [ [${destLat}, ${destLon}] ];

    // 1. Destination Marker
    var destIcon = L.divIcon({
      className: 'dest-pin',
      html: '📍',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    var destMarker = L.marker([${destLat}, ${destLon}], { icon: destIcon }).addTo(map);
    destMarker.bindPopup("<b>📍 Target Destination</b><br/>${destination.name.replace(/"/g, '\\"')}<br/><small>${(destination.address || '').replace(/"/g, '\\"')}</small>");

    // 2. Candidate Meeting Points
    var points = ${JSON.stringify(pointsData)};
    var selected = points.find(function(p) { return p.isSelected; }) || points[0];

    points.forEach(function(p) {
      if (!p.lat || !p.lon) return;
      group.push([p.lat, p.lon]);

      var isSel = selected && selected.id === p.id;
      var className = 'mp-pin' + (p.rank <= 3 ? ' mp-pin-top' : '') + (isSel ? ' mp-pin-selected' : '');
      var label = p.rank <= 3 ? ('★' + p.rank) : p.rank;

      var icon = L.divIcon({
        className: className,
        html: label,
        iconSize: isSel ? [38, 38] : [32, 32],
        iconAnchor: isSel ? [19, 19] : [16, 16]
      });

      var m = L.marker([p.lat, p.lon], { icon: icon }).addTo(map);
      m.bindPopup("<b>#" + p.rank + ": " + p.name.replace(/"/g, '\\"') + "</b><br/>" +
                  p.category + "<br/>" +
                  (p.dist ? ("Road: " + p.dist + " (" + p.time + ")") : "") + "<br/>" +
                  "<small>" + p.address.replace(/"/g, '\\"') + "</small>");
    });

    // 3. Draw Route Polyline from Destination to Selected Meeting Point
    if (selected && selected.lat && selected.lon) {
      var routePoints = [];
      if (selected.polyline) {
        routePoints = decodePolyline(selected.polyline);
      }
      if (routePoints.length === 0) {
        routePoints = [ [${destLat}, ${destLon}], [selected.lat, selected.lon] ];
      }

      L.polyline(routePoints, {
        color: '#D1956A',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Fit between destination and selected point
      map.fitBounds([ [${destLat}, ${destLon}], [selected.lat, selected.lon] ], { padding: [50, 50] });
    } else if (group.length > 1) {
      map.fitBounds(group, { padding: [40, 40] });
    }

    // Controls
    var customControl = L.control({ position: 'topright' });
    customControl.onAdd = function() {
      var div = L.DomUtil.create('div');
      div.innerHTML = '<div class="custom-ctrl" onclick="map.fitBounds(' + JSON.stringify(group) + ', { padding: [40, 40] })">🗺️ Fit All</div>' +
                      '<div class="custom-ctrl" onclick="map.setView([' + ${destLat} + ', ' + ${destLon} + '], 15)">📍 Destination</div>';
      return div;
    };
    customControl.addTo(map);
  </script>
</body>
</html>
  `;

  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      srcDoc: mapHtml,
      style: {
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
        backgroundColor: '#EAE7EA',
      },
      title: 'Meeting Points Map',
    });
  }

  return (
    <View style={styles.nativeMapPlaceholder}>
      <Text style={styles.nativeMapTitle}>📍 {destination.name}</Text>
      <Text style={styles.nativeMapSub}>
        {meetingPoints.length} candidate spots discovered near destination
      </Text>
    </View>
  );
};

export default function MeetingPointFinderScreen() {
  const params = useLocalSearchParams<{
    roomId?: string;
    destName?: string;
    destAddress?: string;
    destLat?: string;
    destLon?: string;
  }>();
  const roomId = params.roomId || 'budi26-mock-room-id';
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;

  const [mode, setMode] = useState<'near_destination' | 'fair_for_everyone'>('near_destination');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRadius, setSelectedRadius] = useState(2000);
  const [recommendations, setRecommendations] = useState<MeetingPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Build initial destination from URL params if available, otherwise use a neutral default
  // that will be overwritten once the room data or search API responds.
  const [roomDestination, setRoomDestination] = useState(() => {
    const paramLat = params.destLat ? parseFloat(params.destLat) : NaN;
    const paramLon = params.destLon ? parseFloat(params.destLon) : NaN;
    if (!isNaN(paramLat) && !isNaN(paramLon)) {
      return {
        name: params.destName || 'Selected Destination',
        address: params.destAddress || '',
        latitude: paramLat,
        longitude: paramLon,
      };
    }
    // Neutral default – will be replaced by API or room lookup below
    return {
      name: 'Loading destination…',
      address: '',
      latitude: 17.3850,
      longitude: 78.4867,
    };
  });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // On mount, fetch the room details to get the real destination
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const roomRes = await api.getRoom(roomId);
        if (cancelled) return;
        if (roomRes.success && roomRes.room) {
          const r = roomRes.room;
          if (r.destination_latitude && r.destination_longitude) {
            setRoomDestination({
              name: r.destination_name || 'Destination',
              address: r.destination_address || '',
              latitude: r.destination_latitude,
              longitude: r.destination_longitude,
            });
          }
        }
      } catch (err) {
        console.warn('[MeetingPointFinder] Could not fetch room destination:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  const fetchRecommendations = async (
    cat = selectedCategory,
    rad = selectedRadius,
    searchMode = mode,
    explicitDest?: { name: string; address?: string; latitude: number; longitude: number }
  ) => {
    try {
      setLoading(true);
      setErrorMsg(null);

      let targetDest = explicitDest;
      if (!targetDest) {
        const paramLat = params.destLat ? parseFloat(params.destLat) : NaN;
        const paramLon = params.destLon ? parseFloat(params.destLon) : NaN;
        if (!isNaN(paramLat) && !isNaN(paramLon)) {
          targetDest = {
            name: params.destName || 'Selected Destination',
            address: params.destAddress || '',
            latitude: paramLat,
            longitude: paramLon,
          };
        } else {
          try {
            const roomRes = await api.getRoom(roomId);
            if (roomRes.success && roomRes.room?.destination_latitude && roomRes.room?.destination_longitude) {
              targetDest = {
                name: roomRes.room.destination_name || 'Selected Destination',
                address: roomRes.room.destination_address || '',
                latitude: roomRes.room.destination_latitude,
                longitude: roomRes.room.destination_longitude,
              };
            }
          } catch {
            // Room lookup failed; backend will resolve or use default
          }
        }
      }

      if (targetDest) {
        setRoomDestination({
          name: targetDest.name,
          address: targetDest.address || '',
          latitude: targetDest.latitude,
          longitude: targetDest.longitude,
        });
      }

      const res = await api.searchMeetingPoints(roomId, cat, {
        radiusMeters: rad,
        mode: searchMode,
        destination: targetDest,
      });

      if (res.success && res.recommendations) {
        setRecommendations(res.recommendations);
        if (res.roomDestination && !targetDest) {
          setRoomDestination(res.roomDestination);
        }
        if (res.recommendations.length > 0) {
          setSelectedPointId(res.recommendations[0].id);
        }
      }
      setHasSearched(true);
    } catch (err: any) {
      console.warn('[MeetingPointFinder] Search error:', err);
      setErrorMsg(err.message || 'Failed to search meeting points near destination');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(selectedCategory, selectedRadius, mode);
  }, [roomId, mode, params.destLat, params.destLon]);

  const onSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    fetchRecommendations(cat, selectedRadius, mode);
  };

  const onSelectRadius = (radiusMeters: number) => {
    setSelectedRadius(radiusMeters);
    fetchRecommendations(selectedCategory, radiusMeters, mode);
  };

  const onSwitchMode = (newMode: 'near_destination' | 'fair_for_everyone') => {
    setMode(newMode);
    fetchRecommendations(selectedCategory, selectedRadius, newMode);
  };

  const handleConfirm = async (meetingPointId: string) => {
    try {
      await api.selectMeetingPoint(meetingPointId);
      Alert.alert(
        'Meeting Point Confirmed! 📍',
        'Synchronized to all room buddies on the live map.',
        [{ text: 'View on Room Map', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Notice', 'Meeting point selected and saved for the group trip.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  const handleStartVote = (mpId: string) => {
    router.push({ pathname: `/voting/${roomId}`, params: { initialPick: mpId } });
  };

  const topThree = recommendations.slice(0, 3);
  const remaining = recommendations.slice(3);

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. TOP HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Smart Meeting Point Finder</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Real Places & Route Navigation via Google Places (New)
          </Text>
        </View>
        <TouchableOpacity
          style={styles.voteNavBtn}
          onPress={() => router.push(`/voting/${roomId}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.voteNavBtnText}>🗳️ Vote</Text>
        </TouchableOpacity>
      </View>

      {/* 2. AUTOMATIC ROOM DESTINATION BANNER */}
      <View style={styles.destBanner}>
        <View style={styles.destBannerHeader}>
          <View style={styles.destTag}>
            <Text style={styles.destTagText}>TARGET DESTINATION</Text>
          </View>
          <Text style={styles.destCoords}>
            GPS: {roomDestination.latitude.toFixed(4)}° N, {roomDestination.longitude.toFixed(4)}° E
          </Text>
        </View>
        <Text style={styles.destName} numberOfLines={1}>
          📍 {roomDestination.name}
        </Text>
        {roomDestination.address ? (
          <Text style={styles.destAddress} numberOfLines={1}>
            {roomDestination.address}
          </Text>
        ) : null}
      </View>

      {/* 3. MODE SWITCHER TABS: "Near Destination" (Default) vs "Fair for Everyone" (Minimax) */}
      <View style={styles.modeTabsRow}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'near_destination' && styles.modeTabActive]}
          onPress={() => onSwitchMode('near_destination')}
          activeOpacity={0.85}
        >
          <Text style={[styles.modeTabText, mode === 'near_destination' && styles.modeTabTextActive]}>
            📍 Near Destination (Default)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === 'fair_for_everyone' && styles.modeTabActive]}
          onPress={() => onSwitchMode('fair_for_everyone')}
          activeOpacity={0.85}
        >
          <Text style={[styles.modeTabText, mode === 'fair_for_everyone' && styles.modeTabTextActive]}>
            ⚖️ Fair for Everyone (Minimax)
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. FILTERS BAR: Radius & Categories */}
      <View style={styles.filtersSection}>
        {/* Radius Filter Chips */}
        {mode === 'near_destination' && (
          <View style={styles.radiusRow}>
            <Text style={styles.filterLabel}>Radius:</Text>
            {RADIUS_OPTIONS.map((r) => {
              const active = selectedRadius === r.meters;
              return (
                <TouchableOpacity
                  key={r.meters}
                  style={[styles.radiusChip, active && styles.radiusChipActive]}
                  onPress={() => onSelectRadius(r.meters)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.radiusText, active && styles.radiusTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => onSelectCategory(cat.key)}
                style={[styles.catChip, active && styles.catChipActive]}
                activeOpacity={0.8}
              >
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. MAIN CONTENT AREA (Split on Desktop, Stacked on Mobile) */}
      <View style={[styles.mainLayout, isDesktop && styles.desktopLayout]}>
        {/* LEFT COLUMN: Map Canvas */}
        <View style={[styles.mapContainer, isDesktop && styles.desktopMapContainer]}>
          <MeetingPointsMapFrame
            destination={roomDestination}
            meetingPoints={recommendations}
            selectedId={selectedPointId}
          />
        </View>

        {/* RIGHT COLUMN / BOTTOM: Scrollable Recommendations */}
        <ScrollView
          style={[styles.resultsScroll, isDesktop && styles.desktopResultsScroll]}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingTitle}>Searching Google Places (New)...</Text>
              <Text style={styles.loadingDesc}>
                Discovering venues around {roomDestination.name} & computing road routes
              </Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchRecommendations(selectedCategory, selectedRadius, mode)}
              >
                <Text style={styles.retryBtnText}>Retry Search</Text>
              </TouchableOpacity>
            </View>
          ) : recommendations.length > 0 ? (
            <View style={styles.resultsList}>
              {/* TOP 3 RECOMMENDATIONS SECTION */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🏆 Top Recommendations</Text>
                <Text style={styles.sectionBadge}>Best Matches</Text>
              </View>

              {topThree.map((mp, index) => (
                <MeetingPointCard
                  key={mp.id || index}
                  meetingPoint={mp}
                  rankIndex={index}
                  isSelected={selectedPointId === mp.id}
                  destinationName={roomDestination.name}
                  mode={mode}
                  onViewOnMap={() => setSelectedPointId(mp.id)}
                  onSelect={() => handleConfirm(mp.id)}
                  onVote={() => handleStartVote(mp.id)}
                  isCreator={true}
                />
              ))}

              {/* REMAINING RESULTS */}
              {remaining.length > 0 && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 14 }]}>
                    <Text style={styles.sectionTitle}>
                      📍 More Places Near Destination ({remaining.length})
                    </Text>
                  </View>

                  {remaining.map((mp, index) => (
                    <MeetingPointCard
                      key={mp.id || index + 3}
                      meetingPoint={mp}
                      rankIndex={index + 3}
                      isSelected={selectedPointId === mp.id}
                      destinationName={roomDestination.name}
                      mode={mode}
                      onViewOnMap={() => setSelectedPointId(mp.id)}
                      onSelect={() => handleConfirm(mp.id)}
                      onVote={() => handleStartVote(mp.id)}
                      isCreator={true}
                    />
                  ))}
                </>
              )}
            </View>
          ) : (
            hasSearched && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No places found within {selectedRadius / 1000} km</Text>
                <Text style={styles.emptyDesc}>
                  Try expanding your search radius to discover places further out:
                </Text>
                <View style={styles.emptyActionsRow}>
                  <TouchableOpacity
                    style={styles.expandRadiusBtn}
                    onPress={() => onSelectRadius(5000)}
                  >
                    <Text style={styles.expandRadiusText}>Expand to 5 km</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.expandRadiusBtn}
                    onPress={() => onSelectRadius(10000)}
                  >
                    <Text style={styles.expandRadiusText}>Expand to 10 km</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6E1',
    zIndex: 10,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  backIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.mutedText,
    marginTop: 1,
  },
  voteNavBtn: {
    backgroundColor: '#FAF2EC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1956A',
  },
  voteNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D1956A',
  },

  // Destination Banner
  destBanner: {
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  destBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  destTag: {
    backgroundColor: '#FAF0E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  destTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D1956A',
    letterSpacing: 0.5,
  },
  destCoords: {
    fontSize: 10,
    color: Colors.mutedText,
    fontWeight: '600',
  },
  destName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  destAddress: {
    fontSize: 11,
    color: Colors.mutedText,
    marginTop: 1,
  },

  // Mode Switcher Tabs
  modeTabsRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: '#EAE6E1',
    padding: 3,
    borderRadius: 12,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.mutedText,
  },
  modeTabTextActive: {
    color: '#D1956A',
  },

  // Filters Section
  filtersSection: {
    paddingHorizontal: 12,
    marginBottom: 6,
    gap: 6,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.mutedText,
  },
  radiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  radiusChipActive: {
    backgroundColor: '#D1956A',
    borderColor: '#D1956A',
  },
  radiusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  radiusTextActive: {
    color: Colors.white,
  },
  catScroll: {
    gap: 6,
    paddingBottom: 2,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    gap: 4,
  },
  catChipActive: {
    backgroundColor: '#FAF2EC',
    borderColor: '#D1956A',
  },
  catIcon: {
    fontSize: 13,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  catLabelActive: {
    color: '#D1956A',
  },

  // Main Layout
  mainLayout: {
    flex: 1,
    flexDirection: 'column',
  },
  desktopLayout: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 12,
  },
  mapContainer: {
    height: 240,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAE6E1',
    backgroundColor: '#EAE7EA',
  },
  desktopMapContainer: {
    flex: 1.2,
    height: 'auto',
    marginHorizontal: 0,
    marginBottom: 12,
    minHeight: 460,
  },
  nativeMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAE7EA',
    padding: 16,
  },
  nativeMapTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  nativeMapSub: {
    fontSize: 12,
    color: Colors.mutedText,
    marginTop: 4,
  },

  // Results Scroll
  resultsScroll: {
    flex: 1,
  },
  desktopResultsScroll: {
    flex: 1,
    maxWidth: 540,
  },
  resultsContent: {
    paddingHorizontal: 12,
    paddingBottom: 36,
  },
  resultsList: {
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D1956A',
  },

  // Loading & Empty States
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  loadingDesc: {
    fontSize: 12,
    color: Colors.mutedText,
    textAlign: 'center',
  },
  errorBox: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    marginVertical: 10,
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#E53935',
    textAlign: 'center',
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E53935',
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E53935',
  },
  emptyBox: {
    padding: 28,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    marginVertical: 10,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 12,
    color: Colors.mutedText,
    textAlign: 'center',
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  expandRadiusBtn: {
    backgroundColor: '#D1956A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  expandRadiusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
});
