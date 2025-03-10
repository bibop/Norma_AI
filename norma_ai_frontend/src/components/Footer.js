import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer mt-auto py-3 bg-light">
      <Container>
        <Row>
          <Col md={4} className="mb-3 mb-md-0">
            <h5>NORMA AI</h5>
            <p className="text-muted">
              Italian Law Compliance Management Tool
            </p>
          </Col>
          <Col md={4} className="mb-3 mb-md-0">
            <h5>Links</h5>
            <ul className="list-unstyled">
              <li><a href="/" className="text-decoration-none">Home</a></li>
              <li><a href="/documents" className="text-decoration-none">Documents</a></li>
              <li><a href="https://www.gazzettaufficiale.it/" target="_blank" rel="noopener noreferrer" className="text-decoration-none">Gazzetta Ufficiale</a></li>
            </ul>
          </Col>
          <Col md={4}>
            <h5>Contact</h5>
            <address className="text-muted">
              <p>Email: support@norma-ai.it</p>
              <p>Phone: +39 02 1234 5678</p>
              <p>Address: Via Roma 123, 00100 Rome, Italy</p>
            </address>
          </Col>
        </Row>
        <hr />
        <Row>
          <Col className="text-center">
            <p className="text-muted">© {currentYear} NORMA AI. All rights reserved.</p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
