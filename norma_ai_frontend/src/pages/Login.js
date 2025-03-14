import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Container, Card } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { saveToken } from '../utils/tokenUtils';
import { toast } from 'react-toastify';
import { API_ROOT_URL } from '../config';

// Use centralized configuration
const BACKEND_URL = API_ROOT_URL;

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const navigate = useNavigate();

  // Check API connection on component mount
  useEffect(() => {
    let isMounted = true;
    let connectionCheckTimeout = null;
    
    const checkConnection = async () => {
      try {
        console.log('Checking API connection to:', `${BACKEND_URL}/api/public/test-connection`);
        
        // Try multiple connection methods
        let connectionSuccessful = false;
        let connectionData = null;
        
        // Method 1: Standard fetch
        try {
          console.log('Trying connection method 1...');
          const response = await fetch(`${BACKEND_URL}/api/public/test-connection`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'X-Debug-Client': 'LoginComponent'
            },
            credentials: 'omit', // Explicitly omit credentials for this public endpoint
            mode: 'cors',
            cache: 'no-store'
          });

          if (response.ok) {
            const data = await response.json();
            console.log('API connection successful (method 1):', data);
            connectionSuccessful = true;
            connectionData = data;
          } else {
            console.warn('API connection method 1 failed with status:', response.status);
          }
        } catch (err) {
          console.warn('API connection method 1 failed:', err);
          
          // Add more detailed error logging
          if (err.name === 'TypeError') {
            console.error('Network error details:', {
              message: err.message,
              name: err.name,
              stack: err.stack
            });
          }
        }
        
        // Only continue with other methods if component is still mounted and previous method failed
        if (!isMounted) return;
        
        // Use a simple XMLHttpRequest as fallback
        if (!connectionSuccessful) {
          try {
            console.log('Trying connection method 2 with XMLHttpRequest...');
            const xhr = new XMLHttpRequest();
            await new Promise((resolve, reject) => {
              xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                  if (xhr.status === 200) {
                    try {
                      const data = JSON.parse(xhr.responseText);
                      console.log('API connection successful (method 2):', data);
                      connectionSuccessful = true;
                      connectionData = data;
                      resolve();
                    } catch (e) {
                      console.error('Error parsing response:', e);
                      reject(e);
                    }
                  } else {
                    reject(new Error(`Status: ${xhr.status}`));
                  }
                }
              };
              xhr.onerror = reject;
              xhr.open('GET', `${BACKEND_URL}/api/public/test-connection`, true);
              xhr.setRequestHeader('Accept', 'application/json');
              xhr.setRequestHeader('X-Debug-Client', 'LoginComponent-XHR');
              xhr.send();
            });
          } catch (err) {
            console.warn('API connection method 2 failed:', err);
          }
        }
        
        // Only continue with other methods if component is still mounted and previous methods failed
        if (!isMounted) return;
        
        // Use jQuery AJAX as a third fallback method
        if (!connectionSuccessful && window.jQuery) {
          try {
            console.log('Trying connection method 3 with jQuery AJAX...');
            await new Promise((resolve, reject) => {
              window.jQuery.ajax({
                url: `${BACKEND_URL}/api/public/test-connection`,
                method: 'GET',
                dataType: 'json',
                headers: {
                  'Accept': 'application/json',
                  'X-Debug-Client': 'LoginComponent-jQuery'
                },
                xhrFields: {
                  withCredentials: false
                },
                success: function(data) {
                  console.log('API connection successful (method 3):', data);
                  connectionSuccessful = true;
                  connectionData = data;
                  resolve();
                },
                error: function(jqXHR, textStatus, errorThrown) {
                  console.warn('jQuery AJAX error:', textStatus, errorThrown);
                  reject(new Error(`${textStatus}: ${errorThrown}`));
                }
              });
            });
          } catch (err) {
            console.warn('API connection method 3 failed:', err);
          }
        }
        
        // Only continue with other methods if component is still mounted and previous methods failed
        if (!isMounted) return;
        
        // Try a direct IP address approach if all else fails
        if (!connectionSuccessful) {
          try {
            console.log('Trying connection method 4 with direct IP...');
            // Force using the IP address instead of hostname
            const response = await fetch(`http://127.0.0.1:3001/api/public/test-connection`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'X-Debug-Client': 'LoginComponent-DirectIP'
              },
              mode: 'cors',
              cache: 'no-store'
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('API connection successful (method 4):', data);
              connectionSuccessful = true;
              connectionData = data;
            } else {
              console.warn('API connection method 4 failed with status:', response.status);
            }
          } catch (err) {
            console.warn('API connection method 4 failed:', err);
          }
        }
        
        // Update status based on connection results - only if component is still mounted
        if (!isMounted) return;
        
        if (connectionSuccessful) {
          setConnectionStatus('connected');
          // Log important server info for debugging
          if (connectionData?.server_info) {
            console.log('Server info:', connectionData.server_info);
          }
        } else {
          console.error('All API connection methods failed');
          setConnectionStatus('failed');
        }
        
        // Schedule next check after a delay if still failed
        if (!connectionSuccessful && isMounted) {
          connectionCheckTimeout = setTimeout(checkConnection, 8000);
        }
      } catch (err) {
        console.error('API connection error:', err);
        if (isMounted) {
          setConnectionStatus('failed');
          // Schedule retry after delay
          connectionCheckTimeout = setTimeout(checkConnection, 8000);
        }
      }
    };

    checkConnection();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      if (connectionCheckTimeout) {
        clearTimeout(connectionCheckTimeout);
      }
    };
  }, []); // Empty dependency array ensures this only runs once on mount

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log(`Attempting login to ${BACKEND_URL}/api/auth/login`);
      
      // Using direct IP address (127.0.0.1) instead of localhost to avoid IPv6 issues
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });
      
      console.log("Login response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || `Login failed with status ${response.status}`);
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw new Error(`Login failed with status ${response.status}`);
          }
          throw e;
        }
      }
      
      const data = await response.json();
      console.log("Login successful data:", data);
      
      // Check if we got a valid token
      if (data.success && data.access_token) {
        console.log("Saving token:", data.access_token.substring(0, 10) + "...");
        
        // Save token - makes it available to the API service
        saveToken(data.access_token);
        
        // Store in localStorage as well for debugging
        localStorage.setItem('debug_token_saved', 'true');
        localStorage.setItem('debug_token_time', new Date().toISOString());
        
        toast.success('Login successful! Welcome back');
        
        if (onLoginSuccess) {
          onLoginSuccess(data.user, data.access_token);
        }
        
        // Redirect to dashboard or home page
        navigate('/');
      } else {
        throw new Error(data.message || 'Login failed - no valid token received');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (err instanceof TypeError || err.message.includes('Failed to fetch')) {
        setError(`
          Connection issue detected. Please verify:
          1. Backend server is running on port 3001
          2. Your network connection is working
          3. Try refreshing the page
          
          Technical details: ${err.message}
        `);
      } else {
        setError(err.message || 'Invalid email or password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <div style={{ width: '100%', maxWidth: '450px' }}>
        <Card className="shadow-sm">
          <Card.Body className="p-4">
            <h2 className="text-center mb-4">Login to Norma AI</h2>
            
            {connectionStatus === 'checking' && (
              <Alert variant="info">
                Checking connection to API server...
              </Alert>
            )}
            
            {connectionStatus === 'failed' && (
              <Alert variant="danger">
                <strong>API server is unreachable!</strong>
                <p className="mb-0">Please make sure the backend server is running on port 3001.</p>
                <p className="mb-0 mt-2"><small>Retrying connection automatically...</small></p>
              </Alert>
            )}
            
            {error && (
              <Alert variant="danger">
                {error}
              </Alert>
            )}
            
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={connectionStatus === 'failed'}
                />
              </Form.Group>
              
              <Form.Group className="mb-3" controlId="password">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={connectionStatus === 'failed'}
                />
              </Form.Group>
              
              <Button 
                variant="primary" 
                type="submit" 
                className="w-100 mt-3"
                disabled={isSubmitting || connectionStatus === 'failed'}
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
              
              <div className="text-center mt-3">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            </Form>
          </Card.Body>
        </Card>
        
        <div className="text-center mt-3">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>
        
        {connectionStatus === 'connected' && (
          <div className="text-center mt-3 text-success">
            <small>✓ Connected to API server</small>
          </div>
        )}
      </div>
    </Container>
  );
};

export default Login;
