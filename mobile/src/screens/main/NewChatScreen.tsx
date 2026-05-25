import React, { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, Text, StyleSheet, ActivityIndicator,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../services/api';
import { Contact, Room } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import ContactListItem from '../../components/ContactListItem';
import { colors, spacing, radius, typography } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function NewChatScreen() {
  const navigation = useNavigation<Nav>();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filtered, setFiltered] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.get<Contact[]>('/users').then(users => {
      const accepted = users.filter(u => u.status === 'accepted');
      setContacts(accepted);
      setFiltered(accepted);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(q ? contacts.filter(c => c.username.toLowerCase().includes(q)) : contacts);
  }, [query, contacts]);

  const openDM = useCallback(async (contact: Contact) => {
    try {
      const room = await api.post<Room>('/rooms/dm', { userId: contact.id });
      navigation.replace('Chat', {
        roomId: room.id,
        roomName: contact.username,
        isGroup: false,
        type: 'room',
        otherUserId: contact.id,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not open chat.');
    }
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts…"
          placeholderTextColor={colors.textFaint}
          autoFocus
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <ContactListItem
            contact={item}
            onPress={() => openDM(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {contacts.length === 0
                ? 'Add contacts first to start a conversation.'
                : 'No contacts match your search.'}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  searchBox: { padding: spacing.md },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: typography.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 3, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: typography.base, textAlign: 'center' },
});
