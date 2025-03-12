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
      console.warn('Error saving token to cookie storage, using in-memory only');
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
      console.warn('Error accessing token in cookie storage, using in-memory fallback');
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
      console.warn('Error removing token from cookie storage');
    }
  }
};

// Public API
export const saveToken = (token) => {
  tokenStorage.setToken(token);
};

export const getToken = () => {
  return tokenStorage.getToken();
};

export const removeToken = () => {
  tokenStorage.removeToken();
};

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
