import React, { useState, useEffect, useCallback } from 'react';
import { Card, ListGroup, Spinner, Alert, Form, Button, Badge } from 'react-bootstrap';
import { getLegalUpdates, updateLegalUpdatesInterval } from '../services/api';
import { formatDate } from '../utils/formatters';
import { userStorage } from '../services/api';

const LegalUpdates = () => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateInterval, setUpdateInterval] = useState(30); // Default 30 minutes
  const [lastUpdated, setLastUpdated] = useState('');
  const [showIntervalEditor, setShowIntervalEditor] = useState(false);
  const [newInterval, setNewInterval] = useState(30);
  const [intervalUpdating, setIntervalUpdating] = useState(false);
  const [user, setUser] = useState(null);

  // Get the user from storage
  useEffect(() => {
    const userData = userStorage.getUser();
    setUser(userData);
  }, []);

  const fetchLegalUpdates = useCallback(async () => {
    try {
      if (!user) {
        setError('User information is unavailable. Please log in again.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null); // Clear previous errors
      
      // Pass null to getLegalUpdates to let the backend use the user's preferences
      const response = await getLegalUpdates();
      
      if (response.success) {
        setUpdates(response.updates || []);
        setUpdateInterval(response.updateInterval || 30);
        setLastUpdated(response.lastUpdated || new Date().toISOString());
      } else {
        // Handle failure response (including network errors)
        const errorMessage = response.message || 'Failed to fetch legal updates';
        setError(errorMessage);
        
        // Keep existing updates if we have them
        if (updates.length === 0) {
          setUpdates([{
            title: "Unable to fetch legal updates",
            summary: "An error occurred while fetching updates. Please try again later.",
            published: new Date().toISOString(),
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
  }, [user, updates.length]);

  // Handle interval change
  const handleIntervalChange = async () => {
    if (newInterval < 1) {
      setError('Interval must be at least 1 minute');
      return;
    }
    
    try {
      setIntervalUpdating(true);
      const response = await updateLegalUpdatesInterval(newInterval);
      
      if (response.success) {
        setUpdateInterval(newInterval);
        setShowIntervalEditor(false);
        // Restart the update timer with the new interval
        setLastUpdated(new Date().toISOString());
      } else {
        throw new Error(response.message || 'Failed to update interval');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while updating the interval');
    } finally {
      setIntervalUpdating(false);
    }
  };

  useEffect(() => {
    // Only fetch updates if we have user data
    if (user) {
      fetchLegalUpdates();
    }
  }, [user, fetchLegalUpdates]);

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

  // Auto-refresh based on the update interval
  useEffect(() => {
    if (!updateInterval) return;
    
    const intervalId = setInterval(() => {
      fetchLegalUpdates();
    }, updateInterval * 60 * 1000); // Convert minutes to milliseconds
    
    return () => clearInterval(intervalId);
  }, [updateInterval, fetchLegalUpdates]);

  if (!user) {
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
          <span className="text-muted me-2" style={{ fontSize: '0.8rem' }}>
            Last updated: {getLastUpdatedText()}
          </span>
          <Button 
            variant="outline-secondary" 
            size="sm"
            onClick={() => setShowIntervalEditor(!showIntervalEditor)}
          >
            <i className="bi bi-clock"></i> {updateInterval}m
          </Button>
        </div>
      </Card.Header>
      
      {showIntervalEditor && (
        <Card.Body className="border-bottom pb-3 pt-0 mt-2">
          <Form className="d-flex align-items-center">
            <Form.Group className="mb-0 d-flex align-items-center">
              <Form.Label className="me-2 mb-0">Refresh every</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={newInterval}
                onChange={(e) => setNewInterval(parseInt(e.target.value) || 1)}
                style={{ width: '70px' }}
                size="sm"
                className="me-2"
              />
              <span className="me-3">minutes</span>
            </Form.Group>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleIntervalChange} 
              disabled={intervalUpdating}
              className="me-2"
            >
              {intervalUpdating ? (
                <>
                  <Spinner animation="border" size="sm" /> Saving...
                </>
              ) : 'Save'}
            </Button>
            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={() => setShowIntervalEditor(false)}
            >
              Cancel
            </Button>
          </Form>
        </Card.Body>
      )}

      {loading ? (
        <Card.Body className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2 text-muted">Loading the latest legal updates...</p>
        </Card.Body>
      ) : error ? (
        <Card.Body>
          <Alert variant="danger">
            <Alert.Heading>Error</Alert.Heading>
            <p>{error}</p>
            <div className="d-flex justify-content-end">
              <Button onClick={fetchLegalUpdates} variant="outline-danger" size="sm">
                Try Again
              </Button>
            </div>
          </Alert>
        </Card.Body>
      ) : (
        <>
          {updates.length === 0 ? (
            <Card.Body className="text-center py-4">
              <i className="bi bi-info-circle" style={{ fontSize: '2rem' }}></i>
              <p className="mt-2">No legal updates available at this time.</p>
              <Button variant="outline-primary" size="sm" onClick={fetchLegalUpdates}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </Button>
            </Card.Body>
          ) : (
            <>
              <ListGroup variant="flush">
                {updates.map((update, index) => (
                  <ListGroup.Item key={index} className="py-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h6 className="mb-0">{update.title}</h6>
                      <small className="text-muted">{formatDate(update.published)}</small>
                    </div>
                    <p className="mb-1 text-muted small">{update.summary}</p>
                    <div className="d-flex justify-content-between align-items-center">
                      <Badge bg="light" text="dark">{update.source || 'Official Source'}</Badge>
                      {update.url && (
                        <a href={update.url} target="_blank" rel="noopener noreferrer" className="btn btn-link btn-sm p-0">
                          Read More
                        </a>
                      )}
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
              <Card.Footer className="text-center">
                <Button variant="link" size="sm" onClick={fetchLegalUpdates}>
                  <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                </Button>
              </Card.Footer>
            </>
          )}
        </>
      )}
    </Card>
  );
};

export default LegalUpdates;
