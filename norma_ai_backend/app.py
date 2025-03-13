import os
from flask import Flask, jsonify, request, make_response, send_from_directory
import flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, jwt_required
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

# Load environment variables from .env file if it exists
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app(config_class=Config):
    app = Flask(__name__, static_folder='static')
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
    jwt = JWTManager(app)

    # Create a custom JWT error handler to bypass validation for test tokens
    @jwt.token_in_blocklist_loader
    def check_if_token_in_blocklist(jwt_header, jwt_payload):
        # Check if this is a test token and bypass validation
        token = request.headers.get('Authorization', '')
        if token.startswith('Bearer test-'):
            return False
        return False  # For testing, all tokens are valid

    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        # For development, check if using a test token and bypass validation
        token = request.headers.get('Authorization', '')
        if token.startswith('Bearer test-'):
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
        'http://localhost:52527',
        'http://127.0.0.1:52527',
        'http://localhost:55505',
        'http://127.0.0.1:55505'
    ]
    
    # Proper CORS configuration with correct headers and OPTIONS handling
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        
        # If origin is in our allowed origins or we're allowing all origins (*)
        if origin in cors_origins or '*' in cors_origins:
            response.headers.add('Access-Control-Allow-Origin', origin)
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.add('Access-Control-Expose-Headers', 'Authorization, Content-Type')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
        
        # Log response status and headers for debugging
        logger.info(f"Response: {response.status} - Headers: {dict(response.headers)}")
        return response
        
    # Handle OPTIONS requests globally
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        logger.info(f"OPTIONS request for path: {path}")
        response = app.make_default_options_response()
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
    
    # Add a completely public endpoint for jurisdictions without JWT validation
    @app.route('/api/jurisdictions', methods=['GET', 'OPTIONS'])
    def get_jurisdictions():
        """Mock endpoint for available jurisdictions - NO authentication required"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            response = app.make_default_options_response()
            return response
            
        # Mock data for jurisdictions
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
    
    # Add endpoint for user profile updates
    @app.route('/api/user/profile', methods=['GET', 'PUT', 'OPTIONS'])
    def user_profile():
        """Mock endpoint for user profile operations"""
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")
        
        if request.method == 'OPTIONS':
            response = app.make_default_options_response()
            return response
            
        # Mock user profile data
        mock_profile = {
            "success": True,
            "profile": {
                "id": 1,
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
                "last_login": "2025-03-13T10:30:00Z",
                "account_created": "2024-09-01T08:00:00Z"
            }
        }
        
        # Handle profile update
        if request.method == 'PUT':
            try:
                update_data = request.json
                logger.info(f"Profile update data: {update_data}")
                
                # In a real app, we would update the profile here
                # For the mock, we'll just merge the update data with the existing profile
                if update_data and isinstance(update_data, dict):
                    if 'profile' in update_data:
                        update_data = update_data['profile']
                    
                    # Update only the provided fields
                    for key, value in update_data.items():
                        if key in mock_profile['profile']:
                            mock_profile['profile'][key] = value
                        elif key == 'preferences' and isinstance(value, dict):
                            for pref_key, pref_value in value.items():
                                mock_profile['profile']['preferences'][pref_key] = pref_value
                
                return jsonify({
                    "success": True,
                    "message": "Profile updated successfully",
                    "profile": mock_profile['profile']
                })
            except Exception as e:
                logger.error(f"Error updating profile: {str(e)}")
                return jsonify({
                    "success": False,
                    "message": f"Error updating profile: {str(e)}"
                }), 500
        
        # Handle profile retrieval
        return jsonify(mock_profile)
    
    return app

app = create_app()

@app.route('/test', methods=['GET'])
def test():
    return {"message": "API is working!"}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=3001)
