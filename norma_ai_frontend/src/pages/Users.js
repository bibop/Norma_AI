import React, { useState, useEffect } from 'react';
import { Container, Table, Alert, Spinner, Badge } from 'react-bootstrap';
import { getUsers } from '../services/api';
import { formatDate } from '../utils/formatters';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await getUsers();
        
        if (response.success) {
          setUsers(response.users);
        } else {
          throw new Error(response.message || 'Failed to fetch users');
        }
      } catch (err) {
        setError(err.message || 'An error occurred while fetching users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) {
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading users...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="my-5">
        <Alert variant="danger">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <h2 className="mb-4">Registered Users</h2>
      
      {users.length === 0 ? (
        <Alert variant="info">No users found.</Alert>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Role</th>
                <th>Registration Date</th>
                <th>Password Hash (Debug)</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{`${user.first_name} ${user.last_name}`}</td>
                  <td>{user.email}</td>
                  <td>{user.company || 'N/A'}</td>
                  <td>
                    <Badge bg={user.role === 'admin' ? 'danger' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <small className="text-muted">{user.password_hash}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      
      <Alert variant="warning" className="mt-4">
        <Alert.Heading>Debug View Only</Alert.Heading>
        <p>
          This page is for debugging purposes only. In a production environment, password hashes 
          should never be displayed, and user information should be protected with appropriate 
          access controls.
        </p>
      </Alert>
    </Container>
  );
};

export default Users;
