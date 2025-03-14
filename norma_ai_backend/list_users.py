#!/usr/bin/env python3
"""
Script to list all users in the Norma AI database.
"""
from app import app, db
from models.user import User

def list_users():
    with app.app_context():
        users = User.query.all()
        print("\nUsers in database:")
        for user in users:
            print(f"ID: {user.id}, Email: {user.email}, First name: {user.first_name}, Role: {user.role}")

if __name__ == "__main__":
    list_users()
