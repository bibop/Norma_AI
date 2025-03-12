"""
WSGI entry point for the Norma AI backend application.
Used by Gunicorn in production environments.
"""
from app import create_app

# Create the Flask application
app = create_app()

if __name__ == "__main__":
    app.run()
