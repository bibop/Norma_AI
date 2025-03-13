/**
 * Offline mode utilities
 * Provides mock data and API response simulation for offline usage
 */

// Mock data for various API endpoints
const mockData = {
  // Legal updates by jurisdiction
  legalUpdates: {
    us: [
      {
        id: 'us-1',
        title: 'Supreme Court Rules on Data Privacy Case',
        summary: 'The US Supreme Court has ruled on a landmark data privacy case affecting technology companies.',
        link: '#',
        published: new Date(Date.now() - 86400000).toISOString(),
        source: 'US Courts'
      },
      {
        id: 'us-2',
        title: 'New Antitrust Legislation Passed by Congress',
        summary: 'Congress has passed new antitrust legislation targeting large technology companies.',
        link: '#',
        published: new Date(Date.now() - 172800000).toISOString(),
        source: 'Congress.gov'
      }
    ],
    eu: [
      {
        id: 'eu-1',
        title: 'EU Commission Proposes New AI Regulation Framework',
        summary: 'The European Commission has proposed new regulations for artificial intelligence applications.',
        link: '#',
        published: new Date(Date.now() - 86400000).toISOString(),
        source: 'EU Official Journal'
      },
      {
        id: 'eu-2',
        title: 'Court of Justice Rules on Cross-Border Data Transfers',
        summary: 'The EU Court of Justice has issued a ruling on the legality of cross-border data transfers.',
        link: '#',
        published: new Date(Date.now() - 172800000).toISOString(),
        source: 'EU Court of Justice'
      }
    ],
    uk: [
      {
        id: 'uk-1',
        title: 'UK Introduces New Data Protection Bill',
        summary: 'The UK government has introduced a new data protection bill following Brexit.',
        link: '#',
        published: new Date(Date.now() - 86400000).toISOString(),
        source: 'UK Parliament'
      }
    ],
    italy: [
      {
        id: 'it-1',
        title: 'Italian Data Protection Authority Issues New Guidelines',
        summary: 'The Italian DPA has issued new guidelines for GDPR compliance in the private sector.',
        link: '#',
        published: new Date(Date.now() - 86400000).toISOString(),
        source: 'Garante Privacy'
      }
    ]
  },
  
  // User profile data
  profile: {
    id: 1,
    username: 'demo_user',
    email: 'demo@example.com',
    name: 'Demo User',
    role: 'user',
    created_at: '2024-01-01T00:00:00Z'
  },
  
  // Documents list
  documents: [
    {
      id: 1,
      title: 'Privacy Policy Template',
      file_name: 'privacy_policy.pdf',
      file_type: 'application/pdf',
      size: 245000,
      upload_date: new Date(Date.now() - 604800000).toISOString(),
      tags: ['privacy', 'legal', 'template']
    },
    {
      id: 2,
      title: 'Terms of Service',
      file_name: 'terms.pdf',
      file_type: 'application/pdf',
      size: 189000,
      upload_date: new Date(Date.now() - 1209600000).toISOString(),
      tags: ['terms', 'legal', 'template']
    }
  ],
  
  // Users list for admin
  users: [
    {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      username: 'demo_user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'user',
      created_at: '2024-01-01T00:00:00Z'
    }
  ]
};

// Check if the application should operate in offline mode
export const shouldUseOfflineMode = () => {
  // Check for navigator.onLine (browser api)
  const browserIsOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  
  // Check if we've explicitly enabled offline mode in localStorage
  const offlineModeEnabled = localStorage.getItem('offline_mode_enabled') === 'true';
  
  // Check if we've detected backend unavailability
  const backendUnavailable = localStorage.getItem('backend_unavailable') === 'true';
  
  return browserIsOffline || offlineModeEnabled || backendUnavailable;
};

// Enable offline mode
export const enableOfflineMode = () => {
  localStorage.setItem('offline_mode_enabled', 'true');
  localStorage.setItem('offline_mode_enabled_at', new Date().toISOString());
};

// Disable offline mode
export const disableOfflineMode = () => {
  localStorage.removeItem('offline_mode_enabled');
  localStorage.removeItem('offline_mode_enabled_at');
};

// Mark the backend as unavailable
export const markBackendUnavailable = () => {
  localStorage.setItem('backend_unavailable', 'true');
  localStorage.setItem('backend_unavailable_at', new Date().toISOString());
};

// Mark the backend as available
export const markBackendAvailable = () => {
  localStorage.removeItem('backend_unavailable');
  localStorage.removeItem('backend_unavailable_at');
};

// Get mock data for a specific endpoint
export const getMockData = (endpoint, params = {}) => {
  switch (endpoint) {
    case 'legalUpdates':
      const jurisdiction = params.jurisdiction || 'us';
      return {
        success: true,
        updates: mockData.legalUpdates[jurisdiction] || mockData.legalUpdates.us,
        updateInterval: 30,
        lastUpdated: new Date().toISOString()
      };
      
    case 'profile':
      return {
        success: true,
        user: mockData.profile
      };
      
    case 'documents':
      return {
        success: true,
        documents: mockData.documents
      };
      
    case 'users':
      return {
        success: true,
        users: mockData.users,
        pagination: {
          page: 1,
          per_page: 10,
          total: mockData.users.length,
          total_pages: 1
        }
      };
      
    default:
      return {
        success: true,
        message: 'Offline mode active - no data available for this endpoint'
      };
  }
};

export default {
  shouldUseOfflineMode,
  enableOfflineMode,
  disableOfflineMode,
  markBackendUnavailable,
  markBackendAvailable,
  getMockData
};
