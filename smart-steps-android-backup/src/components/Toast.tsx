/**
 * Toast Notification Component
 * 
 * Wrapper for react-native-paper Snackbar with consistent styling
 */

import React from 'react';
import { Snackbar } from 'react-native-paper';
import { theme } from '../theme';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({
  visible,
  message,
  type = 'info',
  onDismiss,
  duration = 3000,
}: ToastProps) {
  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  };

  return (
    <Snackbar
      visible={visible}
      onDismiss={onDismiss}
      duration={duration}
      style={{ backgroundColor: getBackgroundColor() }}
      action={{
        label: 'Dismiss',
        onPress: onDismiss,
      }}
    >
      {message}
    </Snackbar>
  );
}
