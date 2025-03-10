import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { formatFileSize, formatDate } from '../utils/formatters';

const DocumentCard = ({ document }) => {
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

  return (
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
      <Card.Footer className="bg-transparent">
        <Link to={`/documents/${document.id}`} className="btn btn-sm btn-outline-primary w-100">
          View Details
        </Link>
      </Card.Footer>
    </Card>
  );
};

export default DocumentCard;
