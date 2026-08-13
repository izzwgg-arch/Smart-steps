/**
 * Client Detail Screen - View and edit client details
 * 
 * TODO: Implement full client detail view
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, ActivityIndicator, Button } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import SignatureImage from '../components/SignatureImage';
import SignaturePad from '../components/SignaturePad';
import { handleError } from '../utils/errorHandler';

export default function ClientDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  useEffect(() => {
    loadClient();
  }, [id]);

  const loadClient = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getClient(id);
      setClient(data);
    } catch (error: any) {
      handleError(error, 'Failed to load client');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (signatureDataUrl: string) => {
    try {
      await apiClient.updateClient(id, { signature: signatureDataUrl });
      setShowSignaturePad(false);
      loadClient(); // Refresh
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
        existingSignature={client?.signature}
        label="Client Signature"
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

  if (!client) {
    return (
      <View style={styles.center}>
        <Text>Client not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            Client Details
          </Text>

          <View style={styles.infoRow}>
            <Text variant="labelLarge">Name:</Text>
            <Text variant="bodyLarge">{client.name}</Text>
          </View>

          {client.email && (
            <View style={styles.infoRow}>
              <Text variant="labelLarge">Email:</Text>
              <Text variant="bodyLarge">{client.email}</Text>
            </View>
          )}

          {client.phone && (
            <View style={styles.infoRow}>
              <Text variant="labelLarge">Phone:</Text>
              <Text variant="bodyLarge">{client.phone}</Text>
            </View>
          )}

          {client.address && (
            <View style={styles.infoRow}>
              <Text variant="labelLarge">Address:</Text>
              <Text variant="bodyLarge">{client.address}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text variant="labelLarge">Insurance:</Text>
            <Text variant="bodyLarge">{client.insurance?.name || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="labelLarge">Status:</Text>
            <Text variant="bodyLarge">{client.active ? 'Active' : 'Inactive'}</Text>
          </View>
        </Card.Content>
      </Card>

      <SignatureImage
        signatureUrl={client.signature}
        entityType="CLIENT"
        entityId={id}
        label="Client Signature"
        onUpdate={() => setShowSignaturePad(true)}
      />

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('CreateClient', { id })}
          icon="pencil"
          style={styles.actionButton}
          contentStyle={{ minHeight: 48 }}
        >
          Edit Client
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
