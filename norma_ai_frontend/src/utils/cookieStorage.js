/**
 * Cookie-based storage solution that provides a localStorage-like API
 * Uses js-cookie for cross-browser cookie handling with memory fallback
 * for contexts where cookies are not available
 */
import Cookies from 'js-cookie';

// Default cookie configuration
const DEFAULT_OPTIONS = {
  expires: 7, // 7 days expiry
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict'
};

// Memory storage fallback
const memoryStorage = new Map();

// Detect if cookies are actually available
const isCookieAvailable = () => {
  try {
    if (typeof window === 'undefined' || !window.document) {
      return false;
    }
    
    // Try to set and immediately remove a test cookie
    const testKey = '_test_cookie_available';
    Cookies.set(testKey, 'test', { expires: 1/86400 }); // 1 second expiry
    const testValue = Cookies.get(testKey);
    Cookies.remove(testKey);
    
    return testValue === 'test';
  } catch (error) {
    console.warn('Cookie access is not available in this context:', error);
    return false;
  }
};

// Safe getter that falls back to memory storage
export const getItem = (key) => {
  try {
    if (isCookieAvailable()) {
      const value = Cookies.get(key);
      return value || memoryStorage.get(key) || null;
    }
    return memoryStorage.get(key) || null;
  } catch (error) {
    console.warn(`Error getting ${key} from cookies:`, error);
    return memoryStorage.get(key) || null;
  }
};

// Safe setter that falls back to memory storage
export const setItem = (key, value, options = {}) => {
  try {
    memoryStorage.set(key, value); // Always set in memory first
    
    if (isCookieAvailable()) {
      Cookies.set(key, value, { ...DEFAULT_OPTIONS, ...options });
    }
    return true;
  } catch (error) {
    console.warn(`Error storing ${key} in cookies:`, error);
    return false;
  }
};

// Safe remover that falls back to memory storage
export const removeItem = (key) => {
  try {
    memoryStorage.delete(key); // Always remove from memory
    
    if (isCookieAvailable()) {
      Cookies.remove(key, { path: '/' });
    }
    return true;
  } catch (error) {
    console.warn(`Error removing ${key} from cookies:`, error);
    return false;
  }
};

// Export default object with localStorage-like API
export default {
  getItem,
  setItem,
  removeItem
};
