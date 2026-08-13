/**
 * Main Navigation Setup for Smart Steps Android App
 * 
 * Uses React Navigation with Material Design 3 bottom tabs
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, Portal } from 'react-native-paper';
import { View, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Screens (to be implemented)
import DashboardScreen from '../screens/DashboardScreen';
import TimesheetsScreen from '../screens/TimesheetsScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import ClientsScreen from '../screens/ClientsScreen';
import ProvidersScreen from '../screens/ProvidersScreen';

// Detail Screens
import TimesheetDetailScreen from '../screens/TimesheetDetailScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import ClientDetailScreen from '../screens/ClientDetailScreen';
import ProviderDetailScreen from '../screens/ProviderDetailScreen';

// Form Screens
import CreateTimesheetScreen from '../screens/CreateTimesheetScreen';
import CreateProviderScreen from '../screens/CreateProviderScreen';
import CreateClientScreen from '../screens/CreateClientScreen';
import CreateInvoiceScreen from '../screens/CreateInvoiceScreen';

// Auth Screen
import LoginScreen from '../screens/LoginScreen';

import { theme } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/**
 * Main Tab Navigator - Bottom Navigation Bar
 */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Timesheets':
              iconName = focused ? 'file-document' : 'file-document-outline';
              break;
            case 'Invoices':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'Clients':
              iconName = focused ? 'account-group' : 'account-group-outline';
              break;
            case 'Providers':
              iconName = focused ? 'account-tie' : 'account-tie-outline';
              break;
            default:
              iconName = 'help-circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Timesheets" 
        component={TimesheetsScreen}
        options={{ title: 'Timesheets' }}
      />
      <Tab.Screen 
        name="Invoices" 
        component={InvoicesScreen}
        options={{ title: 'Invoices' }}
      />
      <Tab.Screen 
        name="Clients" 
        component={ClientsScreen}
        options={{ title: 'Clients' }}
      />
      <Tab.Screen 
        name="Providers" 
        component={ProvidersScreen}
        options={{ title: 'Providers' }}
      />
    </Tab.Navigator>
  );
}

/**
 * Main Stack Navigator
 */
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="TimesheetDetail" 
        component={TimesheetDetailScreen}
        options={{ title: 'Timesheet Details' }}
      />
      <Stack.Screen 
        name="InvoiceDetail" 
        component={InvoiceDetailScreen}
        options={{ title: 'Invoice Details' }}
      />
      <Stack.Screen 
        name="ClientDetail" 
        component={ClientDetailScreen}
        options={{ title: 'Client Details' }}
      />
      <Stack.Screen 
        name="ProviderDetail" 
        component={ProviderDetailScreen}
        options={{ title: 'Provider Details' }}
      />
      <Stack.Screen 
        name="CreateTimesheet" 
        component={CreateTimesheetScreen}
        options={{ title: 'Create Timesheet' }}
      />
      <Stack.Screen 
        name="CreateProvider" 
        component={CreateProviderScreen}
        options={{ title: 'Create Provider' }}
      />
      <Stack.Screen 
        name="CreateClient" 
        component={CreateClientScreen}
        options={{ title: 'Create Client' }}
      />
      <Stack.Screen 
        name="CreateInvoice" 
        component={CreateInvoiceScreen}
        options={{ title: 'Create Invoice' }}
      />
    </Stack.Navigator>
  );
}

/**
 * Root Navigator with Auth
 */
function AppNavigatorContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Portal.Host>
        {isAuthenticated ? (
          <AppStack />
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        )}
      </Portal.Host>
    </NavigationContainer>
  );
}

/**
 * Root Navigator with Auth Provider
 */
export default function AppNavigator() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <AppNavigatorContent />
      </AuthProvider>
    </PaperProvider>
  );
}
