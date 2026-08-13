/**
 * Timesheet Detail Screen
 *
 * Status flow on this server: DRAFT → APPROVED (via /approve) or DRAFT (via /reject).
 * There is NO "submit" step — admins approve directly from DRAFT.
 *
 * Alert.prompt is iOS-only. On Android we show a custom modal for the reject reason.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Text,
  ActivityIndicator,
  Button,
  Chip,
  TextInput,
  Divider,
} from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';

// Local date display — avoids UTC off-by-one shifts
function formatLocalDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return 'N/A';
  // If it's a date-only string like "2025-12-31", parse parts directly
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  }
  return new Date(dateStr).toLocaleDateString();
}

export default function TimesheetDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { isAdmin } = useAuth();

  const [timesheet, setTimesheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal state (Alert.prompt is iOS-only, crashes on Android)
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

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

  const handleApprove = async () => {
    Alert.alert(
      'Approve Timesheet',
      'Are you sure you want to approve this timesheet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiClient.approveTimesheet(id);
              Alert.alert('Success', 'Timesheet approved');
              loadTimesheet();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to approve timesheet');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnapprove = async () => {
    Alert.alert(
      'Unapprove Timesheet',
      'Are you sure you want to revert this timesheet back to Draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unapprove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiClient.unapproveTimesheet(id);
              Alert.alert('Success', 'Timesheet reverted to Draft');
              loadTimesheet();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to unapprove timesheet');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for rejection');
      return;
    }
    setRejectModalVisible(false);
    setActionLoading(true);
    try {
      await apiClient.rejectTimesheet(id, rejectReason.trim());
      Alert.alert('Success', 'Timesheet rejected');
      setRejectReason('');
      loadTimesheet();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to reject timesheet');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return '#065f46';
      case 'DRAFT':    return '#374151';
      default:         return theme.colors.primary;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return '#d1fae5';
      case 'DRAFT':    return '#f3f4f6';
      default:         return theme.colors.primaryContainer;
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

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Header card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.header}>
              <Text variant="titleLarge" style={styles.title}>
                Timesheet Details
              </Text>
              <Chip
                style={{ backgroundColor: getStatusBg(timesheet.status) }}
                textStyle={{ color: getStatusColor(timesheet.status), fontWeight: '600' }}
              >
                {timesheet.status}
              </Chip>
            </View>

            <View style={styles.infoRow}>
              <Text variant="labelLarge" style={styles.label}>Provider</Text>
              <Text variant="bodyLarge">{timesheet.provider?.name || 'N/A'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text variant="labelLarge" style={styles.label}>Client</Text>
              <Text variant="bodyLarge">{timesheet.client?.name || 'N/A'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text variant="labelLarge" style={styles.label}>BCBA</Text>
              <Text variant="bodyLarge">{timesheet.bcba?.name || 'N/A'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text variant="labelLarge" style={styles.label}>Insurance</Text>
              <Text variant="bodyLarge">{timesheet.insurance?.name || 'N/A'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text variant="labelLarge" style={styles.label}>Period</Text>
              <Text variant="bodyLarge">
                {formatLocalDate(timesheet.startDate)} – {formatLocalDate(timesheet.endDate)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Entries */}
        {timesheet.entries && timesheet.entries.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Time Entries ({timesheet.entries.length})
              </Text>
              {timesheet.entries.map((entry: any, index: number) => (
                <View key={entry.id || index}>
                  <View style={styles.entryRow}>
                    <Text variant="bodyMedium" style={styles.entryDate}>
                      {formatLocalDate(entry.date)}
                    </Text>
                    <View style={styles.entryHours}>
                      <Text variant="bodySmall" style={styles.hoursLabel}>
                        DR: <Text style={styles.hoursValue}>{entry.drHours ?? 0}h</Text>
                      </Text>
                      <Text variant="bodySmall" style={[styles.hoursLabel, { marginLeft: theme.spacing.md }]}>
                        SV: <Text style={styles.hoursValue}>{entry.svHours ?? 0}h</Text>
                      </Text>
                    </View>
                  </View>
                  {entry.notes ? (
                    <Text variant="bodySmall" style={styles.entryNotes}>{entry.notes}</Text>
                  ) : null}
                  {index < timesheet.entries.length - 1 && <Divider style={styles.divider} />}
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Admin actions */}
        {isAdmin && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>Actions</Text>

              {timesheet.status === 'DRAFT' && (
                <View style={styles.actionRow}>
                  <Button
                    mode="contained"
                    onPress={handleApprove}
                    loading={actionLoading}
                    disabled={actionLoading}
                    style={[styles.actionButton, styles.approveButton]}
                    contentStyle={{ minHeight: 48 }}
                    icon="check-circle"
                  >
                    Approve
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => { setRejectReason(''); setRejectModalVisible(true); }}
                    loading={actionLoading}
                    disabled={actionLoading}
                    style={styles.actionButton}
                    contentStyle={{ minHeight: 48 }}
                    icon="close-circle"
                  >
                    Reject
                  </Button>
                </View>
              )}

              {timesheet.status === 'APPROVED' && (
                <Button
                  mode="outlined"
                  onPress={handleUnapprove}
                  loading={actionLoading}
                  disabled={actionLoading}
                  style={styles.actionButton}
                  contentStyle={{ minHeight: 48 }}
                  icon="undo"
                >
                  Revert to Draft
                </Button>
              )}
            </Card.Content>
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Reject reason modal — Alert.prompt is iOS-only and crashes on Android */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRejectModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <Text variant="titleMedium" style={styles.modalTitle}>
              Reject Timesheet
            </Text>
            <Text variant="bodyMedium" style={styles.modalSubtitle}>
              Please provide a reason for rejection
            </Text>
            <TextInput
              mode="outlined"
              label="Reason *"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setRejectModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleRejectConfirm}
                style={[styles.modalButton, styles.rejectButton]}
                buttonColor="#dc2626"
              >
                Reject
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
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
    marginBottom: 0,
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
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  label: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  entryDate: {
    fontWeight: '500',
    flex: 1,
  },
  entryHours: {
    flexDirection: 'row',
  },
  hoursLabel: {
    color: theme.colors.textSecondary,
  },
  hoursValue: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  entryNotes: {
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.xs,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
  },
  approveButton: {
    backgroundColor: theme.colors.primary,
  },
  // Reject modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    elevation: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  modalInput: {
    marginBottom: theme.spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
  },
  rejectButton: {},
});
