import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RegisterScreenProps } from '../../navigation/types';
import { api } from '../../services/api';
import { colors, spacing, radius, typography } from '../../theme';

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) return;
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      navigation.navigate('Verify', { email: email.trim().toLowerCase() });
    } catch (err) {
      Alert.alert('Registration Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Linkloop today</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="cooluser"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <Text style={styles.mutedText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  title: { fontSize: typography.xxl, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: typography.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl * 1.5 },
  form: { gap: spacing.sm },
  label: { fontSize: typography.sm, color: colors.textMuted, marginBottom: 2 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: typography.base,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.text, fontSize: typography.base, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  mutedText: { color: colors.textMuted, fontSize: typography.sm },
  linkText: { color: colors.primary, fontSize: typography.sm, fontWeight: '600' },
});
