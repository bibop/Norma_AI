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
from marshmallow import Schema, fields, validate, ValidationError
from functools import wraps
from flask_caching import Cache
import secrets

# Custom exception for API errors
class APIError(Exception):
    """Custom exception for API errors with status code and optional payload"""
    def __init__(self, message, status_code=400, payload=None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload

# Validation schemas
class ProfileUpdateSchema(Schema):
    """Schema for profile update validation"""
    first_name = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    last_name = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    email = fields.Email(required=True)
    company = fields.Str(validate=validate.Length(max=100))
    preferences = fields.Dict()

class DocumentSchema(Schema):
    """Schema for document validation"""
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    type = fields.Str(required=True, validate=validate.OneOf(['report', 'policy', 'handbook']))
    content = fields.Str(required=True)
    status = fields.Str(validate=validate.OneOf(['draft', 'final', 'approved']))

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
    """Decorator to validate request data against a schema"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            schema = schema_class()
            try:
                data = schema.load(request.get_json())
                return f(data, *args, **kwargs)
            except ValidationError as err:
                raise APIError('Invalid request data', payload=err.messages)
        return decorated_function
    return decorator

# Cache configuration
def configure_cache(app):
    """Configure Flask-Cache with Redis backend"""
    cache = Cache(app, config={
        'CACHE_TYPE': 'redis',
        'CACHE_REDIS_URL': os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
        'CACHE_DEFAULT_TIMEOUT': 300,
        'CACHE_KEY_PREFIX': 'norma_ai_',
        'CACHE_REDIS_DB': 0,
    })
    return cache

# Rate limiting configuration
def configure_rate_limiting(app):
    """Configure rate limiting with Redis backend"""
    if not app.config.get('REDIS_URL'):
        app.logger.warning("Redis URL not configured. Rate limiting disabled.")
        return None
    
    try:
        limiter = Limiter(
            app=app,
            key_func=get_remote_address,
            default_limits=["1000 per day", "200 per hour"],
            storage_uri=app.config['REDIS_URL'],
            storage_options={
                "connection_pool": redis.ConnectionPool.from_url(
                    app.config['REDIS_URL'],
                    max_connections=10,
                    decode_responses=True
                )
            }
        )
        return limiter
    except Exception as e:
        app.logger.error(f"Failed to initialize rate limiter: {e}")
        if app.config['ENV'] == 'production':
            raise
        return None

# Cached endpoint decorator
def cached_endpoint(timeout=300):
    """Decorator to cache endpoint responses"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            cache_key = f"{request.path}:{request.args}"
            response = cache.get(cache_key)
            if response is None:
                response = f(*args, **kwargs)
                cache.set(cache_key, response, timeout=timeout)
            return response
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
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
        app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
        app.config['DEBUG'] = False
        app.config['TESTING'] = False
    else:
        app.config.from_object(config_class)
    
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
    
    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)
    jwt = JWTManager(app)
    cache = configure_cache(app)
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
        '/api/public/documents',
        '/api/health',
        '/api/test',
        '/',
        '/test'
    ]
    
    # Request logging and validation
    @app.before_request
    def before_request():
        # Log request details
        logger.info(f"Request: {request.method} {request.path}")
        logger.debug(f"Headers: {dict(request.headers)}")
        
        # Skip validation for OPTIONS requests
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

    # Enhanced CORS configuration
    cors_origins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:63031',
        'http://127.0.0.1:63031',
        'http://localhost:8091',
        'http://127.0.0.1:8091',
        'http://localhost:8090',
        'http://127.0.0.1:8090',
        'http://localhost:8000',
        'http://127.0.0.1:8000'
    ]
    
    # CORS configuration
    CORS(app, 
         resources={
             r"/api/*": {
                 "origins": cors_origins,
                 "supports_credentials": True,
                 "allow_headers": ["Content-Type", "Authorization", "X-Debug-Client", "Accept", "x-debug-client"],
                 "expose_headers": ["Authorization", "Content-Type", "X-Request-ID"],
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                 "max_age": 86400
             }
         })

    # Centralized CORS headers function
    def add_cors_headers(response, origin):
        if origin in cors_origins:
            response.headers.update({
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Debug-Client, Accept, x-debug-client',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Expose-Headers': 'Authorization, Content-Type, X-Request-ID',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            })
        return response

    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        if origin:
            response = add_cors_headers(response, origin)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        return response

    # Handle OPTIONS requests globally
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        """Handle OPTIONS requests with proper CORS headers"""
        logger.info(f"OPTIONS request for path: {path}")
        response = app.make_default_options_response()
        origin = request.headers.get('Origin')
        return add_cors_headers(response, origin)

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
            db.session.execute('SELECT 1')
            db_status = 'connected'
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
            'environment': app.config['ENV'],
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
                'environment': app.config['ENV']
            })
        except Exception as e:
            logger.error(f"Error in test connection: {e}")
            raise APIError('Connection test failed', status_code=500)
    
    # Create explicitly public routes without JWT validation
    
    # Public test connection endpoint
    @app.route('/api/public/test-connection', methods=['GET', 'OPTIONS'])
    def public_test_connection():
        """Public endpoint for testing API connectivity - NO authentication required"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        # Handle preflight CORS request
        if request.method == 'OPTIONS':
            # Add CORS headers directly to OPTIONS responses
            origin = request.headers.get('Origin')
            logger.info(f"CORS OPTIONS request with Origin: {origin}")
            
            # Handle CORS headers for preflight requests - only allow specified origins
            if origin in cors_origins:
                response = make_response('', 200)
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Debug-Client, Accept, x-debug-client'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Expose-Headers'] = 'Authorization, Content-Type, X-Request-ID'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Max-Age'] = '86400'  # Cache preflight for 24 hours
            
                logger.info(f"Sending OPTIONS response with headers: {dict(response.headers)}")
                return response
        
        # Get client information
        client_ip = request.remote_addr
        user_agent = request.headers.get('User-Agent', 'Unknown')
        debug_client = request.headers.get('X-Debug-Client', 'None')
        
        # Get detailed connection information
        connection_info = {
            'remote_addr': client_ip,
            'is_ipv6': ':' in client_ip,
            'forwarded_for': request.headers.get('X-Forwarded-For'),
            'host': request.host,
            'host_url': request.host_url,
            'full_path': request.full_path,
            'is_secure': request.is_secure,
            'scheme': request.scheme,
        }
        
        logger.info(f"Public test connection from {client_ip} with {user_agent}, debug_client: {debug_client}")
        logger.info(f"Connection details: {connection_info}")
        
        # Build detailed response with client and server info
        response_data = {
            'success': True,
            'message': 'Connection successful',
            'server_time': str(datetime.now()),
            'timestamp': int(time.time()),
            'client_info': {
                'ip': client_ip,
                'user_agent': user_agent,
                'debug_client': debug_client,
                'headers': dict(request.headers)
            },
            'connection_info': connection_info,
            'server_info': {
                'host': request.host,
                'env': 'development',
                'python_version': platform.python_version(),
                'flask_version': flask.__version__ if hasattr(flask, '__version__') else 'unknown',
                'server_interface': '0.0.0.0',  # Listening on all interfaces
                'server_port': 3001,
                'request_count': request.environ.get('wsgi.request_count', 0)
            }
        }
        
        # Clear Flask's automatic CORS headers (to prevent conflicts)
        response = jsonify(response_data)
        
        # Set CORS headers directly using dictionary access to avoid duplicates
        origin = request.headers.get('Origin')
        logger.info(f"GET request with Origin: {origin}")
        
        # Set CORS headers only for allowed origins
        if origin in cors_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Debug-Client, Accept, x-debug-client'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Expose-Headers'] = 'Authorization, Content-Type, X-Request-ID'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['X-Request-ID'] = str(uuid.uuid4())
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        
        logger.info(f"Sending successful test response with headers: {dict(response.headers)}")
        return response
    
    # API Test Page
    @app.route('/api-test', methods=['GET'])
    def api_test_page():
        """Serve a simple API test page"""
        return send_from_directory('static', 'test.html')
    
    # Jurisdictions public endpoint
    @app.route('/api/public/jurisdictions', methods=['GET', 'OPTIONS'])
    def public_jurisdictions():
        """Public mock endpoint for jurisdictions - NO authentication required"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            return '', 200
            
        # Mock jurisdictions data
        mock_jurisdictions = {
            "success": True,
            "jurisdictions": [
                {"id": "us", "name": "United States", "regions": [
                    {"id": "ca", "name": "California"},
                    {"id": "ny", "name": "New York"},
                    {"id": "tx", "name": "Texas"}
                ]},
                {"id": "eu", "name": "European Union", "regions": [
                    {"id": "de", "name": "Germany"},
                    {"id": "fr", "name": "France"},
                    {"id": "it", "name": "Italy"}
                ]},
                {"id": "uk", "name": "United Kingdom", "regions": [
                    {"id": "eng", "name": "England"},
                    {"id": "sct", "name": "Scotland"},
                    {"id": "wls", "name": "Wales"}
                ]},
                {"id": "ca", "name": "Canada", "regions": [
                    {"id": "on", "name": "Ontario"},
                    {"id": "qc", "name": "Quebec"},
                    {"id": "bc", "name": "British Columbia"}
                ]}
            ]
        }
        
        return jsonify(mock_jurisdictions)
    
    # Mock profile endpoint - public
    @app.route('/api/profile', methods=['GET', 'PUT'])
    @jwt_required()
    @limiter.limit("30 per minute")
    def user_profile():
        current_user_id = get_jwt_identity()
        
        if request.method == 'GET':
            try:
                user = User.query.get(current_user_id)
                if not user:
                    raise APIError('User not found', status_code=404)
                    
                return jsonify({
                    'success': True,
                    'profile': user.to_dict()
                })
            except Exception as e:
                logger.error(f"Error fetching user profile: {e}")
                raise APIError('Error fetching profile', status_code=500)
                
        elif request.method == 'PUT':
            try:
                schema = ProfileUpdateSchema()
                data = schema.load(request.json)
                
                user = User.query.get(current_user_id)
                if not user:
                    raise APIError('User not found', status_code=404)
                
                # Update user fields
                for key, value in data.items():
                    setattr(user, key, value)
                
                db.session.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Profile updated successfully',
                    'profile': user.to_dict()
                })
            except ValidationError as e:
                raise APIError('Invalid profile data', payload=e.messages)
            except Exception as e:
                db.session.rollback()
                logger.error(f"Error updating user profile: {e}")
                raise APIError('Error updating profile', status_code=500)
    
    # Documents endpoint with authentication
    @app.route('/api/documents', methods=['GET', 'POST'])
    @jwt_required()
    @limiter.limit("100 per minute")
    def documents():
        current_user_id = get_jwt_identity()
        
        if request.method == 'GET':
            try:
                # Add filtering and pagination
                page = request.args.get('page', 1, type=int)
                per_page = min(request.args.get('per_page', 10, type=int), 100)
                document_type = request.args.get('type')
                status = request.args.get('status')
                
                query = Document.query.filter_by(user_id=current_user_id)
                
                if document_type:
                    query = query.filter_by(type=document_type)
                if status:
                    query = query.filter_by(status=status)
                
                documents = query.paginate(page=page, per_page=per_page)
                
                return jsonify({
                    'success': True,
                    'documents': [doc.to_dict() for doc in documents.items],
                    'pagination': {
                        'total': documents.total,
                        'pages': documents.pages,
                        'current_page': documents.page,
                        'per_page': documents.per_page
                    }
                })
            except Exception as e:
                logger.error(f"Error fetching documents: {e}")
                raise APIError('Error fetching documents', status_code=500)
                
        elif request.method == 'POST':
            try:
                schema = DocumentSchema()
                data = schema.load(request.json)
                
                new_document = Document(
                    user_id=current_user_id,
                    **data
                )
                
                db.session.add(new_document)
                db.session.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Document created successfully',
                    'document': new_document.to_dict()
                }), 201
            except ValidationError as e:
                raise APIError('Invalid document data', payload=e.messages)
            except Exception as e:
                db.session.rollback()
                logger.error(f"Error creating document: {e}")
                raise APIError('Error creating document', status_code=500)

    # Public documents endpoint with caching
    @app.route('/api/public/documents', methods=['GET'])
    @limiter.limit("200 per minute")
    @cached_endpoint(timeout=300)
    def public_documents():
        try:
            # Add filtering and pagination
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 10, type=int), 100)
            
            # Only return public documents
            documents = Document.query.filter_by(
                is_public=True,
                status='approved'
            ).paginate(page=page, per_page=per_page)
            
            return jsonify({
                'success': True,
                'documents': [doc.to_dict() for doc in documents.items],
                'pagination': {
                    'total': documents.total,
                    'pages': documents.pages,
                    'current_page': documents.page,
                    'per_page': documents.per_page
                }
            })
        except Exception as e:
            logger.error(f"Error fetching public documents: {e}")
            raise APIError('Error fetching documents', status_code=500)

    # Legal updates endpoint with caching
    @app.route('/api/legal-updates', methods=['GET'])
    @limiter.limit("150 per minute")
    @cached_endpoint(timeout=600)
    def legal_updates():
        try:
            # Add filtering and pagination
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 10, type=int), 100)
            jurisdiction = request.args.get('jurisdiction')
            category = request.args.get('category')
            
            query = LegalUpdate.query
            
            if jurisdiction:
                query = query.filter_by(jurisdiction=jurisdiction)
            if category:
                query = query.filter_by(category=category)
                
            updates = query.order_by(
                LegalUpdate.date.desc()
            ).paginate(page=page, per_page=per_page)
            
            return jsonify({
                'success': True,
                'updates': [update.to_dict() for update in updates.items],
                'pagination': {
                    'total': updates.total,
                    'pages': updates.pages,
                    'current_page': updates.page,
                    'per_page': updates.per_page
                }
            })
        except Exception as e:
            logger.error(f"Error fetching legal updates: {e}")
            raise APIError('Error fetching legal updates', status_code=500)

    # Root level test-connection endpoint for simplified connectivity testing
    @app.route('/public/test-connection', methods=['GET', 'OPTIONS'])
    def root_public_test_connection():
        """Simplified root-level endpoint for testing API connectivity - NO authentication required"""
        logger.info(f"Request to root test endpoint: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        # Handle preflight CORS request
        if request.method == 'OPTIONS':
            response = make_response('', 200)
            origin = request.headers.get('Origin', '*')
            
            # Always allow CORS for this public test endpoint
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Debug-Client, Accept'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response.headers['Access-Control-Max-Age'] = '86400'
            
            logger.info(f"Sending OPTIONS response with headers: {dict(response.headers)}")
            return response
        
        # Simple response for connectivity testing
        response_data = {
            'success': True,
            'message': 'Connection successful',
            'server_time': str(datetime.now()),
            'endpoint': 'root-level-test'
        }
        
        response = jsonify(response_data)
        logger.info(f"Successfully responded to root test connection")
        return response

    return app

app = create_app()

@app.route('/test', methods=['GET'])
def test():
    return {"message": "API is working!"}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=3001)
