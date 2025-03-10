from datetime import datetime
from models import db
from flask import current_app
import bcrypt

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    company = db.Column(db.String(100), nullable=True)
    role = db.Column(db.String(20), default='user')  # 'user' or 'admin'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with documents
    documents = db.relationship('Document', backref='owner', lazy=True)
    
    def set_password(self, password):
        """Hash the password and store it in the database."""
        salt = current_app.config['PASSWORD_SALT'].encode('utf-8')
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        self.password_hash = hashed.decode('utf-8')
    
    def check_password(self, password):
        """Check if the password matches the hashed password in the database."""
        salt = current_app.config['PASSWORD_SALT'].encode('utf-8')
        return bcrypt.checkpw(password.encode('utf-8'), 
                             self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        """Convert user object to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'company': self.company,
            'role': self.role,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'password_hash': self.password_hash  # For debugging purposes
        }
