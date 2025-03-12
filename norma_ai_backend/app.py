import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from config import Config
from models import db
from routes.auth import auth_bp
from routes.users import users_bp
from routes.documents import documents_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
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
    # Abilita la modalità debug molto dettagliata
    import logging
    logging.basicConfig(level=logging.DEBUG)
    
    app.run(debug=True, port=5001)
