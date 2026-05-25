import React, { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, Text, StyleSheet, ActivityIndicator,
  RefreshControl, SectionList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { Contact } from '../../types';
import ContactListItem from '../../components/ContactListItem';
import { colors, spacing, typography } from '../../theme';

export default function ContactsScreen() {
  const { socket } = useSocket();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allUsers, setAllUsers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'contacts' | 'discover'>('contacts');

  const fetchData = useCallback(async () => {
    try {
      const users = await api.get<Contact[]>('/users');
      setAllUsers(users);
      setContacts(users.filter(u => u.status === 'accepted'));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  useEffect(() => {
    function onContactRequest({ from }: { from: Contact }) {
      setAllUsers(prev =>
        prev.map(u => u.id === from.id ? { ...u, status: 'pending' as const } : u)
      );
    }

    function onContactAccepted({ userId }: { userId: number }) {
      setAllUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, status: 'accepted' as const } : u)
      );
      setContacts(prev => {
        const user = allUsers.find(u => u.id === userId);
        if (!user) return prev;
        return [...prev, { ...user, status: 'accepted' }];
      });
    }

    socket?.on('contact:request', onContactRequest);
    socket?.on('contact:accepted', onContactAccepted);

    return () => {
      socket?.off('contact:request', onContactRequest);
      socket?.off('contact:accepted', onContactAccepted);
    };
  }, [socket, allUsers]);

  const sendRequest = async (userId: number) => {
    try {
      await api.post('/contacts/request', { contactId: userId });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'pending' as const } : u));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not send request.');
    }
  };

  const acceptRequest = async (userId: number) => {
    try {
      await api.post('/contacts/accept', { contactId: userId });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'accepted' as const } : u));
      const user = allUsers.find(u => u.id === userId);
      if (user) setContacts(prev => [...prev, { ...user, status: 'accepted' }]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not accept request.');
    }
  };

  const removeContact = async (userId: number) => {
    Alert.alert('Remove Contact', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/contacts/${userId}`);
            setContacts(prev => prev.filter(u => u.id !== userId));
            setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'none' as const } : u));
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove contact.');
          }
        },
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const discover = allUsers.filter(u => u.status === 'none' || u.status === 'pending');
  const pending = allUsers.filter(u => u.status === 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.tabs}>
        <Text
          style={[styles.tabLabel, tab === 'contacts' && styles.tabActive]}
          onPress={() => setTab('contacts')}
        >
          Contacts {contacts.length > 0 ? `(${contacts.length})` : ''}
        </Text>
        <Text
          style={[styles.tabLabel, tab === 'discover' && styles.tabActive]}
          onPress={() => setTab('discover')}
        >
          Discover {pending.length > 0 ? `(${pending.length})` : ''}
        </Text>
      </View>

      {tab === 'contacts' ? (
        <FlatList
          data={contacts}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ContactListItem
              contact={item}
              onRemove={() => removeContact(item.id)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No contacts yet. Discover people to add.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <FlatList
          data={discover}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ContactListItem
              contact={item}
              onAdd={() => sendRequest(item.id)}
              onAccept={() => acceptRequest(item.id)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No new people to discover.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tabLabel: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.md,
    fontSize: typography.base,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabActive: { color: colors.primary, borderBottomWidth: 2, borderBottomColor: colors.primary },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 3, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: typography.base, textAlign: 'center' },
});
