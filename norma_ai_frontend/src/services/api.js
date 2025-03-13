import axios from 'axios';
import { toast } from 'react-toastify';
import { getToken, clearToken, validateToken, isTokenExpired } from '../utils/tokenUtils';

// Create axios instance with base URL from environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:3003';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS with credentials
});

// Request interceptor to add authorization header
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    
    // Add token to request if available
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle 401 Unauthorized errors
      if (error.response.status === 401) {
        // Only clear token if it's present and we're not on login/register routes
        const token = getToken();
        if (token) {
          console.log('Authentication error. Clearing token...');
          clearToken();
          
          // Don't show toast for login attempts
          const isLoginAttempt = error.config.url.includes('/login') || 
                               error.config.url.includes('/register');
          
          if (!isLoginAttempt) {
            toast.error('Your session has expired. Please log in again.');
            
            // Redirect to login page if needed and not already there
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
        }
      } else if (error.response.status === 403) {
        toast.error('You do not have permission to access this resource.');
      } else if (error.response.status >= 500) {
        toast.error('Server error. Please try again later.');
      }
    } else if (error.request) {
      // Request was made but no response received (network error)
      const errorMessage = 'Unable to connect to the server. Please check your connection.';
      console.error(errorMessage, error);
      
      // Dispatch network error event for NetworkStatusContext to handle
      const networkErrorEvent = new CustomEvent('api_network_error', {
        detail: { message: errorMessage }
      });
      window.dispatchEvent(networkErrorEvent);
      
      toast.error(errorMessage);
    } else {
      // Error in setting up the request
      console.error('API configuration error:', error.message);
      toast.error('Error in application. Please refresh the page.');
    }
    
    return Promise.reject(error);
  }
);

// Generic retry function with exponential backoff
const retryOperation = async (operation, retries = 3, delay = 300) => {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Operation failed, attempt ${attempt + 1}/${retries + 1}`, error);
      lastError = error;
      
      if (attempt < retries) {
        const backoffDelay = delay * Math.pow(2, attempt);
        console.log(`Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  throw lastError;
};

// User storage utilities (backward compatibility)
const userStorage = {
  saveUser: (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
  },
  
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  clearUser: () => {
    localStorage.removeItem('user');
  }
};

// Auth Services
const authService = {
  login: async (credentials) => {
    try {
      const response = await api.post('/api/login', credentials);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Please try again.'
      };
    }
  },
  
  register: async (userData) => {
    try {
      const response = await api.post('/api/register', userData);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed. Please try again.'
      };
    }
  },
  
  logout: async () => {
    try {
      // First try to call logout API if server requires it
      try {
        await api.post('/api/logout');
      } catch (logoutError) {
        console.log('Logout API call failed, clearing local token only', logoutError);
      }
      
      // Always clear token locally regardless of API call result
      clearToken();
      
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      // Clear token even if logout API fails
      clearToken();
      
      return {
        success: true, // Return success anyway since we cleared local token
        message: 'Logged out locally'
      };
    }
  },
  
  checkAuth: async () => {
    // First check token validity locally
    const isValid = validateToken();
    
    if (!isValid) {
      return {
        success: false,
        message: 'Token is invalid or expired'
      };
    }
    
    // Then verify with server
    try {
      const response = await api.get('/api/verify-token');
      return response.data;
    } catch (error) {
      // Token verification failed, clear it
      if (error.response?.status === 401) {
        clearToken();
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Session verification failed'
      };
    }
  }
};

// User Profile Services
const userService = {
  getUserProfile: async (retry = true) => {
    try {
      // Check if user is authenticated
      const token = getToken();
      if (!token) {
        return {
          success: false,
          message: 'Authentication required'
        };
      }
      
      const response = await api.get('/api/user/profile');
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      
      // If 401 error but we have a token, try refreshing and retry once
      if (retry && error.response?.status === 401 && getToken()) {
        try {
          // Try to verify token
          const authCheck = await authService.checkAuth();
          if (authCheck.success) {
            // Retry profile fetch with new token
            return userService.getUserProfile(false);
          }
        } catch (refreshError) {
          console.error('Token refresh failed during profile fetch:', refreshError);
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load user profile'
      };
    }
  },
  
  updateUserProfile: async (profileData) => {
    try {
      const response = await api.put('/api/user/profile', profileData);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update profile'
      };
    }
  }
};

// Legal Updates Services
const legalService = {
  getLegalUpdates: async (retry = true) => {
    try {
      // Check if user is authenticated
      const token = getToken();
      if (!token) {
        return {
          success: false,
          message: 'Authentication required'
        };
      }
      
      const response = await api.get('/api/legal/updates');
      return response.data;
    } catch (error) {
      console.error('Error fetching legal updates:', error);
      
      // If 401 error but we have a token, try refreshing and retry once
      if (retry && error.response?.status === 401 && getToken()) {
        try {
          // Try to verify token
          const authCheck = await authService.checkAuth();
          if (authCheck.success) {
            // Retry updates fetch with new token
            return legalService.getLegalUpdates(false);
          }
        } catch (refreshError) {
          console.error('Token refresh failed during legal updates fetch:', refreshError);
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load legal updates'
      };
    }
  }
};

// Connectivity Service
const connectivityService = {
  testConnection: async () => {
    try {
      const response = await api.get('/api/test-connection', {
        // Shorter timeout for connectivity test
        timeout: 5000,
        // Don't trigger global error interceptors for this request
        skipErrorHandler: true,
        // Don't use auth for connection test
        headers: {
          'X-Test-Request': 'true'
        }
      });
      
      return {
        success: true,
        message: 'Connection successful',
        data: response.data
      };
    } catch (error) {
      console.warn('API connection test failed:', error);
      
      return {
        success: false,
        message: error.response 
          ? `Server responded with error: ${error.response.status}` 
          : 'Server is unreachable',
        error: error.message
      };
    }
  }
};

// Admin services
const adminService = {
  getUsersAdmin: async () => {
    try {
      const response = await api.get('/api/admin/users');
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch users'
      };
    }
  },
  
  getUserByIdAdmin: async (userId) => {
    try {
      const response = await api.get(`/api/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch user'
      };
    }
  },
  
  updateUserAdmin: async (userId, userData) => {
    try {
      const response = await api.put(`/api/admin/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update user'
      };
    }
  },
  
  createUserAdmin: async (userData) => {
    try {
      const response = await api.post('/api/admin/users', userData);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create user'
      };
    }
  },
  
  deleteUserAdmin: async (userId) => {
    try {
      const response = await api.delete(`/api/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete user'
      };
    }
  }
};

// Document services
const documentService = {
  getDocuments: async () => {
    try {
      const response = await api.get('/api/documents');
      return response.data;
    } catch (error) {
      return {
        success: false, 
        message: error.response?.data?.message || 'Failed to fetch documents'
      };
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
      
      const response = await api.post('/api/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to upload document'
      };
    }
  }
};

// Backward compatibility functions
const getUserProfile = userService.getUserProfile;
const updateUserProfile = userService.updateUserProfile;
const getLegalUpdates = legalService.getLegalUpdates;
const getUsers = async () => adminService.getUsersAdmin();
const getUsersAdmin = adminService.getUsersAdmin;
const getUserByIdAdmin = adminService.getUserByIdAdmin;
const updateUserAdmin = adminService.updateUserAdmin;
const createUserAdmin = adminService.createUserAdmin;
const deleteUserAdmin = adminService.deleteUserAdmin;
const retryRequest = retryOperation;
const uploadDocumentWithRetry = documentService.uploadDocument;

// User Jurisdictions and Legal Update Sources (backward compatibility)
const updateUserJurisdictions = (primaryJurisdiction, selectedJurisdictions) => {
  return api.post('/api/users/preferences/jurisdictions', {
    preferred_jurisdiction: primaryJurisdiction,
    preferred_jurisdictions: selectedJurisdictions
  });
};

const updateUserLegalSources = (selectedSources) => {
  return api.post('/api/users/preferences/legal-sources', {
    preferred_legal_sources: selectedSources
  });
};

const getAvailableJurisdictions = () => {
  return api.get('/api/jurisdictions');
};

// Export services
export {
  api,
  authService,
  userService,
  legalService,
  connectivityService,
  adminService,
  documentService,
  userStorage,
  retryOperation,
  retryRequest,
  getUserProfile,
  updateUserProfile,
  getLegalUpdates,
  getUsers,
  getUsersAdmin,
  getUserByIdAdmin,
  updateUserAdmin,
  createUserAdmin,
  deleteUserAdmin,
  updateUserJurisdictions,
  updateUserLegalSources,
  getAvailableJurisdictions,
  uploadDocumentWithRetry
};

// Default export for backward compatibility
export default api;
