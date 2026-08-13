/**
 * Date Picker Component - Simple date picker using React Native's built-in DatePickerAndroid
 * For a better implementation, use react-native-paper-dates or react-native-date-picker
 */

import React, { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { theme } from '../theme';

interface DatePickerProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  style?: any;
}

export default function DatePicker({
  label,
  value,
  onChange,
  mode = 'date',
  minimumDate,
  maximumDate,
  style,
}: DatePickerProps) {
  const handlePress = async () => {
    if (Platform.OS === 'android') {
      try {
        const { action, year, month, day } = await require('react-native').DatePickerAndroid.open({
          date: value,
          mode: mode === 'datetime' ? 'default' : mode,
          minDate: minimumDate,
          maxDate: maximumDate,
        });

        if (action !== 'dismissedAction') {
          const newDate = new Date(year, month, day);
          onChange(newDate);
        }
      } catch (error) {
        console.error('DatePicker error:', error);
      }
    } else {
      // iOS - would use a different picker
      // For now, just show an alert
      console.log('iOS date picker not implemented');
    }
  };

  return (
    <Button
      mode="outlined"
      onPress={handlePress}
      style={[styles.button, style]}
      contentStyle={{ minHeight: 48 }}
    >
      {value ? value.toLocaleDateString() : label}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
  },
});
