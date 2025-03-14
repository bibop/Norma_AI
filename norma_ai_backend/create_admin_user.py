#!/usr/bin/env python3
"""
Script to create an administrator user in the Norma AI database.
"""
from app import app, db
from models.user import User

# Admin credentials - easy to remember for testing
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Admin123!"

def create_admin_user():
    with app.app_context():
        # Check if admin already exists
        existing_user = User.query.filter_by(email=ADMIN_EMAIL).first()
        
        if existing_user:
            print(f"Admin user '{ADMIN_EMAIL}' already exists with ID: {existing_user.id}")
            return existing_user
        
        # Create new admin user
        new_user = User(
            email=ADMIN_EMAIL,
            first_name="Admin",
            last_name="User",
            company="Norma AI",
            role="admin",  # Admin role
            preferred_jurisdiction="us"
        )
        
        # Set password using the User model's method
        new_user.set_password(ADMIN_PASSWORD)
        
        db.session.add(new_user)
        db.session.commit()
        
        print(f"Created new admin user '{ADMIN_EMAIL}' with ID: {new_user.id}")
        return new_user

if __name__ == "__main__":
    try:
        user = create_admin_user()
        print(f"\nYou can login with:\nEmail: {ADMIN_EMAIL}\nPassword: {ADMIN_PASSWORD}")
    except Exception as e:
        print(f"Error creating admin user: {str(e)}")
