import api, { retryRequest } from './api';
import { tokenStorage } from '../utils/tokenUtils';
import { userStorage } from './api';

/**
 * Register a new user with the system
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Response with success status and message
 */
export const register = async (userData) => {
  try {
    const response = await retryRequest(async () => {
      return await api.post('/auth/register', userData);
    }, 2);
    
    if (response.success && response.token) {
      tokenStorage.setToken(response.token);
      userStorage.setUser(response.user);
    }
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle network errors specifically
    if (error.isNetworkError) {
      return { 
        success: false, 
        message: 'Cannot connect to server. Please check your connection and try again.',
        isNetworkError: true
      };
    }
    
    return { success: false, message: error.message || 'Registration failed' };
  }
};

/**
 * Authenticate user with the system
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Response with success status, token and user data
 */
export const login = async (email, password) => {
  try {
    const response = await retryRequest(async () => {
      return await api.post('/auth/login', { email, password });
    }, 2);
    
    if (response.success && response.access_token) {
      tokenStorage.setToken(response.access_token);
      userStorage.setUser(response.user);
    }
    return response;
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle network errors specifically
    if (error.isNetworkError) {
      return { 
        success: false, 
        message: 'Cannot connect to server. Please check your connection and try again.',
        isNetworkError: true
      };
    }
    
    return { success: false, message: error.message || 'Login failed' };
  }
};

/**
 * Log user out of the system by removing their authentication data
 */
export const logout = () => {
  tokenStorage.removeToken();
  userStorage.removeUser();
};

/**
 * Check if user is currently authenticated
 * @returns {boolean} True if user is authenticated
 */
export const checkAuthStatus = () => {
  const token = tokenStorage.getToken();
  return !!token;
};

/**
 * Get current authenticated user data
 * @returns {Object|null} User data or null if not authenticated
 */
export const getCurrentUser = () => {
  return userStorage.getUser();
};

/**
 * Verify if the current authentication token is valid
 * @returns {Promise<Object>} Response with validation result
 */
export const verifyToken = async () => {
  try {
    const token = tokenStorage.getToken();
    if (!token) {
      return { success: false, message: 'No authentication token found' };
    }
    
    const response = await api.post('/auth/verify');
    return response;
  } catch (error) {
    console.error('Token verification error:', error);
    return { success: false, message: 'Authentication token is invalid' };
  }
};
