/**
 * Filter Chips Component - For filtering lists by status, date, etc.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { theme } from '../theme';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  multiSelect?: boolean;
}

export default function FilterChips({
  options,
  selected,
  onToggle,
  multiSelect = true,
}: FilterChipsProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Chip
            key={option.value}
            selected={isSelected}
            onPress={() => onToggle(option.value)}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
            ]}
            selectedColor={isSelected ? theme.colors.onPrimary : undefined}
            mode={isSelected ? 'flat' : 'outlined'}
          >
            {option.label}
          </Chip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  chip: {
    marginBottom: theme.spacing.xs,
    minHeight: 40,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
  },
});
