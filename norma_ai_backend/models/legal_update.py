from datetime import datetime
from models import db

class LegalUpdate(db.Model):
    """Model for legal updates in the system"""
    __tablename__ = 'legal_updates'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    summary = db.Column(db.Text, nullable=False)
    content = db.Column(db.Text)
    jurisdiction = db.Column(db.String(100))
    publication_date = db.Column(db.Date, default=datetime.utcnow)
    category = db.Column(db.String(50))
    source = db.Column(db.String(200))
    url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<LegalUpdate {self.id}: {self.title}>'
    
    def to_dict(self):
        """Convert model to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'title': self.title,
            'summary': self.summary,
            'content': self.content,
            'jurisdiction': self.jurisdiction,
            'publication_date': self.publication_date.isoformat() if self.publication_date else None,
            'category': self.category,
            'source': self.source,
            'url': self.url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
