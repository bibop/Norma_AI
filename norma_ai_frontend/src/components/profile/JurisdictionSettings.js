import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { getAvailableJurisdictions, updateUserJurisdictions } from '../../services/api';
import { toast } from 'react-toastify';

/**
 * Component for updating user's preferred jurisdictions
 * @param {Object} props Component properties
 * @param {Object} props.user The user profile object
 * @param {Function} props.onUpdate Function to call when jurisdictions are updated
 */
const JurisdictionSettings = ({ user, onUpdate }) => {
  const [selectedJurisdictions, setSelectedJurisdictions] = useState(
    user?.preferred_jurisdictions || [user?.preferred_jurisdiction || 'us']
  );
  const [primaryJurisdiction, setPrimaryJurisdiction] = useState(
    user?.preferred_jurisdiction || 'us'
  );
  const [jurisdictions, setJurisdictions] = useState([
    { code: 'us', name: 'United States', description: 'US federal and state laws including CCPA, HIPAA, ADA, etc.' },
    { code: 'eu', name: 'European Union', description: 'EU regulations including GDPR, ePrivacy, Digital Services Act, etc.' },
    { code: 'uk', name: 'United Kingdom', description: 'UK laws including UK GDPR, Data Protection Act, PECR, etc.' },
    { code: 'ca', name: 'Canada', description: 'Canadian regulations including PIPEDA, CASL, etc.' },
    { code: 'au', name: 'Australia', description: 'Australian laws including Privacy Act, Consumer Law, etc.' },
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Fetch available jurisdictions on component mount
  useEffect(() => {
    const fetchJurisdictions = async () => {
      try {
        setLoading(true);
        const response = await getAvailableJurisdictions().catch(err => {
          console.error('Caught error fetching jurisdictions:', err);
          return null;
        });
        
        // Handle the response carefully to avoid undefined errors
        if (response && typeof response === 'object' && response.success === true && Array.isArray(response.jurisdictions)) {
          setJurisdictions(response.jurisdictions);
        } else {
          console.log('Using default jurisdictions due to invalid response:', response);
          // Keep using the default jurisdictions
        }
      } catch (err) {
        console.error('Error in jurisdiction fetch try/catch:', err);
        // We'll use the default jurisdictions already set in state
      } finally {
        setLoading(false);
      }
    };
    
    fetchJurisdictions();
  }, []);
  
  const handleJurisdictionChange = (jurisdictionCode) => {
    setSelectedJurisdictions(prev => {
      // If the jurisdiction is already selected, remove it
      if (prev.includes(jurisdictionCode)) {
        // Don't allow removing primary jurisdiction
        if (jurisdictionCode === primaryJurisdiction) {
          return prev;
        }
        return prev.filter(code => code !== jurisdictionCode);
      } else {
        // Otherwise, add it
        return [...prev, jurisdictionCode];
      }
    });
  };
  
  const handlePrimaryChange = (e) => {
    const newPrimary = e.target.value;
    setPrimaryJurisdiction(newPrimary);
    
    // Ensure the primary jurisdiction is selected
    if (!selectedJurisdictions.includes(newPrimary)) {
      setSelectedJurisdictions(prev => [...prev, newPrimary]);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Ensure primary jurisdiction is in the list of selected jurisdictions
    if (!selectedJurisdictions.includes(primaryJurisdiction)) {
      toast.error('Primary jurisdiction must be in your selected jurisdictions');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      // Capture any errors during the API call
      const response = await updateUserJurisdictions(primaryJurisdiction, selectedJurisdictions).catch(err => {
        console.error('Caught error updating jurisdictions:', err);
        setError(err?.message || 'Failed to update jurisdictions');
        return null;
      });
      
      // Handle the response carefully to avoid undefined errors
      if (response && typeof response === 'object' && response.success === true) {
        toast.success('Preferred jurisdictions updated successfully');
        
        // Call the parent's update handler with the updated user data
        if (onUpdate && response.user) {
          onUpdate(response.user);
        }
      } else if (response) {
        setError(response.message || 'Failed to update jurisdictions');
      } else {
        // Error was already handled in the catch block above
      }
    } catch (err) {
      setError('Error updating jurisdictions: ' + (err?.message || 'Unknown error occurred'));
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Card className="mb-4">
      <Card.Header>
        <strong>Preferred Jurisdictions</strong>
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        
        <p>
          Select your preferred jurisdictions for document compliance analysis and legal updates.
          Your primary jurisdiction will be used as the default when uploading and analyzing documents.
        </p>
        
        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" role="status" />
            <span className="ms-2">Loading jurisdictions...</span>
          </div>
        ) : (
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-4">
              <Form.Label><strong>Primary Jurisdiction</strong></Form.Label>
              <Form.Select 
                value={primaryJurisdiction} 
                onChange={handlePrimaryChange}
                disabled={saving}
                className="mb-2"
              >
                {jurisdictions.map(j => (
                  <option key={j.code} value={j.code}>
                    {j.name}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Your primary jurisdiction will be used by default for document compliance analysis.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-4">
              <Form.Label><strong>Track Updates for These Jurisdictions</strong></Form.Label>
              {jurisdictions.map(j => (
                <Form.Check 
                  key={j.code}
                  type="checkbox"
                  id={`jurisdiction-${j.code}`}
                  label={`${j.name} - ${j.description}`}
                  checked={selectedJurisdictions.includes(j.code)}
                  onChange={() => handleJurisdictionChange(j.code)}
                  disabled={j.code === primaryJurisdiction || saving}
                  className="mb-2"
                />
              ))}
              <Form.Text className="text-muted">
                You will receive legal updates for all selected jurisdictions. Your primary jurisdiction can't be unselected.
              </Form.Text>
            </Form.Group>
            
            <Button 
              type="submit" 
              variant="primary" 
              disabled={saving || 
                (primaryJurisdiction === user?.preferred_jurisdiction &&
                JSON.stringify(selectedJurisdictions.sort()) === 
                JSON.stringify((user?.preferred_jurisdictions || [user?.preferred_jurisdiction || 'us']).sort()))}
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

export default JurisdictionSettings;
