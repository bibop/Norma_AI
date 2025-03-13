import os
from flask import Flask, jsonify, request, make_response, send_from_directory
import flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from dotenv import load_dotenv
from config import Config
from models import db, User
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

# Load environment variables from .env file if it exists
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app(config_class=Config):
    app = Flask(__name__, static_folder='../static', static_url_path='')
    app_env = os.environ.get('FLASK_ENV', 'development')
    if app_env == 'production':
        # Use DATABASE_URL from environment (provided by Render)
        database_url = os.environ.get('DATABASE_URL')
        # Render provides PostgreSQL connection string starting with 'postgres://'
        # but SQLAlchemy expects 'postgresql://'
        if database_url and database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
        app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'production-secret-key')
        app.config['DEBUG'] = False
    else:
        # Local development configuration
        app.config.from_object(config_class)
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)
    
    # Configure JWT
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
    app.config['JWT_ALGORITHM'] = 'HS256'
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    
    # List of paths that should bypass JWT validation
    public_paths = [
        # Only include /public routes for truly public endpoints
        '/api/public/test-connection',  # Basic connectivity test
        '/api/public/jurisdictions',    # Public reference data
        '/api/public/legal-updates',    # Public legal updates
        '/api/public/documents',        # Public document listings
        '/api/health',                  # Health check endpoint
        '/api/test',                    # Basic API test
        '/',                           # Root endpoint
        '/test'                        # Test endpoint
    ]
    
    # Initialize the JWT manager
    jwt = JWTManager(app)
    
    # Add a decorator to exempt certain routes from JWT validation
    @app.before_request
    def handle_public_paths():
        """Check if the current request path is in the list of public paths and allow access if it is"""
        if request.method == 'OPTIONS':
            # Handle CORS preflight requests
            response = make_response()
            origin = request.headers.get('Origin')
            if origin in cors_origins:  # Only allow specified origins
                response.headers.add('Access-Control-Allow-Origin', origin)
                response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Debug-Client, x-debug-client')
                response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                response.headers.add('Access-Control-Expose-Headers', 'Authorization, Content-Type')
                response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
            
        # Extract the path without query parameters
        path = request.path
        
        # Check if this path should bypass JWT validation
        if any(path.startswith(public_path) for public_path in public_paths):
            logger.info(f"Bypassing JWT validation for public path: {path}")
            return None
            
        # If not a public path and not authenticated, require authentication
        # except for login/auth endpoints
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            if not any(request.path.startswith(path) for path in ['/api/auth', '/api/login', '/api/basic-login']):
                logger.info(f"JWT validation required for path: {path}")
                return jsonify({
                    'success': False,
                    'message': 'Authentication required'
                }), 401
    
    # Create a custom JWT error handler to bypass validation for test tokens
    @jwt.token_in_blocklist_loader
    def check_if_token_in_blocklist(jwt_header, jwt_payload):
        """Check if the token is in the blocklist or is a valid test token"""
        token = request.headers.get('Authorization', '').split(' ')[1] if request.headers.get('Authorization', '').startswith('Bearer ') else ''
        
        # Only allow test tokens in development environment
        if app.config['ENV'] == 'development' and token.startswith('test-'):
            logger.info(f"Allowing test token in development: {token}")
            return False
            
        # In production, implement proper token validation
        # TODO: Implement proper token blocklist checking against Redis/database
        revoked_tokens = []  # This should be replaced with actual blocklist storage
        return token in revoked_tokens

    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        """Handle invalid tokens"""
        # For development, check if using a test token
        token = request.headers.get('Authorization', '')
        if app.config['ENV'] == 'development' and token.startswith('Bearer test-'):
            # Create a mock identity for testing
            return jsonify({
                'success': True,
                'message': 'Test token accepted',
                'user': {
                    'id': 1,
                    'email': 'test@example.com'
                }
            })
        return jsonify({
            'success': False,
            'message': error_string
        }), 401

    # JWT configuration callbacks
    @jwt.user_identity_loader
    def user_identity_lookup(user_id):
        return str(user_id)
    
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return identity
    
    # Enhanced CORS configuration
    cors_origins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:63031',
        'http://127.0.0.1:63031'
    ]
    
    # Proper CORS configuration with correct headers and OPTIONS handling
    CORS(app, 
         resources={r"/*": {"origins": cors_origins, "supports_credentials": True}},
         allow_headers=["Content-Type", "Authorization", "X-Debug-Client", "Accept"],
         expose_headers=["Authorization", "Content-Type", "X-Request-ID"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    # Handle OPTIONS requests globally
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        logger.info(f"OPTIONS request for path: {path}")
        response = app.make_default_options_response()
        
        # Add CORS headers directly to OPTIONS responses
        origin = request.headers.get('Origin')
        # Only allow specified origins
        if origin in cors_origins:
            response.headers.add('Access-Control-Allow-Origin', origin)
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Debug-Client, Accept, x-debug-client')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.add('Access-Control-Expose-Headers', 'Authorization, Content-Type, X-Request-ID')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            
        return response

    # Custom function to add CORS headers to handle preflight OPTIONS requests
    def handle_preflight_request(path):
        """Handle preflight OPTIONS requests with the proper CORS headers"""
        response = app.make_default_options_response()
        return response

    # Log all requests for debugging
    @app.before_request
    def log_request():
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")

    # Log all responses for debugging
    @app.after_request
    def log_response(response):
        logger.info(f"Response: {response.status_code} - Headers: {dict(response.headers)}")
        return response

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
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(legal_updates_bp, url_prefix='/api')
    
    # Add a simple health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'ok',
            'message': 'Server is running',
            'timestamp': datetime.utcnow().isoformat()
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
    def test_connection():
        """Test endpoint to verify API connectivity"""
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            # Get client IP and headers for debugging
            client_ip = request.remote_addr
            headers = dict(request.headers)
            # Remove sensitive headers
            if 'Authorization' in headers:
                headers['Authorization'] = '[REDACTED]'
            if 'Cookie' in headers:
                headers['Cookie'] = '[REDACTED]'
            
            return jsonify({
                'success': True,
                'message': 'Connection successful',
                'server_time': str(datetime.now()),
                'server_info': {
                    'host': request.host,
                    'env': os.environ.get('FLASK_ENV', 'development'),
                    'python_version': os.popen('python3 --version').read().strip(),
                    'flask_version': flask.__version__ if hasattr(flask, '__version__') else 'unknown'
                },
                'client_info': {
                    'ip': client_ip,
                    'user_agent': request.user_agent.string,
                    'headers': headers
                }
            })
        except Exception as e:
            logger.error(f"Error in test_connection: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Error: {str(e)}'
            }), 500
    
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
    @app.route('/api/profile', methods=['GET', 'OPTIONS'])
    @jwt_required()  # Require authentication
    def get_profile():
        """Protected endpoint for user profile - requires authentication"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            return '', 200
            
        # Get the current user's identity from the JWT
        current_user_id = get_jwt_identity()
        
        # Mock profile data - in production, fetch from database using current_user_id
        mock_profile = {
            "success": True,
            "profile": {
                "id": current_user_id,
                "username": "johndoe",
                "email": "john.doe@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "role": "Legal Counsel",
                "organization": "Acme Legal Services",
                "preferences": {
                    "theme": "light",
                    "notifications": True,
                    "language": "en-US",
                    "jurisdictions": ["us", "eu"]
                },
                "account_created": "2024-09-01T08:00:00Z"
            }
        }
        
        return jsonify(mock_profile)
    
    # Jurisdictions endpoint - public (for testing)
    @app.route('/api/jurisdictions', methods=['GET', 'OPTIONS'])
    def get_jurisdictions():
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
    
    # Legal updates endpoint - public
    @app.route('/api/legal-updates', methods=['GET', 'OPTIONS'])
    def get_legal_updates():
        """Public mock endpoint for legal updates - NO authentication required"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            response = make_response()
            return response
            
        # Mock legal updates data
        mock_updates = {
            "success": True,
            "updates": [
                {
                    "id": 1,
                    "title": "New Tax Regulations",
                    "summary": "Updated tax regulations for fiscal year 2025",
                    "date": "2025-01-15",
                    "jurisdiction": "us",
                    "category": "Tax Law",
                    "importance": "high"
                },
                {
                    "id": 2,
                    "title": "GDPR Compliance Updates",
                    "summary": "New guidelines for GDPR compliance in digital services",
                    "date": "2025-02-22",
                    "jurisdiction": "eu",
                    "category": "Privacy Law",
                    "importance": "medium"
                },
                {
                    "id": 3,
                    "title": "Corporate Governance Changes",
                    "summary": "Updated requirements for board reporting and transparency",
                    "date": "2025-03-10",
                    "jurisdiction": "uk",
                    "category": "Corporate Law",
                    "importance": "high"
                }
            ]
        }
        
        response = jsonify(mock_updates)
        
        # Add a unique request ID for tracking
        response.headers['X-Request-ID'] = str(uuid.uuid4())
        
        # Ensure no caching for this endpoint
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        logger.info(f"Successfully returned legal updates with response headers: {dict(response.headers)}")
        return response
    
    # Legal updates public endpoint
    @app.route('/api/public/legal-updates', methods=['GET', 'OPTIONS'])
    def public_legal_updates():
        """Public mock endpoint for legal updates - NO authentication required"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            return '', 200
            
        # Mock legal updates data
        mock_updates = {
            "success": True,
            "legal_updates": [
                {
                    "id": "lu001",
                    "title": "New Privacy Regulations in California",
                    "summary": "California has introduced new privacy regulations that affect data handling practices.",
                    "jurisdiction": "US/California",
                    "date": "2025-01-15",
                    "url": "https://example.com/updates/california-privacy"
                },
                {
                    "id": "lu002",
                    "title": "EU Digital Services Act Implementation",
                    "summary": "New guidelines for implementing the EU Digital Services Act have been published.",
                    "jurisdiction": "EU",
                    "date": "2025-02-10",
                    "url": "https://example.com/updates/eu-dsa"
                },
                {
                    "id": "lu003",
                    "title": "UK Data Protection Framework Updates",
                    "summary": "Post-Brexit updates to the UK's data protection framework have been finalized.",
                    "jurisdiction": "UK",
                    "date": "2025-03-01",
                    "url": "https://example.com/updates/uk-data-protection"
                }
            ]
        }
        
        return jsonify(mock_updates)
    
    # Documents endpoint - public (for testing)
    @app.route('/api/documents', methods=['GET', 'OPTIONS'])
    def get_documents():
        """Public mock endpoint for documents - NO authentication required"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            return '', 200
            
        # Mock documents data
        mock_documents = {
            "success": True,
            "documents": [
                {
                    "id": 1,
                    "title": "Annual Report 2024",
                    "type": "report",
                    "date_created": "2024-12-15",
                    "last_modified": "2025-01-10",
                    "status": "final",
                    "size_kb": 1240
                },
                {
                    "id": 2,
                    "title": "Privacy Policy",
                    "type": "policy",
                    "date_created": "2024-08-20",
                    "last_modified": "2025-02-05",
                    "status": "approved",
                    "size_kb": 320
                },
                {
                    "id": 3,
                    "title": "Employee Handbook",
                    "type": "handbook",
                    "date_created": "2024-06-01",
                    "last_modified": "2024-11-30",
                    "status": "draft",
                    "size_kb": 1850
                }
            ]
        }
        
        return jsonify(mock_documents)
    
    # Documents public endpoint
    @app.route('/api/public/documents', methods=['GET', 'OPTIONS'])
    def public_documents():
        """Public mock endpoint for documents - NO authentication required"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            return '', 200
            
        # Mock documents data
        mock_documents = {
            "success": True,
            "documents": [
                {
                    "id": "doc001",
                    "title": "Privacy Policy Template",
                    "type": "template",
                    "jurisdiction": "US/California",
                    "last_modified": "2025-02-15",
                    "status": "active"
                },
                {
                    "id": "doc002",
                    "title": "GDPR Compliance Checklist",
                    "type": "checklist",
                    "jurisdiction": "EU",
                    "last_modified": "2025-01-20",
                    "status": "active"
                },
                {
                    "id": "doc003",
                    "title": "UK Data Processing Agreement",
                    "type": "agreement",
                    "jurisdiction": "UK",
                    "last_modified": "2025-03-05",
                    "status": "draft"
                }
            ]
        }
        
        return jsonify(mock_documents)
        
    # Profile public endpoint
    @app.route('/api/public/profile', methods=['GET', 'OPTIONS'])
    def public_user_profile():
        """Public mock endpoint for user profile - NO authentication required"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            return '', 200
            
        # Mock profile data
        mock_profile = {
            "success": True,
            "profile": {
                "user_id": "u123456",
                "name": "Jane Doe",
                "email": "jane.doe@example.com",
                "company": "Legal Tech Inc.",
                "role": "Legal Counsel",
                "subscription": {
                    "plan": "Professional",
                    "status": "active",
                    "expires": "2025-12-31"
                },
                "preferences": {
                    "jurisdictions": ["US/California", "EU", "UK"],
                    "notification_frequency": "weekly",
                    "theme": "light"
                }
            }
        }
        
        return jsonify(mock_profile)
    
    # Add update profile endpoint
    @app.route('/api/user/profile', methods=['PUT', 'OPTIONS'])
    @jwt_required(optional=True)
    def update_user_profile():
        if request.method == 'OPTIONS':
            return '', 200
            
        # Get profile data from request
        profile_data = request.json
        
        # In a real application, we would update the user's profile in a database
        # For demonstration, we'll just return success with the received data
        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "user": {
                "id": 1,
                "name": profile_data.get('name', 'John Doe'),
                "email": profile_data.get('email', 'john.doe@example.com'),
                "role": "admin",
                "preferences": profile_data.get('preferences', {
                    "darkMode": True,
                    "notifications": {
                        "email": True,
                        "push": False
                    },
                    "jurisdictions": ["us", "eu"]
                }),
                "lastLogin": "2023-04-15T10:30:45Z",
                "updated": datetime.now().isoformat()
            }
        })
    
    # Add endpoint for fetching users list
    @app.route('/api/users', methods=['GET', 'OPTIONS'])
    @jwt_required()  # Require authentication
    def get_users():
        """Protected endpoint for user listing - requires authentication"""
        if request.method == 'OPTIONS':
            return '', 200
            
        # Get the current user's identity
        current_user_id = get_jwt_identity()
        
        # For demonstration, we'll return mock user data
        mock_users = {
            "success": True,
            "users": [
                {
                    "id": "user123",
                    "name": "John Doe",
                    "email": "john.doe@example.com",
                    "role": "admin",
                    "lastLogin": "2023-04-15T10:30:45Z"
                },
                {
                    "id": "user456",
                    "name": "Jane Smith",
                    "email": "jane.smith@example.com",
                    "role": "editor",
                    "lastLogin": "2023-04-14T14:20:30Z"
                },
                {
                    "id": "user789",
                    "name": "Bob Johnson",
                    "email": "bob.johnson@example.com",
                    "role": "viewer",
                    "lastLogin": "2023-04-13T09:15:22Z"
                }
            ],
            "total": 3,
            "page": 1,
            "pageSize": 10
        }
        
        return jsonify(mock_users)
    
    # Add public endpoint for fetching users
    @app.route('/api/public/users', methods=['GET', 'OPTIONS'])
    def get_public_users():
        if request.method == 'OPTIONS':
            return '', 200
            
        # Return the same mock data as the authenticated endpoint
        return get_users()
    
    # Add endpoint for fetching documents
    @app.route('/api/documents', methods=['GET', 'OPTIONS'])
    @jwt_required(optional=True)
    def get_all_documents():
        if request.method == 'OPTIONS':
            return '', 200
            
        # For demonstration, we'll return mock document data
        mock_documents = {
            "success": True,
            "documents": [
                {
                    "id": "doc123",
                    "title": "Privacy Policy",
                    "description": "Updated privacy policy for 2023",
                    "created": "2023-01-15T10:30:45Z",
                    "updated": "2023-03-20T14:25:30Z",
                    "jurisdiction": "us",
                    "status": "published",
                    "author": "John Doe"
                },
                {
                    "id": "doc456",
                    "title": "Terms of Service",
                    "description": "Legal terms for service usage",
                    "created": "2023-02-10T09:15:22Z",
                    "updated": "2023-03-18T11:10:15Z",
                    "jurisdiction": "us",
                    "status": "published",
                    "author": "Jane Smith"
                },
                {
                    "id": "doc789",
                    "title": "GDPR Compliance",
                    "description": "Guidelines for GDPR compliance",
                    "created": "2023-03-05T15:45:30Z",
                    "updated": "2023-03-22T16:30:20Z",
                    "jurisdiction": "eu",
                    "status": "draft",
                    "author": "Bob Johnson"
                }
            ],
            "total": 3,
            "page": 1,
            "pageSize": 10
        }
        
        return jsonify(mock_documents)
        
    # Add public endpoint for documents
    @app.route('/api/public/documents', methods=['GET', 'OPTIONS'])
    def get_public_documents():
        if request.method == 'OPTIONS':
            return '', 200
            
        # Return the same mock data as the authenticated endpoint
        return get_all_documents()
    
    # Add public endpoint for profile updates - for testing only
    @app.route('/api/public/user/profile', methods=['PUT', 'OPTIONS'])
    def update_public_user_profile():
        if request.method == 'OPTIONS':
            # Add CORS headers directly for preflight requests
            response = make_response('', 200)
            origin = request.headers.get('Origin')
            if origin in cors_origins or '*' in cors_origins:
                response.headers.add('Access-Control-Allow-Origin', origin)
                response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Debug-Client, x-debug-client')
                response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                response.headers.add('Access-Control-Expose-Headers', 'Authorization, Content-Type')
                response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
            
        # Get profile data from request
        profile_data = request.json
        logger.info(f"Received profile update with data: {profile_data}")
        
        # In a real application, we would update the user's profile in a database
        # For demonstration, we'll just return success with the received data
        # Make sure we're correctly mapping the fields from the form to match
        # what the frontend expects in its user object
        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "user": {
                "id": "user123",
                "first_name": profile_data.get('first_name', 'John'),
                "last_name": profile_data.get('last_name', 'Doe'),
                "email": profile_data.get('email', 'john.doe@example.com'),
                "company": profile_data.get('company', 'ACME Inc'),
                "role": "admin",
                "preferences": profile_data.get('preferences', {
                    "darkMode": True,
                    "notifications": {
                        "email": True,
                        "push": False
                    },
                    "jurisdictions": ["us", "eu"]
                }),
                "lastLogin": "2023-04-15T10:30:45Z",
                "updated": datetime.now().isoformat()
            }
        })
    
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
    
    app.config.update(
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        PERMANENT_SESSION_LIFETIME=timedelta(hours=1)
    )
    
    # Set Redis URL with fallback to localhost if not specified in environment
    app.config['REDIS_URL'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    
    # Initialize rate limiter with safer error handling
    try:
        limiter = Limiter(
            app=app,
            key_func=get_remote_address,
            default_limits=["1000 per day", "200 per hour"],  # More lenient limits for development
            storage_uri=app.config['REDIS_URL'],
            storage_options={"connection_pool": redis.ConnectionPool.from_url(app.config['REDIS_URL'])}
        )

        # Set higher rate limits for public endpoints
        @limiter.limit("300 per hour")
        @app.route('/api/public/test-connection', methods=['GET'])
        def rate_limited_test_connection():
            return public_test_connection()

        # Add error handling for rate limiter
        @app.errorhandler(429)
        def ratelimit_handler(e):
            return jsonify({
                'success': False,
                'message': 'Rate limit exceeded',
                'retry_after': e.description
            }), 429
    except Exception as e:
        logger.error(f"Failed to initialize rate limiter: {e}")
        # Continue without rate limiting if Redis is not available
        pass

    return app

app = create_app()

@app.route('/test', methods=['GET'])
def test():
    return {"message": "API is working!"}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=3001)
