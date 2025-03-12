import api from './api';
import { tokenStorage } from '../utils/tokenUtils';
import { userStorage } from './api';

/**
 * Register a new user with the system
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Response with success status and message
 */
export const register = async (userData) => {
  try {
    const response = await api.post('/register', userData);
    if (response.success && response.token) {
      tokenStorage.setToken(response.token);
      userStorage.setUser(response.user);
    }
    return response;
  } catch (error) {
    console.error('Registration error:', error);
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
    const response = await api.post('/login', { email, password });
    if (response.success && response.token) {
      tokenStorage.setToken(response.token);
      userStorage.setUser(response.user);
    }
    return response;
  } catch (error) {
    console.error('Login error:', error);
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
