import re
import logging

def validate_registration_data(data):
    """Validate registration data."""
    data_to_log = {k: v for k, v in data.items() if k != 'password'}
    logging.debug(f"Validating registration data: {data_to_log}")
    # Check if required fields are present
    required_fields = ['email', 'password', 'first_name', 'last_name']
    for field in required_fields:
        if field not in data or not data[field]:
            logging.error(f"Missing required field: {field}")
            return {
                "success": False,
                "message": f"Missing required field: {field}"
            }
    
    # Validate email format
    email_regex = r'^[a-zA-Z0-9.%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}(?:.[a-zA-Z]{2,})*$'
    if not re.match(email_regex, data['email']):
        return {
            "success": False,
            "message": "Invalid email format"
        }
    
    # Validate password strength (at least 8 characters with a mix of letters, numbers, and special chars)
    password_regex = r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$'
    if not re.match(password_regex, data['password']):
        return {
            "success": False,
            "message": "Password must be at least 8 characters and include letters, numbers, and special characters"
        }
    
    logging.info("Registration data is valid")
    return {
        "success": True,
        "message": "Validation successful"
    }

def validate_login_data(data):
    """Validate login data."""
    # Check if required fields are present
    required_fields = ['email', 'password']
    for field in required_fields:
        if field not in data or not data[field]:
            return {
                "success": False,
                "message": f"Missing required field: {field}"
            }
    
    # In a real application, you might want to validate the token
    # with the server or check if it's expired
    return {
        "success": True,
        "message": "Validation successful"
    }