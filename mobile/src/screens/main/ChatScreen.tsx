import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator,
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

  const fetchMessages = useCallback(async (before?: number): Promise<MessagesResponse> => {
    const qs = before ? `?before=${before}` : '';
    return api.get<MessagesResponse>(`/rooms/${roomId}/messages${qs}`);
  }, [roomId]);

  useEffect(() => {
    navigation.setOptions({ title: roomName });
  }, [navigation, roomName]);

  useEffect(() => {
    socket?.emit('room:join', { roomId });

    void fetchMessages().then(({ messages: msgs, hasMore: more }) => {
      // API returns newest-first; store as-is for inverted FlatList
      setMessages(msgs);
      setHasMore(more);
      setLoading(false);
    });

    function onMessageNew(msg: Message) {
      if (msg.room_id !== roomId) return;
      setMessages(prev => [msg, ...prev]);
    }

    function onMessageAck({ tempId, message }: { tempId: string; message: Message }) {
      setMessages(prev =>
        prev.map(m => m.tempId === tempId ? { ...message, pending: false } : m)
      );
    }

    function onTypingUpdate({ roomId: rid, users }: { roomId: number; users: string[] }) {
      if (rid !== roomId) return;
      setTypingUsers(users.filter(u => u !== user?.username));
    }

    function onMessageDeleted({ messageId }: { messageId: number }) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }

    function onMessageReaction({ messageId, reaction }: { messageId: number; reaction: string | null }) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reaction } : m));
    }

    socket?.on('message:new', onMessageNew);
    socket?.on('message:ack', onMessageAck);
    socket?.on('typing:update', onTypingUpdate);
    socket?.on('message:deleted', onMessageDeleted);
    socket?.on('message:reaction', onMessageReaction);

    return () => {
      socket?.emit('room:leave', { roomId });
      socket?.off('message:new', onMessageNew);
      socket?.off('message:ack', onMessageAck);
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
      id: -Date.now(),
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
    socket.emit('message:send', { roomId, content: text, tempId });
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
