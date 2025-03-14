import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { connectivityService } from '../services/api';
import { API_BASE_URL, API_ROOT_URL } from '../config';

// Create a context for network status
const NetworkStatusContext = createContext({
  isOnline: true,
  lastChecked: null,
  serverAvailable: false,
  error: null,
  isLoading: false
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
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Function to actively check server connectivity with multiple methods
  const checkServerConnection = async (showToasts = true) => {
    setIsLoading(true);
    
    try {
      console.log('Testing API connection to:', API_ROOT_URL);
      const result = await connectivityService.testConnection(API_ROOT_URL);
      
      console.log('Connection test result:', result);
      
      if (result.success) {
        setServerAvailable(true);
        setError(null);
        if (showToasts) {
          toast.success('Connected to server successfully!');
        }
      } else {
        // If the test failed, provide specific error information
        setServerAvailable(false);
        
        if (result.details?.some(d => d.errorType === 'CORS error')) {
          setError({
            type: 'CORS',
            message: 'CORS policy blocked connection',
            details: result.message
          });
          if (showToasts) {
            toast.error('CORS policy blocked API connection. Please check the server configuration.', {
              autoClose: 5000
            });
          }
        } else if (result.details?.some(d => d.status === 0)) {
          setError({
            type: 'NETWORK',
            message: 'Network error - server unreachable',
            details: result.message
          });
          if (showToasts) {
            toast.error('Server is unreachable. Please check if the server is running.', {
              autoClose: 5000
            });
          }
        } else {
          setError({
            type: 'UNKNOWN',
            message: result.message || 'Unknown error occurred',
            details: JSON.stringify(result.details || {})
          });
          if (showToasts) {
            toast.error(`Connection error: ${result.message || 'Unknown error'}`, {
              autoClose: 5000
            });
          }
        }
      }
    } catch (error) {
      // Handle any unexpected errors in the connection test itself
      console.error('Error checking server connection:', error);
      setServerAvailable(false);
      setError({
        type: 'EXCEPTION',
        message: error.message || 'Exception occurred during connection check',
        details: error.stack || ''
      });
      if (showToasts) {
        toast.error(`Connection check failed: ${error.message || 'Unknown error'}`, {
          autoClose: 5000
        });
      }
    } finally {
      setIsLoading(false);
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
      setError({
        type: 'CORS',
        message: 'CORS policy blocked connection',
        details: 'Please check the server configuration.'
      });
      toast.error('API connection blocked by CORS policy. Please check the server configuration.', {
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
    
    // Initial server connection check with 2 second delay to allow app to initialize
    setTimeout(() => checkServerConnection(false), 2000);
    
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
      error,
      isLoading,
      checkServerConnection,
      apiBaseUrl: API_ROOT_URL
    }}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

// Custom hook to easily access network status anywhere in the app
export const useNetworkStatus = () => useContext(NetworkStatusContext);

export default NetworkStatusContext;
