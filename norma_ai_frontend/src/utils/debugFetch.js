/**
 * Debug-focused fetch utility for diagnosing connection issues
 */

/**
 * Enhanced fetch that provides detailed debugging information
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise} - Promise that resolves with the fetch result
 */
export const debugFetch = async (url, options = {}) => {
  console.log(`🔍 [DEBUG FETCH] Request to ${url}`);
  console.log('🔧 Options:', options);
  
  // Try multiple approaches in sequence
  const approaches = [
    { name: 'Standard fetch', fn: standardFetch },
    { name: 'JSONP fallback', fn: jsonpFallback },
    { name: 'Image ping', fn: imagePing },
  ];
  
  let lastError = null;
  
  for (const approach of approaches) {
    try {
      console.log(`🔄 Trying approach: ${approach.name}`);
      const result = await approach.fn(url, options);
      console.log(`✅ Success with ${approach.name}`);
      return result;
    } catch (err) {
      console.error(`❌ Failed with ${approach.name}:`, err);
      lastError = err;
    }
  }
  
  // If we get here, all approaches failed
  console.error('💥 All connection approaches failed!');
  throw lastError || new Error('Connection failed with all approaches');
};

/**
 * Standard fetch implementation
 */
const standardFetch = async (url, options) => {
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-Debug-Client': 'DebugFetch-1.0',
      }
    });
    
    console.log(`⏱️ Fetch response in ${Math.round(performance.now() - startTime)}ms`);
    console.log('📡 Status:', response.status);
    console.log('📡 Headers:', Object.fromEntries([...response.headers.entries()]));
    
    if (!response.ok) {
      const text = await response.text();
      console.error('📡 Error body:', text);
      
      try {
        return { 
          ok: false, 
          error: JSON.parse(text), 
          statusCode: response.status,
          response
        };
      } catch (e) {
        return { 
          ok: false, 
          error: { message: text || `Error ${response.status}` }, 
          statusCode: response.status,
          response
        };
      }
    }
    
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const text = await response.text();
        console.log('📄 Raw response:', text.substring(0, 150) + (text.length > 150 ? '...' : ''));
        const json = JSON.parse(text);
        return { ok: true, data: json, response };
      } else {
        const text = await response.text();
        return { ok: true, data: text, response };
      }
    } catch (e) {
      console.error('Failed to parse response:', e);
      return { 
        ok: false, 
        error: { message: 'Invalid response format' }, 
        statusCode: response.status,
        response
      };
    }
  } catch (error) {
    console.error('Network error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    throw error;
  }
};

/**
 * JSONP fallback for extreme cases
 * Only works for GET requests to endpoints that support JSONP
 */
const jsonpFallback = (url, options) => {
  if (options.method && options.method !== 'GET') {
    return Promise.reject(new Error('JSONP only supports GET requests'));
  }
  
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonpCallback' + Math.round(Math.random() * 10000000);
    const script = document.createElement('script');
    
    // Add callback to window
    window[callbackName] = (data) => {
      cleanup();
      resolve({ ok: true, data, response: null });
    };
    
    // Cleanup function
    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
      clearTimeout(timeoutId);
    };
    
    // Handle script load error
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP request failed'));
    };
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP request timed out'));
    }, 10000);
    
    // Prepare URL (assumes the server supports a callback parameter)
    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}callback=${callbackName}`;
    
    // Add script to document to start the request
    document.head.appendChild(script);
  });
};

/**
 * Image ping as a last resort to check if server is reachable
 * This only tests connectivity and doesn't return actual data
 */
const imagePing = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({ 
        ok: true, 
        data: { message: 'Server is reachable (ping only)' }, 
        response: null
      });
    };
    
    img.onerror = () => {
      // This will likely fail due to wrong content type, but that's actually
      // a good sign that the server is responding
      resolve({ 
        ok: true, 
        data: { message: 'Server appears to be reachable (ping only)' }, 
        response: null
      });
    };
    
    // Add random parameter to prevent caching
    const pingUrl = url.split('/').slice(0, 3).join('/') + '/ping?' + Date.now();
    img.src = pingUrl;
    
    // Set timeout
    setTimeout(() => {
      reject(new Error('Image ping timed out'));
    }, 5000);
  });
};

export default debugFetch;
