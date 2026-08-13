/**
 * Mobile Configuration for Smart Steps Android App
 * 
 * This file maps the mobile app to the existing backend API endpoints
 * WITHOUT modifying the desktop/web backend code.
 * 
 * IMPORTANT: This is a READ-ONLY reference configuration.
 * All API endpoints point to the existing Next.js backend.
 */

const config = {
  // Base API URL - Points to production backend
  // For local development with emulator: http://10.0.2.2:3000
  // For local development with physical device: http://192.168.x.x:3000
  API_BASE_URL: process.env.API_BASE_URL || 'https://app.smartstepsabapc.org',
  
  // API Endpoints - All map to existing desktop backend routes
  endpoints: {
    // Authentication
    auth: {
      login: '/api/auth/session',
      logout: '/api/auth/signout',
      forgotPassword: '/api/auth/forgot-password',
      resetPassword: '/api/auth/reset-password',
      changePassword: '/api/auth/change-password',
      session: '/api/auth/session',
    },
    
    // Providers
    providers: {
      list: '/api/providers',
      get: (id) => `/api/providers/${id}`,
      create: '/api/providers',
      update: (id) => `/api/providers/${id}`,
      delete: (id) => `/api/providers/${id}`,
      import: '/api/providers/import',
    },
    
    // Clients
    clients: {
      list: '/api/clients',
      get: (id) => `/api/clients/${id}`,
      create: '/api/clients',
      update: (id) => `/api/clients/${id}`,
      delete: (id) => `/api/clients/${id}`,
      import: '/api/clients/import',
    },
    
    // BCBAs
    bcbas: {
      list: '/api/bcbas',
      get: (id) => `/api/bcbas/${id}`,
      create: '/api/bcbas',
      update: (id) => `/api/bcbas/${id}`,
      delete: (id) => `/api/bcbas/${id}`,
    },
    
    // Insurance
    insurance: {
      list: '/api/insurance',
      get: (id) => `/api/insurance/${id}`,
      create: '/api/insurance',
      update: (id) => `/api/insurance/${id}`,
      delete: (id) => `/api/insurance/${id}`,
    },
    
    // Timesheets
    // NOTE: Server only has DRAFT and APPROVED statuses — no SUBMITTED state.
    // Timesheets go DRAFT → APPROVED (via /approve) or DRAFT → rejected (via /reject).
    // There is no separate /submit endpoint.
    timesheets: {
      list: '/api/timesheets',
      get: (id) => `/api/timesheets/${id}`,
      create: '/api/timesheets',
      update: (id) => `/api/timesheets/${id}`,
      delete: (id) => `/api/timesheets/${id}`,
      approve: (id) => `/api/timesheets/${id}/approve`,
      unapprove: (id) => `/api/timesheets/${id}/unapprove`,
      reject: (id) => `/api/timesheets/${id}/reject`,
      generateInvoice: '/api/timesheets/generate-invoice',
      batchGenerateInvoice: '/api/timesheets/batch/generate-invoice',
      batchArchive: '/api/timesheets/batch/archive',
      checkOverlaps: '/api/timesheets/check-overlaps',
      pdf: (id) => `/api/timesheets/${id}/pdf`,
    },
    
    // Invoices
    invoices: {
      list: '/api/invoices',
      get: (id) => `/api/invoices/${id}`,
      create: '/api/invoices',
      update: (id) => `/api/invoices/${id}`,
      delete: (id) => `/api/invoices/${id}`,
      generate: '/api/invoices/generate',
      addPayment: (id) => `/api/invoices/${id}/payments`,
      addAdjustment: (id) => `/api/invoices/${id}/adjustments`,
      pdf: (id) => `/api/invoices/${id}/pdf`,
    },
    
    // Users (Admin only)
    users: {
      list: '/api/users',
      get: (id) => `/api/users/${id}`,
      create: '/api/users',
      update: (id) => `/api/users/${id}`,
      delete: (id) => `/api/users/${id}`,
    },
    
    // Analytics
    analytics: {
      data: '/api/analytics',
    },
    
    // Reports
    reports: {
      generate: '/api/reports',
      detailed: '/api/reports/detailed',
    },
    
    // Notifications
    notifications: {
      list: '/api/notifications',
      get: (id) => `/api/notifications/${id}`,
      markRead: (id) => `/api/notifications/${id}`,
      markAllRead: '/api/notifications/mark-all',
    },
    
    // Dashboard
    dashboard: {
      stats: '/api/dashboard/stats',
    },
    
    // Signatures
    signatures: {
      file: (type, id, ext) => `/api/admin/signatures/file/${type}/${id}.${ext}`,
      upload: '/api/admin/signatures/import',
    },
    
    // Forms (BCBA Forms)
    forms: {
      list: '/api/forms/list',
      get: (id) => `/api/forms/${id}`,
      create: '/api/forms',
      update: (id) => `/api/forms/${id}`,
      delete: (id) => `/api/forms/${id}`,
    },
  },
  
  // Request Configuration
  requestConfig: {
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
  
  // Feature Flags
  features: {
    enableOfflineMode: false, // Future: Enable offline data caching
    enablePushNotifications: false, // Future: Enable push notifications
    enableBiometricAuth: false, // Future: Enable fingerprint/face ID
  },
  
  // Storage Keys (for AsyncStorage)
  storageKeys: {
    authToken: '@smart_steps:auth_token',
    userSession: '@smart_steps:user_session',
    userPreferences: '@smart_steps:user_preferences',
    offlineData: '@smart_steps:offline_data',
  },
};

/**
 * Helper function to build full API URL
 */
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const baseUrl = config.API_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  return `${baseUrl}/${cleanEndpoint}`;
};

/**
 * Helper function to get endpoint URL
 */
export const getEndpoint = (category, action, ...params) => {
  const endpoint = config.endpoints[category];
  if (!endpoint) {
    throw new Error(`Unknown endpoint category: ${category}`);
  }
  
  const path = typeof endpoint[action] === 'function' 
    ? endpoint[action](...params)
    : endpoint[action];
  
  if (!path) {
    throw new Error(`Unknown endpoint action: ${category}.${action}`);
  }
  
  return getApiUrl(path);
};

export default config;
