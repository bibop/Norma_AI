import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Button, Form, Spinner, Alert } from 'react-bootstrap';
import api from '../../services/api';
import { getLegalUpdates } from '../../services/api';

const LegalUpdates = ({ user }) => {
  const [legalUpdates, setLegalUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateCount, setUpdateCount] = useState(10);
  
  useEffect(() => {
    fetchLegalUpdates();
  }, [user]);
  
  const fetchLegalUpdates = async () => {
    if (!user || !user.preferred_jurisdiction) return;
    
    setLoading(true);
    try {
      const response = await getLegalUpdates(user.preferred_jurisdiction);
      
      if (response.success) {
        // Limit the updates to the specified count
        setLegalUpdates(response.updates.slice(0, updateCount));
      } else {
        setError(response.message || 'Failed to retrieve legal updates');
      }
    } catch (err) {
      setError('Error loading legal updates: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const handleCountChange = (e) => {
    const newCount = parseInt(e.target.value);
    setUpdateCount(newCount);
    // Refresh data with new count
    fetchLegalUpdates();
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  if (!user || !user.preferred_jurisdiction) {
    return (
      <Card className="mb-4">
        <Card.Header as="h5">Legal Updates</Card.Header>
        <Card.Body>
          <Alert variant="info">
            Please set your preferred jurisdiction to see relevant legal updates.
          </Alert>
        </Card.Body>
      </Card>
    );
  }
  
  return (
    <Card className="mb-4">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="m-0">Legal Updates for {user.preferred_jurisdiction_name || user.preferred_jurisdiction}</h5>
        <Form.Select 
          className="w-auto" 
          size="sm" 
          value={updateCount} 
          onChange={handleCountChange}
        >
          <option value="5">Show 5</option>
          <option value="10">Show 10</option>
          <option value="15">Show 15</option>
          <option value="20">Show 20</option>
        </Form.Select>
      </Card.Header>
      
      {loading ? (
        <Card.Body className="text-center py-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </Card.Body>
      ) : error ? (
        <Card.Body>
          <Alert variant="danger">{error}</Alert>
        </Card.Body>
      ) : (
        <>
          <ListGroup variant="flush">
            {legalUpdates.length > 0 ? (
              legalUpdates.map((update, index) => (
                <ListGroup.Item key={index} className="py-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <h6 className="mb-0">{update.title}</h6>
                    <small className="text-muted">{formatDate(update.published)}</small>
                  </div>
                  <p className="mb-1 text-secondary small">{update.summary}</p>
                  {update.link && (
                    <a 
                      href={update.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-sm btn-outline-primary mt-2"
                    >
                      Read More
                    </a>
                  )}
                </ListGroup.Item>
              ))
            ) : (
              <ListGroup.Item className="py-3 text-center">
                No legal updates available at this time.
              </ListGroup.Item>
            )}
          </ListGroup>
          
          <Card.Footer className="text-muted small">
            Last updated: {legalUpdates[0]?.published 
              ? formatDate(legalUpdates[0].published) 
              : 'Unknown'}
          </Card.Footer>
        </>
      )}
    </Card>
  );
};

export default LegalUpdates;
