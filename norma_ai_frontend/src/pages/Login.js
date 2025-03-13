import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Container, Card } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { saveToken } from '../utils/tokenUtils';
import { toast } from 'react-toastify';

// Force using direct IP address for API calls to avoid IPv6 issues
const BACKEND_URL = 'http://127.0.0.1:3001';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const navigate = useNavigate();

  // Check API connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('Checking API connection...');
        const response = await fetch(`${BACKEND_URL}/api/test-connection`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('API connection successful:', data);
          setConnectionStatus('connected');
        } else {
          console.error('API connection failed:', response.status);
          setConnectionStatus('failed');
        }
      } catch (err) {
        console.error('API connection error:', err);
        setConnectionStatus('failed');
      }
    };

    checkConnection();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log(`Attempting login to ${BACKEND_URL}/api/basic-login`);
      
      // Using direct IP address (127.0.0.1) instead of localhost to avoid IPv6 issues
      const response = await fetch(`${BACKEND_URL}/api/basic-login`, {
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
      console.log("Login successful:", data);
      
      if (data.success) {
        toast.success('Login successful! Welcome back');
        saveToken(data.access_token);
        
        if (onLoginSuccess) {
          onLoginSuccess(data.user, data.access_token);
        }
        
        // Redirect to dashboard or home page
        navigate('/');
      } else {
        throw new Error(data.message || 'Login failed');
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
