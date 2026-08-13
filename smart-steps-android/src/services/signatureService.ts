/**
 * Signature Service
 * 
 * Handles signature upload, download, and management
 */

import apiClient from '../api/apiClient';
import { getApiUrl } from '../../mobile-config';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

class SignatureService {
  /**
   * Upload signature for a provider or client
   */
  async uploadSignature(
    entityType: 'PROVIDER' | 'CLIENT',
    entityId: string,
    signatureDataUrl: string
  ): Promise<string> {
    try {
      // Convert data URL to blob/file
      const base64Data = signatureDataUrl.split(',')[1];
      const blob = await this.dataURLToBlob(signatureDataUrl);

      // Create form data
      const formData = new FormData();
      formData.append('file', {
        uri: signatureDataUrl,
        type: 'image/png',
        name: 'signature.png',
      } as any);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      // Upload via signature import endpoint or update entity directly
      if (entityType === 'PROVIDER') {
        await apiClient.updateProvider(entityId, {
          signature: signatureDataUrl, // Base64 data URL
        });
        return signatureDataUrl;
      } else {
        await apiClient.updateClient(entityId, {
          signature: signatureDataUrl, // Base64 data URL
        });
        return signatureDataUrl;
      }
    } catch (error: any) {
      throw new Error(`Failed to upload signature: ${error.message}`);
    }
  }

  /**
   * Get signature URL for a provider or client
   */
  getSignatureUrl(entityType: 'PROVIDER' | 'CLIENT', entityId: string, ext: string = 'png'): string {
    return getApiUrl(`/api/admin/signatures/file/${entityType.toLowerCase()}/${entityId}.${ext}`);
  }

  /**
   * Download signature image
   */
  async downloadSignature(url: string): Promise<string> {
    try {
      // For React Native, we can use the URL directly or fetch and convert
      const response = await fetch(url);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error: any) {
      throw new Error(`Failed to download signature: ${error.message}`);
    }
  }

  /**
   * Convert data URL to blob (for file uploads)
   */
  private async dataURLToBlob(dataURL: string): Promise<Blob> {
    const response = await fetch(dataURL);
    return await response.blob();
  }

  /**
   * Convert signature to base64 (for storage)
   */
  async convertToBase64(imageUri: string): Promise<string> {
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // For React Native, use expo-file-system or react-native-fs
        // This is a placeholder - you'll need to implement based on your file system library
        return imageUri;
      }
    } catch (error: any) {
      throw new Error(`Failed to convert image: ${error.message}`);
    }
  }
}

export default new SignatureService();
