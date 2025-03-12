from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from services.auth_service import validate_email

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get the profile information of the current user."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    return jsonify({
        "success": True,
        "message": "Profile retrieved successfully",
        "user": user.to_dict()
    }), 200

@profile_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update the profile information of the current user."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    data = request.get_json()
    
    # Update basic profile information
    if 'first_name' in data:
        user.first_name = data['first_name']
    
    if 'last_name' in data:
        user.last_name = data['last_name']
    
    if 'company' in data:
        user.company = data['company']
    
    # Update email (with validation)
    if 'email' in data and data['email'] != user.email:
        # Check email format
        if not validate_email(data['email']):
            return jsonify({"success": False, "message": "Invalid email format"}), 400
        
        # Check if email is already taken by another user
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({"success": False, "message": "Email already registered"}), 400
        
        user.email = data['email']
    
    # Update password
    if 'current_password' in data and 'new_password' in data:
        # Verify current password
        if not user.check_password(data['current_password']):
            return jsonify({"success": False, "message": "Current password is incorrect"}), 400
        
        # Validate password length
        if len(data['new_password']) < 6:
            return jsonify({"success": False, "message": "Password must be at least 6 characters"}), 400
        
        # Set new password
        user.set_password(data['new_password'])
    
    # Save changes
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Profile updated successfully",
        "user": user.to_dict()
    }), 200
