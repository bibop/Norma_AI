#!/usr/bin/env python3
from app import app, db
from models.user import User
import datetime

# Test user credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "password123"

def create_test_user():
    with app.app_context():
        # Check if test user already exists
        existing_user = User.query.filter_by(email=TEST_EMAIL).first()
        
        if existing_user:
            print(f"Test user '{TEST_EMAIL}' already exists with ID: {existing_user.id}")
            return existing_user
        
        # Create new test user
        new_user = User(
            email=TEST_EMAIL,
            first_name="Test",
            last_name="User",
            company="Test Company",
            role="user",
            preferred_jurisdiction="us"
        )
        
        # Set password using the User model's method
        new_user.set_password(TEST_PASSWORD)
        
        db.session.add(new_user)
        db.session.commit()
        
        print(f"Created new test user '{TEST_EMAIL}' with ID: {new_user.id}")
        return new_user

if __name__ == "__main__":
    try:
        user = create_test_user()
        print(f"\nYou can login with:\nEmail: {TEST_EMAIL}\nPassword: {TEST_PASSWORD}")
    except Exception as e:
        print(f"Error creating test user: {str(e)}")
