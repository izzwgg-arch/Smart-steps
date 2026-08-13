/**
 * API Client for Smart Steps Android App
 * 
 * This service layer handles all communication with the backend API.
 * It uses the mobile-config.js endpoints to ensure consistency.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config, { getApiUrl, getEndpoint } from '../../mobile-config';

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = config.API_BASE_URL;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.requestConfig.timeout,
      headers: config.requestConfig.headers,
    });

    // Request interceptor - Add auth token if available
    this.client.interceptors.request.use(
      async (requestConfig) => {
        const token = await AsyncStorage.getItem(config.storageKeys.authToken);
        if (token) {
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }
        return requestConfig;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - Clear token and redirect to login
          await AsyncStorage.removeItem(config.storageKeys.authToken);
          await AsyncStorage.removeItem(config.storageKeys.userSession);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generic GET request
   */
  async get<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(endpoint, config);
    return response.data;
  }

  /**
   * Generic POST request
   */
  async post<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(endpoint, data, config);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  async put<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(endpoint, data, config);
    return response.data;
  }

  /**
   * Generic PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(endpoint, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  async delete<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(endpoint, config);
    return response.data;
  }

  // Authentication Methods
  async login(email: string, password: string) {
    const endpoint = getEndpoint('auth', 'login');
    return this.post(endpoint, { email, password });
  }

  async logout() {
    const endpoint = getEndpoint('auth', 'logout');
    await AsyncStorage.removeItem(config.storageKeys.authToken);
    await AsyncStorage.removeItem(config.storageKeys.userSession);
    return this.post(endpoint);
  }

  async getSession() {
    const endpoint = getEndpoint('auth', 'session');
    return this.get(endpoint);
  }

  // Provider Methods
  async getProviders() {
    const endpoint = getEndpoint('providers', 'list');
    return this.get(endpoint);
  }

  async getProvider(id: string) {
    const endpoint = getEndpoint('providers', 'get', id);
    return this.get(endpoint);
  }

  async createProvider(data: any) {
    const endpoint = getEndpoint('providers', 'create');
    return this.post(endpoint, data);
  }

  async updateProvider(id: string, data: any) {
    const endpoint = getEndpoint('providers', 'update', id);
    return this.put(endpoint, data);
  }

  async deleteProvider(id: string) {
    const endpoint = getEndpoint('providers', 'delete', id);
    return this.delete(endpoint);
  }

  // Client Methods
  async getClients() {
    const endpoint = getEndpoint('clients', 'list');
    return this.get(endpoint);
  }

  async getClient(id: string) {
    const endpoint = getEndpoint('clients', 'get', id);
    return this.get(endpoint);
  }

  async createClient(data: any) {
    const endpoint = getEndpoint('clients', 'create');
    return this.post(endpoint, data);
  }

  async updateClient(id: string, data: any) {
    const endpoint = getEndpoint('clients', 'update', id);
    return this.put(endpoint, data);
  }

  async deleteClient(id: string) {
    const endpoint = getEndpoint('clients', 'delete', id);
    return this.delete(endpoint);
  }

  // Timesheet Methods
  async getTimesheets(params?: any) {
    const endpoint = getEndpoint('timesheets', 'list');
    return this.get(endpoint, { params });
  }

  async getTimesheet(id: string) {
    const endpoint = getEndpoint('timesheets', 'get', id);
    return this.get(endpoint);
  }

  async createTimesheet(data: any) {
    const endpoint = getEndpoint('timesheets', 'create');
    return this.post(endpoint, data);
  }

  async updateTimesheet(id: string, data: any) {
    const endpoint = getEndpoint('timesheets', 'update', id);
    return this.put(endpoint, data);
  }

  async submitTimesheet(id: string) {
    const endpoint = getEndpoint('timesheets', 'submit', id);
    return this.post(endpoint);
  }

  async approveTimesheet(id: string) {
    const endpoint = getEndpoint('timesheets', 'approve', id);
    return this.post(endpoint);
  }

  async rejectTimesheet(id: string, reason?: string) {
    const endpoint = getEndpoint('timesheets', 'reject', id);
    return this.post(endpoint, { reason });
  }

  // Invoice Methods
  async getInvoices(params?: any) {
    const endpoint = getEndpoint('invoices', 'list');
    return this.get(endpoint, { params });
  }

  async getInvoice(id: string) {
    const endpoint = getEndpoint('invoices', 'get', id);
    return this.get(endpoint);
  }

  async createInvoice(data: any) {
    const endpoint = getEndpoint('invoices', 'create');
    return this.post(endpoint, data);
  }

  async updateInvoice(id: string, data: any) {
    const endpoint = getEndpoint('invoices', 'update', id);
    return this.put(endpoint, data);
  }

  async addPayment(invoiceId: string, paymentData: any) {
    const endpoint = getEndpoint('invoices', 'addPayment', invoiceId);
    return this.post(endpoint, paymentData);
  }

  async addAdjustment(invoiceId: string, adjustmentData: any) {
    const endpoint = getEndpoint('invoices', 'addAdjustment', invoiceId);
    return this.post(endpoint, adjustmentData);
  }

  // Notification Methods
  async getNotifications() {
    const endpoint = getEndpoint('notifications', 'list');
    return this.get(endpoint);
  }

  async markNotificationRead(id: string) {
    const endpoint = getEndpoint('notifications', 'markRead', id);
    return this.patch(endpoint);
  }

  async markAllNotificationsRead() {
    const endpoint = getEndpoint('notifications', 'markAllRead');
    return this.post(endpoint);
  }

  // Dashboard Methods
  async getDashboardStats() {
    const endpoint = getEndpoint('dashboard', 'stats');
    return this.get(endpoint);
  }
}

export default new ApiClient();
