import React, { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Text, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../services/api';
import { Room, Message } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import RoomListItem from '../../components/RoomListItem';
import { colors, spacing, typography, radius } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RoomsListScreen() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigation = useNavigation<Nav>();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const fetchRooms = useCallback(async () => {
    try {
      const data = await api.get<Room[]>('/rooms');
      setRooms(data);
      // Seed presence from the room rows so DM dots are right immediately — the
      // live user:status snapshot can fire before this screen's listener mounts.
      setOnlineIds(prev => {
        const next = new Set(prev);
        for (const r of data) {
          if (r.other_user_id && r.other_user_online) next.add(r.other_user_id);
        }
        return next;
      });
    } catch {
      // ignore — user sees stale data
    }
  }, []);

  useEffect(() => {
    void fetchRooms().finally(() => setLoading(false));
  }, [fetchRooms]);

  useEffect(() => {
    // Server emits { roomId, message }.
    function onMessageNew({ message }: { roomId: string; message: Message }) {
      setRooms(prev =>
        prev.map(r =>
          r.id === message.room_id
            ? { ...r, last_message: message.text, last_message_at: message.created_at, unread_count: (r.unread_count ?? 0) + 1 }
            : r
        )
      );
    }

    function onUserStatus({ userId, online }: { userId: string; online: boolean }) {
      setOnlineIds(prev => {
        const next = new Set(prev);
        if (online) next.add(userId); else next.delete(userId);
        return next;
      });
    }

    // Server emits room:new as { roomId, ...extra } (not a full Room) and has
    // already joined this socket to the room — re-pull the list for the full row.
    function onRoomNew() {
      void fetchRooms();
    }

    function onRoomDeleted({ roomId }: { roomId: string }) {
      setRooms(prev => prev.filter(r => r.id !== roomId));
    }

    socket?.on('message:new', onMessageNew);
    socket?.on('user:status', onUserStatus);
    socket?.on('room:new', onRoomNew);
    socket?.on('room:deleted', onRoomDeleted);

    return () => {
      socket?.off('message:new', onMessageNew);
      socket?.off('user:status', onUserStatus);
      socket?.off('room:new', onRoomNew);
      socket?.off('room:deleted', onRoomDeleted);
    };
  }, [socket, fetchRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  }, [fetchRooms]);

  const openChat = (room: Room) => {
    const roomName = room.is_group
      ? room.name
      : room.other_username ?? room.name;

    navigation.navigate('Chat', {
      roomId: room.id,
      roomName,
      isGroup: room.is_group,
      type: room.type,
      otherUserId: room.other_user_id,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={rooms}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <RoomListItem
            room={item}
            online={item.other_user_id ? onlineIds.has(item.other_user_id) : false}
            currentUserId={user?.id ?? ''}
            onPress={() => openChat(item)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>Start a conversation with your contacts.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 72 },
  empty: { flex: 1, alignItems: 'center', paddingTop: spacing.xl * 3, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: typography.base, color: colors.textMuted, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: { fontSize: 22 },
});
