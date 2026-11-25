import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface AvatarProps {
  name: string;
  url?: string;
  size?: number;
  markerColor?: string;
  showBadge?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  url,
  size = 40,
  markerColor = Colors.primary,
  showBadge = false,
}) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const fontSize = Math.round(size * 0.4);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: markerColor,
        },
      ]}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size - 4,
              height: size - 4,
              borderRadius: (size - 4) / 2,
              backgroundColor: `${markerColor}20`,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize, color: markerColor }]}>
            {initials || 'BG'}
          </Text>
        </View>
      )}

      {showBadge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: markerColor,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.white,
  },
});

