/**
 * Create Timesheet Screen - Form for creating new timesheets
 * 
 * Matches desktop functionality with mobile-optimized UI
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Card,
  Text,
  TextInput,
  Button,
  SegmentedButtons,
  Divider,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { theme } from '../theme';
import apiClient from '../api/apiClient';

interface TimesheetFormData {
  providerId: string;
  clientId: string;
  bcbaId?: string;
  insuranceId: string;
  startDate: Date;
  endDate: Date;
  entries: TimesheetEntry[];
}

interface TimesheetEntry {
  date: Date;
  drHours: number;
  svHours: number;
  notes?: string;
}

export default function CreateTimesheetScreen({ navigation, route }: any) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [bcbas, setBcbas] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<TimesheetFormData>({
    providerId: '',
    clientId: '',
    bcbaId: '',
    insuranceId: '',
    startDate: new Date(),
    endDate: new Date(),
    entries: [],
  });

  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const [providersData, clientsData, bcbasData, insurancesData] = await Promise.all([
        apiClient.getProviders(),
        apiClient.getClients(),
        apiClient.get('/api/bcbas'),
        apiClient.get('/api/insurance'),
      ]);

      setProviders(providersData || []);
      setClients(clientsData || []);
      setBcbas(bcbasData || []);
      setInsurances(insurancesData || []);
    } catch (error) {
      console.error('Error loading options:', error);
      Alert.alert('Error', 'Failed to load form options');
    }
  };

  const generateEntries = () => {
    if (!formData.startDate || !formData.endDate) return;

    const entries: TimesheetEntry[] = [];
    const currentDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    while (currentDate <= endDate) {
      entries.push({
        date: new Date(currentDate),
        drHours: 0,
        svHours: 0,
        notes: '',
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    setFormData({ ...formData, entries });
  };

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      generateEntries();
    }
  }, [formData.startDate, formData.endDate]);

  const updateEntry = (index: number, field: keyof TimesheetEntry, value: any) => {
    const updatedEntries = [...formData.entries];
    updatedEntries[index] = { ...updatedEntries[index], [field]: value };
    setFormData({ ...formData, entries: updatedEntries });
  };

  const handleSubmit = async () => {
    if (!formData.providerId || !formData.clientId || !formData.insuranceId) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (formData.entries.length === 0) {
      Alert.alert('Validation Error', 'Please select a date range');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        providerId: formData.providerId,
        clientId: formData.clientId,
        bcbaId: formData.bcbaId || undefined,
        insuranceId: formData.insuranceId,
        startDate: formData.startDate.toISOString(),
        endDate: formData.endDate.toISOString(),
        entries: formData.entries.map((entry) => ({
          date: entry.date.toISOString(),
          drHours: entry.drHours,
          svHours: entry.svHours,
          notes: entry.notes || undefined,
        })),
      };

      await apiClient.createTimesheet(payload);
      Alert.alert('Success', 'Timesheet created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create timesheet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            Create Timesheet
          </Text>

          {/* Provider Selection */}
          <Text variant="labelLarge" style={styles.label}>
            Provider *
          </Text>
          <SegmentedButtons
            value={formData.providerId}
            onValueChange={(value) => setFormData({ ...formData, providerId: value })}
            buttons={providers.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            style={styles.segmentedButtons}
          />

          {/* Client Selection */}
          <Text variant="labelLarge" style={styles.label}>
            Client *
          </Text>
          <SegmentedButtons
            value={formData.clientId}
            onValueChange={(value) => setFormData({ ...formData, clientId: value })}
            buttons={clients.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            style={styles.segmentedButtons}
          />

          {/* Date Range */}
          <View style={styles.dateRow}>
            <View style={styles.dateInput}>
              <Text variant="labelLarge" style={styles.label}>
                Start Date *
              </Text>
              <Button
                mode="outlined"
                onPress={() => setStartDatePickerOpen(true)}
                style={styles.dateButton}
              >
                {formData.startDate.toLocaleDateString()}
              </Button>
            </View>

            <View style={styles.dateInput}>
              <Text variant="labelLarge" style={styles.label}>
                End Date *
              </Text>
              <Button
                mode="outlined"
                onPress={() => setEndDatePickerOpen(true)}
                style={styles.dateButton}
              >
                {formData.endDate.toLocaleDateString()}
              </Button>
            </View>
          </View>

          <DatePickerModal
            locale="en"
            mode="single"
            visible={startDatePickerOpen}
            onDismiss={() => setStartDatePickerOpen(false)}
            date={formData.startDate}
            onConfirm={(params) => {
              setStartDatePickerOpen(false);
              setFormData({ ...formData, startDate: params.date });
            }}
          />

          <DatePickerModal
            locale="en"
            mode="single"
            visible={endDatePickerOpen}
            onDismiss={() => setEndDatePickerOpen(false)}
            date={formData.endDate}
            onConfirm={(params) => {
              setEndDatePickerOpen(false);
              setFormData({ ...formData, endDate: params.date });
            }}
          />

          {/* Entries */}
          {formData.entries.length > 0 && (
            <View style={styles.entriesContainer}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Time Entries
              </Text>
              {formData.entries.map((entry, index) => (
                <Card key={index} style={styles.entryCard}>
                  <Card.Content>
                    <Text variant="titleSmall">
                      {entry.date.toLocaleDateString()}
                    </Text>
                    <TextInput
                      label="DR Hours"
                      value={entry.drHours.toString()}
                      onChangeText={(text) =>
                        updateEntry(index, 'drHours', parseFloat(text) || 0)
                      }
                      keyboardType="numeric"
                      mode="outlined"
                      style={styles.input}
                    />
                    <TextInput
                      label="SV Hours"
                      value={entry.svHours.toString()}
                      onChangeText={(text) =>
                        updateEntry(index, 'svHours', parseFloat(text) || 0)
                      }
                      keyboardType="numeric"
                      mode="outlined"
                      style={styles.input}
                    />
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
            contentStyle={{ minHeight: 48 }}
          >
            Create Timesheet
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
  segmentedButtons: {
    marginBottom: theme.spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  dateInput: {
    flex: 1,
  },
  dateButton: {
    minHeight: 48,
  },
  entriesContainer: {
    marginTop: theme.spacing.lg,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  entryCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.sm,
  },
  input: {
    marginBottom: theme.spacing.sm,
  },
  submitButton: {
    marginTop: theme.spacing.xl,
    minHeight: 48,
  },
});
