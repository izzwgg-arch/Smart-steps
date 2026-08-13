/**
 * Timesheets Screen - List of timesheets with card-based layout
 * 
 * TODO: Implement full timesheet list with filtering and search
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Card, Text, FAB, ActivityIndicator, Button } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import SearchBar from '../components/SearchBar';
import FilterChips from '../components/FilterChips';

const TIMESHEET_STATUSES = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function TimesheetsScreen({ navigation }: any) {
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['ALL']);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTimesheets();
  }, []);

  const loadTimesheets = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getTimesheets();
      setTimesheets(data || []);
    } catch (error: any) {
      console.error('Error loading timesheets:', error);
      // Don't show error on initial load, just log it
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTimesheets();
    setRefreshing(false);
  };

  const filteredTimesheets = useMemo(() => {
    let filtered = [...timesheets];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ts) =>
          ts.provider?.name?.toLowerCase().includes(query) ||
          ts.client?.name?.toLowerCase().includes(query) ||
          ts.id?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (!selectedStatuses.includes('ALL')) {
      filtered = filtered.filter((ts) => selectedStatuses.includes(ts.status));
    }

    return filtered;
  }, [timesheets, searchQuery, selectedStatuses]);

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

  const renderTimesheetCard = ({ item }: any) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('TimesheetDetail', { id: item.id })}
    >
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>
          {item.provider?.name || 'Unknown Provider'}
        </Text>
        <Text variant="bodyMedium" style={styles.cardSubtext}>
          Client: {item.client?.name || 'Unknown Client'}
        </Text>
        <Text variant="bodySmall" style={styles.cardDate}>
          {item.startDate} - {item.endDate}
        </Text>
        <View style={styles.statusBadge}>
          <Text variant="labelSmall" style={styles.statusText}>
            {item.status}
          </Text>
        </View>
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
        placeholder="Search timesheets..."
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
          options={TIMESHEET_STATUSES}
          selected={selectedStatuses}
          onToggle={toggleStatusFilter}
        />
      )}

      <FlatList
        data={filteredTimesheets}
        renderItem={renderTimesheetCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              {searchQuery || selectedStatuses.length > 0
                ? 'No timesheets match your filters'
                : 'No timesheets found'}
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          navigation.navigate('CreateTimesheet');
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
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  statusText: {
    color: theme.colors.primary,
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
