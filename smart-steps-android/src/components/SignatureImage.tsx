/**
 * Signature Image Component - Displays existing signatures
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import { getApiUrl } from '../../mobile-config';

interface SignatureImageProps {
  signatureUrl?: string;
  entityType: 'PROVIDER' | 'CLIENT';
  entityId: string;
  label?: string;
  onUpdate?: () => void;
}

export default function SignatureImage({
  signatureUrl,
  entityType,
  entityId,
  label = 'Signature',
  onUpdate,
}: SignatureImageProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSignature();
  }, [signatureUrl, entityType, entityId]);

  const loadSignature = async () => {
    if (!signatureUrl) {
      setImageUri(null);
      return;
    }

    // If it's already a data URL (base64), use it directly
    if (signatureUrl.startsWith('data:')) {
      setImageUri(signatureUrl);
      return;
    }

    // If it's a relative URL, construct full URL
    if (signatureUrl.startsWith('/api/')) {
      try {
        setLoading(true);
        setError(null);
        // Try to construct the full URL
        const fullUrl = signatureUrl.startsWith('http')
          ? signatureUrl
          : getApiUrl(signatureUrl.replace('/api/', ''));
        setImageUri(fullUrl);
      } catch (err: any) {
        setError('Failed to load signature');
        console.error('Error loading signature:', err);
      } finally {
        setLoading(false);
      }
    } else {
      // Assume it's already a full URL
      setImageUri(signatureUrl);
    }
  };

  if (!signatureUrl && !imageUri) {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="labelLarge" style={styles.label}>
            {label}
          </Text>
          <View style={styles.emptyContainer}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No signature on file
            </Text>
            {onUpdate && (
              <Button
                mode="outlined"
                onPress={onUpdate}
                icon="draw"
                style={styles.addButton}
                contentStyle={{ minHeight: 48 }}
              >
                Add Signature
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="labelLarge" style={styles.label}>
            {label}
          </Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        </Card.Content>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="labelLarge" style={styles.label}>
            {label}
          </Text>
          <View style={styles.emptyContainer}>
            <Text variant="bodySmall" style={styles.errorText}>
              {error}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="labelLarge" style={styles.label}>
            {label}
          </Text>
          {onUpdate && (
            <Button
              mode="text"
              onPress={onUpdate}
              icon="pencil"
              compact
            >
              Update
            </Button>
          )}
        </View>
        {imageUri && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onError={() => setError('Failed to load image')}
            />
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: theme.spacing.md,
    elevation: theme.elevation.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontWeight: '600',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  image: {
    width: '100%',
    height: 150,
    maxWidth: 400,
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  loadingContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.error,
  },
  addButton: {
    marginTop: theme.spacing.sm,
    minHeight: 48,
  },
});
