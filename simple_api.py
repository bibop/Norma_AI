#!/usr/bin/env python3
"""
Simple API server for Norma AI authentication testing
"""

import os
import logging
from datetime import datetime
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Helper function to add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin', '*')
    response.headers.add('Access-Control-Allow-Origin', origin)
    response.headers.add('Access-Control-Allow-Headers', 
                        'Content-Type, Authorization, X-Requested-With, X-Debug-Client')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Max-Age', '86400')  # 24 hours
    logger.info(f"Response: {response.status_code} - Headers: {dict(response.headers)}")
    return response

# Log all requests
@app.before_request
def log_request():
    logger.info(f"Request: {request.method} {request.path} - Headers: {dict(request.headers)}")

# Test connection endpoint
@app.route('/api/test-connection', methods=['GET', 'OPTIONS'])
def test_connection():
    """Test connection to the API server"""
    if request.method == 'OPTIONS':
        return '', 200
        
    return jsonify({
        'success': True,
        'message': 'API server is reachable',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

# Basic login endpoint
@app.route('/api/basic-login', methods=['POST', 'OPTIONS'])
def basic_login():
    """Simple login endpoint for testing"""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        logger.info(f"Login request data: {data}")
        
        # For test purposes, any credentials are accepted
        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": "test-token-12345",
            "access_token": "test-token-12345", 
            "user": {
                "id": 1,
                "email": data.get('email', 'user@example.com'),
                "firstName": "Test",
                "lastName": "User",
                "role": "admin"
            }
        })
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Login error: {str(e)}"
        }), 500

# Profile endpoint
@app.route('/api/profile', methods=['GET', 'OPTIONS'])
def get_profile():
    """Return mock profile data for testing"""
    # Handle preflight request
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        # Log request details for debugging
        auth_header = request.headers.get('Authorization')
        logger.info(f"Profile request received. Headers: {dict(request.headers)}")
        
        # Check for missing authorization header
        if not auth_header:
            logger.warning("Authorization header missing in profile request")
            return jsonify({
                'success': False,
                'message': 'Authorization header required'
            }), 401
            
        # Log the token format
        logger.info(f"Auth header format: {auth_header}")
        
        # Validate Bearer token format
        if not auth_header.startswith('Bearer '):
            logger.warning(f"Invalid auth header format: {auth_header}")
            return jsonify({
                'success': False,
                'message': 'Invalid authorization format. Expected: Bearer TOKEN'
            }), 401
        
        # Extract and validate token
        token = auth_header.split(' ')[1]
        logger.info(f"Token extracted: {token}")
        
        # Accept either test-token-12345 or any token starting with 'test-'
        if token == 'test-token-12345' or token.startswith('test-'):
            logger.info(f"Valid test token: {token}")
            # Mock profile data
            return jsonify({
                'success': True,
                'profile': {
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
                    },
                    'preferences': {
                        'jurisdictions': ['US', 'EU', 'UK'],
                        'updateFrequency': 'daily',
                        'categories': ['tax', 'corporate', 'employment']
                    }
                }
            })
        else:
            logger.warning(f"Invalid token: {token}")
            return jsonify({
                'success': False,
                'message': 'Invalid token'
            }), 401
            
    except Exception as e:
        # Log the full exception
        logger.error(f"Error in get_profile: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

# Legal updates endpoint
@app.route('/api/legal-updates', methods=['GET', 'OPTIONS'])
def get_legal_updates():
    """Return mock legal updates data for testing"""
    # Handle preflight request
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        # Log request details for debugging
        auth_header = request.headers.get('Authorization')
        logger.info(f"Legal updates request received. Headers: {dict(request.headers)}")
        
        # Check for missing authorization header
        if not auth_header:
            logger.warning("Authorization header missing in legal updates request")
            return jsonify({
                'success': False,
                'message': 'Authorization header required'
            }), 401
            
        # Log the token format
        logger.info(f"Auth header format: {auth_header}")
        
        # Validate Bearer token format
        if not auth_header.startswith('Bearer '):
            logger.warning(f"Invalid auth header format: {auth_header}")
            return jsonify({
                'success': False,
                'message': 'Invalid authorization format. Expected: Bearer TOKEN'
            }), 401
        
        # Extract and validate token
        token = auth_header.split(' ')[1]
        logger.info(f"Token extracted: {token}")
        
        # Accept either test-token-12345 or any token starting with 'test-'
        if token == 'test-token-12345' or token.startswith('test-'):
            logger.info(f"Valid test token: {token}")
            # Mock legal updates data
            return jsonify({
                'success': True,
                'updates': [
                    {
                        'id': 1,
                        'title': 'New Tax Regulations 2025',
                        'summary': 'Summary of the new tax regulations for 2025',
                        'content': 'Detailed content about the new tax regulations...',
                        'publishDate': '2025-03-10T14:30:00Z',
                        'category': 'tax',
                        'jurisdiction': 'US',
                        'importance': 'high'
                    },
                    {
                        'id': 2,
                        'title': 'EU Corporate Governance Update',
                        'summary': 'New corporate governance guidelines in EU',
                        'content': 'Detailed content about corporate governance...',
                        'publishDate': '2025-03-08T10:15:00Z',
                        'category': 'corporate',
                        'jurisdiction': 'EU',
                        'importance': 'medium'
                    },
                    {
                        'id': 3,
                        'title': 'UK Employment Law Changes',
                        'summary': 'Recent updates to UK employment laws',
                        'content': 'Detailed content about employment law changes...',
                        'publishDate': '2025-03-05T08:45:00Z',
                        'category': 'employment',
                        'jurisdiction': 'UK',
                        'importance': 'high'
                    }
                ]
            })
        else:
            logger.warning(f"Invalid token: {token}")
            return jsonify({
                'success': False,
                'message': 'Invalid token'
            }), 401
            
    except Exception as e:
        # Log the full exception
        logger.error(f"Error in get_legal_updates: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))
    app.run(debug=True, host='0.0.0.0', port=port)
