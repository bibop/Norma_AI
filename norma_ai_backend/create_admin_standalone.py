#!/usr/bin/env python3
"""
Standalone script to create an administrator user in the Norma AI database.
This script uses direct database connection without Flask to ensure it works
even if Flask dependencies are not properly installed.
"""
import os
import sys
import bcrypt
import datetime
import json
import re

# Admin credentials that will work with the frontend
ADMIN_EMAIL = "admin@norma-ai.com"
ADMIN_PASSWORD = "admin123456"

def main():
    try:
        # Try to load database configuration from config.py
        db_config = get_db_config()
        
        print(f"=== Norma AI Admin User Creation Tool ===")
        print(f"This script will create an admin user with the following credentials:")
        print(f"Email: {ADMIN_EMAIL}")
        print(f"Password: {ADMIN_PASSWORD}")
        print(f"\nThese credentials will work with the frontend login form.")
        print(f"===========================================\n")
        
        # Check if we can import database libraries
        try:
            import psycopg2
            from psycopg2 import sql
            
            # Connect to the database
            print(f"Connecting to PostgreSQL database: {db_config['DB_URI']}")
            
            # Parse the PostgreSQL connection string
            match = re.match(r'postgresql://([^:]+):([^@]+)@([^/]+)/(.+)', db_config['DB_URI'])
            if match:
                user, password, host_port, dbname = match.groups()
                
                # Split host and port if port is present
                if ':' in host_port:
                    host, port = host_port.split(':')
                else:
                    host = host_port
                    port = 5432
                
                conn = psycopg2.connect(
                    host=host,
                    port=port,
                    database=dbname,
                    user=user,
                    password=password
                )
                
                # Create admin user
                create_admin_postgres(conn, ADMIN_EMAIL, ADMIN_PASSWORD)
            else:
                print(f"Could not parse PostgreSQL connection string: {db_config['DB_URI']}")
                return
            
        except ImportError:
            print("Could not import psycopg2. Please install it with:")
            print("   pip install psycopg2-binary")
            return
                
    except Exception as e:
        print(f"Error creating admin user: {str(e)}")
        import traceback
        traceback.print_exc()

def get_db_config():
    """Extract database configuration from config.py"""
    config = {}
    
    # Get the path to config.py
    config_path = os.path.join(os.path.dirname(__file__), 'config.py')
    
    print(f"Looking for configuration in {config_path}")
    
    if os.path.exists(config_path):
        try:
            # Read config.py manually
            with open(config_path, 'r') as f:
                config_text = f.read()
            
            # Extract DATABASE_URL
            db_uri_match = re.search(r"SQLALCHEMY_DATABASE_URI\s*=\s*os\.environ\.get\('DATABASE_URL',\s*'([^']+)'\)", config_text)
            if db_uri_match:
                db_uri = db_uri_match.group(1)
                print(f"Found database URI: {db_uri}")
                config['DB_URI'] = db_uri
            else:
                # Default fallback from config.py
                config['DB_URI'] = 'postgresql://bibop:bibopbibop1@localhost/italian_law_compliance'
                print(f"Using default database URI: {config['DB_URI']}")
        except Exception as e:
            print(f"Error reading config.py: {str(e)}")
            # Default fallback
            config['DB_URI'] = 'postgresql://bibop:bibopbibop1@localhost/italian_law_compliance'
    else:
        print(f"Config file not found at {config_path}")
        # Default fallback
        config['DB_URI'] = 'postgresql://bibop:bibopbibop1@localhost/italian_law_compliance'
    
    return config

def create_admin_postgres(conn, email, password):
    """Create admin user in PostgreSQL database"""
    try:
        cursor = conn.cursor()
        
        # Check if admin already exists
        cursor.execute("SELECT id, email, role FROM users WHERE email = %s", (email,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            user_id, user_email, user_role = existing_user
            print(f"User '{user_email}' already exists with ID: {user_id}, role: {user_role}")
            
            # Update user role to admin if not already
            if user_role != 'admin':
                print(f"Updating user role to 'admin'...")
                cursor.execute("UPDATE users SET role = 'admin' WHERE id = %s", (user_id,))
                conn.commit()
                print(f"User role updated to 'admin'")
            
            return
        
        # Generate bcrypt hash with salt (matching User.set_password method)
        password_bytes = password.encode('utf-8')
        hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt(12))
        password_hash = hashed.decode('utf-8')
        
        # Get current timestamp
        current_time = datetime.datetime.utcnow().isoformat()
        
        # Create new admin user
        cursor.execute("""
            INSERT INTO users (
                email, password_hash, first_name, last_name, company, role,
                preferred_jurisdiction, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            email, password_hash, "Admin", "User", "Norma AI", "admin",
            "us", current_time, current_time
        ))
        
        user_id = cursor.fetchone()[0]
        conn.commit()
        
        print(f"Created new admin user '{email}' with ID: {user_id}")
        print(f"You can now log in with:")
        print(f"Email: {email}")
        print(f"Password: {password}")
        
    except Exception as e:
        conn.rollback()
        print(f"Error in PostgreSQL: {str(e)}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
