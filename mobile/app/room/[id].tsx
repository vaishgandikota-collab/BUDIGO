import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useRoom } from '../../hooks/useRoom';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { LocationService } from '../../services/location';
import { MapView } from '../../components/maps/MapView';
import { MemberListItem } from '../../components/room/MemberListItem';
import { MemberDetailSheet } from '../../components/members/MemberDetailSheet';
import { Badge } from '../../components/common/Badge';

export default function TravelRoomMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth >= 860;

  const {
    room,
    members,
    locations,
    confirmedMeetingPoint,
    isLoading,
    error,
    refreshRoom,
  } = useRoom(id);

  // Hook up device GPS tracking for this active room
  const { isSharing, trackingState, currentCoords, currentTelemetry, toggleSharing } = useLocationTracking(id, Boolean(room));

  // Road route distance & ETA from Google Routes API for current user
  const [myRouteMetrics, setMyRouteMetrics] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null);
  const lastRouteOriginRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!room?.destination_latitude || !room?.destination_longitude || !currentCoords) return;
    if (lastRouteOriginRef.current) {
      const moved = LocationService.calculateDistance(currentCoords, lastRouteOriginRef.current);
      if (moved < 100) return;
    }
    lastRouteOriginRef.current = currentCoords;
    let cancelled = false;
    api.calculateRoute(
      currentCoords,
      { latitude: room.destination_latitude, longitude: room.destination_longitude },
      'DRIVE'
    ).then((res) => {
      if (!cancelled && res.success && res.route) {
        setMyRouteMetrics({
          distanceMeters: res.route.distanceMeters,
          durationSeconds: res.route.durationSeconds,
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentCoords?.latitude, currentCoords?.longitude, room?.destination_latitude, room?.destination_longitude]);

  // Merge local GPS telemetry (distance, ETA, speed) into the locations map for the current user
  const mergedLocations = React.useMemo(() => {
    if (!user?.id || !currentCoords) return locations;
    const merged = new Map(locations);
    const existing = merged.get(user.id);
    // Prefer Google Routes road distance/ETA, then server values, then Haversine fallback
    let distMeters = myRouteMetrics?.distanceMeters ?? existing?.distance_to_dest_meters;
    let etaSecs = myRouteMetrics?.durationSeconds ?? existing?.eta_seconds;
    const gpsSpeed = currentTelemetry?.speed ?? existing?.speed ?? 0;
    if (room && currentCoords) {
      const haversineDist = LocationService.calculateDistance(currentCoords, {
        latitude: room.destination_latitude || 0,
        longitude: room.destination_longitude || 0,
      });
      if (distMeters === undefined || distMeters === null) {
        distMeters = Math.round(haversineDist);
      }
      if (etaSecs === undefined || etaSecs === null) {
        if (gpsSpeed > 0.5) {
          etaSecs = Math.round(distMeters / gpsSpeed);
        } else {
          etaSecs = Math.round((distMeters / 1000) / 30 * 3600);
        }
      }
    }
    const status =
      distMeters !== undefined && distMeters < 150
        ? 'Arrived'
        : distMeters !== undefined && distMeters < 1000
        ? 'Near Destination'
        : 'On the Way';
    merged.set(user.id, {
      room_id: id,
      user_id: user.id,
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
      accuracy: currentTelemetry?.accuracy ?? undefined,
      speed: gpsSpeed,
      heading: currentTelemetry?.heading ?? undefined,
      distance_to_dest_meters: distMeters,
      eta_seconds: etaSecs,
      status,
      displayName: existing?.displayName || user.full_name || 'You',
      markerColor: existing?.markerColor || '#D1956A',
      updated_at: new Date().toISOString(),
    });
    return merged;
  }, [locations, currentCoords, currentTelemetry, myRouteMetrics, user?.id, user?.full_name, room, id]);

  // Merge live distance, ETA, and status into members list as well
  const mergedMembers = React.useMemo(() => {
    return members.map((m) => {
      const loc = mergedLocations.get(m.user_id);
      if (!loc) return m;
      return {
        ...m,
        distance_to_dest_meters: loc.distance_to_dest_meters ?? m.distance_to_dest_meters,
        eta_seconds: loc.eta_seconds ?? m.eta_seconds,
        status: loc.status ?? m.status,
      };
    });
  }, [members, mergedLocations]);

  // Selected member for detail sheet
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isMemberListExpanded, setIsMemberListExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const shareRoomCode = async () => {
    if (!room) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(room.room_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      return;
    }
    try {
      await Share.share({
        message: `Join our Budigo trip "${room.room_name}"! Use code: ${room.room_code} to track our journey together.`,
      });
    } catch (e) {}
  };

  if (isLoading && !room) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connecting to travel room...</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>🗺️</Text>
          <Text style={styles.errorHeading}>Unable to Load Travel Room</Text>
          <Text style={styles.errorMessage}>{error || 'The room could not be found or connection timed out.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refreshRoom} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>🔄 Retry Connection</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/')} activeOpacity={0.8}>
            <Text style={styles.backHomeBtnText}>← Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const selectedMember = mergedMembers.find((m) => m.user_id === selectedMemberId);
  const selectedLocation = selectedMemberId ? mergedLocations.get(selectedMemberId) : undefined;
  const arrivedCount = mergedMembers.filter((m) => m.status === 'Arrived').length;

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. TOP HEADER - Structured flex flow, zero overlap with content */}
      <View style={[styles.topHeaderContainer, !isDesktop && styles.topHeaderFloating]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.roomInfo}>
            <Text style={styles.roomName} numberOfLines={1}>
              {room.room_name}
            </Text>
            <Text style={styles.roomDest} numberOfLines={1}>
              📍 {room.destination_name}
            </Text>
          </View>

          {/* Share / Copy Code Pill */}
          <TouchableOpacity
            style={styles.codeBadge}
            onPress={shareRoomCode}
            activeOpacity={0.8}
          >
            <Text style={styles.codePrefix}>CODE</Text>
            <Text style={styles.codeText}>#{room.room_code}</Text>
            <Text style={styles.shareIcon}>{copiedCode ? '✓' : '📋'}</Text>
          </TouchableOpacity>
        </View>

        {/* Location Sharing Alert Banner - Flows cleanly beneath header, never overlaps! */}
        {(!isSharing || trackingState === 'unavailable') && (
          <TouchableOpacity
            style={[
              styles.sharingStatusPill,
              trackingState === 'unavailable' && styles.sharingUnavailablePill,
            ]}
            onPress={toggleSharing}
            activeOpacity={0.85}
          >
            <Text style={styles.sharingStatusText} numberOfLines={1}>
              {trackingState === 'unavailable'
                ? '⚠️ GPS Permission Required • Tap to grant'
                : '⏸️ Location Sharing Paused • Tap to resume live GPS'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. BODY CONTENT (Desktop 2-Column Split vs Mobile View) */}
      {isDesktop ? (
        /* DESKTOP SPLIT VIEW (> 860px) */
        <View style={styles.desktopContainer}>
          {/* LEFT COLUMN: Map & Action Buttons */}
          <View style={styles.desktopLeftCol}>
            <View style={styles.desktopMapWrapper}>
              <MapView
                room={room}
                currentUserId={user?.id}
                myLocation={currentCoords}
                locations={mergedLocations}
                meetingPoint={confirmedMeetingPoint}
                onSelectMember={(memberId) => setSelectedMemberId(memberId)}
              />
            </View>

            {/* Desktop Action Buttons Pinned Under Map */}
            <View style={styles.desktopActionsRow}>
              <TouchableOpacity
                style={[styles.desktopActionBtn, styles.primaryActionBtn]}
                onPress={() => router.push({
                  pathname: '/meeting-points/finder',
                  params: {
                    roomId: room.id,
                    destName: room.destination_name,
                    destAddress: room.destination_address || '',
                    destLat: String(room.destination_latitude),
                    destLon: String(room.destination_longitude),
                  },
                })}
                activeOpacity={0.85}
              >
                <Text style={styles.desktopActionIcon}>⭐</Text>
                <Text style={styles.primaryActionBtnText}>Find Meeting Point</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.desktopActionBtn}
                onPress={() => router.push({ pathname: '/room/progress', params: { roomId: room.id } })}
                activeOpacity={0.85}
              >
                <Text style={styles.desktopActionIcon}>📊</Text>
                <Text style={styles.desktopActionText}>Trip Progress</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.desktopActionBtn, !isSharing && styles.sharingPausedBtn]}
                onPress={toggleSharing}
                activeOpacity={0.85}
              >
                <Text style={styles.desktopActionIcon}>{isSharing ? '📡' : '🛑'}</Text>
                <Text style={styles.desktopActionText}>{isSharing ? 'Sharing On' : 'Paused'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* RIGHT COLUMN: Coordination Sidebar */}
          <ScrollView
            style={styles.desktopRightCol}
            contentContainerStyle={styles.desktopSidebarContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Target Destination Card */}
            <View style={styles.sidebarCard}>
              <View style={styles.sidebarCardHeader}>
                <Text style={styles.sidebarCardTitle}>📍 Target Destination</Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active Trip</Text>
                </View>
              </View>
              <Text style={styles.destMainName}>{room.destination_name}</Text>
              {room.destination_address ? (
                <Text style={styles.destAddressText}>{room.destination_address}</Text>
              ) : null}
              <View style={styles.destCoordsPill}>
                <Text style={styles.destCoordsText}>
                  GPS: {room.destination_latitude?.toFixed(4)}° N, {room.destination_longitude?.toFixed(4)}° E
                </Text>
              </View>
            </View>

            {/* Confirmed Meeting Point Card */}
            {confirmedMeetingPoint && (
              <View style={styles.meetingCard}>
                <View style={styles.sidebarCardHeader}>
                  <Text style={styles.meetingCardTitle}>⭐ Confirmed Meeting Point</Text>
                  <Text style={styles.confirmedBadgeText}>Selected</Text>
                </View>
                <Text style={styles.meetingPlaceName}>{confirmedMeetingPoint.place_name}</Text>
                {confirmedMeetingPoint.address ? (
                  <Text style={styles.meetingAddressText}>{confirmedMeetingPoint.address}</Text>
                ) : null}
                <Text style={styles.meetingCategoryText}>Category: {confirmedMeetingPoint.category || 'Venue'}</Text>
              </View>
            )}

            {/* Live Buddies Section */}
            <View style={styles.buddiesSection}>
              <View style={styles.buddiesHeaderRow}>
                <Text style={styles.buddiesTitle}>Travel Buddies ({members.length})</Text>
                <Text style={styles.buddiesSub}>{arrivedCount} of {members.length} arrived safely</Text>
              </View>

              <View style={styles.membersList}>
                {mergedMembers.map((member) => (
                  <MemberListItem
                    key={member.id}
                    member={member}
                    isCurrentUser={member.user_id === user?.id}
                    onPress={() => setSelectedMemberId(member.user_id)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      ) : (
        /* MOBILE VIEW (< 860px) WITH ZERO-OVERLAP DOCKED TRAY */
        <View style={styles.mobileContainer}>
          {/* Map fills viewport */}
          <View style={styles.mobileMapContainer}>
            <MapView
              room={room}
              currentUserId={user?.id}
              myLocation={currentCoords}
              locations={mergedLocations}
              meetingPoint={confirmedMeetingPoint}
              onSelectMember={(memberId) => setSelectedMemberId(memberId)}
            />
          </View>

          {/* DOCKED UNIFIED BOTTOM CONTAINER: Shortcuts Row + Collapsible Member Tray */}
          <View style={[styles.dockedBottomContainer, isMemberListExpanded && styles.dockedBottomExpanded]}>
            {/* Row 1: Action Shortcuts (Pinned to tray, NEVER buried!) */}
            <View style={styles.mobileShortcutsRow}>
              <TouchableOpacity
                style={[styles.mobileShortcutBtn, styles.primaryShortcutBtn]}
                onPress={() => router.push({
                  pathname: '/meeting-points/finder',
                  params: {
                    roomId: room.id,
                    destName: room.destination_name,
                    destAddress: room.destination_address || '',
                    destLat: String(room.destination_latitude),
                    destLon: String(room.destination_longitude),
                  },
                })}
                activeOpacity={0.85}
              >
                <Text style={styles.mobileShortcutIcon}>⭐</Text>
                <Text style={styles.primaryShortcutText} numberOfLines={1}>Meet Point</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mobileShortcutBtn}
                onPress={() => router.push({ pathname: '/room/progress', params: { roomId: room.id } })}
                activeOpacity={0.85}
              >
                <Text style={styles.mobileShortcutIcon}>📊</Text>
                <Text style={styles.mobileShortcutText} numberOfLines={1}>Progress</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mobileShortcutBtn, !isSharing && styles.sharingPausedBtn]}
                onPress={toggleSharing}
                activeOpacity={0.85}
              >
                <Text style={styles.mobileShortcutIcon}>{isSharing ? '📡' : '🛑'}</Text>
                <Text style={styles.mobileShortcutText} numberOfLines={1}>
                  {isSharing ? 'Sharing' : 'Paused'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Row 2: Tray Header Toggle */}
            <TouchableOpacity
              style={styles.trayHeader}
              onPress={() => setIsMemberListExpanded(!isMemberListExpanded)}
              activeOpacity={0.8}
            >
              <View style={styles.trayHandle} />
              <View style={styles.trayInfoRow}>
                <View style={styles.trayStats}>
                  <Text style={styles.trayTitle}>Buddies ({members.length})</Text>
                  <Text style={styles.traySubtitle}>
                    {arrivedCount} of {members.length} arrived safely
                  </Text>
                </View>
                <Text style={styles.trayArrow}>
                  {isMemberListExpanded ? '▼ Hide' : '▲ View All'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Row 3: Expanded Member List */}
            {isMemberListExpanded && (
              <ScrollView
                style={styles.mobileMembersScroll}
                contentContainerStyle={styles.mobileMembersContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {mergedMembers.map((member) => (
                  <MemberListItem
                    key={member.id}
                    member={member}
                    isCurrentUser={member.user_id === user?.id}
                    onPress={() => setSelectedMemberId(member.user_id)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* Screen 8: Member Details Sheet Modal */}
      <MemberDetailSheet
        visible={Boolean(selectedMemberId)}
        member={selectedMember}
        location={selectedLocation}
        destinationName={room.destination_name}
        destinationCoords={
          room.destination_latitude && room.destination_longitude
            ? { latitude: room.destination_latitude, longitude: room.destination_longitude }
            : undefined
        }
        onClose={() => setSelectedMemberId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5F7',
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F5F7',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.mutedText,
    fontWeight: '600',
  },
  // Top Header Container
  topHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    zIndex: 20,
    backgroundColor: '#F8F5F7',
  },
  topHeaderFloating: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 10,
    left: 10,
    right: 10,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingTop: 0,
    zIndex: 25,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    width: '100%',
    overflow: 'hidden',
  },
  backBtn: {
    padding: 4,
    marginRight: 6,
    flexShrink: 0,
  },
  backIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  roomInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
    overflow: 'hidden',
  },
  roomName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  roomDest: {
    fontSize: 11,
    color: Colors.mutedText,
    marginTop: 1,
    flexShrink: 1,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF2EC',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1956A',
    gap: 3,
    flexShrink: 0,
  },
  codePrefix: {
    fontSize: 8,
    fontWeight: '800',
    color: '#D1956A',
    letterSpacing: 0.5,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D1956A',
    letterSpacing: 0.5,
  },
  shareIcon: {
    fontSize: 11,
  },
  sharingStatusPill: {
    marginTop: 6,
    backgroundColor: '#FAF0E6',
    borderWidth: 1,
    borderColor: '#D1956A',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sharingUnavailablePill: {
    backgroundColor: '#FDECEA',
    borderColor: '#E53935',
  },
  sharingStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // DESKTOP SPLIT VIEW
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 28,
    gap: 16,
    minHeight: 0,
  },
  desktopLeftCol: {
    flex: 1.4,
    minHeight: 0,
    flexDirection: 'column',
    gap: 12,
  },
  desktopMapWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EAE7EA',
    borderWidth: 1,
    borderColor: '#EAE6E1',
    minHeight: 380,
  },
  desktopActionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 4,
  },
  desktopActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  primaryActionBtn: {
    backgroundColor: '#D1956A',
    borderColor: '#D1956A',
  },
  desktopActionIcon: {
    fontSize: 16,
  },
  desktopActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  sharingPausedBtn: {
    backgroundColor: '#FDECEC',
    borderColor: '#E53935',
  },
  desktopRightCol: {
    flex: 1,
    maxWidth: 480,
  },
  desktopSidebarContent: {
    gap: 12,
    paddingBottom: 28,
  },
  sidebarCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sidebarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sidebarCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.mutedText,
    letterSpacing: 0.5,
  },
  activeBadge: {
    backgroundColor: '#EDF8F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#27AE60',
  },
  destMainName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  destAddressText: {
    fontSize: 13,
    color: Colors.mutedText,
    lineHeight: 18,
    marginBottom: 8,
  },
  destCoordsPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FAF5F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  destCoordsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D1956A',
  },
  meetingCard: {
    backgroundColor: '#FEFDF8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E5AB',
  },
  meetingCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B78103',
  },
  confirmedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B78103',
  },
  meetingPlaceName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
    marginBottom: 2,
  },
  meetingAddressText: {
    fontSize: 12,
    color: Colors.mutedText,
    marginBottom: 4,
  },
  meetingCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.mutedText,
  },
  buddiesSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
  buddiesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  buddiesTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  buddiesSub: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.mutedText,
  },
  membersList: {
    gap: 4,
  },

  // MOBILE VIEW
  mobileContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  mobileMapContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  dockedBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 30,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: '#EAE6E1',
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 24 : Platform.OS === 'ios' ? 24 : 12,
  },
  dockedBottomExpanded: {
    maxHeight: 400,
  },
  mobileShortcutsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 6,
    marginBottom: 6,
    width: '100%',
  },
  mobileShortcutBtn: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    gap: 3,
  },
  primaryShortcutBtn: {
    backgroundColor: '#D1956A',
    borderColor: '#D1956A',
  },
  mobileShortcutIcon: {
    fontSize: 12,
  },
  mobileShortcutText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  primaryShortcutText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  trayHeader: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 6,
    alignItems: 'center',
  },
  trayHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D8D4CF',
    borderRadius: 2,
    marginBottom: 6,
  },
  trayInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  trayStats: {
    gap: 2,
  },
  trayTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  traySubtitle: {
    fontSize: 11,
    color: Colors.mutedText,
  },
  trayArrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D1956A',
  },
  mobileMembersScroll: {
    maxHeight: 260,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  mobileMembersContent: {
    paddingBottom: 10,
  },

  // Error & Loading States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8F5F7',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  retryBtn: {
    backgroundColor: '#D1956A',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  retryBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  backHomeBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  backHomeBtnText: {
    color: '#D1956A',
    fontSize: 14,
    fontWeight: '600',
  },
});

