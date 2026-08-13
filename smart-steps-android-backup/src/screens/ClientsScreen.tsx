/**
 * Clients Screen - List of clients with card-based layout
 * 
 * TODO: Implement full client list with filtering and search
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Card, Text, FAB, ActivityIndicator } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import SearchBar from '../components/SearchBar';

export default function ClientsScreen({ navigation }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getClients();
      setClients(data || []);
    } catch (error: any) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const renderClientCard = ({ item }: any) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('ClientDetail', { id: item.id })}
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
        <Text variant="bodySmall" style={styles.cardInsurance}>
          Insurance: {item.insurance?.name || 'N/A'}
        </Text>
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
        placeholder="Search clients..."
      />

      <FlatList
        data={filteredClients}
        renderItem={renderClientCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              {searchQuery ? 'No clients match your search' : 'No clients found'}
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          navigation.navigate('CreateClient');
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
  cardInsurance: {
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.xs,
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
