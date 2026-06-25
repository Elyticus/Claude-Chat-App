import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatScreenProps } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../services/api';
import { Message } from '../../types';
import MessageBubble from '../../components/MessageBubble';
import MessageInput from '../../components/MessageInput';
import TypingIndicator from '../../components/TypingIndicator';
import { colors, spacing } from '../../theme';

interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

export default function ChatScreen({ route, navigation }: ChatScreenProps) {
  const { roomId, roomName, isGroup } = route.params;
  const { user } = useAuth();
  const { socket } = useSocket();

  // Messages stored newest-first so inverted FlatList shows newest at bottom
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const fetchMessages = useCallback(async (before?: string): Promise<MessagesResponse> => {
    const qs = before ? `?before=${before}` : '';
    return api.get<MessagesResponse>(`/rooms/${roomId}/messages${qs}`);
  }, [roomId]);

  useEffect(() => {
    navigation.setOptions({ title: roomName });
  }, [navigation, roomName]);

  useEffect(() => {
    void fetchMessages().then(({ messages: msgs, hasMore: more }) => {
      // API returns newest-first; store as-is for inverted FlatList
      setMessages(msgs);
      setHasMore(more);
      setLoading(false);
    });

    // Opening the room marks it read server-side (advances last_read_at) so the
    // durable unread badge on the rooms list clears.
    socket?.emit('room:read', { roomId });

    // Server emits { roomId, message }; the socket is already joined to every
    // room server-side, so messages for other rooms arrive here too — gate on id.
    function onMessageNew({ roomId: rid, message }: { roomId: string; message: Message }) {
      if (rid !== roomId) return;
      setMessages(prev => [message, ...prev]);
    }

    function onMessageAck({ tempId, message }: { tempId: string; message: Message }) {
      setMessages(prev =>
        prev.map(m => m.tempId === tempId ? { ...message, pending: false } : m)
      );
    }

    // Send failed (rate limit, muted, too long) — drop the optimistic bubble.
    function onMessageError({ tempId, error }: { tempId: string; error: string }) {
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
      Alert.alert('Message not sent', error);
    }

    // Server: typing:update { roomId, userId, username, typing }. Track the set
    // of usernames currently typing in THIS room.
    function onTypingUpdate(
      { roomId: rid, username: who, typing }: { roomId: string; userId: string; username: string; typing: boolean },
    ) {
      if (rid !== roomId || who === user?.username) return;
      setTypingUsers(prev => {
        const has = prev.includes(who);
        if (typing && !has) return [...prev, who];
        if (!typing && has) return prev.filter(u => u !== who);
        return prev;
      });
    }

    function onMessageDeleted({ messageId }: { roomId: string; messageId: string }) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }

    // Server emits { roomId, messageId, emoji } — map `emoji` onto `reaction`.
    function onMessageReaction({ messageId, emoji }: { roomId: string; messageId: string; emoji: string | null }) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reaction: emoji } : m));
    }

    socket?.on('message:new', onMessageNew);
    socket?.on('message:ack', onMessageAck);
    socket?.on('message:error', onMessageError);
    socket?.on('typing:update', onTypingUpdate);
    socket?.on('message:deleted', onMessageDeleted);
    socket?.on('message:reaction', onMessageReaction);

    return () => {
      socket?.off('message:new', onMessageNew);
      socket?.off('message:ack', onMessageAck);
      socket?.off('message:error', onMessageError);
      socket?.off('typing:update', onTypingUpdate);
      socket?.off('message:deleted', onMessageDeleted);
      socket?.off('message:reaction', onMessageReaction);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) socket?.emit('typing:stop', { roomId });
    };
  }, [roomId, socket, user?.username, fetchMessages]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    // oldest message is last in our newest-first array
    const oldestId = messages[messages.length - 1].id;
    setLoadingMore(true);
    try {
      const { messages: older, hasMore: more } = await fetchMessages(oldestId);
      setMessages(prev => [...prev, ...older]);
      setHasMore(more);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, messages, fetchMessages]);

  const sendMessage = useCallback((text: string) => {
    if (!socket || !user) return;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: tempId,
      room_id: roomId,
      user_id: user.id,
      text,
      reaction: null,
      created_at: new Date().toISOString(),
      is_system: false,
      username: user.username,
      avatar: user.avatar,
      tempId,
      pending: true,
    };
    setMessages(prev => [optimistic, ...prev]);
    socket.emit('message:send', { roomId, text, tempId });
  }, [socket, user, roomId]);

  const handleTyping = useCallback(() => {
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing:start', { roomId });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing:stop', { roomId });
    }, 2000);
  }, [socket, roomId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={messages}
          keyExtractor={item => item.tempId ?? String(item.id)}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.user_id === user?.id}
              showAvatar={isGroup}
            />
          )}
          inverted
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null
          }
          contentContainerStyle={styles.list}
        />
        {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
        <MessageInput onSend={sendMessage} onTyping={handleTyping} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  loader: { padding: spacing.md },
});
