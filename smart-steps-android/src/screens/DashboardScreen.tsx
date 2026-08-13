/**
 * Dashboard Screen — main overview for the Smart Steps mobile app
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Text, ActivityIndicator } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  pendingApprovals?: number;
  totalTimesheets?: number;
  approvedTimesheets?: number;
  totalInvoices?: number;
  pendingInvoices?: number;
  outstandingAmount?: number;
  recentActivity?: any[];
}

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDashboardStats();
      setStats(data || {});
    } catch (error: any) {
      // Show empty state on error — don't crash
      setStats({});
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
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {/* Greeting */}
        <Text variant="headlineSmall" style={styles.greeting}>
          Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </Text>
        <Text variant="bodyMedium" style={styles.greetingSub}>
          Smart Steps ABA
        </Text>

        {/* Quick Access */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.cardRow}>
          <Card style={styles.quickCard} onPress={() => navigation.navigate('Timesheets')}>
            <Card.Content style={styles.quickCardContent}>
              <Text style={styles.quickCardIcon}>📋</Text>
              <Text variant="titleSmall" style={styles.quickCardLabel}>Timesheets</Text>
            </Card.Content>
          </Card>
          <Card style={styles.quickCard} onPress={() => navigation.navigate('Invoices')}>
            <Card.Content style={styles.quickCardContent}>
              <Text style={styles.quickCardIcon}>🧾</Text>
              <Text variant="titleSmall" style={styles.quickCardLabel}>Invoices</Text>
            </Card.Content>
          </Card>
          <Card style={styles.quickCard} onPress={() => navigation.navigate('Clients')}>
            <Card.Content style={styles.quickCardContent}>
              <Text style={styles.quickCardIcon}>👤</Text>
              <Text variant="titleSmall" style={styles.quickCardLabel}>Clients</Text>
            </Card.Content>
          </Card>
          <Card style={styles.quickCard} onPress={() => navigation.navigate('Providers')}>
            <Card.Content style={styles.quickCardContent}>
              <Text style={styles.quickCardIcon}>👥</Text>
              <Text variant="titleSmall" style={styles.quickCardLabel}>Providers</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Stats */}
        {(stats.pendingApprovals !== undefined || stats.totalTimesheets !== undefined) && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              {stats.pendingApprovals !== undefined && (
                <Card style={[styles.statCard, stats.pendingApprovals > 0 && styles.statCardAlert]}>
                  <Card.Content>
                    <Text variant="headlineMedium" style={styles.statValue}>
                      {stats.pendingApprovals}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Pending Approvals
                    </Text>
                  </Card.Content>
                </Card>
              )}
              {stats.totalTimesheets !== undefined && (
                <Card style={styles.statCard}>
                  <Card.Content>
                    <Text variant="headlineMedium" style={styles.statValue}>
                      {stats.totalTimesheets}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Total Timesheets
                    </Text>
                  </Card.Content>
                </Card>
              )}
              {stats.totalInvoices !== undefined && (
                <Card style={styles.statCard}>
                  <Card.Content>
                    <Text variant="headlineMedium" style={styles.statValue}>
                      {stats.totalInvoices}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Total Invoices
                    </Text>
                  </Card.Content>
                </Card>
              )}
              {stats.outstandingAmount !== undefined && stats.outstandingAmount > 0 && (
                <Card style={styles.statCard}>
                  <Card.Content>
                    <Text variant="headlineMedium" style={[styles.statValue, { fontSize: 20 }]}>
                      ${stats.outstandingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Outstanding
                    </Text>
                  </Card.Content>
                </Card>
              )}
            </View>
          </>
        )}
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
  content: {
    padding: theme.spacing.md,
  },
  greeting: {
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: theme.spacing.md,
  },
  greetingSub: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  quickCard: {
    width: '47%',
    elevation: theme.elevation.sm,
  },
  quickCardContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  quickCardIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  quickCardLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statCard: {
    width: '47%',
    elevation: theme.elevation.sm,
  },
  statCardAlert: {
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  statValue: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
