import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VerifyScreenProps } from '../../navigation/types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';

export default function VerifyScreen({ route, navigation }: VerifyScreenProps) {
  const { email } = route.params;
  const { setTokenAndUser } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 8) {
      Alert.alert('Invalid Code', 'Please enter the 8-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<{ token: string; user: User }>('/auth/verify', { email, code });
      await setTokenAndUser(data.token, data.user);
    } catch (err) {
      Alert.alert('Verification Failed', err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend', { email });
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent an 8-digit code to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 8))}
          placeholder="00000000"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={8}
          textAlign="center"
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify Email'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={resending}
        >
          <Text style={styles.resendText}>{resending ? 'Sending…' : 'Resend code'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: typography.xxl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: typography.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  email: { color: colors.primary, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    color: colors.text,
    fontSize: typography.xxl,
    fontWeight: '700',
    letterSpacing: 8,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.text, fontSize: typography.base, fontWeight: '700' },
  resendBtn: { alignItems: 'center', padding: spacing.sm },
  resendText: { color: colors.primary, fontSize: typography.sm },
  backText: { color: colors.textMuted, fontSize: typography.sm, textAlign: 'center' },
});
