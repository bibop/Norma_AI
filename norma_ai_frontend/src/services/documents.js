import api, { uploadDocumentWithRetry } from './api';
import { tokenStorage } from '../utils/tokenUtils';

/**
 * Upload a document for compliance analysis
 * @param {File} file - The file to upload
 * @param {string} jurisdiction - Optional jurisdiction code for compliance analysis
 * @param {Object} metadata - Additional metadata to include with the upload
 * @returns {Promise<Object>} Response with document data
 */
export const uploadDocument = async (file, jurisdiction, metadata = {}) => {
  try {
    // Add jurisdiction to metadata
    const uploadMetadata = {
      ...metadata,
      jurisdiction
    };
    
    // Use the retry-capable upload function with correct path
    const response = await uploadDocumentWithRetry(file, 'document', uploadMetadata);
    
    return {
      success: true,
      message: 'Document uploaded successfully',
      document: response.document
    };
  } catch (error) {
    console.error('Upload document error:', error);
    
    if (error.isNetworkError) {
      return {
        success: false,
        message: 'SERVER IS UNREACHABLE. Please check the connection',
        isNetworkError: true
      };
    }
    
    return {
      success: false,
      message: error.message || 'Failed to upload document'
    };
  }
};

/**
 * Get all documents for the current user
 * @returns {Promise<Object>} Response with documents array
 */
export const getUserDocuments = async () => {
  try {
    console.log('Fetching documents...');
    // Ensure we're using the correct endpoint without duplicate /api prefix
    const response = await api.get('/api/documents');
    console.log('Documents response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching documents:', error);
    
    // Check for network errors
    if (error.isNetworkError || !error.response) {
      return {
        success: false,
        message: 'Network error: Cannot connect to server',
        isNetworkError: true,
        documents: []
      };
    }
    
    // Handle authentication errors
    if (error.response && (error.response.status === 401 || error.response.status === 422)) {
      return {
        success: false,
        message: 'Authentication error: Please log in again',
        isAuthError: true,
        documents: []
      };
    }
    
    // Default error handling
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to load documents',
      documents: []
    };
  }
};

/**
 * Get details of a specific document
 * @param {number} documentId - The ID of the document to get details for
 * @returns {Promise<Object>} Response with document details
 */
export const getDocumentDetails = async (documentId) => {
  try {
    const response = await api.get(`/api/document/${documentId}/compliance`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching document ${documentId} details:`, error);
    return {
      success: false,
      message: `Error fetching document details: ${error.message}`,
      details: {}
    };
  }
};

/**
 * Delete a document
 * @param {number} documentId - The ID of the document to delete
 * @returns {Promise<Object>} Response with success status
 */
export const deleteDocument = async (documentId) => {
  try {
    const response = await api.delete(`/api/document/${documentId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting document ${documentId}:`, error);
    return {
      success: false,
      message: `Error deleting document: ${error.message}`
    };
  }
};

/**
 * Re-analyze a document for compliance
 * @param {number} documentId - The ID of the document to re-analyze
 * @param {string} jurisdiction - The jurisdiction to analyze against
 * @returns {Promise<Object>} Response with updated document data
 */
export const reanalyzeDocument = async (documentId, jurisdiction) => {
  try {
    const payload = jurisdiction ? { jurisdiction } : {};
    const response = await api.post(`/api/document/${documentId}/analyze`, payload);
    return response.data;
  } catch (error) {
    console.error(`Error reanalyzing document ${documentId}:`, error);
    return {
      success: false,
      message: `Error reanalyzing document: ${error.message}`
    };
  }
};

/**
 * Get available jurisdictions for compliance analysis
 * @returns {Promise<Object>} Response with jurisdictions array
 */
export const getAvailableJurisdictions = async () => {
  try {
    return await api.get('/api/jurisdictions');
  } catch (error) {
    console.error('Error fetching jurisdictions:', error);
    return {
      success: false,
      message: error?.message || 'Failed to fetch jurisdictions'
    };
  }
};

/**
 * Update user's preferred jurisdiction
 * @param {string} jurisdiction - The jurisdiction code to set as preferred
 * @returns {Promise<Object>} Response indicating success or failure
 */
export const updateUserJurisdiction = async (jurisdiction) => {
  try {
    return await api.put('user/jurisdiction', { jurisdiction });
  } catch (error) {
    console.error('Error updating user jurisdiction:', error);
    return {
      success: false,
      message: error?.message || 'Failed to update jurisdiction'
    };
  }
};
