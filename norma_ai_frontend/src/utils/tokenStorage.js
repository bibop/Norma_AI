/**
 * Token storage utilities - Re-exports token management functions from tokenUtils
 * to maintain compatibility with imports expecting this file
 */

import { 
  tokenStorage, 
  setToken, 
  getToken, 
  removeToken, 
  isTokenExpired 
} from './tokenUtils';

// Export all required token management functions
export {
  tokenStorage,
  setToken,
  getToken,
  removeToken,
  isTokenExpired
};

// Default export for backwards compatibility
export default {
  tokenStorage,
  setToken,
  getToken,
  removeToken,
  isTokenExpired
};
