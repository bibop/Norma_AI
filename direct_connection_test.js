// Direct connection test to help diagnose API connectivity issues
// Using Node.js fetch API to test backend connectivity

// Configuration
const TEST_URL = 'http://localhost:3001/api/test-connection';
const LOGIN_URL = 'http://localhost:3001/api/basic-login';
const AUTH_URL = 'http://localhost:3001/api/auth/login';

const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'test123'
};

// Helper function to nicely format the response
function formatResponse(response, body) {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: body
  };
}

// Test connection to api/test-connection
async function testConnection() {
  console.log('\n🔍 Testing connection to:', TEST_URL);
  
  try {
    const response = await fetch(TEST_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DirectConnectionTest/1.0'
      }
    });
    
    const text = await response.text();
    let body;
    
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = text;
    }
    
    console.log('✅ Connection test response:', formatResponse(response, body));
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

// Test basic login endpoint
async function testBasicLogin() {
  console.log('\n🔑 Testing basic login to:', LOGIN_URL);
  
  try {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DirectConnectionTest/1.0'
      },
      body: JSON.stringify(TEST_CREDENTIALS)
    });
    
    const text = await response.text();
    let body;
    
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = text;
    }
    
    console.log('✅ Basic login response:', formatResponse(response, body));
    return true;
  } catch (error) {
    console.error('❌ Basic login test failed:', error.message);
    return false;
  }
}

// Test auth login endpoint
async function testAuthLogin() {
  console.log('\n🔐 Testing auth login to:', AUTH_URL);
  
  try {
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DirectConnectionTest/1.0'
      },
      body: JSON.stringify(TEST_CREDENTIALS)
    });
    
    const text = await response.text();
    let body;
    
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = text;
    }
    
    console.log('✅ Auth login response:', formatResponse(response, body));
    return true;
  } catch (error) {
    console.error('❌ Auth login test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting direct connection tests...');
  console.log('⚙️ Node.js version:', process.version);
  
  const connectionSuccess = await testConnection();
  const basicLoginSuccess = await testBasicLogin();
  const authLoginSuccess = await testAuthLogin();
  
  console.log('\n📊 Test Summary:');
  console.log(`- Connection test: ${connectionSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`- Basic login test: ${basicLoginSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`- Auth login test: ${authLoginSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (!connectionSuccess && !basicLoginSuccess && !authLoginSuccess) {
    console.log('\n⚠️ All tests failed! Possible issues:');
    console.log('1. Backend server is not running on port 3001');
    console.log('2. Firewall is blocking the connection');
    console.log('3. There\'s an issue with the server\'s CORS configuration');
  } else if (!basicLoginSuccess && !authLoginSuccess) {
    console.log('\n⚠️ Authentication endpoints are failing. Possible issues:');
    console.log('1. Backend authentication logic has errors');
    console.log('2. Test credentials are invalid');
    console.log('3. There\'s an issue with how POST requests are being handled');
  }
  
  console.log('\n📝 Recommendations:');
  console.log('- Confirm Flask server is running with: flask run --port=3001');
  console.log('- Check Flask logs for any errors during request handling');
  console.log('- Review CORS configuration in app.py');
  console.log('- Try using a REST client like Postman to test the API directly');
}

// Execute the tests
runTests().catch(error => {
  console.error('💥 Unexpected error during tests:', error);
});
