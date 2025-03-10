import re
import string
import random
from flask_jwt_extended import get_jwt_identity
from models import User

def generate_password(length=12):
    """Generate a secure random password."""
    # Define character sets
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    special_chars = '!@#$%^&*()-_=+[]{}|;:,.<>?'
    
    # Ensure at least one character from each set
    password = [
        random.choice(lowercase),
        random.choice(uppercase),
        random.choice(digits),
        random.choice(special_chars)
    ]
    
    # Fill the rest of the password
    all_chars = lowercase + uppercase + digits + special_chars
    password.extend(random.choice(all_chars) for _ in range(length - 4))
    
    # Shuffle the password
    random.shuffle(password)
    
    return ''.join(password)

def is_admin(user_id):
    """Check if the user is an admin."""
    user = User.query.filter_by(id=user_id).first()
    if user and user.role == 'admin':
        return True
    return False

def admin_required(func):
    """Decorator to require admin privileges for a route."""
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        if not is_admin(user_id):
            return {"success": False, "message": "Admin privileges required"}, 403
        return func(*args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper
