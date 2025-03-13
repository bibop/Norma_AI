from datetime import datetime
from models import db
from flask import current_app
import bcrypt
import json

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    company = db.Column(db.String(100), nullable=True)
    role = db.Column(db.String(20), default='user')  # 'user' or 'admin'
    preferred_jurisdiction = db.Column(db.String(50), default='us')  # Default to US
    # Stores multiple jurisdictions as a JSON string
    preferred_jurisdictions = db.Column(db.Text, default='["us"]')  
    # Stores preferred legal sources as a JSON string
    preferred_legal_sources = db.Column(db.Text, default='["official"]')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with documents
    documents = db.relationship('Document', backref='owner', lazy=True)
    
    def set_password(self, password):
        """Hash the password and store it in the database.
        
        Automatically generates a secure salt and creates a hash of the password.
        """
        # Generate a secure salt and let bcrypt handle it internally
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12))
        self.password_hash = hashed.decode('utf-8')
    
    def check_password(self, password):
        """Check if the password matches the hashed password in the database.
        
        Verifies if the provided password matches the stored hash.
        """
        # bcrypt internally handles extracting the salt from the hash
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )
    
    def get_preferred_jurisdictions(self):
        """Get the list of preferred jurisdictions."""
        try:
            return json.loads(self.preferred_jurisdictions)
        except (TypeError, json.JSONDecodeError):
            # Default to a list with the primary jurisdiction if there's an error
            return [self.preferred_jurisdiction]
    
    def set_preferred_jurisdictions(self, jurisdictions):
        """Set the list of preferred jurisdictions."""
        if not jurisdictions:
            jurisdictions = [self.preferred_jurisdiction]
        self.preferred_jurisdictions = json.dumps(jurisdictions)
    
    def get_preferred_legal_sources(self):
        """Get the list of preferred legal update sources."""
        try:
            return json.loads(self.preferred_legal_sources)
        except (TypeError, json.JSONDecodeError):
            # Default to official sources if there's an error
            return ["official"]
    
    def set_preferred_legal_sources(self, sources):
        """Set the list of preferred legal update sources."""
        if not sources:
            sources = ["official"]
        self.preferred_legal_sources = json.dumps(sources)
    
    def to_dict(self):
        """Convert user object to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'company': self.company,
            'role': self.role,
            'preferred_jurisdiction': self.preferred_jurisdiction,
            'preferred_jurisdictions': self.get_preferred_jurisdictions(),
            'preferred_legal_sources': self.get_preferred_legal_sources(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
