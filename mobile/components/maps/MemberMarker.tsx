import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface MemberMarkerProps {
  displayName: string;
  markerColor?: string;
  isCurrentUser?: boolean;
  status?: string;
}

export const MemberMarker: React.FC<MemberMarkerProps> = ({
  displayName,
  markerColor = Colors.primary,
  isCurrentUser = false,
  status,
}) => {
  const initials = displayName
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.container}>
      {/* Name Bubble */}
      <View style={[styles.bubble, { borderColor: markerColor }]}>
        <Text style={[styles.nameText, { color: markerColor }]} numberOfLines={1}>
          {isCurrentUser ? `${displayName} (You)` : displayName}
        </Text>
      </View>

      {/* Circular Pin Head with Initials */}
      <View style={[styles.pinCircle, { backgroundColor: markerColor }]}>
        <View style={styles.innerCircle}>
          <Text style={[styles.initialsText, { color: markerColor }]}>
            {initials || 'ME'}
          </Text>
        </View>
      </View>

      {/* Pin Pointer Arrow */}
      <View style={[styles.arrow, { borderTopColor: markerColor }]} />

      {/* Shadow */}
      <View style={styles.shadow} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  nameText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  innerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 12,
    fontWeight: '800',
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: 2,
  },
});

