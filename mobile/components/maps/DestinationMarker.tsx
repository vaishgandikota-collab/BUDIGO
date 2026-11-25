import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface DestinationMarkerProps {
  destinationName: string;
}

export const DestinationMarker: React.FC<DestinationMarkerProps> = ({ destinationName }) => {
  return (
    <View style={styles.container}>
      <View style={styles.callout}>
        <Text style={styles.tagText}>🏁 DESTINATION</Text>
        <Text style={styles.nameText} numberOfLines={1}>
          {destinationName}
        </Text>
      </View>

      <View style={styles.pinCircle}>
        <Text style={styles.icon}>🎯</Text>
      </View>

      <View style={styles.arrow} />
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
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  nameText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 1,
  },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    borderWidth: 2.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  icon: {
    fontSize: 18,
  },
  arrow: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 0,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.primary,
    marginTop: -1,
  },
  shadow: {
    width: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: 2,
  },
});

