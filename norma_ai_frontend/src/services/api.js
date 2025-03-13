import axios from 'axios';
import { getToken } from '../utils/tokenUtils';
import { shouldUseOfflineMode, getMockData, markBackendUnavailable } from '../utils/offlineMode';

// Always use direct IP address to avoid IPv6 resolution issues
const API_URL = 'http://127.0.0.1:3001/api';

console.log('Using direct API URL:', API_URL);

// Create axios instance with the direct IP address
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true,
  timeout: 15000 // Reasonable timeout to detect network issues
});

// Reset any previously saved API configurations
localStorage.removeItem('api_config');

// Define API endpoints
const endpoints = {
  login: '/auth/login',
  logout: '/auth/logout',
  register: '/auth/register',
  refreshToken: '/auth/refresh',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  verifyEmail: '/auth/verify-email',
  users: '/users',
  documents: '/documents',
  search: '/search',
  upload: '/upload',
};

// Helper for API methods
const apiMethods = {
  get: async (url, params = {}) => {
    return api.get(url, { params });
  },
  post: async (url, data = {}) => {
    return api.post(url, data);
  },
  put: async (url, data = {}) => {
    return api.put(url, data);
  },
  delete: async (url) => {
    return api.delete(url);
  },
  upload: async (url, file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (e) => {
        const progress = Math.round((e.loaded * 100) / e.total);
        if (onProgress) onProgress(progress);
      },
    });
  },
};

// Add a request interceptor to inject the JWT token
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method.toUpperCase(), config.url);
    
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors and normalize response format
api.interceptors.response.use(
  (response) => {
    console.log('API Response success:', response.status, response.config.url);
    // Return the data directly
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    
    // Network errors (no response from server)
    if (!error.response) {
      console.error('Network error details:', {
        message: error.message,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          baseURL: error.config.baseURL
        } : 'No config'
      });
      
      markBackendUnavailable(); // Mark backend as unavailable for offline mode
      
      return Promise.reject({
        success: false,
        isNetworkError: true,
        message: 'SERVER IS UNREACHABLE. Please check the connection',
        status: 'network_error'
      });
    }
    
    // Handle unauthorized errors (token expired or invalid)
    if (error.response.status === 401) {
      // Remove token
      localStorage.removeItem('token');
      
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    // Return a formatted error object
    if (error.response.data) {
      return Promise.reject(error.response.data);
    }
    
    return Promise.reject({ 
      success: false, 
      message: error.message || 'An error occurred'
    });
  }
);

// Shared user data storage with memory fallback
export const userStorage = {
  inMemoryUser: null,
  setUser: (userData) => {
    // Always set in memory first
    userStorage.inMemoryUser = userData;
    try {
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.warn('Error storing user data in local storage, using memory fallback');
    }
  },
  getUser: () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          userStorage.inMemoryUser = parsedUser; // Update memory cache
          return parsedUser;
        } catch (e) {
          console.warn('Error parsing user data from local storage');
        }
      }
      return userStorage.inMemoryUser;
    } catch (error) {
      console.warn('Error accessing user data from local storage, using memory fallback');
      return userStorage.inMemoryUser;
    }
  },
  removeUser: () => {
    userStorage.inMemoryUser = null;
    try {
      localStorage.removeItem('user');
    } catch (error) {
      console.warn('Error removing user data from local storage');
    }
  }
};

// Utility function for retrying API calls with exponential backoff
export const retryRequest = async (requestFn, maxRetries = 3) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await requestFn();
    } catch (error) {
      retries++;
      if (retries >= maxRetries || !error.isNetworkError) {
        throw error;
      }
      console.log(`Retrying request (${retries}/${maxRetries}) after network error...`);
      // Exponential backoff: 1s, 2s, 4s, etc.
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries - 1)));
    }
  }
};

/**
 * Upload a document with retry capability
 * @param {File} file - The file to upload
 * @param {string} [type='document'] - The type of upload
 * @param {Object} [metadata={}] - Additional metadata for the upload
 * @returns {Promise<Object>} Response with upload result
 */
export const uploadDocumentWithRetry = async (file, type = 'document', metadata = {}) => {
  return retryRequest(async () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    
    try {
      // Use the raw axios instance for this request to avoid response transformation
      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Increase timeout for large file uploads
        timeout: 60000, // 60 seconds
      });
      
      return response;
    } catch (error) {
      console.error('Document upload error:', error);
      throw error;
    }
  }, 3); // Try up to 3 times
};

/**
 * Get all users (debug view)
 * @returns {Promise<Object>} Response with users array
 */
export const getUsers = async () => {
  try {
    return await api.get('/users');
  } catch (error) {
    console.error('Error fetching users:', error);
    return { 
      success: false, 
      message: error?.message || 'Error fetching users',
      users: []
    };
  }
};

/**
 * Get all users (admin only)
 * @param {number} page - Page number for pagination
 * @param {number} perPage - Items per page
 * @returns {Promise<Object>} Response with user data and pagination info
 */
export const getUsersAdmin = async (page = 1, perPage = 10) => {
  try {
    return await api.get(`/admin/users?page=${page}&per_page=${perPage}`);
  } catch (error) {
    console.error('Error fetching users:', error);
    return { 
      success: false, 
      message: error?.message || 'Error fetching users',
      users: [],
      pagination: { page: 1, total_pages: 1 }
    };
  }
};

/**
 * Get a user by ID (admin only)
 * @param {string} userId - The ID of the user to fetch
 * @returns {Promise<Object>} Response with user data
 */
export const getUserByIdAdmin = async (userId) => {
  try {
    return await api.get(`/admin/users/${userId}`);
  } catch (error) {
    console.error('Error fetching user details:', error);
    return { 
      success: false, 
      message: error?.message || 'Error fetching user details' 
    };
  }
};

/**
 * Create a new user (admin only)
 * @param {Object} userData - User data to create
 * @returns {Promise<Object>} Response with created user data
 */
export const createUserAdmin = async (userData) => {
  try {
    return await api.post('/admin/users', userData);
  } catch (error) {
    console.error('Error creating user:', error);
    return { 
      success: false, 
      message: error?.message || 'Error creating user' 
    };
  }
};

/**
 * Update a user (admin only)
 * @param {string} userId - The ID of the user to update
 * @param {Object} userData - User data to update
 * @returns {Promise<Object>} Response with updated user data
 */
export const updateUserAdmin = async (userId, userData) => {
  try {
    return await api.put(`/admin/users/${userId}`, userData);
  } catch (error) {
    console.error('Error updating user:', error);
    return { 
      success: false, 
      message: error?.message || 'Error updating user' 
    };
  }
};

/**
 * Delete a user (admin only)
 * @param {string} userId - The ID of the user to delete
 * @returns {Promise<Object>} Response indicating success or failure
 */
export const deleteUserAdmin = async (userId) => {
  try {
    return await api.delete(`/admin/users/${userId}`);
  } catch (error) {
    console.error('Error deleting user:', error);
    return { 
      success: false, 
      message: error?.message || 'Error deleting user' 
    };
  }
};

/**
 * Get user profile
 * @returns {Promise<Object>} Response with user profile data
 */
export const getUserProfile = async () => {
  try {
    return await api.get('/profile');
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { 
      success: false, 
      message: error?.message || 'Error fetching user profile' 
    };
  }
};

/**
 * Update user profile
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} Response with updated profile data
 */
export const updateUserProfile = async (profileData) => {
  try {
    return await api.put('/profile', profileData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { 
      success: false, 
      message: error?.message || 'Error updating user profile' 
    };
  }
};

/**
 * Get legal updates based on user's profile preferences
 */
export const getLegalUpdates = async () => {
  try {
    const response = await api.get('/legal-updates');
    return response.data;
  } catch (error) {
    console.error('Error fetching legal updates:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch legal updates',
      updates: []
    };
  }
};

/**
 * Update the refresh interval for legal updates
 */
export const updateLegalUpdatesInterval = async (minutes) => {
  try {
    const response = await api.put('/settings/legal-updates-interval', {
      interval: minutes
    });
    return response.data;
  } catch (error) {
    console.error('Error updating legal updates interval:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to update refresh interval'
    };
  }
};

// User Jurisdictions and Legal Update Sources
export const updateUserJurisdictions = (primaryJurisdiction, selectedJurisdictions) => {
  return api.post('/users/preferences/jurisdictions', {
    preferred_jurisdiction: primaryJurisdiction,
    preferred_jurisdictions: selectedJurisdictions
  });
};

export const updateUserLegalSources = (selectedSources) => {
  return api.post('/users/preferences/legal-sources', {
    preferred_legal_sources: selectedSources
  });
};

export const getAvailableJurisdictions = () => {
  return api.get('/jurisdictions');
};

export default {
  ...apiMethods,
  endpoints,
  api, // Export the axios instance for direct use if needed
};
