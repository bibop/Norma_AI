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
  } else {
    console.warn('Attempted to set undefined token');
  }
};

export const getToken = () => {
  const token = tokenStorage.getToken();
  return token || null; // Ensure we never return undefined
};

export const clearToken = () => {
  console.log('Clearing token');
  tokenStorage.removeToken();
};

// Aliases for compatibility
export const saveToken = setToken;
export const removeToken = clearToken;

export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // JWT tokens are made of three parts: header, payload, and signature
    // We need to decode the payload (middle part)
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payload));
    
    // Check if the token has an expiration time
    if (!decodedPayload.exp) return false;
    
    // Compare the expiration time with the current time
    const expirationDate = new Date(decodedPayload.exp * 1000);
    const currentDate = new Date();
    
    return currentDate > expirationDate;
  } catch (e) {
    console.error('Error checking token expiration:', e);
    return true; // Assume token is expired if we can't check
  }
};
