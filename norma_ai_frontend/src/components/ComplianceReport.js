import React from 'react';
import { Card, ListGroup, Badge, Alert } from 'react-bootstrap';
import { formatDate } from '../utils/formatters';

const ComplianceReport = ({ document }) => {
  const { compliance_results } = document;

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
          <Alert.Heading>Compliant with Italian Law</Alert.Heading>
          <p>
            No compliance issues were found in this document. The document appears to be compliant
            with current Italian legal requirements.
          </p>
        </Alert>
      );
    } else {
      return (
        <Alert variant="danger">
          <Alert.Heading>Non-Compliant with Italian Law</Alert.Heading>
          <p>
            The document has {compliance_results.issues_count} compliance {compliance_results.issues_count === 1 ? 'issue' : 'issues'} 
            that need to be addressed. See details below.
          </p>
        </Alert>
      );
    }
  };

  return (
    <div className="compliance-report">
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
          <ListGroup variant="flush">
            {compliance_results.issues.map((issue, index) => (
              <ListGroup.Item key={index}>
                <div className="d-flex justify-content-between mb-2">
                  <h6 className="mb-0">{issue.law}</h6>
                  {getSeverityBadge(issue.severity)}
                </div>
                <p>{issue.description}</p>
                <div className="d-flex justify-content-between text-muted small">
                  <span>Page: {issue.page}</span>
                  <span>Recommendation: {issue.recommendations}</span>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card>
      )}
    </div>
  );
};

export default ComplianceReport;
