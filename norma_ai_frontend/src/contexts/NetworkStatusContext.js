import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { connectivityService } from '../services/api';
import { API_BASE_URL } from '../config';

// Create a context for network status
const NetworkStatusContext = createContext({
  isOnline: true,
  lastChecked: null,
  serverAvailable: false
});

/**
 * Provider component that wraps the application to provide network status information
 * Monitors online/offline status and provides context to children
 */
export const NetworkStatusProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  const [hasShownOnlineToast, setHasShownOnlineToast] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  // Function to actively check server connectivity with multiple methods
  const checkServerConnection = async (showToasts = true) => {
    // Avoid multiple simultaneous connection checks
    if (isCheckingConnection) {
      return serverAvailable;
    }
    
    try {
      setIsCheckingConnection(true);
      setLastChecked(new Date());
      
      // Use the comprehensive connectivity service from api.js
      const result = await connectivityService.testConnection();
      
      // Update server availability status
      const wasAvailable = serverAvailable;
      setServerAvailable(result.success);
      
      if (showToasts) {
        // Show toast notifications only when status changes
        if (result.success && !wasAvailable) {
          toast.success('Server connection established!', {
            autoClose: 3000,
            toastId: 'server-online-notification'
          });
          setHasShownOfflineToast(false);
          setHasShownOnlineToast(true);
        } else if (!result.success && wasAvailable) {
          toast.error('Connection to server lost. Retrying...', {
            autoClose: false,
            toastId: 'server-offline-notification'
          });
          setHasShownOfflineToast(true);
          setHasShownOnlineToast(false);
        }
      }
      
      // Log detailed connection results for debugging
      console.log(`Server connection check result: ${result.success ? 'CONNECTED' : 'DISCONNECTED'}`, {
        message: result.message,
        details: result.details,
        timestamp: new Date().toISOString()
      });
      
      return result.success;
    } catch (error) {
      console.error('Error checking server connection:', error);
      setServerAvailable(false);
      return false;
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Function to handle online status changes
  const handleOnlineStatusChange = async () => {
    const currentlyOnline = navigator.onLine;
    setIsOnline(currentlyOnline);
    
    if (!currentlyOnline && !hasShownOfflineToast) {
      toast.error('You are offline. Some features may not be available.', {
        autoClose: false,
        toastId: 'offline-notification',
      });
      setHasShownOfflineToast(true);
      setHasShownOnlineToast(false);
      setServerAvailable(false);
    } else if (currentlyOnline && !hasShownOnlineToast && hasShownOfflineToast) {
      toast.success('You are back online!', {
        autoClose: 3000,
        toastId: 'online-notification',
      });
      setHasShownOnlineToast(true);
      setHasShownOfflineToast(false);
      
      // Check server connection after network comes back online
      setTimeout(() => checkServerConnection(true), 1000);
    }
  };

  // Listen for API network errors from other components
  useEffect(() => {
    const handleApiNetworkError = (event) => {
      console.log('API network error event received:', event.detail);
      // Debounce the connection check to avoid too many attempts
      if (!isCheckingConnection) {
        setTimeout(() => checkServerConnection(true), 1000);
      }
    };
    
    const handleApiCorsError = (event) => {
      console.log('API CORS error event received:', event.detail);
      // CORS errors likely indicate server is running but misconfigured
      setServerAvailable(false);
      toast.error('API connection blocked by CORS policy. Check server configuration.', {
        autoClose: false,
        toastId: 'cors-error-notification'
      });
    };
    
    // Register custom event listeners
    window.addEventListener('api_network_error', handleApiNetworkError);
    window.addEventListener('api_cors_error', handleApiCorsError);
    
    return () => {
      window.removeEventListener('api_network_error', handleApiNetworkError);
      window.removeEventListener('api_cors_error', handleApiCorsError);
    };
  }, [isCheckingConnection]);

  // Set up event listeners for network status changes
  useEffect(() => {
    // Initial status check
    handleOnlineStatusChange();
    
    // Add event listeners for online/offline status changes
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Initial server connection check
    checkServerConnection(false);
    
    // Periodic check for actual server availability (not just browser online status)
    const serverCheckInterval = setInterval(() => {
      if (navigator.onLine) {
        checkServerConnection(true);
      }
    }, 30000); // Check every 30 seconds
    
    // Clean up event listeners and intervals
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
      clearInterval(serverCheckInterval);
    };
  }, [hasShownOfflineToast, hasShownOnlineToast]);

  return (
    <NetworkStatusContext.Provider value={{ 
      isOnline, 
      serverAvailable, 
      lastChecked, 
      checkServerConnection,
      apiBaseUrl: API_BASE_URL
    }}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

// Custom hook to easily access network status anywhere in the app
export const useNetworkStatus = () => useContext(NetworkStatusContext);

export default NetworkStatusContext;
