#!/usr/bin/env python3
from app import app, db
from models.user import User
from models.document import Document

with app.app_context():
    print('Database check:')
    print('===============')
    print('User count:', User.query.count())
    print('Document count:', Document.query.count())
    
    # List users
    users = User.query.all()
    if users:
        print('\nRegistered Users:')
        for user in users:
            print(f"  - {user.email} (ID: {user.id})")
    else:
        print('\nNo users found in database')
    
    # List documents
    documents = Document.query.all()
    if documents:
        print('\nDocuments:')
        for doc in documents:
            print(f"  - {doc.original_filename} (ID: {doc.id}, User: {doc.user_id}, Status: {doc.status})")
    else:
        print('\nNo documents found in database')
