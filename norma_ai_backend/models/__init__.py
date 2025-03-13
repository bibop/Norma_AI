from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from models.user import User
from models.document import Document
from models.user_settings import UserSettings
