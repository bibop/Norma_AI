import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Button, Row, Col, Alert } from 'react-bootstrap';
import { FaUserPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Components
import UserTable from '../components/admin/UserTable';
import UserForm from '../components/admin/UserForm';
import DeleteConfirmation from '../components/admin/DeleteConfirmation';

// Services
import { 
  getUsersAdmin, 
  createUserAdmin, 
  updateUserAdmin, 
  deleteUserAdmin,
  getUserByIdAdmin 
} from '../services/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // State variables
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Fetch users data
  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await getUsersAdmin(page);
      if (response.success) {
        setUsers(response.users);
        setTotalPages(response.pagination.total_pages);
        setCurrentPage(response.pagination.page);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      // Check if error is due to unauthorized access
      if (err.response && err.response.status === 403) {
        toast.error('You do not have admin privileges to access this page');
        navigate('/'); // Redirect to home
      } else {
        setError('Error loading users: ' + (err.response?.data?.message || err.message));
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);
  
  // Fetch on mount and page change
  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage, fetchUsers]);
  
  // Handler for page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  // Handle user creation
  const handleCreateUser = async (userData) => {
    try {
      const response = await createUserAdmin(userData);
      if (response.success) {
        toast.success('User created successfully');
        setShowUserForm(false);
        fetchUsers(currentPage); // Refresh list
      } else {
        toast.error(response.message || 'Failed to create user');
      }
    } catch (err) {
      toast.error('Error creating user: ' + (err.response?.data?.message || err.message));
    }
  };
  
  // Handle editing user
  const handleEditClick = (user) => {
    setEditUser(user);
    setShowUserForm(true);
  };
  
  // Handle user update
  const handleUpdateUser = async (userData) => {
    try {
      const response = await updateUserAdmin(editUser.id, userData);
      if (response.success) {
        toast.success('User updated successfully');
        setShowUserForm(false);
        setEditUser(null);
        fetchUsers(currentPage); // Refresh list
      } else {
        toast.error(response.message || 'Failed to update user');
      }
    } catch (err) {
      toast.error('Error updating user: ' + (err.response?.data?.message || err.message));
    }
  };
  
  // Handle form submission (create or update)
  const handleSubmitUserForm = (formData) => {
    if (editUser) {
      handleUpdateUser(formData);
    } else {
      handleCreateUser(formData);
    }
  };
  
  // Handle delete user click
  const handleDeleteClick = (userId) => {
    // Find user in list to show name in confirmation
    const user = users.find(u => u.id === userId);
    setUserToDelete(user);
    setShowDeleteModal(true);
  };
  
  // Handle confirm delete
  const handleConfirmDelete = async () => {
    try {
      const response = await deleteUserAdmin(userToDelete.id);
      if (response.success) {
        toast.success('User deleted successfully');
        setShowDeleteModal(false);
        setUserToDelete(null);
        
        // If we're on the last page and deleted the last user, go to previous page
        if (users.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        } else {
          fetchUsers(currentPage); // Refresh list
        }
      } else {
        toast.error(response.message || 'Failed to delete user');
      }
    } catch (err) {
      toast.error('Error deleting user: ' + (err.response?.data?.message || err.message));
    }
  };
  
  // Handle role change
  const handleRoleChange = async (userId, newRole) => {
    try {
      const userData = { role: newRole };
      const response = await updateUserAdmin(userId, userData);
      if (response.success) {
        toast.success(`User role updated to ${newRole}`);
        fetchUsers(currentPage); // Refresh list
      } else {
        toast.error(response.message || 'Failed to update user role');
      }
    } catch (err) {
      toast.error('Error updating user role: ' + (err.response?.data?.message || err.message));
    }
  };
  
  return (
    <Container className="py-4">
      <h1 className="mb-4">User Administration</h1>
      
      {error && (
        <Alert variant="danger">{error}</Alert>
      )}
      
      <Card className="mb-4">
        <Card.Header className="bg-light">
          <Row className="align-items-center">
            <Col>
              <h5 className="mb-0">User Management</h5>
            </Col>
            <Col xs="auto">
              <Button 
                variant="primary" 
                onClick={() => {
                  setEditUser(null);
                  setShowUserForm(true);
                }}
              >
                <FaUserPlus className="me-2" />
                Add New User
              </Button>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body>
          <UserTable 
            users={users}
            loading={loading}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onChangeRole={handleRoleChange}
          />
        </Card.Body>
      </Card>
      
      {/* User Form Modal */}
      <UserForm 
        show={showUserForm}
        user={editUser}
        isEdit={!!editUser}
        onHide={() => {
          setShowUserForm(false);
          setEditUser(null);
        }}
        onSubmit={handleSubmitUserForm}
      />
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmation 
        show={showDeleteModal}
        userName={userToDelete ? `${userToDelete.first_name} ${userToDelete.last_name}` : ''}
        onHide={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </Container>
  );
};

export default AdminDashboard;
