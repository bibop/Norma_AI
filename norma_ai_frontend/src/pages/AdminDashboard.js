import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Button, Row, Col, Alert, Spinner, Pagination } from 'react-bootstrap';
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
  const [usersPerPage, setUsersPerPage] = useState(10);
  
  // Fetch users data
  const fetchUsers = useCallback(async (page = currentPage) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getUsersAdmin(page, usersPerPage);
      
      if (response.success) {
        setUsers(response.users || []);
        setTotalPages(response.pagination?.total_pages || 1);
        setCurrentPage(response.pagination?.page || 1);
      } else if (response.isNetworkError) {
        setError(response.message || 'Network error. Please check your connection and try again.');
        toast.error(response.message || 'Network error. Please check your connection and try again.');
      } else {
        throw new Error(response.message || 'Failed to fetch users');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching users');
      toast.error(err.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  }, [currentPage, usersPerPage, toast]);
  
  // Fetch on mount and page change
  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage, fetchUsers]);
  
  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  // Add new user
  const handleAddUser = () => {
    setEditUser(null);
    setShowUserForm(true);
  };
  
  // Edit existing user
  const handleEditUser = async (userId) => {
    try {
      setLoading(true);
      const response = await getUserByIdAdmin(userId);
      
      if (response.success) {
        const userData = { ...response.user };
        delete userData.password;
        setEditUser(userData);
        setShowUserForm(true);
      } else {
        const errorMessage = response.message || 'Failed to load user details';
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error("Error loading user details:", err);
      let errorMessage = 'Error loading user details';
      if (err.response?.status === 403) {
        errorMessage = 'You do not have admin privileges to access this page';
        toast.error(errorMessage);
        navigate('/');
      } else {
        errorMessage += ': ' + (err.message || 'Unknown error');
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Delete user
  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };
  
  // Change user role
  const handleChangeRole = async (userId, currentRole) => {
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      const response = await updateUserAdmin(userId, { role: newRole });
      
      if (response.success) {
        toast.success(`User role changed to ${newRole} successfully`);
        fetchUsers(currentPage);
      } else {
        const errorMessage = response.message || 'Failed to change user role';
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("Error changing user role:", err);
      let errorMessage = 'Error changing user role';
      if (err.response?.status === 403) {
        errorMessage = 'You do not have admin privileges to access this page';
        toast.error(errorMessage);
        navigate('/');
      } else {
        errorMessage += ': ' + (err.message || 'Unknown error');
        toast.error(errorMessage);
      }
    }
  };
  
  // Submit user form
  const handleUserFormSubmit = async (userData) => {
    try {
      let response;
      
      if (editUser) {
        response = await updateUserAdmin(editUser.id, userData);
        
        if (response.success) {
          toast.success('User updated successfully');
        } else {
          const errorMessage = response.message || 'Failed to update user';
          throw new Error(errorMessage);
        }
      } else {
        response = await createUserAdmin(userData);
        
        if (response.success) {
          toast.success('User created successfully');
        } else {
          const errorMessage = response.message || 'Failed to create user';
          throw new Error(errorMessage);
        }
      }
      
      setShowUserForm(false);
      fetchUsers(currentPage);
    } catch (err) {
      console.error("Error saving user:", err);
      let errorMessage = 'Error saving user';
      if (err.response?.status === 403) {
        errorMessage = 'You do not have admin privileges to access this page';
        toast.error(errorMessage);
        navigate('/');
      } else {
        errorMessage += ': ' + (err.message || 'Unknown error');
        toast.error(errorMessage);
      }
    }
  };
  
  // Confirm delete user
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const response = await deleteUserAdmin(userToDelete.id);
      
      if (response.success) {
        toast.success('User deleted successfully');
        setShowDeleteModal(false);
        fetchUsers(currentPage);
      } else {
        const errorMessage = response.message || 'Failed to delete user';
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      let errorMessage = 'Error deleting user';
      if (err.response?.status === 403) {
        errorMessage = 'You do not have admin privileges to access this page';
        toast.error(errorMessage);
        navigate('/');
      } else {
        errorMessage += ': ' + (err.message || 'Unknown error');
        toast.error(errorMessage);
      }
    }
  };
  
  return (
    <Container className="py-4">
      <Card>
        <Card.Header className="bg-primary text-white">
          <Row className="align-items-center">
            <Col>
              <h4 className="mb-0">User Management</h4>
            </Col>
            <Col xs="auto">
              <Button 
                variant="light" 
                className="d-flex align-items-center" 
                onClick={handleAddUser}
              >
                <FaUserPlus className="me-2" />
                Add User
              </Button>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger">{error}</Alert>
          )}
          
          {loading && users.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : (
            <>
              <UserTable 
                users={users}
                loading={loading}
                totalPages={totalPages}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onEdit={handleEditUser}
                onDelete={handleDeleteUser}
                onChangeRole={handleChangeRole}
              />
              <Pagination>
                {[...Array(totalPages).keys()].map((page) => (
                  <Pagination.Item 
                    key={page} 
                    active={currentPage === page + 1} 
                    onClick={() => handlePageChange(page + 1)}
                  >
                    {page + 1}
                  </Pagination.Item>
                ))}
              </Pagination>
            </>
          )}
        </Card.Body>
      </Card>
      
      {/* User Form Modal */}
      <UserForm 
        show={showUserForm}
        user={editUser}
        onClose={() => setShowUserForm(false)}
        onSubmit={handleUserFormSubmit}
      />
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmation 
        show={showDeleteModal}
        user={userToDelete}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
      />
    </Container>
  );
};

export default AdminDashboard;
