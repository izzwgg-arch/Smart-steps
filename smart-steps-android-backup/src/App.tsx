/**
 * Smart Steps Android App Root Component
 */

import React from 'react';
import { StatusBar } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { theme } from './theme';

export default function App() {
  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.primary}
      />
      <AppNavigator />
    </>
  );
}
