/**
 * Reusable Search Bar Component
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Searchbar } from 'react-native-paper';
import { theme } from '../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  style,
}: SearchBarProps) {
  return (
    <Searchbar
      placeholder={placeholder}
      onChangeText={onChangeText}
      value={value}
      style={[styles.searchbar, style]}
      inputStyle={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  searchbar: {
    margin: theme.spacing.md,
    elevation: theme.elevation.sm,
  },
  input: {
    minHeight: 48, // Touch target
  },
});
