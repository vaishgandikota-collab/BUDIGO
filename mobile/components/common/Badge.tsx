import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { MemberStatus } from '../../types';

interface BadgeProps {
  status?: MemberStatus | string;
  label?: string;
  color?: string;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ status, label, color, style }) => {
  const getStatusColor = () => {
    if (color) return color;
    switch (status) {
      case 'Arrived':
        return Colors.success;
      case 'Moving':
      case 'On the Way':
        return Colors.primary;
      case 'Near Destination':
        return Colors.warning;
      case 'Stopped':
        return '#8B6BC1';
      case 'Offline':
        return Colors.mutedText;
      case 'Not Started':
      default:
        return Colors.mutedText;
    }
  };

  const badgeColor = getStatusColor();
  const text = label || status || 'Active';

  return (
    <View style={[styles.container, { backgroundColor: `${badgeColor}18`, borderColor: badgeColor }, style]}>
      <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      <Text style={[styles.text, { color: badgeColor }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

