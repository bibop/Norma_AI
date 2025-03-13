import axios from 'axios';
import { toast } from 'react-toastify';
import { setToken, getToken, clearToken } from '../utils/tokenUtils';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://127.0.0.1:3001/api', // Use direct IP instead of localhost
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true, // Include cookies in cross-site requests
  allowAbsoluteUrls: true // Allow absolute URLs for full domain requests
});

// Request interceptor to add auth token to requests
api.interceptors.request.use(
  config => {
    const token = getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      // Safe logging with null check
      try {
        console.log('Adding token to request:', `Bearer ${token.substring(0, 5)}...`);
      } catch (e) {
        console.log('Token available but cannot log its contents');
      }
    } else {
      console.log('No token available for request');
    }
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  response => {
    // Ensure data is properly structured in response
    return response.data ? response.data : response;
  },
  error => {
    // Enhanced error handling with detailed logging
    console.error('API Response Error:', error);
    
    if (!error.response) {
      // Network error - server unreachable
      console.error('Network error detected - server might be unreachable');
      return Promise.reject({
        success: false,
        isNetworkError: true,
        message: 'Network error. Server is unreachable.',
        status: 'network_error'
      });
    }
    
    // Server responded with error status
    const status = error.response.status;
    const responseData = error.response.data || {};
    
    console.error(`Server responded with status ${status}:`, responseData);
    
    return Promise.reject({
      success: false,
      isNetworkError: false,
      message: responseData.message || `Error ${status}: Server error`,
      status: status,
      data: responseData
    });
  }
);

// Authentication services
export const authService = {
  login: async (credentials) => {
    try {
      const response = await api.post('/basic-login', credentials);
      
      // Handle response structure: extract data from response if needed
      const responseData = response.data || response;
      
      // Save auth token from response - handle both token formats for compatibility
      if (responseData) {
        // Try both token field formats that might come from the backend
        const token = responseData.token || responseData.access_token;
        if (token) {
          setToken(token);
          console.log('Token saved after login');
        } else {
          console.warn('Login successful but no token received in response data:', responseData);
        }
      }
      
      return responseData;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  },
  
  logout: () => {
    clearToken();
    return { success: true };
  },
  
  validateToken: async () => {
    try {
      const response = await api.get('/auth/validate-token');
      return response;
    } catch (error) {
      clearToken(); // Clear invalid token
      throw error;
    }
  },
  
  getCurrentUser: async () => {
    try {
      return await api.get('/profile');
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }
};

// User profile services
export const userService = {
  getProfile: async () => {
    try {
      return await api.get('/profile');
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },
  
  updateProfile: async (profileData) => {
    try {
      return await api.put('/profile', profileData);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }
};

// Legal updates services
export const legalService = {
  getLegalUpdates: async () => {
    try {
      return await api.get('/legal-updates');
    } catch (error) {
      console.error('Error fetching legal updates:', error);
      throw error;
    }
  }
};

// Document services
export const documentService = {
  getDocuments: async () => {
    try {
      return await api.get('/documents');
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  },
  
  uploadDocument: async (documentData) => {
    try {
      const formData = new FormData();
      formData.append('file', documentData.file);
      formData.append('title', documentData.title);
      
      if (documentData.tags) {
        documentData.tags.forEach(tag => {
          formData.append('tags[]', tag);
        });
      }
      
      return await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }
};

// Network status check service
export const networkService = {
  checkConnection: async () => {
    try {
      return await api.get('/test-connection');
    } catch (error) {
      console.error('Error checking connection:', error);
      throw error;
    }
  }
};

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

export default api;
