import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface MeetingPointMarkerProps {
  name: string;
  category?: string;
  isConfirmed?: boolean;
}

export const MeetingPointMarker: React.FC<MeetingPointMarkerProps> = ({
  name,
  category = 'cafe',
  isConfirmed = false,
}) => {
  const getCategoryIcon = () => {
    switch (category.toLowerCase()) {
      case 'restaurant':
        return '🍽️';
      case 'shopping_mall':
        return '🛍️';
      case 'metro_station':
        return '🚇';
      case 'park':
        return '🌳';
      case 'cafe':
      default:
        return '☕';
    }
  };

  const badgeColor = isConfirmed ? Colors.success : Colors.primary;

  return (
    <View style={styles.container}>
      <View style={[styles.callout, { borderColor: badgeColor }]}>
        <Text style={[styles.tagText, { color: badgeColor }]}>
          {isConfirmed ? '📍 CONFIRMED MEETING POINT' : '⭐ RECOMMENDED SPOT'}
        </Text>
        <Text style={styles.nameText} numberOfLines={1}>
          {name}
        </Text>
      </View>

      <View style={[styles.pinCircle, { backgroundColor: badgeColor }]}>
        <Text style={styles.icon}>{getCategoryIcon()}</Text>
      </View>

      <View style={[styles.arrow, { borderTopColor: badgeColor }]} />
      <View style={styles.shadow} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callout: {
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    marginBottom: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  nameText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  icon: {
    fontSize: 16,
  },
  arrow: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 0,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  shadow: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: 2,
  },
});

