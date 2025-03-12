from flask_sqlalchemy import SQLAlchemy

# Create SQLAlchemy instance
db = SQLAlchemy()

# Import models to make them available
from models.user import User
from models.document import Document
