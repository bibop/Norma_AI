// Simple Node.js script to test API connection directly
const https = require('https');
const http = require('http');

// Configuration
const API_URL = 'http://127.0.0.1:3001';
const ENDPOINTS = [
  '/api/test-connection',
  '/api/basic-login'
];

// Options for POST request
const LOGIN_DATA = JSON.stringify({
  email: 'test@example.com',
  password: 'password123'
});

// Function to make HTTP request
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    // Parse URL to determine if http or https should be used
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    
    const req = lib.request(options, (res) => {
      console.log(`${method} ${url} - Status: ${res.statusCode}`);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (e) {
          console.log('Raw response:', responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: { raw: responseData }
          });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error with request to ${url}:`, error.message);
      reject(error);
    });
    
    // Add timeout
    req.setTimeout(5000, () => {
      req.abort();
      reject(new Error(`Request to ${url} timed out`));
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Run tests
async function runTests() {
  console.log('=== API CONNECTION TEST ===');
  console.log(`Testing API at: ${API_URL}`);
  console.log('========================\n');
  
  // Test GET endpoints
  for (const endpoint of ENDPOINTS) {
    if (endpoint === '/api/basic-login') continue; // Skip GET for login endpoint
    
    try {
      console.log(`Testing GET ${API_URL}${endpoint}...`);
      const response = await makeRequest(`${API_URL}${endpoint}`);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      console.log('------------------------\n');
    } catch (error) {
      console.error('Test failed:', error.message);
      console.log('------------------------\n');
    }
  }
  
  // Test POST to login endpoint
  try {
    console.log(`Testing POST ${API_URL}/api/basic-login...`);
    const response = await makeRequest(`${API_URL}/api/basic-login`, 'POST', LOGIN_DATA);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('------------------------\n');
  } catch (error) {
    console.error('Test failed:', error.message);
    console.log('------------------------\n');
  }
  
  console.log('=== TEST COMPLETE ===');
}

// Execute tests
runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
