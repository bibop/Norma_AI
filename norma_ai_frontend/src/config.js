/**
 * Central configuration file for the Norma AI application
 * All environment-specific settings should be defined here
 */

// API configuration
const API_CONFIG = {
  // Direct IP is used to avoid IPv6 resolution issues on macOS
  BASE_URL: 'http://127.0.0.1',
  PORT: 3002,
  API_PATH: '/api',
  TIMEOUT: 15000,
};

// Derived configurations
const API_BASE_URL = `${API_CONFIG.BASE_URL}:${API_CONFIG.PORT}${API_CONFIG.API_PATH}`;
const API_ROOT_URL = `${API_CONFIG.BASE_URL}:${API_CONFIG.PORT}`;

// Export configurations
export {
  API_CONFIG,
  API_BASE_URL,
  API_ROOT_URL,
};

// For backward compatibility
export default {
  API_BASE_URL,
  API_ROOT_URL,
  API_CONFIG,
};
