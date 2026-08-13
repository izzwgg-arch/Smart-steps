/**
 * Create Timesheet Screen
 *
 * TIMEZONE SAFETY:
 * Dates are sent as "YYYY-MM-DD" strings (not toISOString()) to avoid
 * UTC conversion shifting the date by a day for users in US timezones.
 * The server's parseDateOnly() reads these as local calendar dates.
 *
 * SegmentedButtons break with many items — replaced with ScrollView pickers.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Text,
  TextInput,
  Button,
  Divider,
  ActivityIndicator,
  Modal,
  Portal,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { theme } from '../theme';
import apiClient from '../api/apiClient';

interface TimesheetEntry {
  date: string; // "YYYY-MM-DD" — never a Date object to avoid timezone shifts
  drHours: number;
  svHours: number;
  notes: string;
}

interface FormData {
  providerId: string;
  providerName: string;
  clientId: string;
  clientName: string;
  bcbaId: string;
  bcbaName: string;
  insuranceId: string;
  insuranceName: string;
  startDate: Date | null;
  endDate: Date | null;
  entries: TimesheetEntry[];
}

/** Convert a Date to "YYYY-MM-DD" using local calendar date (not UTC) */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add one day to a "YYYY-MM-DD" string */
function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return toLocalDateString(next);
}

/** Format "YYYY-MM-DD" for display */
function displayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

type PickerType = 'provider' | 'client' | 'bcba' | 'insurance' | null;

export default function CreateTimesheetScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [providers, setProviders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [bcbas, setBcbas] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);

  const [formData, setFormData] = useState<FormData>({
    providerId: '',
    providerName: '',
    clientId: '',
    clientName: '',
    bcbaId: '',
    bcbaName: '',
    insuranceId: '',
    insuranceName: '',
    startDate: null,
    endDate: null,
    entries: [],
  });

  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerType>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      setOptionsLoading(true);
      const [providersData, clientsData, bcbasData, insurancesData] = await Promise.all([
        apiClient.getProviders().catch(() => []),
        apiClient.getClients().catch(() => []),
        apiClient.get('/api/bcbas').catch(() => []),
        apiClient.get('/api/insurance').catch(() => []),
      ]);
      setProviders(Array.isArray(providersData) ? providersData : providersData?.providers || []);
      setClients(Array.isArray(clientsData) ? clientsData : clientsData?.clients || []);
      setBcbas(Array.isArray(bcbasData) ? bcbasData : bcbasData?.bcbas || []);
      setInsurances(Array.isArray(insurancesData) ? insurancesData : insurancesData?.insurances || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load form options. Check your connection.');
    } finally {
      setOptionsLoading(false);
    }
  };

  /** Regenerate entries whenever date range changes */
  const generateEntries = (startDate: Date, endDate: Date): TimesheetEntry[] => {
    const entries: TimesheetEntry[] = [];
    const start = toLocalDateString(startDate);
    const end = toLocalDateString(endDate);
    let current = start;
    while (current <= end) {
      entries.push({ date: current, drHours: 0, svHours: 0, notes: '' });
      current = addOneDay(current);
    }
    return entries;
  };

  const handleStartDateConfirm = (params: any) => {
    setStartPickerOpen(false);
    const newStart = params.date as Date;
    const newEnd = formData.endDate && formData.endDate >= newStart ? formData.endDate : newStart;
    setFormData(prev => ({
      ...prev,
      startDate: newStart,
      endDate: newEnd,
      entries: generateEntries(newStart, newEnd),
    }));
  };

  const handleEndDateConfirm = (params: any) => {
    setEndPickerOpen(false);
    const newEnd = params.date as Date;
    if (formData.startDate && newEnd >= formData.startDate) {
      setFormData(prev => ({
        ...prev,
        endDate: newEnd,
        entries: generateEntries(formData.startDate!, newEnd),
      }));
    } else {
      Alert.alert('Invalid Date', 'End date must be on or after start date');
    }
  };

  const updateEntry = (index: number, field: keyof TimesheetEntry, value: any) => {
    setFormData(prev => {
      const updated = [...prev.entries];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, entries: updated };
    });
  };

  const handleSubmit = async () => {
    if (!formData.providerId || !formData.clientId || !formData.insuranceId) {
      Alert.alert('Missing Fields', 'Provider, Client, and Insurance are required');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      Alert.alert('Missing Dates', 'Please select a start and end date');
      return;
    }
    if (formData.entries.length === 0) {
      Alert.alert('No Entries', 'Date range produced no entries');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        providerId: formData.providerId,
        clientId: formData.clientId,
        bcbaId: formData.bcbaId || undefined,
        insuranceId: formData.insuranceId,
        // Send as "YYYY-MM-DD" — NOT toISOString() which would shift timezone
        startDate: toLocalDateString(formData.startDate),
        endDate: toLocalDateString(formData.endDate),
        entries: formData.entries.map(entry => ({
          date: entry.date, // already "YYYY-MM-DD"
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
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to create timesheet');
    } finally {
      setLoading(false);
    }
  };

  // ── Picker modal ─────────────────────────────────────────────────────────────
  const pickerOptions = () => {
    switch (activePicker) {
      case 'provider':  return providers.map(p => ({ id: p.id, name: p.name }));
      case 'client':    return clients.map(c => ({ id: c.id, name: c.name }));
      case 'bcba':      return [{ id: '', name: 'None' }, ...bcbas.map(b => ({ id: b.id, name: b.name }))];
      case 'insurance': return insurances.map(i => ({ id: i.id, name: i.name }));
      default: return [];
    }
  };

  const pickerTitle = () => {
    switch (activePicker) {
      case 'provider':  return 'Select Provider';
      case 'client':    return 'Select Client';
      case 'bcba':      return 'Select BCBA';
      case 'insurance': return 'Select Insurance';
      default: return '';
    }
  };

  const handlePickerSelect = (id: string, name: string) => {
    setFormData(prev => {
      switch (activePicker) {
        case 'provider':  return { ...prev, providerId: id, providerName: name };
        case 'client':    return { ...prev, clientId: id, clientName: name };
        case 'bcba':      return { ...prev, bcbaId: id, bcbaName: name };
        case 'insurance': return { ...prev, insuranceId: id, insuranceName: name };
        default: return prev;
      }
    });
    setActivePicker(null);
  };

  if (optionsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ marginTop: theme.spacing.md, color: theme.colors.textSecondary }}>
          Loading options…
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.title}>Create Timesheet</Text>

            {/* Provider */}
            <Text variant="labelLarge" style={styles.label}>Provider *</Text>
            <TouchableOpacity
              style={[styles.selector, !formData.providerId && styles.selectorEmpty]}
              onPress={() => setActivePicker('provider')}
            >
              <Text style={formData.providerId ? styles.selectorText : styles.selectorPlaceholder}>
                {formData.providerName || 'Select provider…'}
              </Text>
              <Text style={styles.selectorChevron}>›</Text>
            </TouchableOpacity>

            {/* Client */}
            <Text variant="labelLarge" style={styles.label}>Client *</Text>
            <TouchableOpacity
              style={[styles.selector, !formData.clientId && styles.selectorEmpty]}
              onPress={() => setActivePicker('client')}
            >
              <Text style={formData.clientId ? styles.selectorText : styles.selectorPlaceholder}>
                {formData.clientName || 'Select client…'}
              </Text>
              <Text style={styles.selectorChevron}>›</Text>
            </TouchableOpacity>

            {/* BCBA */}
            <Text variant="labelLarge" style={styles.label}>BCBA</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setActivePicker('bcba')}
            >
              <Text style={styles.selectorText}>
                {formData.bcbaName || 'None'}
              </Text>
              <Text style={styles.selectorChevron}>›</Text>
            </TouchableOpacity>

            {/* Insurance */}
            <Text variant="labelLarge" style={styles.label}>Insurance *</Text>
            <TouchableOpacity
              style={[styles.selector, !formData.insuranceId && styles.selectorEmpty]}
              onPress={() => setActivePicker('insurance')}
            >
              <Text style={formData.insuranceId ? styles.selectorText : styles.selectorPlaceholder}>
                {formData.insuranceName || 'Select insurance…'}
              </Text>
              <Text style={styles.selectorChevron}>›</Text>
            </TouchableOpacity>

            <Divider style={styles.sectionDivider} />

            {/* Date Range */}
            <Text variant="titleSmall" style={styles.sectionTitle}>Date Range *</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateInput}>
                <Text variant="labelMedium" style={styles.label}>Start Date</Text>
                <Button
                  mode="outlined"
                  onPress={() => setStartPickerOpen(true)}
                  style={styles.dateButton}
                  contentStyle={{ minHeight: 48 }}
                  icon="calendar"
                >
                  {formData.startDate ? toLocalDateString(formData.startDate) : 'Pick date'}
                </Button>
              </View>
              <View style={styles.dateInput}>
                <Text variant="labelMedium" style={styles.label}>End Date</Text>
                <Button
                  mode="outlined"
                  onPress={() => setEndPickerOpen(true)}
                  style={styles.dateButton}
                  contentStyle={{ minHeight: 48 }}
                  icon="calendar"
                >
                  {formData.endDate ? toLocalDateString(formData.endDate) : 'Pick date'}
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Entries */}
        {formData.entries.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Time Entries ({formData.entries.length} days)
              </Text>
              {formData.entries.map((entry, index) => (
                <View key={entry.date}>
                  <Text variant="labelMedium" style={styles.entryDateLabel}>
                    {displayDate(entry.date)}
                  </Text>
                  <View style={styles.entryRow}>
                    <TextInput
                      label="DR Hours"
                      value={entry.drHours === 0 ? '' : entry.drHours.toString()}
                      onChangeText={text => updateEntry(index, 'drHours', parseFloat(text) || 0)}
                      keyboardType="decimal-pad"
                      mode="outlined"
                      style={styles.hoursInput}
                      placeholder="0"
                    />
                    <TextInput
                      label="SV Hours"
                      value={entry.svHours === 0 ? '' : entry.svHours.toString()}
                      onChangeText={text => updateEntry(index, 'svHours', parseFloat(text) || 0)}
                      keyboardType="decimal-pad"
                      mode="outlined"
                      style={styles.hoursInput}
                      placeholder="0"
                    />
                  </View>
                  <TextInput
                    label="Notes (optional)"
                    value={entry.notes}
                    onChangeText={text => updateEntry(index, 'notes', text)}
                    mode="outlined"
                    style={styles.notesInput}
                  />
                  {index < formData.entries.length - 1 && <Divider style={styles.entryDivider} />}
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        <View style={styles.submitContainer}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
            contentStyle={{ minHeight: 52 }}
            icon="check"
          >
            Create Timesheet
          </Button>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Date pickers */}
      <DatePickerModal
        locale="en"
        mode="single"
        visible={startPickerOpen}
        onDismiss={() => setStartPickerOpen(false)}
        date={formData.startDate ?? undefined}
        onConfirm={handleStartDateConfirm}
      />
      <DatePickerModal
        locale="en"
        mode="single"
        visible={endPickerOpen}
        onDismiss={() => setEndPickerOpen(false)}
        date={formData.endDate ?? undefined}
        onConfirm={handleEndDateConfirm}
      />

      {/* Picker modal */}
      <Portal>
        <Modal
          visible={activePicker !== null}
          onDismiss={() => setActivePicker(null)}
          contentContainerStyle={styles.pickerModal}
        >
          <Text variant="titleMedium" style={styles.pickerTitle}>{pickerTitle()}</Text>
          <Divider />
          <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
            {pickerOptions().map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={styles.pickerOption}
                onPress={() => handlePickerSelect(opt.id, opt.name)}
              >
                <Text variant="bodyLarge">{opt.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button mode="text" onPress={() => setActivePicker(null)} style={{ marginTop: 8 }}>
            Cancel
          </Button>
        </Modal>
      </Portal>
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
  title: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
  },
  label: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  selector: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    minHeight: 48,
  },
  selectorEmpty: {
    borderColor: theme.colors.outline,
  },
  selectorText: {
    fontSize: 16,
    color: theme.colors.text,
    flex: 1,
  },
  selectorPlaceholder: {
    fontSize: 16,
    color: theme.colors.textTertiary,
    flex: 1,
  },
  selectorChevron: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  sectionDivider: {
    marginVertical: theme.spacing.lg,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  dateInput: {
    flex: 1,
  },
  dateButton: {
    minHeight: 48,
  },
  entryDateLabel: {
    fontWeight: '600',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    color: theme.colors.primary,
  },
  entryRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  hoursInput: {
    flex: 1,
  },
  notesInput: {
    marginTop: theme.spacing.sm,
  },
  entryDivider: {
    marginTop: theme.spacing.md,
  },
  submitContainer: {
    margin: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  submitButton: {
    minHeight: 48,
  },
  // Picker modal
  pickerModal: {
    backgroundColor: '#fff',
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 48,
    justifyContent: 'center',
  },
});
