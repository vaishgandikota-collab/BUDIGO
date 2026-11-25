import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';
import { LiveLocation, MeetingPoint, Room } from '../../types';
import { useRoomRoutes } from '../../hooks/useRoomRoutes';

interface MapViewProps {
  room: Room;
  currentUserId?: string;
  myLocation?: { latitude: number; longitude: number } | null;
  locations: Map<string, LiveLocation>;
  meetingPoint?: MeetingPoint | null;
  onSelectMember?: (memberId: string) => void;
  style?: any;
  height?: number | string;
}

const MapFrame = ({ html, style }: { html: string; style?: any }) => {
  return React.createElement('iframe', {
    srcDoc: html,
    style: {
      width: '100%',
      height: '100%',
      minHeight: 340,
      border: 'none',
      borderRadius: 16,
      backgroundColor: '#EAE7EA',
      display: 'block',
      ...style,
    },
    title: 'Budigo Live Travel Map',
  });
};

export const MapView: React.FC<MapViewProps> = ({
  room,
  currentUserId,
  myLocation,
  locations,
  meetingPoint,
  onSelectMember,
  style,
  height,
}) => {
  const buddies = Array.from(locations.values());
  const routes = useRoomRoutes(room, locations, currentUserId);

  const destLat = room.destination_latitude || 17.4239;
  const destLon = room.destination_longitude || 78.4738;

  // Build markers and lines JS for the interactive map
  const buddiesData = buddies.map((b) => {
    const route = routes.get(b.user_id);
    return {
      userId: b.user_id,
      name: b.displayName || 'Travel Buddy',
      color: b.markerColor || Colors.primary,
      lat: b.latitude,
      lon: b.longitude,
      status: b.status || 'On the Way',
      distKm: route
        ? (route.distanceMeters / 1000).toFixed(1)
        : ((b.distance_to_dest_meters || 0) / 1000).toFixed(1),
      etaMin: route
        ? Math.round(route.durationSeconds / 60)
        : Math.round((b.eta_seconds || 0) / 60),
    };
  });

  const mpData = meetingPoint
    ? {
        name: meetingPoint.place_name,
        category: meetingPoint.category || 'Meeting Venue',
        lat: meetingPoint.latitude,
        lon: meetingPoint.longitude,
        isConfirmed: meetingPoint.is_confirmed,
      }
    : null;

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
    .buddy-pin {
      border: 3px solid #FFFFFF;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 800;
      border-radius: 50%;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    }
    .mp-pin {
      background: #EAB308;
      border: 3px solid #FFFFFF;
      color: #FFFFFF;
      font-size: 15px;
      border-radius: 50%;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
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
    .leaflet-top {
      top: 68px !important;
    }
    .leaflet-right {
      right: 12px !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${destLat}, ${destLon}], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Destination Pin
    var destIcon = L.divIcon({
      className: 'dest-pin',
      html: '📍',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    var destMarker = L.marker([${destLat}, ${destLon}], { icon: destIcon }).addTo(map);
    destMarker.bindPopup("<b>📍 ${room.destination_name.replace(/"/g, '\\"')}</b><br/>${(room.destination_address || 'Target Destination').replace(/"/g, '\\"')}");

    var group = [ [${destLat}, ${destLon}] ];

    // Confirmed Meeting Point
    var mp = ${JSON.stringify(mpData)};
    if (mp && mp.lat && mp.lon) {
      group.push([mp.lat, mp.lon]);
      var mpIcon = L.divIcon({
        className: 'mp-pin',
        html: '⭐',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      var mpMarker = L.marker([mp.lat, mp.lon], { icon: mpIcon }).addTo(map);
      mpMarker.bindPopup("<b>⭐ " + mp.name + "</b><br/>Category: " + mp.category);
    }

    // Live Buddies
    var buddies = ${JSON.stringify(buddiesData)};
    buddies.forEach(function(b) {
      if (!b.lat || !b.lon) return;
      group.push([b.lat, b.lon]);
      var initials = b.name.substring(0, 2).toUpperCase();
      var bIcon = L.divIcon({
        className: 'buddy-pin',
        html: '<div style="background:' + b.color + '; width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff;">' + initials + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      var m = L.marker([b.lat, b.lon], { icon: bIcon }).addTo(map);
      m.bindPopup("<b>" + b.name + "</b><br/>Status: " + b.status + "<br/>Remaining: " + b.distKm + " km (" + b.etaMin + " min)");

      // Route line to destination
      L.polyline([[b.lat, b.lon], [${destLat}, ${destLon}]], {
        color: b.color,
        weight: 4,
        opacity: 0.8,
        dashArray: '6, 6'
      }).addTo(map);
    });

    if (group.length > 1) {
      map.fitBounds(group, { padding: [40, 40] });
    }

    // Custom Controls in top-left
    var customControl = L.control({ position: 'topright' });
    customControl.onAdd = function() {
      var div = L.DomUtil.create('div');
      div.innerHTML = '<div class="custom-ctrl" onclick="map.fitBounds(' + JSON.stringify(group) + ', { padding: [40, 40] })">🗺️ Fit All</div>' +
                      '<div class="custom-ctrl" onclick="map.setView([' + ${destLat} + ', ' + ${destLon} + '], 14)">📍 Destination</div>';
      return div;
    };
    customControl.addTo(map);
  </script>
</body>
</html>
`;

  return (
    <View style={[styles.container, height ? { height } : undefined, style]}>
      <MapFrame html={mapHtml} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    minHeight: 340,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EAE7EA',
  },
});
