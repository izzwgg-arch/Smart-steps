/**
 * Signature Pad Component - Mobile-native signature capture
 * 
 * Uses react-native-signature-canvas for native signature drawing
 * Matches the desktop signature system functionality
 */

import React, { useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Button, Text, Card } from 'react-native-paper';
import SignatureCanvas from 'react-native-signature-canvas';
import { theme } from '../theme';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel: () => void;
  existingSignature?: string; // Base64 data URL or image URL
  label?: string;
}

export default function SignaturePad({
  onSave,
  onCancel,
  existingSignature,
  label = 'Signature',
}: SignaturePadProps) {
  const [signature, setSignature] = useState<string | null>(existingSignature || null);
  const signatureRef = useRef<SignatureCanvas>(null);

  const handleSave = () => {
    if (signatureRef.current) {
      const dataURL = signatureRef.current.toDataURL();
      setSignature(dataURL);
      onSave(dataURL);
    }
  };

  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setSignature(null);
    }
  };

  const handleEnd = () => {
    if (signatureRef.current) {
      const dataURL = signatureRef.current.toDataURL();
      setSignature(dataURL);
    }
  };

  const { width } = Dimensions.get('window');
  const signatureWidth = width - theme.spacing.lg * 2;
  const signatureHeight = 200; // Minimum height for comfortable signing

  return (
    <Card style={styles.container}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.label}>
          {label}
        </Text>

        {existingSignature && !signature && (
          <View style={styles.existingSignatureContainer}>
            <Text variant="bodySmall" style={styles.existingSignatureText}>
              Existing signature on file
            </Text>
            {/* TODO: Display existing signature image */}
          </View>
        )}

        <View style={styles.signatureContainer}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleEnd}
            descriptionText="Sign above"
            clearText="Clear"
            confirmText="Save"
            webStyle={`
              .m-signature-pad {
                box-shadow: none;
                border: 2px solid ${theme.colors.outline};
                border-radius: ${theme.borderRadius.md}px;
              }
              .m-signature-pad--body {
                background-color: ${theme.colors.surface};
              }
              .m-signature-pad--body canvas {
                background-color: ${theme.colors.surface};
              }
            `}
            style={{
              width: signatureWidth,
              height: signatureHeight,
            }}
          />
        </View>

        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={handleClear}
            style={styles.button}
            contentStyle={{ minHeight: 48 }}
          >
            Clear
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={!signature}
            style={styles.button}
            contentStyle={{ minHeight: 48 }}
          >
            Save Signature
          </Button>
        </View>

        <Button
          mode="text"
          onPress={onCancel}
          style={styles.cancelButton}
        >
          Cancel
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: theme.spacing.md,
    elevation: theme.elevation.md,
  },
  label: {
    marginBottom: theme.spacing.md,
    fontWeight: 'bold',
  },
  existingSignatureContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  existingSignatureText: {
    color: theme.colors.textSecondary,
  },
  signatureContainer: {
    borderWidth: 2,
    borderColor: theme.colors.outline,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 48, // Minimum touch target
  },
  cancelButton: {
    marginTop: theme.spacing.xs,
  },
});
