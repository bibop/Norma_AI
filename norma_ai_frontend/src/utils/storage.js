/**
 * Safe localStorage wrapper that handles cases where localStorage might not be available
 * (e.g., in some testing environments, server-side rendering, or when cookies are disabled)
 */

// Check if localStorage is available
const isLocalStorageAvailable = () => {
  try {
    const testKey = '__test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('localStorage is not available in this context');
    return false;
  }
};

// Memory fallback when localStorage is not available
const memoryStorage = new Map();

export const getItem = (key) => {
  try {
    if (isLocalStorageAvailable()) {
      return window.localStorage.getItem(key);
    } 
    return memoryStorage.get(key) || null;
  } catch (error) {
    console.warn(`Error getting ${key} from storage:`, error);
    return memoryStorage.get(key) || null;
  }
};

export const setItem = (key, value) => {
  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.setItem(key, value);
    } else {
      memoryStorage.set(key, value);
    }
  } catch (error) {
    console.warn(`Error storing ${key} in storage:`, error);
    memoryStorage.set(key, value);
  }
};

export const removeItem = (key) => {
  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(key);
    } else {
      memoryStorage.delete(key);
    }
  } catch (error) {
    console.warn(`Error removing ${key} from storage:`, error);
    memoryStorage.delete(key);
  }
};

export default {
  getItem,
  setItem,
  removeItem
};
