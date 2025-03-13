import os
from flask import Flask, jsonify, request, make_response, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from config import Config
from models import db, User
from routes.auth import auth_bp
from routes.users import users_bp
from routes.documents import documents_bp
from routes.admin import admin_bp
from routes.profile import profile_bp
from routes.legal_updates import legal_updates_bp
from datetime import datetime
import logging

# Load environment variables from .env file if it exists
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app(config_class=Config):
    app = Flask(__name__)
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
    jwt = JWTManager(app)
    
    # JWT configuration callbacks
    @jwt.user_identity_loader
    def user_identity_lookup(user_id):
        return str(user_id)
    
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return identity
    
    # Enhanced CORS setup - accept requests from any origin
    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "X-Debug-Client"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "supports_credentials": True,
            "max_age": 86400
        }
    })

    # Fix CORS issues by adding headers to all responses
    @app.after_request
    def add_cors_headers(response):
        # Get the origin from the request
        origin = request.headers.get('Origin', '*')
        
        # Log the origin for debugging
        logger.info(f"Setting CORS headers for origin: {origin}")
        
        # Set CORS headers on every response
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Headers', 
                            'Content-Type,Authorization,X-Requested-With,X-Debug-Client')
        response.headers.add('Access-Control-Allow-Methods', 
                            'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', '86400')  # 24 hours
        
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
    
    # Add test connection and diagnostics endpoints
    @app.route('/api/test-connection', methods=['GET', 'OPTIONS'])
    def test_connection():
        """Test endpoint to verify API connectivity"""
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            return jsonify({
                'success': True,
                'message': 'Connection successful',
                'server_time': str(datetime.now()),
                'env': os.environ.get('FLASK_ENV', 'development')
            })
        except Exception as e:
            logger.error(f"Error in test_connection: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Error: {str(e)}'
            }), 500
    
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
    
    @app.route('/api/profile', methods=['GET', 'OPTIONS'])
    def get_profile():
        """Return mock profile data for testing"""
        # Handle preflight request
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            # Log request details for debugging
            auth_header = request.headers.get('Authorization')
            logger.info(f"Profile request received. Headers: {dict(request.headers)}")
            
            # Check for missing authorization header
            if not auth_header:
                logger.warning("Authorization header missing in profile request")
                return jsonify({
                    'success': False,
                    'message': 'Authorization header required'
                }), 401
                
            # Log the token format
            logger.info(f"Auth header format: {auth_header}")
            
            # Validate Bearer token format
            if not auth_header.startswith('Bearer '):
                logger.warning(f"Invalid auth header format: {auth_header}")
                return jsonify({
                    'success': False,
                    'message': 'Invalid authorization format. Expected: Bearer TOKEN'
                }), 401
            
            # Extract and validate token
            token = auth_header.split(' ')[1]
            logger.info(f"Token extracted: {token}")
            
            # Accept either test-token-12345 or any token starting with 'test-'
            if token == 'test-token-12345' or token.startswith('test-'):
                logger.info(f"Valid test token: {token}")
                # Mock profile data
                return jsonify({
                    'success': True,
                    'profile': {
                        'id': 1,
                        'email': 'user@example.com',
                        'firstName': 'Test',
                        'lastName': 'User',
                        'role': 'admin',
                        'createdAt': '2025-01-01T00:00:00Z',
                        'lastLogin': '2025-03-13T09:00:00Z',
                        'settings': {
                            'notifications': True,
                            'theme': 'light'
                        },
                        'preferences': {
                            'jurisdictions': ['US', 'EU', 'UK'],
                            'updateFrequency': 'daily',
                            'categories': ['tax', 'corporate', 'employment']
                        }
                    }
                })
            else:
                logger.warning(f"Invalid token: {token}")
                return jsonify({
                    'success': False,
                    'message': 'Invalid token'
                }), 401
                
        except Exception as e:
            # Log the full exception
            logger.error(f"Error in get_profile: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'message': f'Server error: {str(e)}'
            }), 500
    
    @app.route('/api/legal-updates', methods=['GET', 'OPTIONS'])
    def get_legal_updates():
        """Return mock legal updates data for testing"""
        # Handle preflight request
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            # Log request details for debugging
            auth_header = request.headers.get('Authorization')
            logger.info(f"Legal updates request received. Headers: {dict(request.headers)}")
            
            # Check for missing authorization header
            if not auth_header:
                logger.warning("Authorization header missing in legal updates request")
                return jsonify({
                    'success': False,
                    'message': 'Authorization header required'
                }), 401
                
            # Log the token format
            logger.info(f"Auth header format: {auth_header}")
            
            # Validate Bearer token format
            if not auth_header.startswith('Bearer '):
                logger.warning(f"Invalid auth header format: {auth_header}")
                return jsonify({
                    'success': False,
                    'message': 'Invalid authorization format. Expected: Bearer TOKEN'
                }), 401
            
            # Extract and validate token
            token = auth_header.split(' ')[1]
            logger.info(f"Token extracted: {token}")
            
            # Accept either test-token-12345 or any token starting with 'test-'
            if token == 'test-token-12345' or token.startswith('test-'):
                logger.info(f"Valid test token: {token}")
                # Mock legal updates data
                return jsonify({
                    'success': True,
                    'updates': [
                        {
                            'id': 1,
                            'title': 'New Tax Regulations 2025',
                            'summary': 'Summary of the new tax regulations for 2025',
                            'content': 'Detailed content about the new tax regulations...',
                            'publishDate': '2025-03-10T14:30:00Z',
                            'category': 'tax',
                            'jurisdiction': 'US',
                            'importance': 'high'
                        },
                        {
                            'id': 2,
                            'title': 'EU Corporate Governance Update',
                            'summary': 'New corporate governance guidelines in EU',
                            'content': 'Detailed content about corporate governance...',
                            'publishDate': '2025-03-08T10:15:00Z',
                            'category': 'corporate',
                            'jurisdiction': 'EU',
                            'importance': 'medium'
                        },
                        {
                            'id': 3,
                            'title': 'UK Employment Law Changes',
                            'summary': 'Recent updates to UK employment laws',
                            'content': 'Detailed content about employment law changes...',
                            'publishDate': '2025-03-05T08:45:00Z',
                            'category': 'employment',
                            'jurisdiction': 'UK',
                            'importance': 'high'
                        }
                    ]
                })
            else:
                logger.warning(f"Invalid token: {token}")
                return jsonify({
                    'success': False,
                    'message': 'Invalid token'
                }), 401
                
        except Exception as e:
            # Log the full exception
            logger.error(f"Error in get_legal_updates: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'message': f'Server error: {str(e)}'
            }), 500
    
    @app.route('/api/documents', methods=['GET', 'OPTIONS'])
    def get_documents():
        """Return mock documents data for testing"""
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            # Log the authorization header for debugging
            auth_header = request.headers.get('Authorization')
            logger.info(f"Documents request with auth header: {auth_header}")
            
            # Check for valid authorization
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({
                    'success': False,
                    'message': 'Authorization required'
                }), 401
                
            # Extract token
            token = auth_header.split(' ')[1]
            
            # In test mode, accept either the specific test token or any token that starts with 'test-'
            if token != 'test-token-12345' and not token.startswith('test-'):
                return jsonify({
                    'success': False,
                    'message': 'Invalid token'
                }), 401
            
            # Mock documents data
            return jsonify({
                'success': True,
                'documents': [
                    {
                        'id': 1,
                        'title': 'Annual Tax Report 2025',
                        'filename': 'tax_report_2025.pdf',
                        'uploadDate': '2025-02-15T10:30:00Z',
                        'fileSize': 1250000,
                        'fileType': 'pdf',
                        'status': 'processed',
                        'tags': ['tax', 'annual', '2025']
                    },
                    {
                        'id': 2,
                        'title': 'Corporate Compliance Guidelines',
                        'filename': 'compliance_guidelines.docx',
                        'uploadDate': '2025-01-20T14:45:00Z',
                        'fileSize': 890000,
                        'fileType': 'docx',
                        'status': 'processed',
                        'tags': ['corporate', 'compliance', 'guidelines']
                    },
                    {
                        'id': 3,
                        'title': 'Employee Handbook 2025',
                        'filename': 'employee_handbook.pdf',
                        'uploadDate': '2025-01-05T08:15:00Z',
                        'fileSize': 2100000,
                        'fileType': 'pdf',
                        'status': 'processed',
                        'tags': ['employment', 'handbook', '2025']
                    }
                ]
            })
        except Exception as e:
            logger.error(f"Error in get_documents: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Server error: {str(e)}'
            }), 500
    
    # Additional test endpoints for frontend components
    @app.route('/api/cors-test', methods=['GET', 'POST', 'OPTIONS'])
    def cors_test():
        """Special endpoint for debugging CORS issues"""
        if request.method == 'OPTIONS':
            # Handle preflight request with all possible headers
            response = make_response()
            response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Headers', 
                                'Content-Type, Authorization, X-Requested-With, X-Debug-Client')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            response.headers.add('Access-Control-Max-Age', '86400')  # 24 hours
            return response, 200
            
        # Regular request
        if request.method == 'GET':
            response_data = {
                'success': True,
                'message': 'CORS test successful',
                'method': 'GET',
                'timestamp': datetime.now().isoformat(),
                'request_headers': dict(request.headers),
                'origin': request.headers.get('Origin', 'No origin header')
            }
        else:  # POST
            try:
                request_body = request.get_json() or {}
            except:
                request_body = {'error': 'Could not parse JSON body'}
                
            response_data = {
                'success': True,
                'message': 'CORS test successful',
                'method': 'POST',
                'timestamp': datetime.now().isoformat(),
                'request_headers': dict(request.headers),
                'request_body': request_body,
                'origin': request.headers.get('Origin', 'No origin header')
            }
            
        # Create response with explicit CORS headers
        response = jsonify(response_data)
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    return app

app = create_app()

@app.route('/test', methods=['GET'])
def test():
    return {"message": "API is working!"}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5001)
