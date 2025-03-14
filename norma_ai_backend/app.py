import os
from flask import Flask, jsonify, request, make_response, send_from_directory
import flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from dotenv import load_dotenv
from config import Config
from models import db, User, Document, LegalUpdate
from routes.auth import auth_bp
from routes.users import users_bp
from routes.documents import documents_bp
from routes.admin import admin_bp
from routes.profile import profile_bp
from routes.legal_updates import legal_updates_bp
from datetime import datetime, timedelta
import logging
import platform
import redis
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import time
import uuid
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE, validates, post_load
from functools import wraps
from flask_caching import Cache
import secrets
import bleach
import re

# Custom exception for API errors
class APIError(Exception):
    """Custom exception for API errors with status code and optional payload"""
    def __init__(self, message, status_code=400, payload=None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload

# Validation schemas
class BaseSchema(Schema):
    """Base schema with common configuration"""
    class Meta:
        unknown = EXCLUDE  # Ignore unknown fields
        ordered = True    # Maintain field order

    @staticmethod
    def sanitize_string(value):
        """Sanitize string input"""
        if value is None:
            return None
        return bleach.clean(str(value).strip(), tags=[], strip=True)

class PaginationSchema(BaseSchema):
    """Schema for pagination parameters"""
    page = fields.Int(validate=validate.Range(min=1), missing=1)
    per_page = fields.Int(validate=validate.Range(min=1, max=100), missing=10)

class ProfileUpdateSchema(BaseSchema):
    """Schema for profile update validation"""
    first_name = fields.Str(required=True, validate=[
        validate.Length(min=1, max=50),
        validate.Regexp(r'^[a-zA-Z\s\'-]+$', error='Invalid characters in first name')
    ])
    last_name = fields.Str(required=True, validate=[
        validate.Length(min=1, max=50),
        validate.Regexp(r'^[a-zA-Z\s\'-]+$', error='Invalid characters in last name')
    ])
    email = fields.Email(required=True)
    company = fields.Str(validate=validate.Length(max=100))
    preferences = fields.Dict(keys=fields.Str(), values=fields.Raw())

    @validates('email')
    def validate_email(self, value):
        """Additional email validation"""
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
            raise ValidationError('Invalid email format')

class DocumentSchema(BaseSchema):
    """Schema for document validation"""
    title = fields.Str(required=True, validate=[
        validate.Length(min=1, max=200),
        validate.Regexp(r'^[\w\s\-.,!?&()]+$', error='Invalid characters in title')
    ])
    type = fields.Str(required=True, validate=validate.OneOf(['report', 'policy', 'handbook']))
    content = fields.Str(required=True)
    status = fields.Str(validate=validate.OneOf(['draft', 'final', 'approved']))
    
    @post_load
    def sanitize_data(self, data, **kwargs):
        """Sanitize input data"""
        data['title'] = self.sanitize_string(data['title'])
        data['content'] = bleach.clean(
            data['content'],
            tags=['p', 'b', 'i', 'u', 'em', 'strong', 'br', 'ul', 'ol', 'li'],
            attributes={},
            strip=True
        )
        return data

# Security decorators and utilities
def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            raise APIError('Authentication required', status_code=401)
        try:
            # Extract and validate token
            token = auth_header.split(' ')[1]
            # Add your token validation logic here
            if not token:
                raise APIError('Invalid token', status_code=401)
            return f(*args, **kwargs)
        except Exception as e:
            raise APIError(f'Authentication failed: {str(e)}', status_code=401)
    return decorated

def validate_request_data(schema_class):
    """Enhanced decorator to validate and sanitize request data"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            schema = schema_class()
            
            # Validate query parameters if they exist
            if request.args and hasattr(schema, 'validate_query_params'):
                try:
                    query_params = schema.validate_query_params(request.args)
                    kwargs['query_params'] = query_params
                except ValidationError as err:
                    raise APIError('Invalid query parameters', payload=err.messages)
            
            # Validate request body if it exists
            if request.is_json and request.get_json():
                try:
                    data = schema.load(request.get_json())
                    kwargs['validated_data'] = data
                except ValidationError as err:
                    raise APIError('Invalid request data', payload=err.messages)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Cache configuration
def configure_cache(app):
    """Configure Flask-Cache with simple memory cache for development"""
    try:
        # Check if Redis URL is provided, otherwise default to simple cache
        if os.environ.get('REDIS_URL'):
            cache = Cache(app, config={
                'CACHE_TYPE': 'redis',
                'CACHE_REDIS_URL': os.environ.get('REDIS_URL'),
                'CACHE_DEFAULT_TIMEOUT': 300,
                'CACHE_KEY_PREFIX': 'norma_ai_',
                'CACHE_REDIS_DB': 0,
                'CACHE_OPTIONS': {
                    'socket_timeout': 2,
                    'socket_connect_timeout': 2,
                    'retry_on_timeout': True,
                    'max_connections': 10
                }
            })
            # Test the cache connection
            cache.get('test_key')
            app.logger.info("Using Redis cache")
            return cache
        else:
            # Use simple cache if Redis URL is not provided
            raise Exception("No Redis URL provided, using simple cache")
    except Exception as e:
        app.logger.warning(f"Using simple memory cache: {e}")
        # Fallback to simple cache
        return Cache(app, config={'CACHE_TYPE': 'SimpleCache'})

# Rate limiting configuration
def configure_rate_limiting(app):
    """Configure rate limiting for API endpoints"""
    try:
        # Use in-memory storage for rate limiting (not suitable for production)
        limiter = Limiter(
            storage_uri="memory://",
            app=app,
            key_func=get_remote_address,
            default_limits=["200 per minute"],  # Increased default limit
            strategy="fixed-window",
            # Exempt certain paths from rate limiting
            default_limits_exempt_when=lambda: request.method == 'OPTIONS' or 
                                              request.path.startswith('/api/public/')
        )
        logger.info("Rate limiting configured with in-memory storage")
        return limiter
    except Exception as e:
        logger.error(f"Rate limiting initialization failed: {e}")
        return None

# CORS configuration
def configure_cors(app):
    """Configure CORS with proper settings for credentials"""
    try:
        # Configure CORS to allow requests from both localhost and 127.0.0.1 on any port
        # Note: When using credentials, we CANNOT use a wildcard origin
        cors = CORS(
            app,
            resources={r"/api/*": {"origins": [
                "http://localhost:*", 
                "http://127.0.0.1:*",
                "http://127.0.0.1:53277",  # Explicitly add the React dev server port
                "http://localhost:53277",
                "null"  # Allow requests from file:// protocol which have 'null' origin
            ]}},
            supports_credentials=True,
            allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Test-Connection", "X-Debug-Client"],
            expose_headers=["Content-Type", "X-Total-Count"]
        )
        
        # Add a hook to customize CORS headers for each response
        @app.after_request
        def after_request(response):
            # Get the request origin
            origin = request.headers.get('Origin', '')
            
            # Default to no CORS if no origin (e.g., same-origin requests)
            if not origin:
                return response
                
            # Always remove any existing CORS headers to avoid duplicates
            for header in ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials',
                          'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers']:
                if header in response.headers:
                    del response.headers[header]
            
            # Set proper CORS headers
            if origin.startswith(('http://localhost:', 'http://127.0.0.1:')):
                # For known origins, set the exact origin (required for credentials)
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-Test-Connection, X-Debug-Client'
            elif origin == 'null':
                # For file:// protocol (used by test tools), allow null origin
                response.headers['Access-Control-Allow-Origin'] = 'null'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-Test-Connection, X-Debug-Client'
            else:
                # For unknown origins, use wildcard but disable credentials
                response.headers['Access-Control-Allow-Origin'] = '*'
                response.headers['Access-Control-Allow-Credentials'] = 'false'
                
            # Common CORS headers for all responses
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-Test-Connection, X-Debug-Client'
            
            # Log the origin and headers for debugging
            if request.method == 'OPTIONS':
                app.logger.info(f"CORS preflight for origin: {origin}")
                app.logger.info(f"CORS headers: {dict(response.headers)}")
                
            return response
            
        logger.info("CORS configured successfully")
        return cors
    except Exception as e:
        logger.error(f"CORS configuration failed: {e}")
        return None

# Cached endpoint decorator with error handling
def cached_endpoint(timeout=300):
    """Decorator to cache endpoint responses with error handling"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(app, 'cache') or not app.cache:
                return f(*args, **kwargs)
            
            try:
                # Include user info in cache key if authenticated
                user_id = get_jwt_identity() if request.headers.get('Authorization') else 'anonymous'
                cache_key = f"cache:{user_id}:{request.path}:{request.query_string.decode()}"
                
                response = app.cache.get(cache_key)
                if response is None:
                    response = f(*args, **kwargs)
                    try:
                        app.cache.set(cache_key, response, timeout=timeout)
                    except Exception as e:
                        app.logger.warning(f"Failed to set cache: {e}")
                return response
            except Exception as e:
                app.logger.error(f"Cache error: {e}")
                return f(*args, **kwargs)
        return decorated_function
    return decorator

# Load environment variables from .env file if it exists
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Required environment variables check
required_env_vars = ['JWT_SECRET_KEY', 'DATABASE_URL']
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars and os.environ.get('FLASK_ENV') == 'production':
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

def create_app(config_class=Config):
    app = Flask(__name__, static_folder='../static', static_url_path='')
    
    # Environment-specific configuration
    app_env = os.environ.get('FLASK_ENV', 'development')
    if app_env == 'production':
        database_url = os.environ.get('DATABASE_URL')
        if database_url and database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        # Add connection pooling configuration
        if database_url:
            from sqlalchemy import create_engine
            from sqlalchemy.pool import QueuePool
            
            engine = create_engine(
                database_url,
                poolclass=QueuePool,
                pool_size=10,
                max_overflow=20,
                pool_timeout=30,
                pool_recycle=1800,  # Recycle connections after 30 minutes
                pool_pre_ping=True  # Enable connection health checks
            )
            app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
                'pool_size': 10,
                'pool_recycle': 1800,
                'pool_timeout': 30,
                'max_overflow': 20
            }
        
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
        app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
        app.config['DEBUG'] = False
        app.config['TESTING'] = False
    else:
        app.config.from_object(config_class)
        # Development database settings
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_size': 5,
            'pool_recycle': 1800,
            'pool_timeout': 30,
            'max_overflow': 10
        }

    # Security configurations
    app.config.update(
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY') or secrets.token_hex(32),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=1),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=30),
        JWT_ALGORITHM='HS256',
        JWT_TOKEN_LOCATION=['headers'],
        JWT_HEADER_NAME='Authorization',
        JWT_HEADER_TYPE='Bearer',
        JWT_COOKIE_SECURE=True,
        JWT_COOKIE_CSRF_PROTECT=True,
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        PERMANENT_SESSION_LIFETIME=timedelta(hours=1)
    )
    
    # Check if we're in development mode
    in_development = app.debug or os.environ.get('FLASK_ENV') == 'development'
    
    # Flag to track if database is initialized
    app.db_initialized = False
    
    # Only initialize the database if we have a URL and we're not in development mode
    # or explicitly testing the database connection
    database_url = os.environ.get('DATABASE_URL', app.config.get('SQLALCHEMY_DATABASE_URI'))
    if database_url and (not in_development or os.environ.get('TEST_DB_CONNECTION') == 'true'):
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        
        # Initialize database
        db.init_app(app)
        migrate = Migrate(app, db)
        app.db_initialized = True
    else:
        logger.warning("Database connection bypassed - running in MOCK/API TEST mode")
    
    # Initialize extensions
    jwt = JWTManager(app)
    cache = configure_cache(app)
    cors = configure_cors(app)
    limiter = configure_rate_limiting(app)
    
    # Error handlers
    @app.errorhandler(APIError)
    def handle_api_error(error):
        response = jsonify({
            'success': False,
            'message': error.message,
            'error_code': error.status_code,
            'details': error.payload
        })
        response.status_code = error.status_code
        return response

    @app.errorhandler(429)
    def handle_ratelimit_error(e):
        return jsonify({
            'success': False,
            'message': 'Rate limit exceeded',
            'retry_after': str(e.description)
        }), 429

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        logger.exception("Unexpected error occurred")
        return jsonify({
            'success': False,
            'message': 'An unexpected error occurred',
            'error': str(e) if app.debug else 'Internal server error'
        }), 500
    
    # List of paths that should bypass JWT validation
    public_paths = [
        '/api/public/test-connection',
        '/api/public/jurisdictions',
        '/api/public/legal-updates',
        '/api/health',
        '/api/test',
        '/api/public/user/profile',
        '/api/public/cors-test'
    ]
    
    # Request logging and validation
    @app.before_request
    def log_request_info():
        """Log information about each incoming request"""
        if request.path.startswith('/static'):
            return
        
        logger.info(f"Request: {request.method} {request.path}")
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")

    # Skip validation for OPTIONS requests
    @app.before_request
    def before_request():
        if request.method == 'OPTIONS':
            return
            
        # Skip validation for public paths
        if any(request.path.startswith(path) for path in public_paths):
            return
            
        # Validate authentication for protected paths
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            if not any(request.path.startswith(path) for path in ['/api/auth', '/api/login', '/api/basic-login']):
                raise APIError('Authentication required', status_code=401)

    # Log all requests for debugging
    @app.before_request
    def log_request():
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")

    # Ensure upload folder exists
    upload_folder = os.path.join(app.instance_path, 'uploads')
    reports_folder = os.path.join(upload_folder, 'reports')

    # Create required directories if they don't exist
    os.makedirs(upload_folder, exist_ok=True)
    os.makedirs(reports_folder, exist_ok=True)

    # Set upload folder in config
    app.config['UPLOAD_FOLDER'] = upload_folder
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api')
    app.register_blueprint(documents_bp, url_prefix='/api')
    app.register_blueprint(admin_bp)  # No prefix here - Admin routes already have /api/admin in their definitions
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(legal_updates_bp, url_prefix='/api')
    
    # Add a simple health check endpoint
    @app.route('/api/health', methods=['GET'])
    @limiter.limit("60 per minute")
    @cached_endpoint(timeout=60)
    def health_check():
        """Health check endpoint with basic system stats"""
        try:
            # Check database connection
            if hasattr(app, 'db'):
                db.session.execute('SELECT 1')
                db_status = 'connected'
            else:
                db_status = 'not initialized'
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            db_status = 'error'

        # Check Redis connection if configured
        redis_status = 'not_configured'
        if app.config.get('REDIS_URL'):
            try:
                redis_client = redis.from_url(app.config['REDIS_URL'])
                redis_client.ping()
                redis_status = 'connected'
            except Exception as e:
                logger.error(f"Redis health check failed: {e}")
                redis_status = 'error'

        return jsonify({
            'status': 'ok',
            'timestamp': datetime.utcnow().isoformat(),
            'environment': os.environ.get('FLASK_ENV', 'development'),
            'database': db_status,
            'redis': redis_status,
            'version': '1.0.0'
        }), 200
    
    @app.route('/')
    def index():
        return jsonify({"message": "Welcome to NORMA AI API"})
    
    @app.route('/api/test', methods=['GET'])
    def test_api():
        return jsonify({"message": "API is working"})
    
    @app.route('/api/basic-login', methods=['POST', 'OPTIONS'])
    def basic_login():
        """Basic login endpoint that always succeeds for testing"""
        if request.method == 'OPTIONS':
            return '', 200
            
        # Log request details
        logger.info(f"Login request data: {request.json}")
        
        try:
            data = request.json
            # Always succeed in test mode with any credentials
            return jsonify({
                "success": True,
                "message": "Login successful",
                "token": "test-token-12345",
                "access_token": "test-token-12345", 
                "user": {
                    "id": 1,
                    "email": data.get('email', 'user@example.com'),
                    "firstName": "Test",
                    "lastName": "User",
                    "role": "admin"
                }
            })
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return jsonify({
                "success": False,
                "message": f"Login error: {str(e)}"
            }), 500
            
    @app.route('/api/auth/validate-token', methods=['GET', 'OPTIONS'])
    def validate_token():
        """Check if a token is valid"""
        if request.method == 'OPTIONS':
            return '', 200
            
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        logger.info(f"Validate token request with auth header: {auth_header}")
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            # In test mode, always accept test token
            if token == 'test-token-12345':
                return jsonify({
                    "success": True,
                    "message": "Token is valid",
                    "user": {
                        "id": 1,
                        "email": "user@example.com",
                        "firstName": "Test",
                        "lastName": "User",
                        "role": "admin"
                    }
                })
                
        # Return invalid token response for any other token
        return jsonify({
            "success": False,
            "message": "Invalid or expired token"
        }), 401
    
    @app.route('/api/test-connection', methods=['GET', 'OPTIONS'])
    @limiter.limit("30 per minute")
    def test_connection():
        try:
            return jsonify({
                'success': True,
                'message': 'Connection successful',
                'timestamp': datetime.utcnow().isoformat(),
                'environment': os.environ.get('FLASK_ENV', 'development')
            })
        except Exception as e:
            logger.error(f"Error in test connection: {e}")
            raise APIError('Connection test failed', status_code=500)
    
    # Public test connection endpoint
    @app.route('/api/public/test-connection', methods=['GET', 'OPTIONS'])
    def public_test_connection():
        """Public endpoint for testing API connectivity - NO authentication required"""
        logger.info("Public test connection endpoint accessed")
        client_ip = request.remote_addr
        user_agent = request.headers.get('User-Agent', 'Unknown')
        
        try:
            # Skip database connection check for public test - we just want to test API connectivity
            return jsonify({
                'success': True,
                'message': 'Connection successful',
                'timestamp': datetime.utcnow().isoformat(),
                'environment': os.environ.get('FLASK_ENV', 'development')
            })
        except Exception as e:
            logger.error(f"Error in test connection: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500

    # Jurisdictions public endpoint
    @app.route('/api/public/jurisdictions', methods=['GET', 'OPTIONS'])
    def public_jurisdictions():
        """Public endpoint for available jurisdictions - NO authentication required"""
        logger.info("Public jurisdictions endpoint accessed")
        
        try:
            # Return mock jurisdictions data
            mock_jurisdictions = [
                {"code": "US", "name": "United States", "active": True},
                {"code": "EU", "name": "European Union", "active": True},
                {"code": "UK", "name": "United Kingdom", "active": True},
                {"code": "CA", "name": "Canada", "active": True},
                {"code": "AU", "name": "Australia", "active": True},
                {"code": "JP", "name": "Japan", "active": False},
                {"code": "BR", "name": "Brazil", "active": False}
            ]
            
            return jsonify({
                'success': True,
                'jurisdictions': mock_jurisdictions,
                'count': len(mock_jurisdictions),
                'timestamp': datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Error in jurisdictions endpoint: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500

    # Public legal updates endpoint
    @app.route('/api/public/legal-updates', methods=['GET', 'OPTIONS'])
    def public_legal_updates():
        """Public mock endpoint for legal updates - NO authentication required"""
        logger.info("Public legal updates endpoint accessed")
        
        try:
            # Return mock legal updates data
            mock_updates = [
                {
                    "id": 1,
                    "title": "New Data Protection Regulations",
                    "summary": "Updated regulations on data privacy and protection.",
                    "jurisdiction": "European Union",
                    "publication_date": "2025-02-15",
                    "category": "Privacy",
                    "source": "EU Commission"
                },
                {
                    "id": 2,
                    "title": "Tax Law Changes for 2025",
                    "summary": "Important changes to corporate taxation policies.",
                    "jurisdiction": "United States",
                    "publication_date": "2025-01-10",
                    "category": "Tax",
                    "source": "Internal Revenue Service"
                },
                {
                    "id": 3, 
                    "title": "Environmental Compliance Update",
                    "summary": "New requirements for corporate environmental reporting.",
                    "jurisdiction": "Global",
                    "publication_date": "2025-03-01",
                    "category": "Environment",
                    "source": "International Standards Organization"
                }
            ]
            
            return jsonify({
                'success': True,
                'data': mock_updates,
                'count': len(mock_updates),
                'timestamp': datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Error in legal updates endpoint: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500

    # Public mock profile endpoint
    @app.route('/api/public/user/profile', methods=['GET', 'OPTIONS'])
    def public_user_profile():
        """Public endpoint for user profile data - NO authentication required"""
        logger.info("Public profile endpoint accessed")
        
        try:
            # Return mock user profile data
            mock_profile = {
                'id': 1,
                'username': 'testuser',
                'email': 'test@example.com',
                'full_name': 'Test User',
                'role': 'user',
                'company': 'Test Company',
                'position': 'Legal Counsel',
                'preferences': {
                    'jurisdictions': ['US', 'EU', 'Canada'],
                    'notification_email': True,
                    'notification_app': True,
                    'language': 'en'
                },
                'joined_date': '2024-01-15',
                'last_login': '2025-03-14T10:30:00Z'
            }
            
            return jsonify({
                'success': True,
                'profile': mock_profile
            })
        except Exception as e:
            logger.error(f"Error in public profile endpoint: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500

    # Public document compliance details endpoint
    @app.route('/api/public/document/<int:document_id>/compliance', methods=['GET', 'OPTIONS'])
    def public_document_compliance(document_id):
        """Public endpoint for document compliance details - NO authentication required"""
        logger.info(f"Public document compliance endpoint accessed for document ID: {document_id}")
        
        try:
            # Mock data for document compliance based on document ID
            mock_compliance_data = {
                1: {  # Privacy Policy Template
                    'status': 'compliant',
                    'score': 92,
                    'last_audit': '2025-02-20T08:15:00Z',
                    'issues': [
                        {
                            'severity': 'low',
                            'description': 'Missing cookie usage details',
                            'recommendation': 'Add specific information about cookie types used'
                        }
                    ],
                    'regulations': [
                        {
                            'name': 'GDPR',
                            'status': 'compliant',
                            'score': 95
                        },
                        {
                            'name': 'CCPA',
                            'status': 'compliant',
                            'score': 90
                        }
                    ]
                },
                2: {  # GDPR Compliance Checklist
                    'status': 'partially_compliant',
                    'score': 85,
                    'last_audit': '2025-02-25T14:30:00Z',
                    'issues': [
                        {
                            'severity': 'medium',
                            'description': 'Incomplete data processing details',
                            'recommendation': 'Add specific information about data processing activities'
                        },
                        {
                            'severity': 'low',
                            'description': 'Missing data retention policy',
                            'recommendation': 'Add clear data retention timeframes'
                        }
                    ],
                    'regulations': [
                        {
                            'name': 'GDPR',
                            'status': 'partially_compliant',
                            'score': 85
                        }
                    ]
                },
                3: {  # Terms of Service Agreement
                    'status': 'compliant',
                    'score': 97,
                    'last_audit': '2025-03-05T11:45:00Z',
                    'issues': [],
                    'regulations': [
                        {
                            'name': 'General Contract Law',
                            'status': 'compliant',
                            'score': 97
                        },
                        {
                            'name': 'E-Commerce Directive',
                            'status': 'compliant',
                            'score': 98
                        }
                    ]
                }
            }
            
            # Return document compliance data if it exists
            if document_id in mock_compliance_data:
                return jsonify({
                    'success': True,
                    'document_id': document_id,
                    'details': mock_compliance_data[document_id]
                })
            else:
                # Return a 404 error if the document doesn't exist
                return jsonify({
                    'success': False,
                    'message': f'Document with ID {document_id} not found'
                }), 404
                
        except Exception as e:
            logger.error(f"Error in public document compliance endpoint: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500
    
    # Public document upload endpoint
    @app.route('/api/public/documents/upload', methods=['POST', 'OPTIONS'])
    def public_document_upload():
        """Public endpoint for document upload - NO authentication required"""
        logger.info("Public document upload endpoint accessed")
        
        if request.method == 'OPTIONS':
            return handle_preflight()
            
        try:
            # Validate that required fields are present
            if 'file' not in request.files:
                return jsonify({
                    'success': False,
                    'message': 'No file provided'
                }), 400
                
            # Get file and other data
            file = request.files['file']
            title = request.form.get('title', 'Untitled Document')
            tags = request.form.getlist('tags[]') or []
            
            # Validate file
            if file.filename == '':
                return jsonify({
                    'success': False,
                    'message': 'No file selected'
                }), 400
                
            # Process the file (in production, save to storage)
            # For now, just acknowledge receipt
            file_size = 0
            for chunk in file:
                file_size += len(chunk)
                
            # Create mock document response
            mock_document = {
                'id': 4,  # Next available ID
                'title': title,
                'filename': file.filename,
                'size': file_size,
                'date_created': datetime.now().isoformat(),
                'date_modified': datetime.now().isoformat(),
                'type': 'uploaded',
                'tags': tags,
                'status': 'pending_analysis'
            }
            
            return jsonify({
                'success': True,
                'message': 'Document uploaded successfully',
                'document': mock_document
            })
            
        except Exception as e:
            logger.error(f"Error in public document upload endpoint: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500

    # Public document delete endpoint
    @app.route('/api/public/document/<int:document_id>', methods=['DELETE', 'OPTIONS'])
    def public_document_delete(document_id):
        """Public endpoint for document deletion - NO authentication required"""
        logger.info(f"Public document delete endpoint accessed for document ID: {document_id}")
        
        if request.method == 'OPTIONS':
            return handle_preflight()
            
        try:
            # In a real implementation, check if document exists and belongs to user
            # For this mock version, we'll just return success
            return jsonify({
                'success': True,
                'message': f'Document {document_id} deleted successfully'
            })
            
        except Exception as e:
            logger.error(f"Error in public document delete endpoint: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500
            
    # Public document re-analyze endpoint
    @app.route('/api/public/document/<int:document_id>/analyze', methods=['POST', 'OPTIONS'])
    def public_document_analyze(document_id):
        """Public endpoint for document re-analysis - NO authentication required"""
        logger.info(f"Public document analyze endpoint accessed for document ID: {document_id}")
        
        if request.method == 'OPTIONS':
            return handle_preflight()
            
        try:
            # Get jurisdiction if provided
            data = request.get_json(silent=True) or {}
            jurisdiction = data.get('jurisdiction', 'US')
            
            # Mock analysis result
            analysis_result = {
                'document_id': document_id,
                'status': 'completed',
                'score': 95,
                'jurisdiction': jurisdiction,
                'analysis_date': datetime.now().isoformat(),
                'summary': 'Document has been successfully analyzed',
                'issues_found': 2,
                'issues_resolved': 0
            }
            
            return jsonify({
                'success': True,
                'message': 'Document analysis completed',
                'analysis': analysis_result
            })
            
        except Exception as e:
            logger.error(f"Error in public document analyze endpoint: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500

    # Simple CORS diagnostic endpoint
    @app.route('/api/public/cors-test', methods=['GET', 'OPTIONS'])
    def public_cors_test():
        """Public endpoint for testing CORS - NO authentication required"""
        logger.info("CORS test endpoint accessed")
        logger.info(f"Request headers: {dict(request.headers)}")
        
        # Log the origin for debugging
        origin = request.headers.get('Origin', 'No origin header')
        logger.info(f"Origin header: {origin}")
        
        if request.method == 'OPTIONS':
            # Handle preflight explicitly
            response = make_response()
            # Add CORS headers directly for this specific endpoint
            response.headers.update({
                'Access-Control-Allow-Origin': origin if origin.startswith(('http://localhost:', 'http://127.0.0.1:')) else '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Test-Connection, X-Debug-Client',
                'Access-Control-Allow-Credentials': 'true' if origin.startswith(('http://localhost:', 'http://127.0.0.1:')) else 'false'
            })
            logger.info(f"CORS preflight response headers: {dict(response.headers)}")
            return response
            
        # For GET requests
        response = jsonify({
            'success': True,
            'message': 'CORS diagnostic successful',
            'request_details': {
                'origin': origin,
                'remote_addr': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', 'Unknown'),
                'headers': {k: v for k, v in request.headers.items()},
            },
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Add CORS headers directly for the response
        if origin.startswith(('http://localhost:', 'http://127.0.0.1:')):
            response.headers.update({
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Credentials': 'true'
            })
        
        logger.info(f"CORS test response headers: {dict(response.headers)}")
        return response

    # Documents endpoint with validation and pagination
    @app.route('/api/documents', methods=['GET', 'POST'])
    @jwt_required()
    def documents():
        current_user = get_jwt_identity()
        
        try:
            if request.method == 'GET':
                # Fetch documents for current user from database
                user_documents = Document.query.filter_by(user_id=current_user['id']).all()
                
                # Support pagination if requested
                page = request.args.get('page', 1, type=int)
                per_page = request.args.get('per_page', 10, type=int)
                
                # Apply pagination to results
                start_idx = (page - 1) * per_page
                end_idx = start_idx + per_page
                paginated_docs = user_documents[start_idx:end_idx]
                
                # Serialize documents
                documents_data = [doc.to_dict() for doc in paginated_docs]
                
                return jsonify({
                    'success': True,
                    'documents': documents_data,
                    'pagination': {
                        'total': len(user_documents),
                        'pages': (len(user_documents) + per_page - 1) // per_page,
                        'current_page': page,
                        'per_page': per_page,
                        'has_next': end_idx < len(user_documents),
                        'has_prev': page > 1
                    }
                })
            elif request.method == 'POST':
                try:
                    schema = DocumentSchema()
                    data = schema.load(request.json)
                    
                    new_document = Document(
                        user_id=current_user['id'],
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                        **data
                    )
                    
                    try:
                        db.session.add(new_document)
                        db.session.commit()
                    except Exception as e:
                        db.session.rollback()
                        logger.error(f"Database error creating document: {e}")
                        raise APIError('Error saving document', status_code=500)
                    
                    return jsonify({
                        'success': True,
                        'message': 'Document created successfully',
                        'document': new_document.to_dict()
                    }), 201
                except ValidationError as e:
                    raise APIError('Invalid document data', payload=e.messages)
                except Exception as e:
                    logger.error(f"Error creating document: {e}")
                    raise APIError('Error creating document', status_code=500)
        except Exception as e:
            logger.error(f"Error fetching documents: {e}")
            raise APIError('Error fetching documents', status_code=500)

    # Database session management
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        """Ensure proper cleanup of database sessions"""
        if exception:
            db.session.rollback()
            app.logger.error(f"Rolling back session due to error: {exception}")
        db.session.remove()

    @app.before_request
    def before_request():
        """Ensure fresh database connection before each request"""
        try:
            if hasattr(app, 'db'):
                db.session.execute('SELECT 1')
        except Exception as e:
            app.logger.error(f"Database connection error: {e}")
            db.session.rollback()
            db.session.remove()
            raise APIError("Database connection error", status_code=503)

    return app

app = create_app()

@app.route('/test', methods=['GET'])
def test():
    return {"message": "API is working!"}

if __name__ == '__main__':
    with app.app_context():
        # Only create database tables if we've initialized the database
        if app.db_initialized:
            try:
                db.create_all()
                app.logger.info("Database tables created successfully")
            except Exception as e:
                app.logger.error(f"Failed to create database tables: {e}")
        else:
            app.logger.warning("Skipping database table creation - running in API test mode without database")
    app.run(debug=True, host='0.0.0.0', port=3001)
