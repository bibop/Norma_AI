import axios from 'axios';
import { API_BASE_URL, API_CONFIG, API_ROOT_URL } from '../config';
import { getToken, setToken, removeToken, isTokenExpired, tokenStorage } from '../utils/tokenStorage';

// IMPORTANT: Create a new API instance with correct configuration
// This ensures our endpoint fixes are properly applied
console.log('Using API URL:', API_BASE_URL);

// Initialize Axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true, // Enable cookies and auth headers
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
});

// Log all API requests for debugging
api.interceptors.request.use(
  config => {
    const token = getToken();
    
    // Add token to request if available
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Log outgoing requests when in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request: ${config.method?.toUpperCase() || 'UNKNOWN'} ${config.url}`, {
        headers: config.headers,
        withCredentials: config.withCredentials,
        baseURL: config.baseURL
      });
    }
    
    return config;
  },
  error => {
    console.error('API Request Configuration Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Handle 401 Unauthorized errors
      if (error.response.status === 401) {
        // Only clear token if it's present and we're not on login/register routes
        const token = getToken();
        if (token) {
          console.log('Authentication error. Clearing token...');
          removeToken();
          
          // Don't show toast for login attempts
          const isLoginAttempt = error.config.url.includes('/login') || 
                               error.config.url.includes('/register');
          
          if (!isLoginAttempt) {
            // toast.error('Your session has expired. Please log in again.');
            
            // Redirect to login page if needed and not already there
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
        }
      } else if (error.response.status === 403) {
        // toast.error('You do not have permission to access this resource.');
      } else if (error.response.status >= 500) {
        // toast.error('Server error. Please try again later.');
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
      
      // toast.error(errorMessage);
    } else {
      // Error in setting up the request
      console.error('API configuration error:', error.message);
      // toast.error('Error in application. Please refresh the page.');
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
      
      // Enhanced error logging with CORS detection
      if (error.message?.includes('Network Error') || 
          error.name === 'TypeError' || 
          error.code === 'ECONNABORTED') {
        console.error('Network connectivity issue detected:', {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack?.split('\n').slice(0, 3).join('\n') // Only log first 3 lines of stack trace
        });
      }
      
      // Specific detection for CORS errors
      if (error.message?.includes('has been blocked by CORS policy') ||
          error.message?.includes('Cross-Origin Request Blocked') ||
          error.message?.includes('CORS error') ||
          error.message?.includes('Origin is not allowed by Access-Control-Allow-Origin')) {
        console.error('CORS policy violation detected:', {
          message: error.message,
          url: error.config?.url || 'Unknown URL',
          method: error.config?.method || 'Unknown method',
          headers: error.config?.headers || 'No headers info',
          origin: window.location.origin,
          timestamp: new Date().toISOString()
        });
        
        // Dispatch CORS error event for NetworkStatusContext
        const corsErrorEvent = new CustomEvent('api_cors_error', {
          detail: { 
            message: 'API request blocked by CORS policy',
            url: error.config?.url || 'Unknown URL'
          }
        });
        window.dispatchEvent(corsErrorEvent);
        
        // Don't retry on CORS errors as they're likely to be consistent
        if (attempt < retries) {
          console.log('CORS error detected, attempting with different configuration...');
          // Don't apply exponential backoff for CORS errors - try immediately with modified config
        } else {
          break; // Stop retrying on CORS errors after all attempts
        }
      } else if (attempt < retries) {
        // Apply exponential backoff for non-CORS errors
        const backoffDelay = delay * Math.pow(2, attempt);
        console.log(`Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  throw lastError;
};

// Test connection using multiple methods to diagnose connectivity issues
const testConnection = async (baseUrl = API_BASE_URL) => {
  console.log('Starting API connectivity test with URL:', baseUrl);
  
  // Use the public endpoint specifically designed for connection testing
  const testEndpoints = [
    '/public/test-connection',
    '/public/jurisdictions', 
    '/public/legal-updates'
  ];
  let connectionStatus = { success: false, message: 'Not tested', details: [] };
  
  // Try each endpoint with different methods
  for (const endpoint of testEndpoints) {
    try {
      // Test with Fetch API first
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Test-Connection': 'true'
        }
      });
      
      if (response.ok) {
        connectionStatus.success = true;
        connectionStatus.message = `Connected successfully using fetch-${endpoint}`;
        connectionStatus.details.push({
          method: 'fetch',
          endpoint,
          status: response.status,
          ok: response.ok
        });
        return connectionStatus;
      }
      
      connectionStatus.details.push({
        method: 'fetch',
        endpoint,
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
    } catch (error) {
      connectionStatus.details.push({
        method: 'fetch',
        endpoint,
        error: error.message
      });
    }
    
    // If fetch failed, try with XMLHttpRequest
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${baseUrl}${endpoint}`, false); // Synchronous for simplicity
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('X-Test-Connection', 'true');
      xhr.withCredentials = true;
      xhr.send(null);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        connectionStatus.success = true;
        connectionStatus.message = `Connected successfully using xhr-${endpoint}`;
        connectionStatus.details.push({
          method: 'xhr',
          endpoint,
          status: xhr.status,
          statusText: xhr.statusText
        });
        return connectionStatus;
      }
      
      connectionStatus.details.push({
        method: 'xhr',
        endpoint,
        status: xhr.status,
        statusText: xhr.statusText
      });
    } catch (error) {
      connectionStatus.details.push({
        method: 'xhr',
        endpoint,
        error: error.message
      });
    }
    
    // If both failed, try jQuery as a last resort
    if (window.jQuery) {
      try {
        const response = await $.ajax({
          url: `${baseUrl}${endpoint}`,
          type: 'GET',
          dataType: 'json',
          xhrFields: {
            withCredentials: true
          },
          headers: {
            'Accept': 'application/json',
            'X-Test-Connection': 'true'
          }
        });
        
        connectionStatus.success = true;
        connectionStatus.message = `Connected successfully using jquery-${endpoint}`;
        connectionStatus.details.push({
          method: 'jquery',
          endpoint,
          status: 200,
          data: response
        });
        return connectionStatus;
      } catch (error) {
        connectionStatus.details.push({
          method: 'jquery',
          endpoint,
          error: error.message
        });
      }
    }
  }
  
  return connectionStatus;
};

// Auth Services
const authService = {
  login: async (credentials) => {
    try {
      const response = await api.post('/login', credentials);
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
      const response = await api.post('/register', userData);
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
        await api.post('/logout');
      } catch (logoutError) {
        console.log('Logout API call failed, clearing local token only', logoutError);
      }
      
      // Always clear token locally regardless of API call result
      removeToken();
      
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      // Clear token even if logout API fails
      removeToken();
      
      return {
        success: true, // Return success anyway since we cleared local token
        message: 'Logged out locally'
      };
    }
  },
  
  checkAuth: async () => {
    // First check token validity locally
    const isValid = !isTokenExpired();
    
    if (!isValid) {
      return {
        success: false,
        message: 'Token is invalid or expired'
      };
    }
    
    // Then verify with server
    try {
      const response = await api.get('/verify-token');
      return response.data;
    } catch (error) {
      // Token verification failed, clear it
      if (error.response?.status === 401) {
        removeToken();
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
      
      const response = await api.get('/profile');
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
      // Use public endpoint for testing, will allow updates without token validation
      const response = await api.put('/public/user/profile', profileData);
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
      // For testing without authentication
      if (process.env.REACT_APP_USE_MOCK_API === 'true') {
        return {
          success: true,
          updates: MOCK_LEGAL_UPDATES
        };
      }
      
      const response = await api.get('/legal-updates');
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
  testConnection
};

// Admin services
const adminService = {
  getUsersAdmin: async () => {
    try {
      // Use public endpoint for testing, will allow fetching without token validation
      const response = await api.get('/public/users');
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
      const response = await api.get(`/admin/users/${userId}`);
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
      const response = await api.put(`/admin/users/${userId}`, userData);
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
      const response = await api.post('/admin/users', userData);
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
      const response = await api.delete(`/admin/users/${userId}`);
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
      // Use public endpoint for testing, will allow fetching without token validation
      const response = await api.get('/public/documents');
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
      
      const response = await api.post('/documents/upload', formData, {
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
  return api.post('/users/preferences/jurisdictions', {
    preferred_jurisdiction: primaryJurisdiction,
    preferred_jurisdictions: selectedJurisdictions
  });
};

const updateUserLegalSources = (selectedSources) => {
  return api.post('/users/preferences/legal-sources', {
    preferred_legal_sources: selectedSources
  });
};

const getAvailableJurisdictions = async () => {
  try {
    const response = await api.get('/public/jurisdictions');
    return response.data;
  } catch (error) {
    console.error('Error fetching jurisdictions:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch jurisdictions',
      jurisdictions: []
    };
  }
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
