/**
 * Create Client Screen - Form for creating/editing clients with signature
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, TextInput, Button } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import SignaturePad from '../components/SignaturePad';

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  address?: string;
  idNumber?: string;
  insuranceId: string;
  signature?: string;
}

export default function CreateClientScreen({ navigation, route }: any) {
  const clientId = route.params?.id;
  const isEdit = !!clientId;

  const [loading, setLoading] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    idNumber: '',
    insuranceId: '',
    signature: undefined,
  });

  useEffect(() => {
    loadInsurances();
    if (isEdit) {
      loadClient();
    }
  }, [clientId]);

  const loadInsurances = async () => {
    try {
      const data = await apiClient.get('/api/insurance');
      setInsurances(data || []);
    } catch (error) {
      console.error('Error loading insurances:', error);
    }
  };

  const loadClient = async () => {
    try {
      setLoading(true);
      const client = await apiClient.getClient(clientId);
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        idNumber: client.idNumber || '',
        insuranceId: client.insuranceId || '',
        signature: client.signature,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load client');
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
      Alert.alert('Validation Error', 'Client name is required');
      return;
    }
    if (!formData.insuranceId) {
      Alert.alert('Validation Error', 'Please select an insurance');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address?.trim() || undefined,
        idNumber: formData.idNumber?.trim() || undefined,
        insuranceId: formData.insuranceId,
        signature: formData.signature || undefined,
      };

      if (isEdit) {
        await apiClient.updateClient(clientId, payload);
        Alert.alert('Success', 'Client updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await apiClient.createClient(payload);
        Alert.alert('Success', 'Client created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save client');
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
        label="Client Signature"
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            {isEdit ? 'Edit Client' : 'Create Client'}
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

          <TextInput
            label="Address"
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.input}
            contentStyle={{ minHeight: 48 }}
          />

          <TextInput
            label="ID Number"
            value={formData.idNumber}
            onChangeText={(text) => setFormData({ ...formData, idNumber: text })}
            mode="outlined"
            style={styles.input}
            contentStyle={{ minHeight: 48 }}
          />

          {/* Insurance Selection - Simplified for now */}
          <Text variant="labelLarge" style={styles.label}>
            Insurance *
          </Text>
          {insurances.map((insurance) => (
            <Button
              key={insurance.id}
              mode={formData.insuranceId === insurance.id ? 'contained' : 'outlined'}
              onPress={() => setFormData({ ...formData, insuranceId: insurance.id })}
              style={styles.insuranceButton}
              contentStyle={{ minHeight: 48 }}
            >
              {insurance.name}
            </Button>
          ))}

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
            {isEdit ? 'Update Client' : 'Create Client'}
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
  label: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  insuranceButton: {
    marginBottom: theme.spacing.sm,
    minHeight: 48,
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
