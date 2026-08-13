/**
 * Login Screen - First screen users see
 */

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      // Navigation will be handled by AppNavigator based on auth state
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.title}>
              Smart Steps
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Sign in to continue
            </Text>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              contentStyle={{ minHeight: 48 }} // Minimum touch target
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              contentStyle={{ minHeight: 48 }} // Minimum touch target
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={{ minHeight: 48 }} // Minimum touch target
            >
              Sign In
            </Button>

            <Button
              mode="text"
              onPress={() => {
                // TODO: Navigate to forgot password
              }}
              style={styles.forgotButton}
            >
              Forgot Password?
            </Button>
          </Card.Content>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    elevation: theme.elevation.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    color: theme.colors.textSecondary,
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  button: {
    marginTop: theme.spacing.md,
    minHeight: 48, // Minimum touch target
  },
  forgotButton: {
    marginTop: theme.spacing.sm,
  },
});
