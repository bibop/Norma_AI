import axios from 'axios';
import { API_BASE_URL, API_CONFIG, API_ROOT_URL } from '../config';
import { getToken, setToken, removeToken, isTokenExpired, tokenStorage } from '../utils/tokenStorage';

// IMPORTANT: Create a new API instance with correct configuration
// This ensures our endpoint fixes are properly applied
console.log('Using API Root URL:', API_ROOT_URL);

// Initialize Axios instance with default configuration
const api = axios.create({
  baseURL: API_ROOT_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  // Don't automatically send credentials for all requests
  withCredentials: false
});

// Add request interceptor that logs requests
api.interceptors.request.use(
  config => {
    // Force IPv4 for all requests to avoid IPv6 resolution issues on macOS
    if (config.url && (config.url.includes('localhost') || config.baseURL?.includes('localhost'))) {
      config.url = config.url.replace('localhost', '127.0.0.1');
      if (config.baseURL) {
        config.baseURL = config.baseURL.replace('localhost', '127.0.0.1');
      }
    }
    
    // Add credentials only for authenticated endpoints
    config.withCredentials = !config.url.includes('/public/');
    
    // Add auth token to requests if available
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log(`API Request [${config.method}] ${config.url}`, config);
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  async error => {
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
            // Redirect to login page if needed and not already there
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
        }
      } 
      // Handle 422 Unprocessable Entity errors (often JWT validation issues)
      else if (error.response.status === 422) {
        console.error('422 Validation Error:', error.response.data);
        
        // Always consider 422 errors on authenticated endpoints as token issues
        // This helps with the PostgreSQL/Flask backend JWT validation
        const isPublicEndpoint = error.config.url.includes('/public/') || 
                               error.config.url.includes('/auth/login') ||
                               error.config.url.includes('/register');
        
        if (!isPublicEndpoint) {
          console.log('Likely JWT validation error. Clearing token and attempting relogin...');
          removeToken();
          
          // Force redirect to login page
          if (window.location.pathname !== '/login') {
            console.log('Redirecting to login due to invalid token');
            window.location.href = '/login';
          }
        }
      } 
      else if (error.response.status === 403) {
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
const testConnection = async (apiUrl = API_ROOT_URL) => {
  console.log('[Connection Test] Testing API connection to:', apiUrl);
  
  // Use a direct IP address to avoid IPv6 resolution issues
  const directUrl = apiUrl.replace('localhost', '127.0.0.1');
  
  // Create a clean endpoint path - ensure we're not duplicating the /api prefix
  const endpoint = '/api/public/test-connection';
  const fullUrl = `${directUrl}${endpoint}`;
  
  console.log('[Connection Test] Testing full URL:', fullUrl);
  
  // Add timestamp to prevent caching
  const params = { t: new Date().getTime() };
  
  // Add special header to identify test requests
  const headers = {
    'Accept': 'application/json',
    'X-Test-Connection': 'true'
  };
  
  // Test using multiple methods to ensure robustness
  try {
    // Method 1: Try using fetch (browser native) with no credentials
    let result;
    try {
      console.log('[Connection Test] Trying fetch method with URL:', fullUrl);
      const fetchResponse = await fetch(fullUrl + '?' + new URLSearchParams(params), {
        method: 'GET',
        credentials: 'omit', // Don't send cookies for connection test
        headers: headers,
        mode: 'cors' // Explicitly set CORS mode
      });
      
      if (!fetchResponse.ok) {
        throw new Error(`HTTP error! Status: ${fetchResponse.status}`);
      }
      
      result = await fetchResponse.json();
      console.log('[Connection Test] Fetch method succeeded:', result);
      return { success: true, method: 'fetch', data: result };
    } catch (fetchError) {
      console.error('[Connection Test] Fetch method failed:', fetchError);
      
      // Method 2: Try using axios (with credentials)
      try {
        const axiosResponse = await axios.get(fullUrl, {
          params,
          headers,
          withCredentials: false, // Don't send cookies for connection test
          allowAbsoluteUrls: true // This is important for some configurations
        });
        
        result = axiosResponse.data;
        console.log('[Connection Test] Axios method succeeded:', result);
        return { success: true, method: 'axios', data: result };
      } catch (axiosError) {
        console.error('[Connection Test] Axios method failed:', axiosError);
        
        // Method 3: Last resort - try a more basic approach
        try {
          // Create a new XMLHttpRequest as fallback
          const promise = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', fullUrl + '?' + new URLSearchParams(params));
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('X-Test-Connection', 'true');
            xhr.withCredentials = false; // Don't send cookies for connection test
            
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                reject(new Error(`XHR error, status: ${xhr.status}`));
              }
            };
            
            xhr.onerror = () => reject(new Error('XHR network error'));
            xhr.send();
          });
          
          result = await promise;
          console.log('[Connection Test] Fallback method succeeded:', result);
          return { success: true, method: 'fallback', data: result };
        } catch (fallbackError) {
          console.error('[Connection Test] Fallback method failed:', fallbackError);
          throw new Error('All connection methods failed');
        }
      }
    }
  } catch (error) {
    const failures = [
      { method: 'fetch', error: 'Failed to fetch' },
      { method: 'axios', error: 'Network Error' },
      { method: 'fallback', error: 'Network Error' }
    ];
    
    console.error('[ERROR] [Connection Test] All methods failed:', failures);
    console.error('[ERROR] [Connection Test] All connection methods failed:', error);
    
    throw error;
  }
}

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
      
      const response = await api.get('/api/profile');
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
      const response = await api.put('/api/profile', profileData);
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
      
      const response = await api.get('/api/public/legal-updates');
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
      const response = await api.get('/admin/users');
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
      const response = await api.get('/documents');
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: `Error fetching documents: ${error.message}`,
        documents: []
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
      console.error('Document upload error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to upload document',
        document: null
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

const getAvailableJurisdictions = async () => {
  // There's a path mismatch - the backend expects /api/public/jurisdictions
  // Use API_ROOT_URL instead of API_BASE_URL to avoid duplicate /api prefix
  const endpoint = '/api/public/jurisdictions';
  const url = `${API_ROOT_URL}${endpoint}`;
  
  // Use axios directly to have more control over the request
  return axios.get(url, { 
    params: { t: new Date().getTime() }, // Add timestamp to prevent caching
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  .then(response => {
    console.log('Jurisdictions response:', response.data);
    return response.data.jurisdictions || [];
  })
  .catch(error => {
    console.error('Error fetching available jurisdictions:', error);
    return [];
  });
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

const MOCK_LEGAL_UPDATES = []; // Empty array as fallback
