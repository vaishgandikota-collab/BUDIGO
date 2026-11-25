import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import NativeMapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Colors } from '../../constants/colors';
import { LiveLocation, MeetingPoint, Room } from '../../types';
import { MemberMarker } from './MemberMarker';
import { DestinationMarker } from './DestinationMarker';
import { MeetingPointMarker } from './MeetingPointMarker';
import { useRoomRoutes } from '../../hooks/useRoomRoutes';

interface MapViewProps {
  room: Room;
  currentUserId?: string;
  myLocation?: { latitude: number; longitude: number } | null;
  locations: Map<string, LiveLocation>;
  meetingPoint?: MeetingPoint | null;
  onSelectMember?: (memberId: string) => void;
  style?: any;
}

export const MapView: React.FC<MapViewProps> = ({
  room,
  currentUserId,
  myLocation,
  locations,
  meetingPoint,
  onSelectMember,
  style,
}) => {
  const mapRef = useRef<NativeMapView | null>(null);

  // Compute road routes using Google Routes API
  const routes = useRoomRoutes(room, locations, currentUserId);

  const initialRegion: Region = {
    latitude: room.destination_latitude || 15.5553,
    longitude: room.destination_longitude || 73.7517,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  const recenterToMyPosition = () => {
    if (myLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        },
        800
      );
    }
  };

  const fitAllMarkers = () => {
    if (!mapRef.current) return;
    const coords: { latitude: number; longitude: number }[] = [
      { latitude: room.destination_latitude, longitude: room.destination_longitude },
    ];

    if (myLocation) {
      coords.push(myLocation);
    }

    for (const loc of locations.values()) {
      coords.push({ latitude: loc.latitude, longitude: loc.longitude });
    }

    if (meetingPoint) {
      coords.push({ latitude: meetingPoint.latitude, longitude: meetingPoint.longitude });
    }

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 90, right: 60, bottom: 130, left: 60 },
      animated: true,
    });
  };

  useEffect(() => {
    if (locations.size > 0) {
      fitAllMarkers();
    }
  }, [locations.size]);

  return (
    <View style={[styles.container, style]}>
      <NativeMapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false} // Using custom distinct color marker
        showsMyLocationButton={false}
        showsCompass={true}
        toolbarEnabled={false}
      >
        {/* 1. Destination Marker */}
        <Marker
          coordinate={{
            latitude: room.destination_latitude,
            longitude: room.destination_longitude,
          }}
          title={room.destination_name}
        >
          <DestinationMarker destinationName={room.destination_name} />
        </Marker>

        {/* 2. Confirmed Meeting Point Marker */}
        {meetingPoint && (
          <Marker
            coordinate={{
              latitude: meetingPoint.latitude,
              longitude: meetingPoint.longitude,
            }}
            title={meetingPoint.place_name}
          >
            <MeetingPointMarker
              name={meetingPoint.place_name}
              category={meetingPoint.category}
              isConfirmed={meetingPoint.is_confirmed}
            />
          </Marker>
        )}

        {/* 3. Live Group Member Markers & Individual Road Routes */}
        {Array.from(locations.values()).map((loc) => {
          const isMe = loc.user_id === currentUserId;
          const markerColor = loc.markerColor || Colors.primary;
          const routeData = routes.get(loc.user_id);

          // Use decoded road polyline if available, fallback to direct line
          const polyCoordinates =
            routeData && routeData.coordinates.length > 0
              ? routeData.coordinates
              : [
                  { latitude: loc.latitude, longitude: loc.longitude },
                  { latitude: room.destination_latitude, longitude: room.destination_longitude },
                ];

          return (
            <React.Fragment key={loc.user_id}>
              {/* Member Live Marker with assigned persistent color */}
              <Marker
                coordinate={{
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }}
                onPress={() => onSelectMember && onSelectMember(loc.user_id)}
                title={loc.displayName || 'Travel Buddy'}
              >
                <MemberMarker
                  displayName={loc.displayName || (isMe ? 'You' : 'Buddy')}
                  markerColor={markerColor}
                  isCurrentUser={isMe}
                  status={loc.status}
                />
              </Marker>

              {/* Individual Road Polyline to Destination in Member's Palette Color */}
              <Polyline
                coordinates={polyCoordinates}
                strokeColor={markerColor}
                strokeWidth={isMe ? 4.5 : 3.2}
                lineDashPattern={isMe ? undefined : [6, 4]}
              />
            </React.Fragment>
          );
        })}
      </NativeMapView>

      {/* Floating Map Controls */}
      <View style={styles.controlsContainer}>
        {/* Fit All Buddies Button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={fitAllMarkers}
          activeOpacity={0.8}
        >
          <Text style={styles.controlIcon}>🗺️</Text>
        </TouchableOpacity>

        {/* Recenter to My Location Button */}
        {myLocation && (
          <TouchableOpacity
            style={[styles.controlButton, styles.activeButton]}
            onPress={recenterToMyPosition}
            activeOpacity={0.8}
          >
            <Text style={styles.controlIcon}>🎯</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  controlsContainer: {
    position: 'absolute',
    right: 14,
    top: 85,
    gap: 10,
    zIndex: 15,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#474459',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeButton: {
    borderColor: Colors.primary,
  },
  controlIcon: {
    fontSize: 20,
  },
});
