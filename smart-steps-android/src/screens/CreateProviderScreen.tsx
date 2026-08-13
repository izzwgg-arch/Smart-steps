/**
 * Create Provider Screen - Form for creating/editing providers with signature
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, TextInput, Button } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import SignaturePad from '../components/SignaturePad';

interface ProviderFormData {
  name: string;
  email: string;
  phone: string;
  signature?: string;
}

export default function CreateProviderScreen({ navigation, route }: any) {
  const providerId = route.params?.id;
  const isEdit = !!providerId;

  const [loading, setLoading] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    email: '',
    phone: '',
    signature: undefined,
  });

  React.useEffect(() => {
    if (isEdit) {
      loadProvider();
    }
  }, [providerId]);

  const loadProvider = async () => {
    try {
      setLoading(true);
      const provider = await apiClient.getProvider(providerId);
      setFormData({
        name: provider.name || '',
        email: provider.email || '',
        phone: provider.phone || '',
        signature: provider.signature,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load provider');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (signatureDataUrl: string) => {
    setFormData({ ...formData, signature: signatureDataUrl });
    setShowSignaturePad(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Provider name is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        signature: formData.signature || undefined,
      };

      if (isEdit) {
        await apiClient.updateProvider(providerId, payload);
        Alert.alert('Success', 'Provider updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await apiClient.createProvider(payload);
        Alert.alert('Success', 'Provider created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save provider');
    } finally {
      setLoading(false);
    }
  };

  if (showSignaturePad) {
    return (
      <SignaturePad
        onSave={handleSaveSignature}
        onCancel={() => setShowSignaturePad(false)}
        existingSignature={formData.signature}
        label="Provider Signature"
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            {isEdit ? 'Edit Provider' : 'Create Provider'}
          </Text>

          <TextInput
            label="Name *"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            mode="outlined"
            style={styles.input}
            contentStyle={{ minHeight: 48 }}
          />

          <TextInput
            label="Email"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            contentStyle={{ minHeight: 48 }}
          />

          <TextInput
            label="Phone"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            contentStyle={{ minHeight: 48 }}
          />

          <Button
            mode="outlined"
            onPress={() => setShowSignaturePad(true)}
            icon="draw"
            style={styles.signatureButton}
            contentStyle={{ minHeight: 48 }}
          >
            {formData.signature ? 'Update Signature' : 'Add Signature'}
          </Button>

          {formData.signature && (
            <Text variant="bodySmall" style={styles.signatureIndicator}>
              ✓ Signature on file
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
            contentStyle={{ minHeight: 48 }}
          >
            {isEdit ? 'Update Provider' : 'Create Provider'}
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  card: {
    margin: theme.spacing.md,
    elevation: theme.elevation.sm,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  signatureButton: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    minHeight: 48,
  },
  signatureIndicator: {
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: theme.spacing.lg,
    minHeight: 48,
  },
});
