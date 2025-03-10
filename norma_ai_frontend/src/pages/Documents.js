import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert, Spinner, Card } from 'react-bootstrap';
import { getUserDocuments } from '../services/documents';
import DocumentCard from '../components/DocumentCard';
import DocumentUpload from '../components/DocumentUpload';
import LegalUpdates from '../components/LegalUpdates';

const Documents = ({ user }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await getUserDocuments();
      
      if (response.success) {
        setDocuments(response.documents);
      } else {
        throw new Error(response.message || 'Failed to fetch documents');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadSuccess = (newDocument) => {
    setDocuments([newDocument, ...documents]);
  };

  return (
    <Container>
      <h2 className="mb-4">Document Management</h2>
      
      <Row>
        <Col lg={8}>
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Body>
                  <DocumentUpload onUploadSuccess={handleUploadSuccess} />
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          <h3 className="mb-3">Your Documents</h3>
          
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-2">Loading your documents...</p>
            </div>
          ) : error ? (
            <Alert variant="danger">
              <p>{error}</p>
            </Alert>
          ) : documents.length === 0 ? (
            <Alert variant="info">
              <p>You haven't uploaded any documents yet. Use the upload form to get started.</p>
            </Alert>
          ) : (
            <Row xs={1} md={2} className="g-4">
              {documents.map((document) => (
                <Col key={document.id}>
                  <DocumentCard document={document} />
                </Col>
              ))}
            </Row>
          )}
        </Col>
        
        <Col lg={4}>
          <div className="mb-4">
            <h4 className="mb-3">User Information</h4>
            <Card>
              <Card.Body>
                <p><strong>Name:</strong> {user ? `${user.first_name} ${user.last_name}` : 'User'}</p>
                <p><strong>Email:</strong> {user ? user.email : 'user@example.com'}</p>
                <p><strong>Company:</strong> {user && user.company ? user.company : 'Not specified'}</p>
                <p><strong>Role:</strong> {user ? user.role : 'user'}</p>
              </Card.Body>
            </Card>
          </div>
          
          <div className="mb-4">
            <h4 className="mb-3">Legal Updates</h4>
            <LegalUpdates />
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Documents;
