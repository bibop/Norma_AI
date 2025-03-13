import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiFileText, FiShield, FiAlertCircle, FiBookOpen } from 'react-icons/fi';
import LegalUpdates from '../components/LegalUpdates';
import { getToken } from '../utils/tokenUtils';

const Home = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check authentication state
  useEffect(() => {
    const token = getToken();
    setIsAuthenticated(!!token);
    
    // Listen for auth changes
    const handleAuthChange = (event) => {
      const action = event.detail.action;
      setIsAuthenticated(action === 'set');
    };
    
    window.addEventListener('auth_token_changed', handleAuthChange);
    
    return () => {
      window.removeEventListener('auth_token_changed', handleAuthChange);
    };
  }, []);

  return (
    <Container>
      {!isAuthenticated ? (
        // Non-authenticated view
        <>
          <div className="hero-section p-5 mb-4 text-center rounded">
            <h1 className="display-5">Welcome to NORMA AI</h1>
            <p className="lead">
              The Italian law compliance management solution for modern businesses
            </p>
            <p className="mb-2">
              NORMA AI helps businesses ensure compliance with Italian legal requirements by analyzing documents,
              providing legal updates, and identifying potential compliance issues.
            </p>
            <p className="mb-4 text-info fw-bold">
              Test Version for David Michael
            </p>
            <div className="d-grid gap-2 d-sm-flex justify-content-sm-center">
              <Link to="/register">
                <Button variant="primary" size="lg">Get Started</Button>
              </Link>
              <Link to="/login">
                <Button variant="outline-secondary" size="lg">Log In</Button>
              </Link>
            </div>
          </div>

          <h2 className="text-center mb-4">How It Works</h2>
          <Row className="g-4 mb-5">
            <Col md={3}>
              <Card className="h-100 text-center p-3">
                <Card.Body>
                  <FiFileText className="mb-3" size={40} color="#0d6efd" />
                  <Card.Title>Upload Documents</Card.Title>
                  <Card.Text>
                    Upload your legal documents, contracts, and compliance materials for analysis.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100 text-center p-3">
                <Card.Body>
                  <FiAlertCircle className="mb-3" size={40} color="#fd7e14" />
                  <Card.Title>Identify Issues</Card.Title>
                  <Card.Text>
                    NORMA AI identifies potential compliance issues in your documents.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100 text-center p-3">
                <Card.Body>
                  <FiShield className="mb-3" size={40} color="#198754" />
                  <Card.Title>Ensure Compliance</Card.Title>
                  <Card.Text>
                    Get actionable recommendations to ensure compliance with Italian law.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100 text-center p-3">
                <Card.Body>
                  <FiBookOpen className="mb-3" size={40} color="#6c757d" />
                  <Card.Title>Stay Updated</Card.Title>
                  <Card.Text>
                    Receive updates on changes to Italian regulations and laws.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="mb-5">
            <Col md={7}>
              <h3 className="mb-3">Why Choose NORMA AI?</h3>
              <p>
                NORMA AI combines advanced technology with legal expertise to provide a comprehensive 
                compliance management solution for businesses operating in Italy. Our platform helps you:
              </p>
              <ul>
                <li>Reduce legal risks and potential penalties</li>
                <li>Save time on manual document review</li>
                <li>Stay up-to-date with changing regulations</li>
                <li>Improve overall compliance management</li>
                <li>Identify issues before they become problems</li>
              </ul>
              <p>
                Our solution is designed specifically for Italian legal compliance, making it the perfect 
                tool for businesses of all sizes operating within the Italian market.
              </p>
            </Col>
            <Col md={5}>
              <LegalUpdates />
            </Col>
          </Row>
        </>
      ) : (
        // Authenticated user dashboard view
        <>
          <div className="p-4 mb-4 rounded bg-light">
            <h1 className="mb-3">Welcome back to NORMA AI</h1>
            <p className="lead mb-0">
              Your Italian law compliance management dashboard
            </p>
          </div>
          
          <Row className="mb-4">
            <Col md={7}>
              <Card className="mb-4">
                <Card.Header>Quick Actions</Card.Header>
                <Card.Body>
                  <Row>
                    <Col sm={6} className="mb-3">
                      <Link to="/documents" className="text-decoration-none">
                        <Card className="h-100 text-center p-3 bg-light">
                          <Card.Body>
                            <FiFileText className="mb-2" size={30} color="#0d6efd" />
                            <Card.Title className="mb-0 fs-6">My Documents</Card.Title>
                          </Card.Body>
                        </Card>
                      </Link>
                    </Col>
                    <Col sm={6} className="mb-3">
                      <Link to="/profile" className="text-decoration-none">
                        <Card className="h-100 text-center p-3 bg-light">
                          <Card.Body>
                            <FiShield className="mb-2" size={30} color="#198754" />
                            <Card.Title className="mb-0 fs-6">Update Profile</Card.Title>
                          </Card.Body>
                        </Card>
                      </Link>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
              
              <Card>
                <Card.Header>Recent Activity</Card.Header>
                <Card.Body>
                  <Alert variant="info">
                    Your activity will appear here as you use the system.
                  </Alert>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={5}>
              <LegalUpdates />
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
};

export default Home;
