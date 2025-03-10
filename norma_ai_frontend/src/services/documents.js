import api from './api';

export const uploadDocument = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    return await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    throw error;
  }
};

export const getUserDocuments = async () => {
  try {
    return await api.get('/documents');
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};

export const getDocumentDetails = async (documentId) => {
  try {
    return await api.get(`/document/${documentId}/compliance`);
  } catch (error) {
    console.error(`Error fetching document ${documentId} details:`, error);
    throw error;
  }
};

export const deleteDocument = async (documentId) => {
  try {
    return await api.delete(`/document/${documentId}`);
  } catch (error) {
    console.error(`Error deleting document ${documentId}:`, error);
    throw error;
  }
};

export const reanalyzeDocument = async (documentId) => {
  try {
    return await api.post(`/document/${documentId}/analyze`);
  } catch (error) {
    console.error(`Error reanalyzing document ${documentId}:`, error);
    throw error;
  }
};
