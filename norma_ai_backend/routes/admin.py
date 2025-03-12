from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, User
from services.auth_middleware import admin_required
from services.auth_service import validate_registration_data

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/admin/users', methods=['GET'])
@jwt_required()
@admin_required()
def get_users():
    """Get all users (admin only)."""
    
    # Get query parameters for pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    # Query users with pagination
    users_pagination = User.query.paginate(page=page, per_page=per_page, error_out=False)
    total_users = users_pagination.total
    users = users_pagination.items
    
    # Prepare response
    users_data = [user.to_dict() for user in users]
    
    return jsonify({
        "success": True,
        "message": "Users retrieved successfully",
        "users": users_data,
        "pagination": {
            "total": total_users,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_users + per_page - 1) // per_page
        }
    }), 200

@admin_bp.route('/admin/users', methods=['POST'])
@jwt_required()
@admin_required()
def create_user():
    """Create a new user (admin only)."""
    data = request.get_json()
    
    # Validate user data
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
        company=data.get('company', ''),
        role=data.get('role', 'user')  # Admin can specify role
    )
    new_user.set_password(data['password'])
    
    # Save user to database
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "User created successfully",
        "user": new_user.to_dict()
    }), 201

@admin_bp.route('/admin/users/<int:user_id>', methods=['GET'])
@jwt_required()
@admin_required()
def get_user(user_id):
    """Get a specific user (admin only)."""
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    return jsonify({
        "success": True,
        "message": "User retrieved successfully",
        "user": user.to_dict()
    }), 200

@admin_bp.route('/admin/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@admin_required()
def update_user(user_id):
    """Update a user (admin only)."""
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    data = request.get_json()
    
    # Update user data
    if 'email' in data:
        # Check if email is already taken by another user
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({"success": False, "message": "Email already registered"}), 400
        user.email = data['email']
    
    if 'first_name' in data:
        user.first_name = data['first_name']
    
    if 'last_name' in data:
        user.last_name = data['last_name']
    
    if 'company' in data:
        user.company = data['company']
    
    if 'role' in data:
        # Validate role
        if data['role'] not in ['user', 'admin']:
            return jsonify({"success": False, "message": "Invalid role"}), 400
        user.role = data['role']
    
    if 'password' in data:
        user.set_password(data['password'])
    
    # Save changes
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "User updated successfully",
        "user": user.to_dict()
    }), 200

@admin_bp.route('/admin/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@admin_required()
def delete_user(user_id):
    """Delete a user (admin only)."""
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    # Delete user
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "User deleted successfully"
    }), 200
