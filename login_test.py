#!/usr/bin/env python3
import urllib.request
import urllib.parse
import urllib.error
import json
import ssl

# Base URL using direct IP to avoid IPv6 resolution issues (per your configuration)
BASE_URL = "http://127.0.0.1:3001"

def test_login(email, password):
    """Test login with specified credentials"""
    url = f"{BASE_URL}/api/auth/login"
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    payload = {
        'email': email,
        'password': password
    }
    
    print(f"Testing login with: {email} / {password}")
    try:
        # Create a context that ignores SSL certificate validation (for testing only)
        context = ssl._create_unverified_context()
        
        # Prepare the request data
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        
        # Send the request
        with urllib.request.urlopen(req, context=context) as response:
            status_code = response.getcode()
            print(f"Status code: {status_code}")
            
            if status_code == 200:
                response_data = json.loads(response.read().decode('utf-8'))
                print("SUCCESS!")
                print(f"Token: {response_data.get('access_token', 'No token found')[:10]}...")
                print(f"User: {json.dumps(response_data.get('user', {}), indent=2)}")
                return True
            else:
                print(f"Failed with status code: {status_code}")
                return False
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        return False
    except urllib.error.URLError as e:
        print(f"URL Error: {e.reason}")
        return False
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

# Try various test credentials - one of these should work
credentials = [
    ("user@example.com", "password"),
    ("admin@norma-ai.com", "admin123456"),
    ("test@example.com", "password123"),
    ("demo@norma-ai.com", "demo123"),
    ("user@norma-ai.com", "user123")
]

print("=== Norma AI Login Test ===")
print(f"Connecting to API at: {BASE_URL}\n")

success = False
for email, password in credentials:
    if test_login(email, password):
        print(f"\n✅ FOUND WORKING CREDENTIALS: {email} / {password}")
        print("Use these credentials to log in through the web interface")
        success = True
        break
    print("\n---\n")

if not success:
    print("\n❌ None of the test credentials worked.")
    print("Please make sure the backend server is running at:", BASE_URL)
