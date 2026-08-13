/**
 * Providers Screen - List of providers with card-based layout
 * 
 * TODO: Implement full provider list with filtering and search
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Card, Text, FAB, ActivityIndicator } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import SearchBar from '../components/SearchBar';

export default function ProvidersScreen({ navigation }: any) {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getProviders();
      setProviders(data || []);
    } catch (error: any) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProviders();
    setRefreshing(false);
  };

  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const query = searchQuery.toLowerCase();
    return providers.filter(
      (provider) =>
        provider.name?.toLowerCase().includes(query) ||
        provider.email?.toLowerCase().includes(query) ||
        provider.phone?.toLowerCase().includes(query)
    );
  }, [providers, searchQuery]);

  const renderProviderCard = ({ item }: any) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('ProviderDetail', { id: item.id })}
    >
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>
          {item.name}
        </Text>
        {item.email && (
          <Text variant="bodyMedium" style={styles.cardSubtext}>
            {item.email}
          </Text>
        )}
        {item.phone && (
          <Text variant="bodySmall" style={styles.cardSubtext}>
            {item.phone}
          </Text>
        )}
        {item.signature && (
          <Text variant="bodySmall" style={styles.signatureIndicator}>
            ✓ Signature on file
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search providers..."
      />

      <FlatList
        data={filteredProviders}
        renderItem={renderProviderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              {searchQuery ? 'No providers match your search' : 'No providers found'}
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          navigation.navigate('CreateProvider');
        }}
      />
    </View>
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
  listContent: {
    padding: theme.spacing.md,
  },
  card: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.sm,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  cardSubtext: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  signatureIndicator: {
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    margin: theme.spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});
