"""
Script to create an admin user in the database.
"""
from app import create_app
from models import db
from models.user import User
import argparse

def create_admin_user(email, password, first_name, last_name, company=None):
    """Create an admin user in the database."""
    # Create Flask app context
    app = create_app()
    
    with app.app_context():
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            print(f"User with email {email} already exists.")
            
            # If user exists but is not admin, make them admin
            if existing_user.role != 'admin':
                existing_user.role = 'admin'
                db.session.commit()
                print(f"User {email} has been promoted to admin.")
            else:
                print(f"User {email} is already an admin.")
                
            return existing_user
        
        # Create new admin user
        admin = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            company=company,
            role='admin'
        )
        admin.set_password(password)
        
        # Save to database
        db.session.add(admin)
        db.session.commit()
        
        print(f"Admin user {email} created successfully with ID: {admin.id}")
        return admin

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Create an admin user')
    parser.add_argument('--email', type=str, default="admin@norma-ai.com", help='Admin email')
    parser.add_argument('--password', type=str, default="admin123456", help='Admin password')
    parser.add_argument('--first_name', type=str, default="Admin", help='Admin first name')
    parser.add_argument('--last_name', type=str, default="User", help='Admin last name')
    parser.add_argument('--company', type=str, default=None, help='Admin company (optional)')
    
    # Parse arguments
    args = parser.parse_args()
    
    # Create admin user with provided arguments
    create_admin_user(
        email=args.email,
        password=args.password,
        first_name=args.first_name,
        last_name=args.last_name,
        company=args.company
    )
