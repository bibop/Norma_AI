import pytest
import redis
from flask import Flask
import jwt
from datetime import datetime, timedelta

def test_public_endpoints(client):
    """Test public endpoints are accessible without authentication"""
    public_routes = [
        '/api/public/test-connection',
        '/api/public/jurisdictions',
        '/api/public/legal-updates',
        '/api/public/documents',
        '/api/public/profile'
    ]
    
    for route in public_routes:
        response = client.get(route)
        assert response.status_code != 401, f"Public route {route} should not require authentication"

def test_protected_endpoints(client):
    """Test protected endpoints require authentication"""
    protected_routes = [
        '/api/profile',
        '/api/documents',
        '/api/legal-updates'
    ]
    
    for route in protected_routes:
        response = client.get(route)
        assert response.status_code == 401, f"Protected route {route} should require authentication"

def test_rate_limiting(client):
    """Test rate limiting functionality"""
    # Make 101 requests to a rate-limited endpoint
    for i in range(101):
        response = client.get('/api/public/test-connection')
        if i == 100:  # Should hit rate limit on 101st request
            assert response.status_code == 429, "Rate limiting should be enforced"

def test_token_blocklist(app, client):
    """Test token blocklist functionality"""
    # Create a test token
    with app.app_context():
        test_token = jwt.encode(
            {'user_id': 1, 'exp': datetime.utcnow() + timedelta(hours=1)},
            app.config['JWT_SECRET_KEY']
        )
    
    # Use token before blocking
    headers = {'Authorization': f'Bearer {test_token}'}
    response = client.get('/api/profile', headers=headers)
    assert response.status_code != 401, "Token should be valid before blocking"
    
    # Block the token
    client.post('/api/auth/logout', headers=headers)
    
    # Try using blocked token
    response = client.get('/api/profile', headers=headers)
    assert response.status_code == 401, "Blocked token should be rejected"

def test_cors_headers(client):
    """Test CORS headers are properly set"""
    headers = {'Origin': 'http://localhost:3000'}
    response = client.options('/api/public/test-connection', headers=headers)
    
    assert 'Access-Control-Allow-Origin' in response.headers
    assert 'Access-Control-Allow-Headers' in response.headers
    assert 'Access-Control-Allow-Methods' in response.headers

def test_security_headers(client):
    """Test security headers are present"""
    response = client.get('/api/public/test-connection')
    
    assert response.headers.get('X-Content-Type-Options') == 'nosniff'
    assert response.headers.get('X-Frame-Options') == 'DENY'
    assert response.headers.get('X-XSS-Protection') == '1; mode=block'
    assert 'Strict-Transport-Security' in response.headers

def test_error_handling(client):
    """Test error handling"""
    response = client.get('/api/nonexistent-endpoint')
    assert response.status_code == 404
    assert response.json['success'] is False
    assert 'message' in response.json

def test_test_token_development(app, client):
    """Test that test tokens work in development"""
    headers = {'Authorization': 'Bearer test-token-123'}
    with app.app_context():
        app.config['FLASK_ENV'] = 'development'
        response = client.get('/api/profile', headers=headers)
        assert response.status_code != 401, "Test tokens should work in development"

def test_test_token_production(app, client):
    """Test that test tokens don't work in production"""
    headers = {'Authorization': 'Bearer test-token-123'}
    with app.app_context():
        app.config['FLASK_ENV'] = 'production'
        response = client.get('/api/profile', headers=headers)
        assert response.status_code == 401, "Test tokens should not work in production" 