"""
Script to create an admin user in the database.
"""
from app import create_app
from models import db
from models.user import User

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
    # Admin details - these will be used to create the admin user
    admin_email = "admin@norma-ai.com"
    admin_password = "admin123456"  # Remember to change this in production!
    admin_first_name = "Admin"
    admin_last_name = "User"
    admin_company = "Norma AI"
    
    create_admin_user(
        email=admin_email,
        password=admin_password,
        first_name=admin_first_name,
        last_name=admin_last_name,
        company=admin_company
    )
