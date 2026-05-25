import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Contact } from '../types';
import Avatar from './Avatar';
import { colors, spacing, radius, typography } from '../theme';

interface Props {
  contact: Contact;
  onPress?: () => void;
  onAdd?: () => void;
  onAccept?: () => void;
  onRemove?: () => void;
}

export default function ContactListItem({ contact, onPress, onAdd, onAccept, onRemove }: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Avatar username={contact.username} avatar={contact.avatar} size={44} online={contact.online} />
      <View style={styles.info}>
        <Text style={styles.name}>{contact.username}</Text>
        <Text style={styles.email} numberOfLines={1}>{contact.email}</Text>
      </View>
      <View style={styles.actions}>
        {contact.status === 'none' && onAdd && (
          <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        )}
        {contact.status === 'pending' && !onAccept && (
          <Text style={styles.pendingText}>Pending</Text>
        )}
        {contact.status === 'pending' && onAccept && (
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        )}
        {contact.status === 'accepted' && onRemove && (
          <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        )}
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
  name: { fontSize: typography.base, fontWeight: '600', color: colors.text },
  email: { fontSize: typography.sm, color: colors.textMuted, marginTop: 2 },
  actions: { alignItems: 'flex-end' },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addText: { color: colors.text, fontSize: typography.sm, fontWeight: '600' },
  acceptBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  acceptText: { color: colors.text, fontSize: typography.sm, fontWeight: '600' },
  removeBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  removeText: { color: colors.error, fontSize: typography.sm },
  pendingText: { color: colors.textFaint, fontSize: typography.sm },
});
