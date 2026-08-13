/**
 * Create Invoice Screen - Form for creating invoices from approved timesheets
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Button, Checkbox, ActivityIndicator } from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import { handleError } from '../utils/errorHandler';

export default function CreateInvoiceScreen({ navigation, route }: any) {
  const invoiceId = route.params?.id;
  const isEdit = !!invoiceId;
  const preselectedTimesheets = route.params?.timesheetIds || [];

  const [loading, setLoading] = useState(false);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [selectedTimesheets, setSelectedTimesheets] = useState<string[]>(preselectedTimesheets);
  const [clients, setClients] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    clientId: '',
    serviceDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadData();
    if (isEdit) {
      loadInvoice();
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [timesheetsData, clientsData] = await Promise.all([
        apiClient.getTimesheets({ status: 'APPROVED' }),
        apiClient.getClients(),
      ]);
      setTimesheets(timesheetsData || []);
      setClients(clientsData || []);
    } catch (error: any) {
      handleError(error, 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const invoice = await apiClient.getInvoice(invoiceId);
      setFormData({
        clientId: invoice.clientId || '',
        serviceDate: invoice.serviceDate
          ? new Date(invoice.serviceDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        notes: invoice.notes || '',
      });
      // Load associated timesheets if any
      if (invoice.timesheetIds) {
        setSelectedTimesheets(invoice.timesheetIds);
      }
    } catch (error: any) {
      handleError(error, 'Failed to load invoice');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const toggleTimesheet = (timesheetId: string) => {
    setSelectedTimesheets((prev) =>
      prev.includes(timesheetId)
        ? prev.filter((id) => id !== timesheetId)
        : [...prev, timesheetId]
    );
  };

  const handleSubmit = async () => {
    if (!formData.clientId) {
      Alert.alert('Validation Error', 'Please select a client');
      return;
    }

    if (selectedTimesheets.length === 0 && !isEdit) {
      Alert.alert('Validation Error', 'Please select at least one approved timesheet');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        clientId: formData.clientId,
        serviceDate: formData.serviceDate,
        notes: formData.notes.trim() || undefined,
        timesheetIds: selectedTimesheets,
      };

      if (isEdit) {
        await apiClient.updateInvoice(invoiceId, payload);
        Alert.alert('Success', 'Invoice updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await apiClient.createInvoice(payload);
        Alert.alert('Success', 'Invoice created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      handleError(error, 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  const availableTimesheets = timesheets.filter(
    (ts) => ts.clientId === formData.clientId || !formData.clientId
  );

  if (loading && !timesheets.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            {isEdit ? 'Edit Invoice' : 'Create Invoice'}
          </Text>

          {/* Client Selection */}
          <Text variant="labelLarge" style={styles.label}>
            Client *
          </Text>
          <View style={styles.clientList}>
            {clients.map((client) => (
              <Button
                key={client.id}
                mode={formData.clientId === client.id ? 'contained' : 'outlined'}
                onPress={() => setFormData({ ...formData, clientId: client.id })}
                style={styles.clientButton}
                contentStyle={{ minHeight: 48 }}
              >
                {client.name}
              </Button>
            ))}
          </View>

          {/* Service Date */}
          <Text variant="labelLarge" style={styles.label}>
            Service Date *
          </Text>
          <Button
            mode="outlined"
            onPress={() => {
              // TODO: Open date picker
              Alert.alert('Date Picker', 'Date picker will be implemented');
            }}
            style={styles.dateButton}
            contentStyle={{ minHeight: 48 }}
          >
            {formData.serviceDate || 'Select Date'}
          </Button>

          {/* Timesheet Selection */}
          {formData.clientId && (
            <>
              <Text variant="labelLarge" style={styles.label}>
                Select Timesheets *
              </Text>
              <Text variant="bodySmall" style={styles.hint}>
                Select approved timesheets to include in this invoice
              </Text>
              {availableTimesheets.length === 0 ? (
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No approved timesheets available for this client
                </Text>
              ) : (
                <View style={styles.timesheetList}>
                  {availableTimesheets.map((timesheet) => (
                    <Card
                      key={timesheet.id}
                      style={[
                        styles.timesheetCard,
                        selectedTimesheets.includes(timesheet.id) && styles.timesheetCardSelected,
                      ]}
                      onPress={() => toggleTimesheet(timesheet.id)}
                    >
                      <Card.Content>
                        <View style={styles.timesheetRow}>
                          <View style={styles.timesheetInfo}>
                            <Text variant="bodyMedium" style={styles.timesheetProvider}>
                              {timesheet.provider?.name || 'Unknown Provider'}
                            </Text>
                            <Text variant="bodySmall" style={styles.timesheetDate}>
                              {timesheet.startDate
                                ? `${new Date(timesheet.startDate).toLocaleDateString()} - ${new Date(timesheet.endDate).toLocaleDateString()}`
                                : 'N/A'}
                            </Text>
                          </View>
                          <Checkbox
                            status={selectedTimesheets.includes(timesheet.id) ? 'checked' : 'unchecked'}
                            onPress={() => toggleTimesheet(timesheet.id)}
                          />
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Notes */}
          <Text variant="labelLarge" style={styles.label}>
            Notes
          </Text>
          <Text
            style={styles.notesInput}
            onPress={() => {
              // TODO: Open text input modal
              Alert.prompt('Notes', 'Enter invoice notes', (text) => {
                if (text !== null) {
                  setFormData({ ...formData, notes: text });
                }
              });
            }}
          >
            {formData.notes || 'Tap to add notes...'}
          </Text>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
            contentStyle={{ minHeight: 48 }}
          >
            {isEdit ? 'Update Invoice' : 'Create Invoice'}
          </Button>
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
  title: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
  },
  label: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  clientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  clientButton: {
    marginBottom: theme.spacing.sm,
    minHeight: 48,
  },
  dateButton: {
    marginBottom: theme.spacing.md,
    minHeight: 48,
  },
  hint: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  timesheetList: {
    marginTop: theme.spacing.sm,
  },
  timesheetCard: {
    marginBottom: theme.spacing.sm,
    elevation: theme.elevation.sm,
  },
  timesheetCardSelected: {
    backgroundColor: theme.colors.primaryContainer,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  timesheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timesheetInfo: {
    flex: 1,
  },
  timesheetProvider: {
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  timesheetDate: {
    color: theme.colors.textSecondary,
  },
  notesInput: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.md,
    minHeight: 100,
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  submitButton: {
    marginTop: theme.spacing.xl,
    minHeight: 48,
  },
});
