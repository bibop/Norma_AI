import api from './api';

export const register = async (userData) => {
  try {
    return await api.post('/register', userData);
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const login = async (email, password) => {
  try {
    return await api.post('/login', { email, password });
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = () => {
  // JWT is stateless, so we just need to remove the token from local storage
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const checkAuthStatus = () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  // In a real application, you might want to validate the token
  // with the server or check if it's expired
  return true;
};
