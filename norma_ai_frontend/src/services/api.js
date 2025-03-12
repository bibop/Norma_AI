import axios from 'axios';
import { getToken } from '../utils/tokenUtils';

// Create an axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:5001/api'
});

// Add a request interceptor to inject the JWT token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
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
    return response.data;
  },
  (error) => {
    // Handle unauthorized errors (token expired or invalid)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(
      error.response ? error.response.data : { message: error.message }
    );
  }
);

// API Endpoints
export const getUsers = async () => {
  try {
    return await api.get('/users');
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
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
    const response = await api.get(`/admin/users?page=${page}&per_page=${perPage}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getUserByIdAdmin = async (userId) => {
  try {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
};

export const createUserAdmin = async (userData) => {
  try {
    const response = await api.post('/admin/users', userData);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUserAdmin = async (userId, userData) => {
  try {
    const response = await api.put(`/admin/users/${userId}`, userData);
    return response.data;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUserAdmin = async (userId) => {
  try {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export default api;
