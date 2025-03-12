import React, { useState } from 'react';
import { Table, Button, Pagination, Spinner, Badge } from 'react-bootstrap';
import { FaEdit, FaTrash, FaUserShield, FaUser } from 'react-icons/fa';

const UserTable = ({ users, loading, totalPages, currentPage, onPageChange, onEdit, onDelete, onChangeRole }) => {
  const renderRoleBadge = (role) => {
    if (role === 'admin') {
      return <Badge bg="danger"><FaUserShield /> Admin</Badge>;
    }
    return <Badge bg="secondary"><FaUser /> User</Badge>;
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPages = 5; // Number of page links to show
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return pageNumbers;
  };

  return (
    <>
      <div className="table-responsive">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-4">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4">No users found</td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{`${user.first_name} ${user.last_name}`}</td>
                  <td>{user.email}</td>
                  <td>{user.company || '-'}</td>
                  <td>{renderRoleBadge(user.role)}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        onClick={() => onEdit(user)}
                        title="Edit user"
                      >
                        <FaEdit />
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm" 
                        onClick={() => onDelete(user.id)}
                        title="Delete user"
                      >
                        <FaTrash />
                      </Button>
                      <Button 
                        variant={user.role === 'admin' ? "outline-secondary" : "outline-danger"} 
                        size="sm" 
                        onClick={() => onChangeRole(user.id, user.role === 'admin' ? 'user' : 'admin')}
                        title={user.role === 'admin' ? "Demote to user" : "Promote to admin"}
                      >
                        {user.role === 'admin' ? <FaUser /> : <FaUserShield />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
      
      {totalPages > 1 && (
        <Pagination className="justify-content-center mt-4">
          <Pagination.First
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          />
          <Pagination.Prev
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          />
          
          {getPageNumbers().map(number => (
            <Pagination.Item
              key={number}
              active={number === currentPage}
              onClick={() => onPageChange(number)}
            >
              {number}
            </Pagination.Item>
          ))}
          
          <Pagination.Next
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          />
          <Pagination.Last
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
          />
        </Pagination>
      )}
    </>
  );
};

export default UserTable;
