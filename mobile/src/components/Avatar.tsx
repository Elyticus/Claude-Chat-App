import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  username: string;
  avatar: string | null | undefined;
  size?: number;
  online?: boolean;
}

export default function Avatar({ username, avatar, size = 40, online }: Props) {
  const initials = username.slice(0, 2).toUpperCase();
  const fontSize = size * 0.38;

  return (
    <View style={{ width: size, height: size }}>
      {avatar ? (
        <Image
          source={{ uri: avatar }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={[
            styles.dot,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              backgroundColor: online ? colors.online : colors.surfaceAlt,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { resizeMode: 'cover' },
  fallback: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: { color: colors.text, fontWeight: '700' },
  dot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.background,
  },
});
