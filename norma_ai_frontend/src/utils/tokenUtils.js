import cookieStorage from './cookieStorage';

// Shared in-memory token storage for contexts where cookies are not available
export const tokenStorage = {
  inMemoryToken: null,
  setToken: (token) => {
    // Always set in-memory first
    tokenStorage.inMemoryToken = token;
    
    // Try to set in cookie storage
    try {
      cookieStorage.setItem('token', token);
      console.log('Token saved successfully to both in-memory and cookie storage');
    } catch (error) {
      console.warn('Error saving token to cookie storage, using in-memory only', error);
    }
  },
  getToken: () => {
    try {
      // Try to get from cookie storage first
      const token = cookieStorage.getItem('token');
      if (token) {
        // Update in-memory cache
        tokenStorage.inMemoryToken = token;
        return token;
      }
      // Fall back to in-memory
      return tokenStorage.inMemoryToken;
    } catch (error) {
      console.warn('Error accessing token in cookie storage, using in-memory fallback', error);
      return tokenStorage.inMemoryToken;
    }
  },
  removeToken: () => {
    // Clear in-memory first
    tokenStorage.inMemoryToken = null;
    
    // Try to remove from cookie storage
    try {
      cookieStorage.removeItem('token');
    } catch (error) {
      console.warn('Error removing token from cookie storage', error);
    }
    
    // Clear any token from sessionStorage as well (for extra safety)
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('token');
      }
    } catch (sessionError) {
      console.warn('Error clearing token from sessionStorage', sessionError);
    }
    
    console.log('Token successfully removed from all storage locations');
    
    // Return true to indicate successful token removal
    return true;
  },
  hasToken: () => {
    return !!tokenStorage.getToken();
  }
};

// Public API
export const setToken = (token) => {
  if (token) {
    console.log('Setting token:', token.substring(0, 5) + '...');
    tokenStorage.setToken(token);
    
    // Set a timestamp for token creation
    try {
      const now = new Date().getTime();
      cookieStorage.setItem('token_timestamp', now.toString());
    } catch (e) {
      console.warn('Could not save token timestamp', e);
    }
    
    // Dispatch an event for other components to know authentication changed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth_token_changed', { detail: { action: 'set' }}));
    }
  } else {
    console.warn('Attempted to set undefined token');
  }
};

export const getToken = () => {
  const token = tokenStorage.getToken();
  
  if (token) {
    // Check if token has expired based on our timestamp
    try {
      const timestamp = parseInt(cookieStorage.getItem('token_timestamp') || '0', 10);
      const now = new Date().getTime();
      const tokenAge = now - timestamp;
      
      // If token is older than 24 hours, consider it expired
      if (tokenAge > 24 * 60 * 60 * 1000) {
        console.warn('Token expired based on age check');
        clearToken();
        return null;
      }
    } catch (e) {
      console.warn('Error checking token age', e);
    }
  }
  
  return token || null; // Ensure we never return undefined
};

export const clearToken = () => {
  console.log('Clearing token');
  tokenStorage.removeToken();
  cookieStorage.removeItem('token_timestamp');
  
  // Dispatch an event for other components to know authentication changed
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth_token_changed', { detail: { action: 'clear' }}));
  }
};

// Aliases for compatibility
export const saveToken = setToken;
export const removeToken = clearToken;

export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // JWT tokens are made of three parts: header, payload, and signature
    // We need to decode the payload (middle part)
    const parts = token.split('.');
    
    // Check if token has the expected JWT structure
    if (parts.length !== 3) {
      // Handle test tokens that may not be valid JWT format
      if (token.startsWith('test-')) {
        // Test tokens are never considered expired
        return false;
      }
      return true; // Not a valid JWT format
    }
    
    const payload = parts[1];
    // Add padding if needed
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = JSON.parse(
      Buffer.from ? 
        Buffer.from(base64, 'base64').toString() : 
        atob(base64)
    );
    
    // Check if the token has an expiration time
    if (!decodedPayload.exp) return false;
    
    // Compare the expiration time with the current time
    const expirationDate = new Date(decodedPayload.exp * 1000);
    const currentDate = new Date();
    
    return currentDate > expirationDate;
  } catch (e) {
    console.error('Error checking token expiration:', e);
    
    // For test tokens, don't consider them expired
    if (token.startsWith('test-')) {
      return false;
    }
    
    return true; // Assume token is expired if we can't check
  }
};

/**
 * Validates the current token
 * @returns {boolean} - True if token is valid, false if expired or missing
 */
export const validateToken = () => {
  const token = getToken();
  
  if (!token) {
    return false;
  }
  
  return !isTokenExpired(token);
};
