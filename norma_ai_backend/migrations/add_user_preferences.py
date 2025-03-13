"""
Database migration script to add new user preferences columns.
This script adds preferred_jurisdictions and preferred_legal_sources columns to the users table.
"""
import os
import sys
import logging
from sqlalchemy import create_engine, MetaData, Table, Text
from sqlalchemy.sql import text

# Add parent directory to path to allow imports from other modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the config and db objects
from config import Config
from models import db

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_migration():
    """Run the migration to add new columns to the users table."""
    try:
        # Create engine using SQLAlchemy URI from config
        engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
        
        # Check if the columns already exist to avoid errors
        metadata = MetaData()
        metadata.reflect(bind=engine)
        
        users_table = metadata.tables.get('users')
        if not users_table:
            logger.error("Users table not found in the database.")
            return False
        
        # Check if the columns already exist
        existing_columns = [c.name for c in users_table.columns]
        
        if 'preferred_jurisdictions' not in existing_columns:
            # Add preferred_jurisdictions column
            logger.info("Adding preferred_jurisdictions column to users table...")
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN preferred_jurisdictions TEXT DEFAULT '[\"us\"]'"
                ))
            logger.info("Added preferred_jurisdictions column.")
        else:
            logger.info("preferred_jurisdictions column already exists.")
        
        if 'preferred_legal_sources' not in existing_columns:
            # Add preferred_legal_sources column
            logger.info("Adding preferred_legal_sources column to users table...")
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN preferred_legal_sources TEXT DEFAULT '[\"official\"]'"
                ))
            logger.info("Added preferred_legal_sources column.")
        else:
            logger.info("preferred_legal_sources column already exists.")
        
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
