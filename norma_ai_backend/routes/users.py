from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import User

users_bp = Blueprint('users', __name__)

@users_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (for debugging)."""
    users = User.query.all()
    users_data = [user.to_dict() for user in users]
    
    return jsonify({
        "success": True,
        "message": "Users retrieved successfully",
        "users": users_data
    }), 200
