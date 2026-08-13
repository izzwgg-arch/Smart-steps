/**
 * Invoice Detail Screen - Complete implementation with Modern styling
 * 
 * Matches desktop "Modern" invoice design with mobile-optimized layout
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import {
  Card,
  Text,
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  Portal,
  Modal,
  TextInput,
} from 'react-native-paper';
import { theme } from '../theme';
import apiClient from '../api/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../utils/errorHandler';

export default function InvoiceDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { isAdmin } = useAuth();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getInvoice(id);
      setInvoice(data);
    } catch (error: any) {
      handleError(error, 'Failed to load invoice');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleViewPDF = async () => {
    try {
      const pdfUrl = `${apiClient['baseURL']}/api/invoices/${id}/pdf`;
      // Open PDF in browser or PDF viewer
      const supported = await Linking.canOpenURL(pdfUrl);
      if (supported) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Error', 'Cannot open PDF');
      }
    } catch (error: any) {
      handleError(error, 'Failed to open PDF');
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount');
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.addPayment(id, {
        amount: parseFloat(paymentAmount),
        referenceNumber: paymentRef || undefined,
        paymentDate: new Date().toISOString(),
      });
      Alert.alert('Success', 'Payment recorded successfully');
      setPaymentModalVisible(false);
      setPaymentAmount('');
      setPaymentRef('');
      loadInvoice(); // Refresh
    } catch (error: any) {
      handleError(error, 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!adjustmentAmount || parseFloat(adjustmentAmount) === 0) {
      Alert.alert('Validation Error', 'Please enter a valid adjustment amount');
      return;
    }
    if (!adjustmentReason.trim()) {
      Alert.alert('Validation Error', 'Please provide a reason for the adjustment');
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.addAdjustment(id, {
        amount: parseFloat(adjustmentAmount),
        reason: adjustmentReason.trim(),
      });
      Alert.alert('Success', 'Adjustment added successfully');
      setAdjustmentModalVisible(false);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      loadInvoice(); // Refresh
    } catch (error: any) {
      handleError(error, 'Failed to add adjustment');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return '#10b981'; // Green
      case 'PARTIALLY_PAID':
        return '#f59e0b'; // Amber
      case 'SENT':
        return '#3b82f6'; // Blue
      case 'READY':
        return '#6366f1'; // Indigo
      default:
        return theme.colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.center}>
        <Text>Invoice not found</Text>
      </View>
    );
  }

  const totalAmount = invoice.totalAmount || 0;
  const paidAmount = invoice.paidAmount || 0;
  const outstandingAmount = totalAmount - paidAmount;

  return (
    <ScrollView style={styles.container}>
      {/* Modern Header Card */}
      <Card style={[styles.card, styles.headerCard]}>
        <Card.Content>
          <View style={styles.header}>
            <View>
              <Text variant="headlineSmall" style={styles.invoiceNumber}>
                Invoice #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
              </Text>
              <Text variant="bodyMedium" style={styles.clientName}>
                {invoice.client?.name || 'Unknown Client'}
              </Text>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(invoice.status) + '20' }]}
              textStyle={{ color: getStatusColor(invoice.status) }}
            >
              {invoice.status?.replace('_', ' ') || 'DRAFT'}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* Info Card */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.infoLabel}>
                Service Date
              </Text>
              <Text variant="bodyLarge" style={styles.infoValue}>
                {invoice.serviceDate
                  ? new Date(invoice.serviceDate).toLocaleDateString()
                  : 'N/A'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.infoLabel}>
                Invoice Date
              </Text>
              <Text variant="bodyLarge" style={styles.infoValue}>
                {invoice.createdAt
                  ? new Date(invoice.createdAt).toLocaleDateString()
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Entries Card */}
      {invoice.entries && invoice.entries.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Invoice Entries
            </Text>
            {invoice.entries.map((entry: any, index: number) => (
              <View key={index} style={styles.entryRow}>
                <View style={styles.entryInfo}>
                  <Text variant="bodyMedium">{entry.description || 'Service'}</Text>
                  <Text variant="bodySmall" style={styles.entryDate}>
                    {entry.date ? new Date(entry.date).toLocaleDateString() : ''}
                  </Text>
                </View>
                <Text variant="bodyLarge" style={styles.entryAmount}>
                  ${(entry.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Payments Card */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Payments
            </Text>
            {invoice.payments.map((payment: any, index: number) => (
              <View key={index} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text variant="bodyMedium">
                    {payment.paymentDate
                      ? new Date(payment.paymentDate).toLocaleDateString()
                      : 'N/A'}
                  </Text>
                  {payment.referenceNumber && (
                    <Text variant="bodySmall" style={styles.paymentRef}>
                      Ref: {payment.referenceNumber}
                    </Text>
                  )}
                </View>
                <Text variant="bodyLarge" style={styles.paymentAmount}>
                  ${(payment.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Adjustments Card */}
      {invoice.adjustments && invoice.adjustments.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Adjustments
            </Text>
            {invoice.adjustments.map((adj: any, index: number) => (
              <View key={index} style={styles.adjustmentRow}>
                <View style={styles.adjustmentInfo}>
                  <Text variant="bodyMedium">{adj.reason || 'Adjustment'}</Text>
                  <Text variant="bodySmall" style={styles.adjustmentDate}>
                    {adj.createdAt
                      ? new Date(adj.createdAt).toLocaleDateString()
                      : ''}
                  </Text>
                </View>
                <Text
                  variant="bodyLarge"
                  style={[
                    styles.adjustmentAmount,
                    { color: (adj.amount || 0) >= 0 ? theme.colors.error : theme.colors.primary },
                  ]}
                >
                  ${(adj.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Summary Card */}
      <Card style={[styles.card, styles.summaryCard]}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Summary
          </Text>
          <View style={styles.summaryRow}>
            <Text variant="bodyLarge">Total Amount:</Text>
            <Text variant="titleLarge" style={styles.summaryAmount}>
              ${totalAmount.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodyLarge">Paid:</Text>
            <Text variant="titleMedium" style={styles.paidAmount}>
              ${paidAmount.toFixed(2)}
            </Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text variant="titleMedium" style={styles.outstandingLabel}>
              Outstanding:
            </Text>
            <Text variant="titleLarge" style={styles.outstandingAmount}>
              ${outstandingAmount.toFixed(2)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={handleViewPDF}
          icon="file-pdf-box"
          style={styles.actionButton}
          contentStyle={{ minHeight: 48 }}
        >
          View PDF
        </Button>
        <Button
          mode="contained"
          onPress={() => setPaymentModalVisible(true)}
          icon="cash"
          style={styles.actionButton}
          contentStyle={{ minHeight: 48 }}
        >
          Add Payment
        </Button>
        {isAdmin && (
          <Button
            mode="outlined"
            onPress={() => setAdjustmentModalVisible(true)}
            icon="calculator"
            style={styles.actionButton}
            contentStyle={{ minHeight: 48 }}
          >
            Add Adjustment
          </Button>
        )}
      </View>

      {/* Payment Modal */}
      <Portal>
        <Modal
          visible={paymentModalVisible}
          onDismiss={() => setPaymentModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Card>
            <Card.Content>
              <Text variant="titleLarge" style={styles.modalTitle}>
                Record Payment
              </Text>
              <TextInput
                label="Amount *"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="numeric"
                mode="outlined"
                style={styles.modalInput}
                contentStyle={{ minHeight: 48 }}
              />
              <TextInput
                label="Reference Number"
                value={paymentRef}
                onChangeText={setPaymentRef}
                mode="outlined"
                style={styles.modalInput}
                contentStyle={{ minHeight: 48 }}
              />
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setPaymentModalVisible(false)}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleAddPayment}
                  loading={actionLoading}
                  style={styles.modalButton}
                >
                  Record
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      {/* Adjustment Modal */}
      <Portal>
        <Modal
          visible={adjustmentModalVisible}
          onDismiss={() => setAdjustmentModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Card>
            <Card.Content>
              <Text variant="titleLarge" style={styles.modalTitle}>
                Add Adjustment
              </Text>
              <TextInput
                label="Amount * (positive or negative)"
                value={adjustmentAmount}
                onChangeText={setAdjustmentAmount}
                keyboardType="numeric"
                mode="outlined"
                style={styles.modalInput}
                contentStyle={{ minHeight: 48 }}
              />
              <TextInput
                label="Reason *"
                value={adjustmentReason}
                onChangeText={setAdjustmentReason}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.modalInput}
                contentStyle={{ minHeight: 48 }}
              />
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setAdjustmentModalVisible(false)}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleAddAdjustment}
                  loading={actionLoading}
                  style={styles.modalButton}
                >
                  Add
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
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
    marginBottom: theme.spacing.sm,
    elevation: theme.elevation.sm,
  },
  headerCard: {
    backgroundColor: theme.colors.primaryContainer,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceNumber: {
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  clientName: {
    color: theme.colors.textSecondary,
  },
  statusChip: {
    paddingHorizontal: theme.spacing.sm,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  infoValue: {
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  entryInfo: {
    flex: 1,
  },
  entryDate: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  entryAmount: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentRef: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  paymentAmount: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  adjustmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  adjustmentInfo: {
    flex: 1,
  },
  adjustmentDate: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  adjustmentAmount: {
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  summaryAmount: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  paidAmount: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  divider: {
    marginVertical: theme.spacing.md,
  },
  outstandingLabel: {
    fontWeight: 'bold',
  },
  outstandingAmount: {
    fontWeight: 'bold',
    color: theme.colors.error,
  },
  actions: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
    minHeight: 48,
  },
  modalContent: {
    padding: theme.spacing.md,
    backgroundColor: 'white',
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
  },
  modalInput: {
    marginBottom: theme.spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  modalButton: {
    minHeight: 48,
  },
});
