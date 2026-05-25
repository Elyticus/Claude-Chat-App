import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../types';
import Avatar from './Avatar';
import { colors, spacing, radius, typography } from '../theme';
import { format } from 'date-fns';

interface Props {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}

export default function MessageBubble({ message, isOwn, showAvatar }: Props) {
  if (message.is_system) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    );
  }

  const timeStr = format(new Date(message.created_at), 'HH:mm');

  return (
    <View style={[styles.row, isOwn && styles.rowReverse]}>
      {showAvatar && !isOwn && (
        <Avatar
          username={message.username}
          avatar={message.avatar}
          size={30}
        />
      )}
      {showAvatar && isOwn && <View style={{ width: 30 }} />}

      <View style={[styles.bubble, isOwn ? styles.bubbleSent : styles.bubbleReceived, message.pending && styles.bubblePending]}>
        {showAvatar && !isOwn && (
          <Text style={styles.sender}>{message.username}</Text>
        )}
        <Text style={styles.text} selectable>{message.text}</Text>
        <View style={styles.meta}>
          {message.reaction && <Text style={styles.reaction}>{message.reaction}</Text>}
          <Text style={styles.time}>{timeStr}</Text>
          {isOwn && (
            <Text style={styles.status}>{message.pending ? '◦' : '✓'}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  bubble: {
    maxWidth: '75%',
    borderRadius: radius.lg,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bubbleSent: {
    backgroundColor: colors.messageSent,
    borderBottomRightRadius: radius.sm,
  },
  bubbleReceived: {
    backgroundColor: colors.messageReceived,
    borderBottomLeftRadius: radius.sm,
  },
  bubblePending: { opacity: 0.6 },
  sender: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  text: {
    fontSize: typography.base,
    color: colors.text,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: 3,
  },
  reaction: { fontSize: typography.sm },
  time: { fontSize: typography.xs, color: 'rgba(255,255,255,0.5)' },
  status: { fontSize: typography.xs, color: 'rgba(255,255,255,0.5)' },
  systemRow: { alignItems: 'center', paddingVertical: spacing.xs },
  systemText: { fontSize: typography.xs, color: colors.textFaint, fontStyle: 'italic' },
});
