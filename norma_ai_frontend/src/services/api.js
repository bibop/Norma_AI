import axios from 'axios';
import { tokenStorage } from '../utils/tokenUtils';
import cookieStorage from '../utils/cookieStorage';

// API server URL - configurable based on environment variables
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create an axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL
});

// Shared user data storage with memory fallback
export const userStorage = {
  inMemoryUser: null,
  setUser: (userData) => {
    // Always set in memory first
    userStorage.inMemoryUser = userData;
    try {
      cookieStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.warn('Error storing user data in cookies, using memory fallback');
    }
  },
  getUser: () => {
    try {
      const userData = cookieStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          userStorage.inMemoryUser = parsedUser; // Update memory cache
          return parsedUser;
        } catch (e) {
          console.warn('Error parsing user data from cookies');
        }
      }
      return userStorage.inMemoryUser;
    } catch (error) {
      console.warn('Error accessing user data from cookies, using memory fallback');
      return userStorage.inMemoryUser;
    }
  },
  removeUser: () => {
    userStorage.inMemoryUser = null;
    try {
      cookieStorage.removeItem('user');
    } catch (error) {
      console.warn('Error removing user data from cookies');
    }
  }
};

// Add a request interceptor to inject the JWT token
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    // Handle missing response.data
    if (!response.data) {
      console.warn('Empty response data received from server');
      return { success: false, message: 'No data received from server' };
    }
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    
    // Handle unauthorized errors (token expired or invalid)
    if (error.response && error.response.status === 401) {
      tokenStorage.removeToken();
      userStorage.removeUser();
      
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    // Return a formatted error object
    return Promise.reject(error.response?.data || { 
      success: false, 
      message: error.message || 'An error occurred'
    });
  }
);

// API Endpoints
export const getUsers = async () => {
  try {
    return await api.get('/users');
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, message: error.message || 'Error fetching users' };
  }
};

export const getLegalUpdates = async () => {
  // In a real app, you would create an endpoint to fetch RSS updates
  // For now, we'll simulate this with mock data
  return {
    success: true,
    message: "Legal updates fetched successfully",
    updates: [
      {
        title: "Nuova normativa sulla privacy per le aziende",
        link: "https://www.gazzettaufficiale.it/example-1",
        published: "2023-10-15T09:30:00Z",
        summary: "Nuove disposizioni per la protezione dei dati personali nel contesto aziendale."
      },
      {
        title: "Modifiche al Codice Civile Italiano",
        link: "https://www.gazzettaufficiale.it/example-2",
        published: "2023-10-10T14:45:00Z",
        summary: "Aggiornamenti agli articoli relativi ai contratti commerciali."
      },
      {
        title: "Decreto Legislativo sulla sicurezza sul lavoro",
        link: "https://www.gazzettaufficiale.it/example-3",
        published: "2023-10-05T11:20:00Z",
        summary: "Nuove misure per garantire la sicurezza nei luoghi di lavoro."
      },
      {
        title: "Regolamento per la protezione dei consumatori",
        link: "https://www.gazzettaufficiale.it/example-4",
        published: "2023-09-28T16:15:00Z",
        summary: "Disposizioni per tutelare i diritti dei consumatori nelle transazioni online."
      },
      {
        title: "Legge anti-riciclaggio: aggiornamenti",
        link: "https://www.gazzettaufficiale.it/example-5",
        published: "2023-09-22T10:00:00Z",
        summary: "Modifiche alla normativa per prevenire il riciclaggio di denaro."
      }
    ]
  };
};

// Admin services
export const getUsersAdmin = async (page = 1, perPage = 10) => {
  try {
    return await api.get(`/admin/users?page=${page}&per_page=${perPage}`);
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, message: error.message || 'Error fetching users' };
  }
};

export const getUserByIdAdmin = async (userId) => {
  try {
    return await api.get(`/admin/users/${userId}`);
  } catch (error) {
    console.error('Error fetching user details:', error);
    return { success: false, message: error.message || 'Error fetching user details' };
  }
};

export const createUserAdmin = async (userData) => {
  try {
    return await api.post('/admin/users', userData);
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, message: error.message || 'Error creating user' };
  }
};

export const updateUserAdmin = async (userId, userData) => {
  try {
    return await api.put(`/admin/users/${userId}`, userData);
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, message: error.message || 'Error updating user' };
  }
};

export const deleteUserAdmin = async (userId) => {
  try {
    return await api.delete(`/admin/users/${userId}`);
  } catch (error) {
    console.error('Error deleting user:', error);
    return { success: false, message: error.message || 'Error deleting user' };
  }
};

// Profile services
export const getUserProfile = async () => {
  try {
    return await api.get('/profile');
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { success: false, message: error.message || 'Error fetching profile' };
  }
};

export const updateUserProfile = async (profileData) => {
  try {
    return await api.put('/profile', profileData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, message: error.message || 'Error updating profile' };
  }
};

export default api;
