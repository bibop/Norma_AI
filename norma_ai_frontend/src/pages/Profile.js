import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { getUserProfile } from '../services/api';
import cookieStorage from '../utils/cookieStorage';
import ProfileForm from '../components/profile/ProfileForm';
import PasswordChangeForm from '../components/profile/PasswordChangeForm';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch user profile data
  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const response = await getUserProfile();
      if (response && response.success) {
        setUser(response.user);
        // Update user data in storage to keep it in sync
        cookieStorage.setItem('user', JSON.stringify(response.user));
      } else {
        setError(response.message || 'Failed to load user profile');
      }
    } catch (err) {
      setError('Error loading profile: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Load user profile on component mount
  useEffect(() => {
    fetchUserProfile();
  }, []);
  
  // Handle profile updates
  const handleProfileUpdate = (updatedUserData) => {
    setUser(updatedUserData);
    // Update user data in storage
    cookieStorage.setItem('user', JSON.stringify(updatedUserData));
  };
  
  if (loading) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }
  
  return (
    <Container className="py-4">
      <h1 className="mb-4">My Profile</h1>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      
      {user && (
        <Row>
          <Col lg={8} className="mb-4">
            <ProfileForm 
              user={user} 
              onProfileUpdate={handleProfileUpdate} 
            />
          </Col>
          <Col lg={4}>
            <PasswordChangeForm />
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default Profile;
