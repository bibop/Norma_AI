"""
Gunicorn configuration file for Render deployment
"""
import os

# Worker configuration
workers = int(os.environ.get('GUNICORN_WORKERS', 3))
threads = int(os.environ.get('GUNICORN_THREADS', 2))
worker_class = 'gevent'
worker_connections = 1000
timeout = 60
keepalive = 5

# Access logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Use Render's PORT environment variable
bind = f"0.0.0.0:{os.environ.get('PORT', 5001)}"
