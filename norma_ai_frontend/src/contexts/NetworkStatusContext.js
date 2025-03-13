import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';

// Create a context for network status
const NetworkStatusContext = createContext({
  isOnline: true,
  lastChecked: null
});

/**
 * Provider component that wraps the application to provide network status information
 * Monitors online/offline status and provides context to children
 */
export const NetworkStatusProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  const [hasShownOnlineToast, setHasShownOnlineToast] = useState(false);

  // Function to actively check if a specific URL is reachable
  const checkServerConnection = async (url = 'http://127.0.0.1:3001/api/test-connection') => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { 
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store', 
        credentials: 'omit',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Also check if response contains expected data
      if (response.ok) {
        const data = await response.json();
        return data && data.success === true;
      }
      
      return false;
    } catch (error) {
      console.warn('Server connection check failed:', error);
      return false;
    }
  };

  // Function to handle online status changes
  const handleOnlineStatusChange = () => {
    const currentlyOnline = navigator.onLine;
    setIsOnline(currentlyOnline);
    setLastChecked(new Date());
    
    if (!currentlyOnline && !hasShownOfflineToast) {
      toast.error('You are offline. Some features may not be available.', {
        autoClose: false,
        toastId: 'offline-notification',
      });
      setHasShownOfflineToast(true);
      setHasShownOnlineToast(false);
    } else if (currentlyOnline && !hasShownOnlineToast && hasShownOfflineToast) {
      toast.success('You are back online!', {
        autoClose: 3000,
        toastId: 'online-notification',
      });
      setHasShownOnlineToast(true);
      setHasShownOfflineToast(false);
    }
  };

  // Set up event listeners for network status changes
  useEffect(() => {
    // Initial status check
    handleOnlineStatusChange();
    
    // Add event listeners for online/offline status changes
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Periodic check for actual server availability (not just browser online status)
    const serverCheckInterval = setInterval(async () => {
      if (navigator.onLine) {
        const serverAvailable = await checkServerConnection();
        if (!serverAvailable && !hasShownOfflineToast) {
          toast.error('Server is unreachable. Please check your connection.', {
            autoClose: false,
            toastId: 'server-offline-notification',
          });
          setHasShownOfflineToast(true);
        }
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
    <NetworkStatusContext.Provider value={{ isOnline, lastChecked, checkServerConnection }}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

// Custom hook to easily access network status anywhere in the app
export const useNetworkStatus = () => useContext(NetworkStatusContext);

export default NetworkStatusContext;
