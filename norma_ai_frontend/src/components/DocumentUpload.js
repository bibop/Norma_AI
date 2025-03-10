import React, { useState, useRef } from 'react';
import { Form, Button, Alert, ProgressBar } from 'react-bootstrap';
import { uploadDocument } from '../services/documents';
import { toast } from 'react-toastify';
import { FiUpload } from 'react-icons/fi';

const DocumentUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
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
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prevProgress) => {
          const newProgress = prevProgress + 10;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 300);
      
      const response = await uploadDocument(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.success) {
        toast.success('Document uploaded successfully');
        setFile(null);
        setIsUploading(false);
        setUploadProgress(0);
        
        if (onUploadSuccess) {
          onUploadSuccess(response.document);
        }
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload document. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div>
      <h4 className="mb-3">Upload Document</h4>
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Form onSubmit={handleSubmit}>
        <div 
          className="upload-area" 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          <FiUpload size={40} className="mb-3 text-muted" />
          <p>Drag and drop a file here, or click to browse</p>
          <p className="text-muted small">Supported formats: PDF, DOC, DOCX, TXT (Max 16MB)</p>
          
          {file && (
            <p className="mt-3">
              <strong>Selected file:</strong> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt"
            className="d-none"
          />
        </div>
        
        {isUploading && (
          <div className="mt-3">
            <ProgressBar 
              now={uploadProgress} 
              label={`${uploadProgress}%`} 
              animated 
            />
            <p className="text-center mt-1">
              {uploadProgress < 100 ? 'Uploading...' : 'Processing document...'}
            </p>
          </div>
        )}
        
        <Button 
          type="submit" 
          variant="primary" 
          className="mt-3 w-100"
          disabled={!file || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </Form>
    </div>
  );
};

export default DocumentUpload;
