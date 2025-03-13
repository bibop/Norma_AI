import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { updateUserLegalSources } from '../../services/api';
import { toast } from 'react-toastify';

/**
 * Component for selecting preferred legal update sources
 * @param {Object} props Component properties
 * @param {Object} props.user The user profile object
 * @param {Function} props.onUpdate Function to call when preferences are updated
 */
const LegalUpdateSources = ({ user, onUpdate }) => {
  // Default available sources
  const defaultSources = [
    { id: 'official', name: 'Official Government Sources', description: 'Updates from official government websites and publications' },
    { id: 'news', name: 'Legal News Outlets', description: 'Updates from reputable legal news outlets and journals' },
    { id: 'academic', name: 'Academic Sources', description: 'Updates from law schools and academic publications' },
    { id: 'industry', name: 'Industry Publications', description: 'Updates from industry-specific legal publications' },
    { id: 'international', name: 'International Organizations', description: 'Updates from international legal bodies and organizations' }
  ];

  const [availableSources, setAvailableSources] = useState(defaultSources);
  const [selectedSources, setSelectedSources] = useState(user?.preferred_legal_sources || ['official']);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fetch available sources on component mount
  useEffect(() => {
    // Initialize selected sources from user preferences if available
    if (user && user.preferred_legal_sources && Array.isArray(user.preferred_legal_sources)) {
      setSelectedSources(user.preferred_legal_sources);
    }
    // In the future, we could add an API call here to fetch available sources dynamically
  }, [user]);

  const handleSourceChange = (sourceId) => {
    setSelectedSources(prev => {
      if (prev.includes(sourceId)) {
        return prev.filter(id => id !== sourceId);
      } else {
        return [...prev, sourceId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Require at least one source
    if (selectedSources.length === 0) {
      setError('Please select at least one source for legal updates');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const response = await updateUserLegalSources(selectedSources);
      
      if (response && response.success) {
        toast.success('Legal update sources updated successfully');
        
        // Call the parent's update handler with the updated user data
        if (onUpdate && response.user) {
          onUpdate(response.user);
        }
      } else {
        setError(response?.message || 'Failed to update preferences');
      }
    } catch (err) {
      setError('Error updating preferences: ' + (err?.message || 'Unknown error occurred'));
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Card className="mb-4">
      <Card.Header>
        <strong>Legal Update Sources</strong>
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        
        <p>
          Select your preferred sources for legal updates. 
          You will receive updates from these sources based on your jurisdiction preferences.
        </p>
        
        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" role="status" />
            <span className="ms-2">Loading sources...</span>
          </div>
        ) : (
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              {availableSources.map(source => (
                <Form.Check 
                  key={source.id}
                  type="checkbox"
                  id={`source-${source.id}`}
                  label={`${source.name} - ${source.description}`}
                  checked={selectedSources.includes(source.id)}
                  onChange={() => handleSourceChange(source.id)}
                  className="mb-2"
                />
              ))}
              <Form.Text className="text-muted">
                You'll receive legal updates from the selected sources based on your jurisdiction preferences.
              </Form.Text>
            </Form.Group>
            
            <Button 
              type="submit" 
              variant="primary" 
              disabled={saving || 
                (JSON.stringify(selectedSources.sort()) === 
                JSON.stringify((user?.preferred_legal_sources || ['official']).sort()))}
            >
              {saving ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Saving...
                </>
              ) : 'Save Preferences'}
            </Button>
          </Form>
        )}
      </Card.Body>
    </Card>
  );
};

export default LegalUpdateSources;
