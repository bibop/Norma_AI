import React, { useState } from 'react';
import { Card, Badge, Button, Modal, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { formatFileSize, formatDate } from '../utils/formatters';
import { deleteDocument } from '../services/documents';
import { toast } from 'react-toastify';

const DocumentCard = ({ document, onDelete }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'compliant':
        return <Badge bg="success">Compliant</Badge>;
      case 'non-compliant':
        return <Badge bg="danger">Non-Compliant</Badge>;
      case 'analyzed':
        return <Badge bg="warning">Analyzed</Badge>;
      case 'uploaded':
        return <Badge bg="info">Uploaded</Badge>;
      default:
        return <Badge bg="secondary">Unknown</Badge>;
    }
  };

  const getFileTypeBadge = (fileType) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return <Badge bg="danger">PDF</Badge>;
      case 'docx':
        return <Badge bg="primary">DOCX</Badge>;
      case 'doc':
        return <Badge bg="primary">DOC</Badge>;
      case 'txt':
        return <Badge bg="secondary">TXT</Badge>;
      default:
        return <Badge bg="secondary">{fileType.toUpperCase()}</Badge>;
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleCloseModal = () => {
    setShowDeleteModal(false);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await deleteDocument(document.id);
      
      if (response.success) {
        toast.success('Document deleted successfully');
        if (onDelete) {
          onDelete(document.id);
        }
      } else {
        toast.error(response.message || 'Failed to delete document');
      }
    } catch (err) {
      toast.error('Error deleting document: ' + (err.message || 'Unknown error occurred'));
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <Card className="document-card h-100 card-hover">
        <Card.Body>
          <Card.Title>{document.original_filename}</Card.Title>
          <div className="mb-2">
            {getFileTypeBadge(document.file_type)}
            {' '}
            {getStatusBadge(document.status)}
          </div>
          <Card.Text>
            <small className="text-muted">
              Uploaded: {formatDate(document.upload_date)}
            </small>
            <br />
            <small className="text-muted">
              Size: {formatFileSize(document.file_size)}
            </small>
          </Card.Text>
        </Card.Body>
        <Card.Footer className="bg-transparent d-flex justify-content-between">
          <Link to={`/documents/${document.id}`} className="btn btn-sm btn-outline-primary" style={{ width: '48%' }}>
            View Details
          </Link>
          <Button 
            variant="outline-danger" 
            size="sm" 
            onClick={handleDeleteClick} 
            style={{ width: '48%' }}
          >
            Delete
          </Button>
        </Card.Footer>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete the document "{document.original_filename}"? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                Deleting...
              </>
            ) : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DocumentCard;
