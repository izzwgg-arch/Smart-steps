/**
 * Provider Detail Screen - View and edit provider details with signature
 * 
 * TODO: Implement full provider detail view with signature capture/display
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, ActivityIndicator, Button } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import SignatureImage from '../components/SignatureImage';
import SignaturePad from '../components/SignaturePad';
import { handleError } from '../utils/errorHandler';

export default function ProviderDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  useEffect(() => {
    loadProvider();
  }, [id]);

  const loadProvider = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getProvider(id);
      setProvider(data);
    } catch (error: any) {
      handleError(error, 'Failed to load provider');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (signatureDataUrl: string) => {
    try {
      await apiClient.updateProvider(id, { signature: signatureDataUrl });
      setShowSignaturePad(false);
      loadProvider(); // Refresh
      Alert.alert('Success', 'Signature updated successfully');
    } catch (error: any) {
      handleError(error, 'Failed to save signature');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (showSignaturePad) {
    return (
      <SignaturePad
        onSave={handleSaveSignature}
        onCancel={() => setShowSignaturePad(false)}
        existingSignature={provider?.signature}
        label="Provider Signature"
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.center}>
        <Text>Provider not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            Provider Details
          </Text>

          <View style={styles.infoRow}>
            <Text variant="labelLarge">Name:</Text>
            <Text variant="bodyLarge">{provider.name}</Text>
          </View>

          {provider.email && (
            <View style={styles.infoRow}>
              <Text variant="labelLarge">Email:</Text>
              <Text variant="bodyLarge">{provider.email}</Text>
            </View>
          )}

          {provider.phone && (
            <View style={styles.infoRow}>
              <Text variant="labelLarge">Phone:</Text>
              <Text variant="bodyLarge">{provider.phone}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text variant="labelLarge">Status:</Text>
            <Text variant="bodyLarge">{provider.active ? 'Active' : 'Inactive'}</Text>
          </View>
        </Card.Content>
      </Card>

      <SignatureImage
        signatureUrl={provider.signature}
        entityType="PROVIDER"
        entityId={id}
        label="Provider Signature"
        onUpdate={() => setShowSignaturePad(true)}
      />

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('CreateProvider', { id })}
          icon="pencil"
          style={styles.actionButton}
          contentStyle={{ minHeight: 48 }}
        >
          Edit Provider
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    elevation: theme.elevation.sm,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  actions: {
    padding: theme.spacing.md,
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
    minHeight: 48,
  },
});
