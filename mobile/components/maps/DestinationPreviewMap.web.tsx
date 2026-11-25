import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors } from '../../constants/colors';

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
  destinationAddress,
  height = 200,
}) => {
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
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${latitude}, ${longitude}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    var destIcon = L.divIcon({
      className: 'dest-pin',
      html: '📍',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    var marker = L.marker([${latitude}, ${longitude}], { icon: destIcon }).addTo(map);
    marker.bindPopup("<b>📍 ${destinationName.replace(/"/g, '\\"')}</b><br/>${(destinationAddress || '').replace(/"/g, '\\"')}").openPopup();
  </script>
</body>
</html>
`;

  return (
    <View style={[styles.container, { height }]}>
      {React.createElement('iframe', {
        srcDoc: mapHtml,
        style: {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: 12,
        },
        title: 'Destination Preview Map',
      })}
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
