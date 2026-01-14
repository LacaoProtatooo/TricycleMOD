import Constants from 'expo-constants';

/**
 * Centralized configuration for the app
 * This ensures consistent API URL handling across all files
 */

// Get backend URL with proper fallback chain for different Expo environments
// Priority: expoConfig.extra > manifest2 > manifest > production default
export const getBackendUrl = () => {
  // For EAS builds (SDK 46+)
  if (Constants.expoConfig?.extra?.BACKEND_URL) {
    return Constants.expoConfig.extra.BACKEND_URL;
  }
  
  // For EAS Updates / newer manifest format
  if (Constants.manifest2?.extra?.expoClient?.extra?.BACKEND_URL) {
    return Constants.manifest2.extra.expoClient.extra.BACKEND_URL;
  }
  
  // For classic builds / older manifest format
  if (Constants.manifest?.extra?.BACKEND_URL) {
    return Constants.manifest.extra.BACKEND_URL;
  }
  
  // Default to production URL (NOT local IP) for preview/production builds
  return 'https://webttrac.onrender.com';
};

// Export the URL for use across the app
export const API_URL = getBackendUrl();

// For debugging - logs the backend URL being used
console.log('🔧 Backend URL:', API_URL);
