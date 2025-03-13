"""
Migration script to add UserSettings table

This script creates the user_settings table to store user preferences
including the legal updates refresh interval.
"""

import sys
import os
from datetime import datetime

# Add parent directory to path so we can import from project
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db, User

def run_migration():
    """Execute the migration to add UserSettings table."""
    app = create_app()
    
    with app.app_context():
        # Check if the table already exists
        if 'user_settings' in db.engine.table_names():
            print("UserSettings table already exists. Migration skipped.")
            return
        
        # Create the table
        try:
            db.engine.execute('''
                CREATE TABLE user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    theme VARCHAR(20) DEFAULT 'light',
                    language VARCHAR(10) DEFAULT 'en',
                    legal_updates_interval INTEGER DEFAULT 30,
                    notification_enabled BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ''')
            
            # Create default settings for existing users
            users = User.query.all()
            for user in users:
                db.engine.execute(
                    'INSERT INTO user_settings (user_id) VALUES (?)',
                    (user.id,)
                )
                
            print(f"Migration successful. Created settings for {len(users)} users.")
            
        except Exception as e:
            print(f"Migration failed: {str(e)}")
            return False
    
    return True

if __name__ == "__main__":
    if run_migration():
        print("Migration completed successfully")
    else:
        print("Migration failed")
        sys.exit(1)
