import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert } from 'react-bootstrap';
import { useParams, Link } from 'react-router-dom';
import { getDocumentDetails } from '../services/documents';
import ComplianceReport from '../components/ComplianceReport';
import { formatFileSize, formatDate } from '../utils/formatters';
import { FiFileText, FiDownload, FiArrowLeft } from 'react-icons/fi';

const DocumentDetail = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocumentDetails = async () => {
      try {
        setLoading(true);
        const response = await getDocumentDetails(id);
        
        if (response.success) {
          setDocument(response.document);
        } else {
          throw new Error(response.message || 'Failed to fetch document details');
        }
      } catch (err) {
        setError(err.message || 'An error occurred while fetching document details');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentDetails();
  }, [id]);

  if (loading) {
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading document details...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="my-5">
        <Alert variant="danger">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
          <hr />
          <div className="d-flex justify-content-end">
            <Link to="/documents">
              <Button variant="outline-danger">
                <FiArrowLeft className="me-2" /> Back to Documents
              </Button>
            </Link>
          </div>
        </Alert>
      </Container>
    );
  }

  if (!document) {
    return (
      <Container className="my-5">
        <Alert variant="warning">
          <Alert.Heading>Document Not Found</Alert.Heading>
          <p>The document you are looking for does not exist or you don't have permission to view it.</p>
          <hr />
          <div className="d-flex justify-content-end">
            <Link to="/documents">
              <Button variant="outline-warning">
                <FiArrowLeft className="me-2" /> Back to Documents
              </Button>
            </Link>
          </div>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{document.original_filename}</h2>
        <Link to="/documents">
          <Button variant="outline-primary">
            <FiArrowLeft className="me-2" /> Back to Documents
          </Button>
        </Link>
      </div>
      
      <Row>
        <Col lg={4}>
          <Card className="mb-4">
            <Card.Header>
              <strong>Document Information</strong>
            </Card.Header>
            <Card.Body>
              <Card.Text>
                <div className="mb-2">
                  <FiFileText className="me-2" />
                  <strong>Document ID:</strong> {document.id}
                </div>
                <div className="mb-2">
                  <strong>Original Filename:</strong> {document.original_filename}
                </div>
                <div className="mb-2">
                  <strong>File Type:</strong> {document.file_type.toUpperCase()}
                </div>
                <div className="mb-2">
                  <strong>File Size:</strong> {formatFileSize(document.file_size)}
                </div>
                <div className="mb-2">
                  <strong>Upload Date:</strong> {formatDate(document.upload_date)}
                </div>
                <div className="mb-2">
                  <strong>Last Analyzed:</strong> {document.last_analyzed ? formatDate(document.last_analyzed) : 'Not analyzed yet'}
                </div>
                <div className="mb-2">
                  <strong>Status:</strong>{' '}
                  <span className={`compliance-tag compliance-${document.status}`}>
                    {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                  </span>
                </div>
              </Card.Text>
            </Card.Body>
            <Card.Footer>
              <Button variant="primary" className="w-100">
                <FiDownload className="me-2" /> Download Document
              </Button>
            </Card.Footer>
          </Card>
          
          <Card>
            <Card.Header>
              <strong>Actions</strong>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="outline-primary">Re-Analyze Document</Button>
                <Button variant="outline-danger">Delete Document</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={8}>
          <ComplianceReport document={document} />
        </Col>
      </Row>
    </Container>
  );
};

export default DocumentDetail;
