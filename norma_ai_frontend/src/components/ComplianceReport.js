import React, { useState } from 'react';
import { Card, ListGroup, Badge, Alert, Row, Col, Accordion, Button } from 'react-bootstrap';
import { formatDate } from '../utils/formatters';
import api from '../services/api';
import { tokenStorage } from '../utils/tokenUtils';

const ComplianceReport = ({ document }) => {
  const { compliance_results } = document;
  const [isLoading, setIsLoading] = useState(false);

  if (!compliance_results) {
    return (
      <Alert variant="info">
        No compliance analysis has been performed on this document yet.
      </Alert>
    );
  }

  const getSeverityBadge = (severity) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return <Badge bg="danger">High Risk</Badge>;
      case 'medium':
        return <Badge bg="warning" text="dark">Medium Risk</Badge>;
      case 'low':
        return <Badge bg="success">Low Risk</Badge>;
      default:
        return <Badge bg="secondary">Unknown</Badge>;
    }
  };

  const renderStatus = () => {
    const status = compliance_results.compliance_status;
    
    if (status === 'compliant') {
      return (
        <Alert variant="success">
          <Alert.Heading>Compliant with Legal Requirements</Alert.Heading>
          <p>
            No compliance issues were found in this document. The document appears to be compliant
            with current legal requirements.
          </p>
        </Alert>
      );
    } else {
      return (
        <Alert variant="danger">
          <Alert.Heading>Non-Compliant with Legal Requirements</Alert.Heading>
          <p>
            The document has {compliance_results.issues_count} compliance {compliance_results.issues_count === 1 ? 'issue' : 'issues'} 
            that need to be addressed. See details below.
          </p>
        </Alert>
      );
    }
  };

  const handleDownloadPDF = () => {
    setIsLoading(true);
    
    // Add visual feedback
    const notification = document.createElement('div');
    notification.textContent = 'Generating PDF report...';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '15px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '9999';
    document.body.appendChild(notification);
    
    // Create a dedicated function to download using the Blob API
    const downloadPdf = (url) => {
      fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenStorage.getToken()}`
        }
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
          }).catch(e => {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
          });
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
          throw new Error('Server did not return a PDF file');
        }
        
        return response.blob();
      })
      .then(blob => {
        // Create a temporary URL for the blob
        const url = window.URL.createObjectURL(blob);
        
        // Create a link element
        const link = document.createElement('a');
        link.href = url;
        link.download = `compliance_report_${document.title || 'document'}.pdf`;
        
        // Append to body and trigger download
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Update notification
        notification.textContent = 'PDF downloaded successfully!';
        notification.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 3000);
        
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error downloading PDF:', error);
        
        // Update notification
        notification.textContent = `Failed to download PDF: ${error.message}`;
        notification.style.backgroundColor = '#F44336';
        
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 5000);
        
        setIsLoading(false);
      });
    };
    
    // Use a direct URL to the PDF endpoint
    const downloadUrl = `${api.defaults.baseURL}/documents/${document.id}/compliance-report-pdf`;
    console.log('Downloading PDF from:', downloadUrl);
    
    // Start the download
    downloadPdf(downloadUrl);
  };

  return (
    <div className="compliance-report">
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="m-0">Compliance Report</h5>
          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={handleDownloadPDF}
            disabled={isLoading}
          >
            {isLoading ? (
              <i className="bi bi-spinner me-1"></i>
            ) : (
              <i className="bi bi-file-earmark-pdf me-1"></i>
            )}
            {isLoading ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </Card.Header>
        <Card.Body>
          <h4 className="mb-3">Compliance Report</h4>
          {renderStatus()}
          <Card className="mb-4">
            <Card.Header>
              <strong>Summary</strong>
            </Card.Header>
            <Card.Body>
              <p>{compliance_results.summary}</p>
              <div className="d-flex justify-content-between">
                <span>
                  <strong>Document ID:</strong> {document.id}
                </span>
                <span>
                  <strong>Analysis Date:</strong> {formatDate(document.last_analyzed)}
                </span>
              </div>
            </Card.Body>
          </Card>
          {compliance_results.issues && compliance_results.issues.length > 0 && (
            <Card>
              <Card.Header>
                <strong>Compliance Issues</strong>
              </Card.Header>
              <Accordion defaultActiveKey="0">
                {compliance_results.issues.map((issue, index) => (
                  <Accordion.Item eventKey={index.toString()} key={index}>
                    <Accordion.Header>
                      <div className="d-flex justify-content-between w-100 me-4">
                        <span>{issue.law}</span>
                        {getSeverityBadge(issue.severity)}
                      </div>
                    </Accordion.Header>
                    <Accordion.Body>
                      <Row className="mb-3">
                        <Col xs={12}>
                          <h6 className="text-muted mb-2">Issue Description</h6>
                          <p>{issue.description}</p>
                        </Col>
                      </Row>
                      <Row className="mb-3">
                        <Col xs={12}>
                          <h6 className="text-muted mb-2">Non-Compliant Text</h6>
                          <Card>
                            <Card.Body className="bg-light">
                              <blockquote className="blockquote mb-0">
                                <p className="font-italic">{issue.original_text || "Non-compliant text not specified"}</p>
                                <footer className="blockquote-footer">Page {issue.page}, Section {issue.section || "Unknown"}</footer>
                              </blockquote>
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                      <Row>
                        <Col xs={12}>
                          <h6 className="text-muted mb-2">Recommendation</h6>
                          <Card className="border-success">
                            <Card.Body>
                              <h6 className="text-success mb-2">Proposed Language Change</h6>
                              <p>{issue.recommendations}</p>
                              {issue.suggested_text && (
                                <div className="mt-3">
                                  <h6 className="text-success mb-2">Compliant Language</h6>
                                  <div className="p-3 bg-success bg-opacity-10 border border-success rounded">
                                    <p className="mb-0 fw-bold">{issue.suggested_text}</p>
                                  </div>
                                </div>
                              )}
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default ComplianceReport;
