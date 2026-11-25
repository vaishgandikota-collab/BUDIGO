import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { DiscoverParticipant, FairDestinationArea, FairMeetingVenue } from '../../types';
import { Colors } from '../../constants/colors';

interface DiscoverMapProps {
  participants: DiscoverParticipant[];
  selectedArea?: FairDestinationArea | null;
  selectedVenue?: FairMeetingVenue | null;
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
    title: 'Budigo Fair Meeting Point Map',
  });
};

export const DiscoverMap: React.FC<DiscoverMapProps> = ({
  participants,
  selectedArea,
  selectedVenue,
  style,
  height = 360,
}) => {
  const participantsData = participants.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.markerColor || Colors.primary,
    lat: p.latitude,
    lon: p.longitude,
    address: p.address || 'Starting Location',
    source: p.source,
  }));

  const areaData = selectedArea
    ? {
        name: selectedArea.name,
        address: selectedArea.address,
        lat: selectedArea.latitude,
        lon: selectedArea.longitude,
        routes: selectedArea.participantRoutes,
      }
    : null;

  const venueData = selectedVenue
    ? {
        name: selectedVenue.name,
        address: selectedVenue.address,
        category: selectedVenue.category,
        rating: selectedVenue.rating,
        lat: selectedVenue.latitude,
        lon: selectedVenue.longitude,
        routes: selectedVenue.participantRoutes,
      }
    : null;

  const centerLat = selectedVenue
    ? selectedVenue.latitude
    : selectedArea
    ? selectedArea.latitude
    : participants.length > 0
    ? participants.reduce((s, p) => s + p.latitude, 0) / participants.length
    : 17.4239;

  const centerLon = selectedVenue
    ? selectedVenue.longitude
    : selectedArea
    ? selectedArea.longitude
    : participants.length > 0
    ? participants.reduce((s, p) => s + p.longitude, 0) / participants.length
    : 78.4738;

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
    .friend-pin {
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
    .venue-pin {
      background: #D1956A;
      border: 3px solid #FFFFFF;
      color: #FFFFFF;
      font-size: 18px;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(209,149,106,0.5);
    }
    .area-pin {
      background: #474459;
      border: 3px solid #FFFFFF;
      color: #FFFFFF;
      font-size: 16px;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    }
    .custom-ctrl {
      background: #FFFFFF;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      padding: 6px 12px;
      font-weight: 700;
      font-size: 12px;
      color: #474459;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      border: 1px solid #EAE6E1;
      margin-bottom: 8px;
      user-select: none;
    }
    .custom-ctrl:hover {
      background: #FAF5F2;
      color: #D1956A;
    }
    .leaflet-top {
      top: 14px !important;
    }
    .leaflet-right {
      right: 12px !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    function decodePolyline(str, precision) {
      var index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision || 5);
      while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push([lat / factor, lng / factor]);
      }
      return coordinates;
    }

    var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLon}], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var group = [];
    var participants = ${JSON.stringify(participantsData)};
    var venue = ${JSON.stringify(venueData)};
    var area = ${JSON.stringify(areaData)};

    // 1. Render Participant Markers
    participants.forEach(function(p) {
      if (!p.lat || !p.lon) return;
      group.push([p.lat, p.lon]);
      var initials = p.name ? p.name.substring(0, 2).toUpperCase() : 'ME';
      var icon = L.divIcon({
        className: 'friend-pin',
        html: '<div style="background:' + p.color + '; width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; font-weight:800;">' + initials + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      var marker = L.marker([p.lat, p.lon], { icon: icon }).addTo(map);
      marker.bindPopup("<b>👤 " + p.name + "</b><br/>" + p.address + "<br/><span style='font-size:11px;color:#888;'>Source: " + (p.source === 'gps' ? 'GPS Live' : 'Manual Entry') + "</span>");
    });

    // 2. Render Selected Venue & Individual Road Routes
    if (venue && venue.lat && venue.lon) {
      group.push([venue.lat, venue.lon]);
      var vIcon = L.divIcon({
        className: 'venue-pin',
        html: '⭐',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      var vMarker = L.marker([venue.lat, venue.lon], { icon: vIcon }).addTo(map);
      vMarker.bindPopup("<b>⭐ " + venue.name + "</b><br/>" + venue.address + (venue.rating ? "<br/>Rating: " + venue.rating + " ★" : "")).openPopup();

      if (venue.routes && venue.routes.length > 0) {
        venue.routes.forEach(function(r) {
          var p = participants.find(function(item) { return item.id === r.userId; });
          var color = (p && p.color) || r.markerColor || '#D1956A';
          if (r.polyline && r.polyline.length > 10) {
            try {
              var coords = decodePolyline(r.polyline);
              L.polyline(coords, {
                color: color,
                weight: 5,
                opacity: 0.85
              }).addTo(map);
            } catch(e) {
              if (p) {
                L.polyline([[p.lat, p.lon], [venue.lat, venue.lon]], {
                  color: color,
                  weight: 3.5,
                  dashArray: '6, 6',
                  opacity: 0.8
                }).addTo(map);
              }
            }
          } else if (p) {
            L.polyline([[p.lat, p.lon], [venue.lat, venue.lon]], {
              color: color,
              weight: 3.5,
              dashArray: '6, 6',
              opacity: 0.8
            }).addTo(map);
          }
        });
      }
    } else if (area && area.lat && area.lon) {
      group.push([area.lat, area.lon]);
      var aIcon = L.divIcon({
        className: 'area-pin',
        html: '📍',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      var aMarker = L.marker([area.lat, area.lon], { icon: aIcon }).addTo(map);
      aMarker.bindPopup("<b>📍 " + area.name + "</b><br/>" + area.address).openPopup();

      if (area.routes && area.routes.length > 0) {
        area.routes.forEach(function(r) {
          var p = participants.find(function(item) { return item.id === r.userId; });
          var color = (p && p.color) || r.markerColor || '#474459';
          if (p) {
            L.polyline([[p.lat, p.lon], [area.lat, area.lon]], {
              color: color,
              weight: 3,
              dashArray: '6, 6',
              opacity: 0.75
            }).addTo(map);
          }
        });
      }
    }

    if (group.length > 1) {
      map.fitBounds(group, { padding: [40, 40], maxZoom: 15 });
    } else if (group.length === 1) {
      map.setView(group[0], 13);
    }

    // Custom Controls in top-right
    var customControl = L.control({ position: 'topright' });
    customControl.onAdd = function() {
      var div = L.DomUtil.create('div');
      div.innerHTML = '<div class="custom-ctrl" onclick="map.fitBounds(' + JSON.stringify(group) + ', { padding: [40, 40], maxZoom: 15 })">🗺️ Fit All</div>' +
                      '<div class="custom-ctrl" onclick="map.setView([' + ${centerLat} + ', ' + ${centerLon} + '], 13)">📍 Focus</div>';
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
    height: 360,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EAE7EA',
    borderWidth: 1,
    borderColor: '#EAE6E1',
  },
});
