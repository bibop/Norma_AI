import os
from datetime import timedelta

class Config:
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'postgresql://bibop:bibopbibop1@localhost/italian_law_compliance')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 's5hzT!Sh0VC%MUdGqaJye')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    
    # App configuration
    SECRET_KEY = os.environ.get('SECRET_KEY', '%8@#bB8D8ditTo7d4Q5i')
    
    # Security
    PASSWORD_SALT = os.environ.get('PASSWORD_SALT', 'your_password_salt_here')
    
    # Uploads
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload
    
    # RSS Feed
    RSS_FEED_URL = 'https://www.gazzettaufficiale.it/rss/guri.xml'
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
