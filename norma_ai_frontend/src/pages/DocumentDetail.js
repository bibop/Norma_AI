import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Modal } from 'react-bootstrap';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDocumentDetails, deleteDocument, reanalyzeDocument, getAvailableJurisdictions } from '../services/documents';
import ComplianceReport from '../components/ComplianceReport';
import JurisdictionSelect from '../components/JurisdictionSelect';
import { formatFileSize, formatDate } from '../utils/formatters';
import { FiFileText, FiDownload, FiArrowLeft, FiRefreshCw, FiTrash2 } from 'react-icons/fi';

const DocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(null);
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);

  useEffect(() => {
    const fetchDocumentDetails = async () => {
      try {
        setLoading(true);
        const response = await getDocumentDetails(id);
        
        if (response.success) {
          setDocument(response.document);
          setSelectedJurisdiction(response.document.jurisdiction || 'us');
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

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      const response = await deleteDocument(id);
      
      if (response.success) {
        // Close modal and redirect to documents page
        setShowDeleteModal(false);
        navigate('/documents', { 
          state: { 
            notification: {
              type: 'success',
              message: 'Document deleted successfully.'
            }
          }
        });
      } else {
        throw new Error(response.message || 'Failed to delete document');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while deleting the document');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleJurisdictionChange = (jurisdiction) => {
    setSelectedJurisdiction(jurisdiction);
  };

  const openReanalyzeModal = () => {
    setSelectedJurisdiction(document.jurisdiction || 'us');
    setShowReanalyzeModal(true);
  };

  const handleReanalyze = async () => {
    try {
      setReanalyzing(true);
      setShowReanalyzeModal(false);
      const response = await reanalyzeDocument(id, selectedJurisdiction);
      
      if (response.success) {
        // Update document state with new analysis
        setDocument(response.document);
      } else {
        throw new Error(response.message || 'Failed to re-analyze document');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while re-analyzing the document');
    } finally {
      setReanalyzing(false);
    }
  };

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
                  <strong>Jurisdiction:</strong> {document.jurisdiction ? document.jurisdiction.toUpperCase() : 'Not specified'}
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
                <Button 
                  variant="outline-primary" 
                  onClick={openReanalyzeModal} 
                  disabled={reanalyzing}
                >
                  {reanalyzing ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                      Re-Analyzing...
                    </>
                  ) : (
                    <>
                      <FiRefreshCw className="me-2" /> Re-Analyze Document
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline-danger" 
                  onClick={() => setShowDeleteModal(true)}
                >
                  <FiTrash2 className="me-2" /> Delete Document
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={8}>
          <Card>
            <Card.Header>
              <strong>Compliance Report</strong>
            </Card.Header>
            <Card.Body>
              {document.compliance_results ? (
                <ComplianceReport document={document} />
              ) : (
                <Alert variant="info">
                  This document has not been analyzed yet. Click "Re-Analyze Document" to run the compliance check.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this document?</p>
          <p className="text-danger"><strong>This action cannot be undone.</strong></p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                Deleting...
              </>
            ) : (
              'Delete Document'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Re-analyze Confirmation Modal with Jurisdiction Selection */}
      <Modal show={showReanalyzeModal} onHide={() => setShowReanalyzeModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Re-Analyze Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Select the jurisdiction for compliance analysis:</p>
          
          <JurisdictionSelect 
            selectedJurisdiction={selectedJurisdiction}
            onChange={handleJurisdictionChange}
          />
          
          <p className="mt-3">
            The document will be analyzed according to the laws and regulations of the selected jurisdiction.
            The compliance report will be generated in English for US native speakers.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReanalyzeModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleReanalyze}
          >
            Re-Analyze Document
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default DocumentDetail;
