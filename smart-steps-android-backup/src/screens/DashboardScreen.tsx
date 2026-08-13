/**
 * Dashboard Screen - Main overview screen
 * 
 * TODO: Implement dashboard with stats, pending approvals, recent activity
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Text, FAB, ActivityIndicator } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';

export default function DashboardScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDashboardStats();
      setStats(data || {
        pendingApprovals: 0,
        recentInvoices: 0,
        recentActivity: [],
      });
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      // Set default stats on error
      setStats({
        pendingApprovals: 0,
        recentInvoices: 0,
        recentActivity: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
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
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {/* Quick Access Cards */}
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Quick Access
          </Text>

          <View style={styles.cardRow}>
            <Card
              style={styles.quickCard}
              onPress={() => navigation.navigate('Timesheets')}
            >
              <Card.Content>
                <Text variant="headlineSmall">Timesheets</Text>
                <Text variant="bodyMedium" style={styles.cardSubtext}>
                  View and manage timesheets
                </Text>
              </Card.Content>
            </Card>

            <Card
              style={styles.quickCard}
              onPress={() => navigation.navigate('Invoices')}
            >
              <Card.Content>
                <Text variant="headlineSmall">Invoices</Text>
                <Text variant="bodyMedium" style={styles.cardSubtext}>
                  View and manage invoices
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* Stats Cards */}
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Statistics
          </Text>

          <Card style={styles.statCard}>
            <Card.Content>
              <Text variant="titleMedium">Pending Approvals</Text>
              <Text variant="headlineMedium" style={styles.statValue}>
                {stats?.pendingApprovals || 0}
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content>
              <Text variant="titleMedium">Recent Invoices</Text>
              <Text variant="headlineMedium" style={styles.statValue}>
                {stats?.recentInvoices || 0}
              </Text>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          // Quick action menu could be added here
          // For now, users can navigate to specific screens via tabs
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  cardRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  quickCard: {
    flex: 1,
    minHeight: 120,
    elevation: theme.elevation.sm,
  },
  cardSubtext: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  statCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.sm,
  },
  statValue: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    marginTop: theme.spacing.xs,
  },
  fab: {
    position: 'absolute',
    margin: theme.spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});
