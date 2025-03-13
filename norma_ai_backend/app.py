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
    
    # Configure CORS to allow all origins during development
    CORS(app, resources={r"/api/*": {
        "origins": "*",
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "X-Debug-Client"],
        "methods": ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
        "supports_credentials": True,
        "max_age": 86400
    }})

    # Log all requests for debugging
    @app.before_request
    def log_request():
        logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")

    # Log all responses for debugging
    @app.after_request
    def log_response(response):
        logger.info(f"Response: {response.status_code} - Headers: {dict(response.headers)}")
        return response

    # Make sure all responses include CORS headers
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,X-Debug-Client')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', '86400')  # 24 hours
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
        """Simplified login endpoint for testing"""
        if request.method == 'OPTIONS':
            return '', 200
        
        try:
            # Get the request data
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'message': 'No data provided'}), 400
            
            email = data.get('email', '')
            password = data.get('password', '')
            
            if not email or not password:
                return jsonify({'success': False, 'message': 'Email and password required'}), 400
            
            # For testing, accept any credentials
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'access_token': 'test-token-12345',
                'user': {
                    'id': 1,
                    'email': email
                }
            }), 200
            
        except Exception as e:
            logger.error(f"Error in basic login: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Server error: {str(e)}'
            }), 500
    
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
    
    # Additional test endpoints for frontend components
    @app.route('/api/user/profile', methods=['GET', 'OPTIONS'])
    def get_user_profile():
        """Return mock user profile data for testing"""
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            # Mock user profile data
            return jsonify({
                'success': True,
                'user': {
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
                    }
                }
            })
        except Exception as e:
            logger.error(f"Error in get_user_profile: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Server error: {str(e)}'
            }), 500
    
    @app.route('/api/legal-updates', methods=['GET', 'OPTIONS'])
    def get_legal_updates():
        """Return mock legal updates data for testing"""
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            # Mock legal updates data
            return jsonify({
                'success': True,
                'updates': [
                    {
                        'id': 1,
                        'title': 'New Tax Regulations 2025',
                        'summary': 'Updates to corporate tax regulations for fiscal year 2025',
                        'date': '2025-03-01T00:00:00Z',
                        'category': 'Tax',
                        'url': 'https://example.com/tax-updates-2025'
                    },
                    {
                        'id': 2,
                        'title': 'GDPR Compliance Update',
                        'summary': 'New guidelines for GDPR compliance in AI applications',
                        'date': '2025-02-15T00:00:00Z',
                        'category': 'Compliance',
                        'url': 'https://example.com/gdpr-ai-2025'
                    },
                    {
                        'id': 3,
                        'title': 'Employment Law Changes',
                        'summary': 'Recent changes to employment law affecting remote workers',
                        'date': '2025-01-20T00:00:00Z',
                        'category': 'Employment',
                        'url': 'https://example.com/employment-remote-2025'
                    }
                ]
            })
        except Exception as e:
            logger.error(f"Error in get_legal_updates: {str(e)}")
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
                        'title': 'Employee Handbook v2',
                        'filename': 'employee_handbook_v2.docx',
                        'uploadDate': '2025-01-20T14:15:00Z',
                        'fileSize': 3540000,
                        'fileType': 'docx',
                        'status': 'processed',
                        'tags': ['HR', 'policies']
                    },
                    {
                        'id': 3,
                        'title': 'Client Agreement Template',
                        'filename': 'client_agreement_template.docx',
                        'uploadDate': '2025-03-01T09:45:00Z',
                        'fileSize': 850000,
                        'fileType': 'docx',
                        'status': 'processed',
                        'tags': ['legal', 'agreement', 'template']
                    }
                ],
                'totalCount': 3,
                'page': 1,
                'pageSize': 10
            })
        except Exception as e:
            logger.error(f"Error in get_documents: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Server error: {str(e)}'
            }), 500
    
    return app

app = create_app()

@app.route('/test', methods=['GET'])
def test():
    return {"message": "API is working!"}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5001)
