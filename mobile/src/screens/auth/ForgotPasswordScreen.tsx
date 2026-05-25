import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ForgotPasswordScreenProps } from '../../navigation/types';
import { api } from '../../services/api';
import { colors, spacing, radius, typography } from '../../theme';

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      Alert.alert('Code Sent', 'Check your email for a reset code.');
      setStep('reset');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (code.length !== 8 || newPassword.length < 8) return;
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        code,
        newPassword,
      });
      Alert.alert('Password Reset', 'Your password has been updated. Please log in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {step === 'request' ? (
          <>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>Enter your email and we'll send a reset code.</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleRequest}
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRequest}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send Reset Code'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter the code from your email and your new password.</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 8))}
              placeholder="Reset code"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={8}
            />
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (8+ characters)"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleReset}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? 'Resetting…' : 'Reset Password'}</Text>
            </TouchableOpacity>
          </>
        )}

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
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: typography.base,
    padding: spacing.md,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.text, fontSize: typography.base, fontWeight: '700' },
  backText: { color: colors.textMuted, fontSize: typography.sm, textAlign: 'center' },
});
