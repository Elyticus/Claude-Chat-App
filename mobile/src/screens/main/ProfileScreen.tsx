import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });

    if (result.canceled || !result.assets[0].base64) return;

    setUploading(true);
    try {
      const ext = result.assets[0].uri.split('.').pop() ?? 'jpg';
      const dataUrl = `data:image/${ext};base64,${result.assets[0].base64}`;
      const updated = await api.post<{ user: User }>('/users/me/avatar', { avatar: dataUrl });
      await updateUser(updated.user);
    } catch (err) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Could not update avatar.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar} disabled={uploading}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          {uploading && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={colors.text} />
            </View>
          )}
          <View style={styles.editBadge}>
            <Text style={{ fontSize: 12 }}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.email}>{user.email}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Username</Text>
            <Text style={styles.rowValue}>{user.username}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{user.email}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  avatarContainer: { position: 'relative', marginBottom: spacing.sm },
  avatar: { width: 96, height: 96, borderRadius: radius.full },
  avatarFallback: {
    width: 96, height: 96, borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  initials: { fontSize: typography.xxl, fontWeight: '700', color: colors.text },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  username: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  email: { fontSize: typography.sm, color: colors.textMuted },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md },
  rowLabel: { fontSize: typography.base, color: colors.textMuted },
  rowValue: { fontSize: typography.base, color: colors.text, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  logoutBtn: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logoutText: { color: colors.error, fontSize: typography.base, fontWeight: '600' },
});
