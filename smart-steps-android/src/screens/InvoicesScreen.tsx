/**
 * Invoices Screen - List of invoices with card-based layout
 * 
 * TODO: Implement full invoice list with filtering and search
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Card, Text, FAB, ActivityIndicator, Button } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import SearchBar from '../components/SearchBar';
import FilterChips from '../components/FilterChips';

const INVOICE_STATUSES = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Ready', value: 'READY' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid', value: 'PAID' },
];

export default function InvoicesScreen({ navigation }: any) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['ALL']);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getInvoices();
      setInvoices(data || []);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  };

  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(query) ||
          inv.client?.name?.toLowerCase().includes(query) ||
          inv.id?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (!selectedStatuses.includes('ALL')) {
      filtered = filtered.filter((inv) => selectedStatuses.includes(inv.status));
    }

    return filtered;
  }, [invoices, searchQuery, selectedStatuses]);

  const toggleStatusFilter = (value: string) => {
    if (value === 'ALL') {
      setSelectedStatuses(['ALL']);
    } else {
      setSelectedStatuses((prev) => {
        const newStatuses = prev.includes('ALL')
          ? [value]
          : prev.includes(value)
          ? prev.filter((s) => s !== value)
          : [...prev.filter((s) => s !== 'ALL'), value];
        return newStatuses.length === 0 ? ['ALL'] : newStatuses;
      });
    }
  };

  const renderInvoiceCard = ({ item }: any) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('InvoiceDetail', { id: item.id })}
    >
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>
          Invoice #{item.invoiceNumber || item.id}
        </Text>
        <Text variant="bodyMedium" style={styles.cardSubtext}>
          Client: {item.client?.name || 'Unknown Client'}
        </Text>
        <Text variant="bodySmall" style={styles.cardDate}>
          Service Date: {item.serviceDate}
        </Text>
        <View style={styles.amountRow}>
          <Text variant="titleLarge" style={styles.amount}>
            ${item.totalAmount?.toFixed(2) || '0.00'}
          </Text>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text variant="labelSmall" style={styles.statusText}>
              {item.status}
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return { backgroundColor: '#d1fae5' };
      case 'PARTIALLY_PAID':
        return { backgroundColor: '#fef3c7' };
      case 'SENT':
        return { backgroundColor: '#dbeafe' };
      default:
        return { backgroundColor: theme.colors.surfaceVariant };
    }
  };

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
        placeholder="Search invoices..."
      />

      <View style={styles.filterRow}>
        <Button
          mode={showFilters ? 'contained' : 'outlined'}
          onPress={() => setShowFilters(!showFilters)}
          icon="filter"
          style={styles.filterButton}
          contentStyle={{ minHeight: 48 }}
        >
          Filters
        </Button>
      </View>

      {showFilters && (
        <FilterChips
          options={INVOICE_STATUSES}
          selected={selectedStatuses}
          onToggle={toggleStatusFilter}
        />
      )}

      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoiceCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              {searchQuery || selectedStatuses.length > 0
                ? 'No invoices match your filters'
                : 'No invoices found'}
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          navigation.navigate('CreateInvoice');
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
  filterRow: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  filterButton: {
    minHeight: 48,
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
  cardDate: {
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  amount: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  statusText: {
    fontWeight: '600',
    textTransform: 'uppercase',
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
