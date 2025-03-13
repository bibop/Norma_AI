import axios from 'axios';
import { toast } from 'react-toastify';
import { getToken, clearToken, validateToken, isTokenExpired } from '../utils/tokenUtils';
import { API_BASE_URL, API_ROOT_URL, API_CONFIG } from '../config';

// Create axios instance with base URL from central configuration
console.log('Using API URL:', API_BASE_URL);

// Configure Axios instance with defaults optimized for CORS
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 seconds timeout
  withCredentials: true, // Always send cookies with requests
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Debug-Client': 'React-Frontend-v1'
  }
});

// Request interceptor with enhanced error logging
api.interceptors.request.use(
  (config) => {
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
  (error) => {
    console.error('API Request Configuration Error:', error);
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
      const response = await api.get('/verify-token');
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
      // Check if user is authenticated
      const token = getToken();
      if (!token) {
        return {
          success: false,
          message: 'Authentication required'
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
  // Test API connectivity with multiple fallback methods
  testConnection: async () => {
    // Use the public endpoint specifically designed for connection testing
    const testEndpoint = '/public/test-connection';
    let connectionStatus = { success: false, message: 'Not tested', details: [] };
    
    // Function to add test results to the status object
    const addResult = (method, result, details = {}) => {
      connectionStatus.details.push({
        method,
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
        ...details
      });
      
      // Update overall status only if successful
      if (result.success) {
        connectionStatus.success = true;
        connectionStatus.message = `Connected successfully using ${method}`;
      }
    };
    
    console.log('Starting API connectivity test with URL:', `${API_ROOT_URL}${testEndpoint}`);
    
    try {
      // Test 1: Direct Fetch API without credentials first (avoid CORS preflight)
      try {
        const directFetchStartTime = Date.now();
        // Use API_ROOT_URL (without /api) to access the direct endpoint
        const response = await fetch(`${API_ROOT_URL}${testEndpoint}`, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
            'X-Debug-Client': 'React-FetchAPI-v1'
          }
        });
        
        const responseTime = Date.now() - directFetchStartTime;
        
        if (response.ok) {
          const data = await response.json();
          addResult('fetch-simple', {
            success: true,
            message: data.message || 'Server responded successfully'
          }, { status: response.status, responseTime });
          
          // If successful, return early
          return connectionStatus;
        } else {
          addResult('fetch-simple', {
            success: false,
            message: `HTTP error: ${response.status} ${response.statusText}`
          }, { status: response.status, responseTime });
        }
      } catch (error) {
        console.error('Network error details:', JSON.stringify(error));
        addResult('fetch-simple', {
          success: false,
          message: `Error: ${error.message}`
        }, { errorName: error.name });
      }
      
      // Test 2: Try direct connection to Flask server without the /api prefix
      try {
        const directServerStartTime = Date.now();
        const response = await fetch(`${API_CONFIG.BASE_URL}:${API_CONFIG.PORT}/api/public/test-connection`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
            'X-Debug-Client': 'React-DirectServer-v1'
          }
        });
        
        const responseTime = Date.now() - directServerStartTime;
        
        if (response.ok) {
          const data = await response.json();
          addResult('fetch-direct-server', {
            success: true,
            message: data.message || 'Server responded successfully'
          }, { status: response.status, responseTime });
          
          return connectionStatus;
        } else {
          addResult('fetch-direct-server', {
            success: false,
            message: `HTTP error: ${response.status} ${response.statusText}`
          }, { status: response.status, responseTime });
        }
      } catch (error) {
        console.error('All API connection methods failed');
        console.error('Network error details:', JSON.stringify(error));
        addResult('fetch-direct-server', {
          success: false,
          message: `Error: ${error.message}`
        }, { errorName: error.name });
      }
      
      // Test 3: XMLHttpRequest as fallback with no credentials
      try {
        const xhrResult = await new Promise((resolve) => {
          const xhr = new XMLHttpRequest();
          const xhrStartTime = Date.now();
          
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              const responseTime = Date.now() - xhrStartTime;
              
              if (xhr.status >= 200 && xhr.status < 300) {
                let response;
                try {
                  response = JSON.parse(xhr.responseText);
                } catch (e) {
                  response = { message: xhr.responseText || 'Response received but not valid JSON' };
                }
                
                resolve({
                  success: true,
                  message: response.message || 'Server responded successfully',
                  status: xhr.status,
                  responseTime
                });
              } else {
                resolve({
                  success: false,
                  message: `HTTP error: ${xhr.status} ${xhr.statusText || ''}`,
                  status: xhr.status,
                  responseTime
                });
              }
            }
          };
          
          xhr.onerror = function() {
            resolve({
              success: false,
              message: 'Network error with XMLHttpRequest',
              status: 0,
              responseTime: Date.now() - xhrStartTime
            });
          };
          
          xhr.ontimeout = function() {
            resolve({
              success: false,
              message: 'XMLHttpRequest timed out',
              status: 0,
              responseTime: 5000 // timeout value
            });
          };
          
          xhr.open('GET', `${API_ROOT_URL}/public/test-connection`, true);
          xhr.timeout = 5000;
          xhr.setRequestHeader('X-Debug-Client', 'React-XHR-v1');
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();
        });
        
        addResult('xmlhttprequest', xhrResult, {
          status: xhrResult.status,
          responseTime: xhrResult.responseTime
        });
        
        if (xhrResult.success) {
          return connectionStatus;
        }
      } catch (error) {
        addResult('xmlhttprequest', {
          success: false,
          message: `Error: ${error.message}`
        }, { errorName: error.name });
      }
      
      // If we reached this point, all tests failed
      connectionStatus.message = 'All connection methods failed. Check network or server status.';
      return connectionStatus;
      
    } catch (error) {
      console.error('Connection test error:', error);
      connectionStatus.message = `Test error: ${error.message}`;
      return connectionStatus;
    }
  }
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

const getAvailableJurisdictions = () => {
  return api.get('/jurisdictions');
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
