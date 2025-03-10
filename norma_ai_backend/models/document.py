from datetime import datetime
from models import db

class Document(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)  # PDF, DOCX, etc.
    file_size = db.Column(db.Integer, nullable=False)  # Size in bytes
    status = db.Column(db.String(20), default='uploaded')  # uploaded, analyzed, compliant, non-compliant
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    last_analyzed = db.Column(db.DateTime, nullable=True)
    
    # Compliance results as JSON
    compliance_results = db.Column(db.JSON, nullable=True)
    
    def to_dict(self):
        """Convert document object to dictionary."""
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'status': self.status,
            'user_id': self.user_id,
            'upload_date': self.upload_date.isoformat(),
            'last_analyzed': self.last_analyzed.isoformat() if self.last_analyzed else None,
            'compliance_results': self.compliance_results
        }
