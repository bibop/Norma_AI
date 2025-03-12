import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from config import Config
from models import db
from routes.auth import auth_bp
from routes.users import users_bp
from routes.documents import documents_bp
from routes.admin import admin_bp
from routes.profile import profile_bp

# Load environment variables from .env file if it exists
load_dotenv()

def create_app(config_class=Config):
    app = Flask(__name__)
    app_env = os.environ.get('FLASK_ENV', 'development')
    if app_env == 'production':
        # Use DATABASE_URL from environment (provided by Render)
        app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
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
    
    # Configurazione CORS corretta con parametri standard
    CORS(app, 
         origins="http://localhost:3000",
         headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE"],
         supports_credentials=True)
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(users_bp, url_prefix='/api')
    app.register_blueprint(documents_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(profile_bp, url_prefix='/api')
    
    @app.route('/')
    def index():
        return {"message": "Welcome to NORMA AI API"}
    
    @app.route('/api/test', methods=['GET'])
    def test_api():
        return jsonify({"message": "API is working"})
    
    return app

app = create_app()

@app.route('/test', methods=['GET'])
def test():
    return {"message": "API is working!"}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5001)
