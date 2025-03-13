import React, { useState, useRef, useEffect } from 'react';
import { Form, Button, Alert, ProgressBar } from 'react-bootstrap';
import { uploadDocument } from '../services/documents';
import { toast } from 'react-toastify';
import { FiUpload } from 'react-icons/fi';
import JurisdictionSelect from './JurisdictionSelect';

const DocumentUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('us');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile || null);
    setError(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleJurisdictionChange = (jurisdiction) => {
    setSelectedJurisdiction(jurisdiction);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    // Check file type
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      setError(`File type not allowed. Please upload one of: ${allowedTypes.join(', ')}`);
      return;
    }
    
    // Check file size (max 16MB)
    const maxSize = 16 * 1024 * 1024; // 16MB in bytes
    if (file.size > maxSize) {
      setError('File is too large. Maximum size is 16MB');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prevProgress) => {
          const newProgress = prevProgress + 5;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 300);
      
      // Pass both file and selected jurisdiction
      const response = await uploadDocument(file, selectedJurisdiction);
      
      clearInterval(progressInterval);
      
      if (response.success) {
        setUploadProgress(100);
        toast.success('Document uploaded successfully');
        setFile(null);
        
        if (onUploadSuccess) {
          onUploadSuccess(response.document);
        }
      } else {
        if (response.isNetworkError) {
          setError('SERVER IS UNREACHABLE. Please check the connection and try again.');
          toast.error('Connection to server lost. Please check your network connection.');
        } else {
          setError(response.message || 'Upload failed');
          toast.error(response.message || 'Upload failed');
        }
      }
    } catch (err) {
      console.error('Document upload error:', err);
      setError(err.message || 'Failed to upload document. Please try again.');
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="document-upload-container">
      <Form onSubmit={handleSubmit}>
        <div 
          className={`upload-area ${isUploading ? 'uploading' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt"
          />
          
          {isUploading ? (
            <div className="upload-progress">
              <ProgressBar 
                now={uploadProgress} 
                label={`${uploadProgress}%`} 
                variant={error ? "danger" : "primary"} 
              />
              <div className="upload-status">
                {error ? 'Upload failed' : 'Uploading...'}
              </div>
            </div>
          ) : file ? (
            <div className="file-selected">
              <FiUpload className="upload-icon" />
              <div className="file-name">{file.name}</div>
              <div className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</div>
            </div>
          ) : (
            <div className="upload-prompt">
              <FiUpload className="upload-icon" />
              <div className="upload-text">
                <strong>Click or drag & drop</strong> to upload a document
              </div>
              <div className="upload-hint">
                Supports PDF, DOC, DOCX, TXT (Max 16MB)
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
            {error.includes('SERVER IS UNREACHABLE') && (
              <div className="mt-2">
                <strong>Troubleshooting tips:</strong>
                <ul>
                  <li>Check if the server is running</li>
                  <li>Verify your network connection</li>
                  <li>Try refreshing the page</li>
                </ul>
              </div>
            )}
          </Alert>
        )}
        
        <div className="mt-3">
          <JurisdictionSelect 
            value={selectedJurisdiction} 
            onChange={handleJurisdictionChange} 
          />
        </div>
        
        <Button 
          type="submit" 
          variant="primary" 
          className="mt-3 w-100" 
          disabled={isUploading || !file}
        >
          {isUploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </Form>
    </div>
  );
};

export default DocumentUpload;
