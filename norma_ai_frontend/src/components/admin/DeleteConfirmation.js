import React from 'react';
import { Modal, Button } from 'react-bootstrap';

const DeleteConfirmation = ({ show, onHide, onConfirm, userName }) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Confirm Delete</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to delete the user <strong>{userName}</strong>?
        </p>
        <p className="text-danger">
          This action cannot be undone and all associated data will be permanently removed.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Delete User
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteConfirmation;
