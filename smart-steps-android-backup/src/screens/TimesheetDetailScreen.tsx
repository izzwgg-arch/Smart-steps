/**
 * Timesheet Detail Screen - View and edit timesheet details
 * 
 * TODO: Implement full timesheet detail view with signature display
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, ActivityIndicator, Button, Chip } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';

export default function TimesheetDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { isAdmin } = useAuth();
  const [timesheet, setTimesheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTimesheet();
  }, [id]);

  const loadTimesheet = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getTimesheet(id);
      setTimesheet(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load timesheet');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!timesheet) {
    return (
      <View style={styles.center}>
        <Text>Timesheet not found</Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await apiClient.submitTimesheet(id);
      Alert.alert('Success', 'Timesheet submitted successfully');
      loadTimesheet(); // Refresh
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit timesheet');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await apiClient.approveTimesheet(id);
      Alert.alert('Success', 'Timesheet approved');
      loadTimesheet(); // Refresh
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve timesheet');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    Alert.prompt(
      'Reject Timesheet',
      'Please provide a reason for rejection',
      async (reason) => {
        if (reason) {
          setActionLoading(true);
          try {
            await apiClient.rejectTimesheet(id, reason);
            Alert.alert('Success', 'Timesheet rejected');
            loadTimesheet(); // Refresh
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to reject timesheet');
          } finally {
            setActionLoading(false);
          }
        }
      }
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.title}>
              Timesheet Details
            </Text>
            {timesheet?.status && (
              <Chip style={styles.statusChip}>
                {timesheet.status}
              </Chip>
            )}
          </View>

          {timesheet && (
            <>
              <View style={styles.infoRow}>
                <Text variant="labelLarge">Provider:</Text>
                <Text variant="bodyLarge">{timesheet.provider?.name || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text variant="labelLarge">Client:</Text>
                <Text variant="bodyLarge">{timesheet.client?.name || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text variant="labelLarge">Period:</Text>
                <Text variant="bodyLarge">
                  {new Date(timesheet.startDate).toLocaleDateString()} -{' '}
                  {new Date(timesheet.endDate).toLocaleDateString()}
                </Text>
              </View>

              {timesheet.entries && timesheet.entries.length > 0 && (
                <View style={styles.entriesSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Entries
                  </Text>
                  {timesheet.entries.map((entry: any, index: number) => (
                    <Card key={index} style={styles.entryCard}>
                      <Card.Content>
                        <Text variant="bodyMedium">
                          {new Date(entry.date).toLocaleDateString()}
                        </Text>
                        <Text variant="bodySmall">
                          DR: {entry.drHours}h | SV: {entry.svHours}h
                        </Text>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}

              {/* Action Buttons */}
              {timesheet.status === 'DRAFT' && (
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={actionLoading}
                  style={styles.actionButton}
                  contentStyle={{ minHeight: 48 }}
                >
                  Submit Timesheet
                </Button>
              )}

              {isAdmin && timesheet.status === 'SUBMITTED' && (
                <View style={styles.actionRow}>
                  <Button
                    mode="contained"
                    onPress={handleApprove}
                    loading={actionLoading}
                    style={[styles.actionButton, styles.approveButton]}
                    contentStyle={{ minHeight: 48 }}
                  >
                    Approve
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={handleReject}
                    loading={actionLoading}
                    style={styles.actionButton}
                    contentStyle={{ minHeight: 48 }}
                  >
                    Reject
                  </Button>
                </View>
              )}
            </>
          )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: theme.spacing.md,
    elevation: theme.elevation.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontWeight: 'bold',
  },
  statusChip: {
    backgroundColor: theme.colors.primaryContainer,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  entriesSection: {
    marginTop: theme.spacing.lg,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  entryCard: {
    marginBottom: theme.spacing.sm,
    elevation: theme.elevation.sm,
  },
  actionButton: {
    marginTop: theme.spacing.md,
    minHeight: 48,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  approveButton: {
    flex: 1,
  },
});
