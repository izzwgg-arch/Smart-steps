/**
 * Error Handler Utility
 * 
 * Centralized error handling and user-friendly error messages
 */

import { Alert } from 'react-native';

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
}

export function handleError(error: any, customMessage?: string): void {
  let message = customMessage || 'An unexpected error occurred';

  if (error?.response) {
    // API error response
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        message = data?.message || 'Invalid request. Please check your input.';
        break;
      case 401:
        message = 'Your session has expired. Please log in again.';
        break;
      case 403:
        message = 'You do not have permission to perform this action.';
        break;
      case 404:
        message = 'The requested resource was not found.';
        break;
      case 409:
        message = data?.message || 'This record already exists.';
        break;
      case 422:
        message = data?.message || 'Validation error. Please check your input.';
        break;
      case 500:
        message = 'Server error. Please try again later.';
        break;
      default:
        message = data?.message || error.message || message;
    }
  } else if (error?.message) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  Alert.alert('Error', message);
}

export function getErrorMessage(error: any): string {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}
