import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import NativeMapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors } from '../../constants/colors';
import { DestinationMarker } from './DestinationMarker';

interface DestinationPreviewMapProps {
  latitude: number;
  longitude: number;
  destinationName: string;
  destinationAddress?: string;
  height?: number;
}

export const DestinationPreviewMap: React.FC<DestinationPreviewMapProps> = ({
  latitude,
  longitude,
  destinationName,
  height = 200,
}) => {
  return (
    <View style={[styles.container, { height }]}>
      <NativeMapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        region={{
          latitude,
          longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }}
        showsUserLocation={false}
        scrollEnabled={true}
        zoomEnabled={true}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={destinationName}
        >
          <DestinationMarker destinationName={destinationName} />
        </Marker>
      </NativeMapView>

      <View style={styles.floatingBadge}>
        <Text style={styles.floatingBadgeText}>
          📍 {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    position: 'relative',
    backgroundColor: '#EAE7EA',
    marginVertical: 10,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(71, 68, 89, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  floatingBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
