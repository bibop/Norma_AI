"""
Database migration script to add new user preferences columns.
This script adds preferred_jurisdictions and preferred_legal_sources columns to the users table.
"""
import os
import sys
import logging

# Add parent directory to path to allow imports from other modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import the Flask app and db
from app import app
from models import db

def add_column_if_not_exists(table_name, column_name, column_type, default_value=None):
    """Add a column to a table if it doesn't already exist."""
    
    # Check if column exists
    result = db.session.execute(f"SELECT column_name FROM information_schema.columns "
                              f"WHERE table_name='{table_name}' AND column_name='{column_name}'").fetchone()
    
    if not result:
        logger.info(f"Adding {column_name} column to {table_name} table...")
        
        # Prepare default value clause if needed
        default_clause = f" DEFAULT '{default_value}'" if default_value else ""
        
        # Execute the column addition
        db.session.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}{default_clause}")
        db.session.commit()
        
        logger.info(f"Added {column_name} column.")
        return True
    else:
        logger.info(f"{column_name} column already exists.")
        return False

def run_migration():
    """Run the migration to add new columns to the users table."""
    try:
        with app.app_context():
            # Add preferred_jurisdictions column
            add_column_if_not_exists('users', 'preferred_jurisdictions', 'TEXT', '["us"]')
            
            # Add preferred_legal_sources column
            add_column_if_not_exists('users', 'preferred_legal_sources', 'TEXT', '["official"]')
            
            logger.info("Migration completed successfully.")
            return True
    
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        return False

if __name__ == "__main__":
    if run_migration():
        logger.info("✅ Migration completed successfully")
        sys.exit(0)
    else:
        logger.error("❌ Migration failed")
        sys.exit(1)
