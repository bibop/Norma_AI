from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, db

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

@users_bp.route('/users/profile', methods=['GET'])
@jwt_required()
def get_user_profile():
    """Get the current user's profile."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404
    
    return jsonify({
        "success": True,
        "message": "Profile retrieved successfully",
        "user": user.to_dict()
    }), 200

@users_bp.route('/users/preferences/jurisdictions', methods=['POST'])
@jwt_required()
def update_user_jurisdictions():
    """Update the user's preferred jurisdictions."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404
    
    data = request.json
    
    # Update the primary jurisdiction
    if 'preferred_jurisdiction' in data:
        user.preferred_jurisdiction = data['preferred_jurisdiction']
    
    # Update the list of preferred jurisdictions
    if 'preferred_jurisdictions' in data:
        # Ensure the primary jurisdiction is in the list
        jurisdictions = data['preferred_jurisdictions']
        if user.preferred_jurisdiction not in jurisdictions:
            jurisdictions.append(user.preferred_jurisdiction)
        
        user.set_preferred_jurisdictions(jurisdictions)
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Jurisdictions updated successfully",
        "user": user.to_dict()
    }), 200

@users_bp.route('/users/preferences/legal-sources', methods=['POST'])
@jwt_required()
def update_user_legal_sources():
    """Update the user's preferred legal update sources."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404
    
    data = request.json
    
    if 'preferred_legal_sources' in data:
        sources = data['preferred_legal_sources']
        if not sources:
            return jsonify({
                "success": False,
                "message": "At least one legal source must be selected"
            }), 400
            
        user.set_preferred_legal_sources(sources)
        db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Legal sources updated successfully",
        "user": user.to_dict()
    }), 200

@users_bp.route('/jurisdictions', methods=['GET'])
@jwt_required()
def get_available_jurisdictions():
    """Get a list of available jurisdictions for the system."""
    # In a production system, this would likely come from a database
    jurisdictions = [
        { "code": "us", "name": "United States", "description": "US federal and state laws including CCPA, HIPAA, ADA, etc." },
        { "code": "eu", "name": "European Union", "description": "EU regulations including GDPR, ePrivacy, Digital Services Act, etc." },
        { "code": "uk", "name": "United Kingdom", "description": "UK laws including UK GDPR, Data Protection Act, PECR, etc." },
        { "code": "ca", "name": "Canada", "description": "Canadian regulations including PIPEDA, CASL, etc." },
        { "code": "au", "name": "Australia", "description": "Australian laws including Privacy Act, Consumer Law, etc." },
        { "code": "it", "name": "Italy", "description": "Italian regulations including Privacy Code, Consumer Code, etc." },
        { "code": "de", "name": "Germany", "description": "German regulations including BDSG, Telemedia Act, etc." },
        { "code": "fr", "name": "France", "description": "French regulations including Data Protection Act, Consumer Code, etc." }
    ]
    
    return jsonify({
        "success": True,
        "message": "Jurisdictions retrieved successfully",
        "jurisdictions": jurisdictions
    }), 200
