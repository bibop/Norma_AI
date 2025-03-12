import React, { useState } from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { updateUserProfile } from '../../services/api';

const PasswordChangeForm = () => {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    // Check if passwords match
    if (formData.new_password !== formData.confirm_password) {
      setError("New passwords don't match");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Only send the required fields for password change
      const passwordData = {
        current_password: formData.current_password,
        new_password: formData.new_password
      };
      
      const response = await updateUserProfile(passwordData);
      
      if (response.success) {
        toast.success('Password changed successfully');
        // Reset form
        setFormData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        setValidated(false);
      } else {
        setError(response.message || 'Failed to change password');
      }
    } catch (err) {
      setError('Error changing password: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <Card.Header>
        <h5 className="mb-0">Change Password</h5>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}
        
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Current Password</Form.Label>
            <Form.Control
              type="password"
              name="current_password"
              value={formData.current_password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
            <Form.Control.Feedback type="invalid">
              Current password is required.
            </Form.Control.Feedback>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              name="new_password"
              value={formData.new_password}
              onChange={handleChange}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Form.Control.Feedback type="invalid">
              New password must be at least 6 characters.
            </Form.Control.Feedback>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Confirm New Password</Form.Label>
            <Form.Control
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              isInvalid={
                formData.new_password !== formData.confirm_password &&
                formData.confirm_password !== ''
              }
              autoComplete="new-password"
            />
            <Form.Control.Feedback type="invalid">
              Passwords do not match.
            </Form.Control.Feedback>
          </Form.Group>
          
          <div className="d-flex justify-content-end">
            <Button 
              variant="primary" 
              type="submit" 
              disabled={loading}
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default PasswordChangeForm;
