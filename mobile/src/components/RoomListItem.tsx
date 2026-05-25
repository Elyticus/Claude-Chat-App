import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Room } from '../types';
import Avatar from './Avatar';
import { colors, spacing, typography } from '../theme';
import { format, isToday, isYesterday } from 'date-fns';

interface Props {
  room: Room;
  online: boolean;
  currentUserId: number;
  onPress: () => void;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yy');
}

export default function RoomListItem({ room, online, onPress }: Props) {
  const isGroup = room.is_group;
  const name = isGroup ? room.name : (room.other_username ?? room.name);
  const avatar = isGroup ? null : (room.other_avatar ?? null);
  const username = isGroup ? room.name : (room.other_username ?? room.name);
  const unread = room.unread_count ?? 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar
        username={username}
        avatar={avatar}
        size={48}
        online={isGroup ? undefined : online}
      />
      <View style={styles.info}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.time}>{formatTime(room.last_message_at)}</Text>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.preview} numberOfLines={1}>
            {room.last_message ?? (room.description ?? 'No messages yet')}
          </Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  info: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  name: { fontSize: typography.base, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  time: { fontSize: typography.xs, color: colors.textFaint },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { fontSize: typography.sm, color: colors.textMuted, flex: 1, marginRight: spacing.sm },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: colors.text, fontSize: typography.xs, fontWeight: '700' },
});
