import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Spinner, Alert } from 'react-bootstrap';
import { getLegalUpdates } from '../services/api';
import { formatDate } from '../utils/formatters';

const LegalUpdates = () => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLegalUpdates = async () => {
      try {
        setLoading(true);
        const response = await getLegalUpdates();
        
        if (response.success) {
          setUpdates(response.updates);
        } else {
          throw new Error(response.message || 'Failed to fetch legal updates');
        }
      } catch (err) {
        setError(err.message || 'An error occurred while fetching legal updates');
      } finally {
        setLoading(false);
      }
    };

    fetchLegalUpdates();
  }, []);

  if (loading) {
    return (
      <div className="text-center my-4">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading legal updates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error</Alert.Heading>
        <p>{error}</p>
      </Alert>
    );
  }

  return (
    <Card>
      <Card.Header>
        <strong>Recent Italian Legal Updates</strong>
      </Card.Header>
      {updates.length === 0 ? (
        <Card.Body>
          <p className="text-center text-muted">No legal updates available at this time.</p>
        </Card.Body>
      ) : (
        <ListGroup variant="flush">
          {updates.slice(0, 5).map((update, index) => (
            <ListGroup.Item key={index} className="legal-update-item">
              <h6>
                <a 
                  href={update.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-decoration-none"
                >
                  {update.title}
                </a>
              </h6>
              {update.summary && (
                <p className="mb-1 text-muted small">{update.summary}</p>
              )}
              <small className="text-muted">
                Published: {update.published ? formatDate(update.published) : 'N/A'}
              </small>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      <Card.Footer className="text-center">
        <a 
          href="https://www.gazzettaufficiale.it/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-decoration-none"
        >
          View all updates on Gazzetta Ufficiale
        </a>
      </Card.Footer>
    </Card>
  );
};

export default LegalUpdates;
