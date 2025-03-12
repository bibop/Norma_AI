import functools
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from models import User

def admin_required():
    """
    Decorator to protect routes that require admin privileges.
    Must be applied after jwt_required() decorator.
    """
    def wrapper(fn):
        @functools.wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            user_id = int(get_jwt_identity())
            user = User.query.filter_by(id=user_id).first()
            
            if not user or user.role != 'admin':
                return jsonify({"success": False, "message": "Admin privileges required"}), 403
            
            return fn(*args, **kwargs)
        return decorator
    return wrapper
