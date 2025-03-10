from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User
from services.auth_service import validate_registration_data, validate_login_data

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    
    # Validate registration data
    validation_result = validate_registration_data(data)
    if validation_result['success'] is False:
        return jsonify(validation_result), 400
    
    # Check if user already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"success": False, "message": "Email already registered"}), 400
    
    # Create new user
    new_user = User(
        email=data['email'],
        first_name=data['first_name'],
        last_name=data['last_name'],
        company=data.get('company', '')
    )
    new_user.set_password(data['password'])
    
    # Save user to database
    db.session.add(new_user)
    db.session.commit()
    
    # Generate access token
    access_token = create_access_token(identity=new_user.id)
    
    return jsonify({
        "success": True,
        "message": "User registered successfully",
        "user": new_user.to_dict(),
        "access_token": access_token
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login a user and return JWT token."""
    data = request.get_json()
    
    # Validate login data
    validation_result = validate_login_data(data)
    if validation_result['success'] is False:
        return jsonify(validation_result), 400
    
    # Find user by email
    user = User.query.filter_by(email=data['email']).first()
    
    # Check if user exists and password is correct
    if user is None or not user.check_password(data['password']):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401
    
    # Generate access token
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": user.to_dict(),
        "access_token": access_token
    }), 200
