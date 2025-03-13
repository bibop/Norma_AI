import React, { useState, useEffect, useCallback } from 'react';
import { Card, ListGroup, Spinner, Alert, Form, Button, Badge } from 'react-bootstrap';
import { legalService } from '../services/api';
import { formatDate } from '../utils/formatters';
import { getToken } from '../utils/tokenUtils';

const LegalUpdates = () => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateInterval, setUpdateInterval] = useState(30); // Default 30 minutes
  const [lastUpdated, setLastUpdated] = useState('');
  const [showIntervalEditor, setShowIntervalEditor] = useState(false);
  const [newInterval, setNewInterval] = useState(30);
  const [intervalUpdating, setIntervalUpdating] = useState(false);
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

  const fetchLegalUpdates = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      
      const response = await legalService.getLegalUpdates();
      
      if (response.success) {
        setUpdates(response.updates || []);
        setUpdateInterval(response.updateInterval || 30);
        setLastUpdated(new Date().toISOString());
      } else {
        // Handle failure response (including network errors)
        const errorMessage = response.message || 'Failed to fetch legal updates';
        setError(errorMessage);
        
        // Keep existing updates if we have them
        if (updates.length === 0) {
          setUpdates([{
            id: 'error',
            title: "Unable to fetch legal updates",
            summary: "An error occurred while fetching updates. Please try again later.",
            published_date: new Date().toISOString(),
            source: "System Message"
          }]);
        }
        
        console.warn('Legal updates fetch failed:', errorMessage);
      }
    } catch (err) {
      // This should only trigger for coding errors in the component itself
      console.error('Error in fetchLegalUpdates function:', err);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, updates.length]);

  // Refresh legal updates when authentication state changes
  useEffect(() => {
    fetchLegalUpdates();
  }, [isAuthenticated, fetchLegalUpdates]);
  
  // Auto-refresh based on the update interval
  useEffect(() => {
    if (!isAuthenticated || !updateInterval) return;
    
    const intervalId = setInterval(() => {
      fetchLegalUpdates();
    }, updateInterval * 60 * 1000); // Convert minutes to milliseconds
    
    return () => clearInterval(intervalId);
  }, [updateInterval, fetchLegalUpdates, isAuthenticated]);

  // Format time since last update
  const getLastUpdatedText = () => {
    if (!lastUpdated) return 'Never';
    
    const lastDate = new Date(lastUpdated);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastDate) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Handle manual refresh
  const handleRefresh = () => {
    fetchLegalUpdates();
  };

  if (!isAuthenticated) {
    return (
      <Card className="mb-4">
        <Card.Header as="h5">Legal Updates</Card.Header>
        <Card.Body>
          <Alert variant="info">
            Please log in to see your legal updates.
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-4 legal-updates-card">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-0">Legal Updates</h5>
          <small className="text-muted">Based on your profile preferences</small>
        </div>
        <div className="d-flex align-items-center">
          <Button 
            variant="outline-secondary" 
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="me-2"
          >
            {loading ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <i className="bi bi-arrow-clockwise"></i>
            )}
          </Button>
          <span className="text-muted me-2" style={{ fontSize: '0.8rem' }}>
            {lastUpdated ? `Last updated: ${getLastUpdatedText()}` : ''}
          </span>
        </div>
      </Card.Header>
      
      {loading && updates.length === 0 ? (
        <Card.Body className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-3 text-muted">Loading your legal updates...</p>
        </Card.Body>
      ) : error ? (
        <Card.Body>
          <Alert variant="danger">
            {error}
            <div className="mt-2">
              <Button variant="outline-danger" size="sm" onClick={fetchLegalUpdates}>
                Try Again
              </Button>
            </div>
          </Alert>
        </Card.Body>
      ) : updates.length === 0 ? (
        <Card.Body>
          <Alert variant="info">
            No legal updates found for your profile preferences.
          </Alert>
        </Card.Body>
      ) : (
        <>
          <ListGroup variant="flush">
            {updates.map((update, index) => (
              <ListGroup.Item key={update.id || index} className="border-bottom py-3">
                <div className="d-flex justify-content-between align-items-start mb-1">
                  <h6 className="mb-1">{update.title}</h6>
                  <Badge bg="secondary" className="text-white">
                    {update.category || update.source || 'Legal'}
                  </Badge>
                </div>
                <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>
                  {update.summary || update.description}
                </p>
                <div className="d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    {formatDate(update.published_date || update.date || update.published)}
                  </small>
                  {update.url && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      href={update.url} 
                      target="_blank" 
                      className="p-0"
                    >
                      Read More
                    </Button>
                  )}
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </>
      )}
    </Card>
  );
};

export default LegalUpdates;
