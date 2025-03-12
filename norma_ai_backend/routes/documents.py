import os
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from models import db, Document, User
from services.document_service import analyze_document, allowed_file

documents_bp = Blueprint('documents', __name__)

@documents_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload a document for compliance analysis."""
    user_id = int(get_jwt_identity())  # Manteniamo questa conversione
    
    # Check if the request has a file
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400
    
    file = request.files['file']
    
    # Check if file is empty
    if file.filename == '':
        return jsonify({"success": False, "message": "No file selected"}), 400
    
    # Check if file type is allowed
    if not allowed_file(file.filename):
        return jsonify({"success": False, "message": "File type not allowed"}), 400
    
    # Secure the filename and save the file
    original_filename = file.filename
    filename = secure_filename(file.filename)
    file_extension = filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{user_id}_{filename}"
    
    # Ensure upload directory exists
    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
    
    file.save(file_path)
    file_size = os.path.getsize(file_path)
    
    # Create document record in database
    new_document = Document(
        filename=unique_filename,
        original_filename=original_filename,
        file_type=file_extension,
        file_size=file_size,
        user_id=user_id
    )
    
    db.session.add(new_document)
    db.session.commit()
    
    # Analyze the document for compliance
    analysis_result = analyze_document(file_path, new_document.id)
    
    # Update document with analysis results
    new_document.compliance_results = analysis_result
    new_document.status = 'analyzed'
    new_document.last_analyzed = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Document uploaded and analyzed successfully",
        "document": new_document.to_dict()
    }), 201

@documents_bp.route('/documents', methods=['GET'])
@jwt_required()
def get_documents():
    """Get all documents for the current user."""
    user_id = int(get_jwt_identity())  # Manteniamo questa conversione
    
    # Get all documents for the user
    user_documents = Document.query.filter_by(user_id=user_id).all()
    documents_data = [doc.to_dict() for doc in user_documents]
    
    return jsonify({
        "success": True,
        "message": "Documents retrieved successfully",
        "documents": documents_data
    }), 200

@documents_bp.route('/document/<int:document_id>/compliance', methods=['GET'])
@jwt_required()
def get_document_compliance(document_id):
    """Get compliance details for a specific document."""
    user_id = int(get_jwt_identity())  # Manteniamo questa conversione
    
    # Find the document
    document = Document.query.filter_by(id=document_id, user_id=user_id).first()
    
    if not document:
        return jsonify({"success": False, "message": "Document not found or access denied"}), 404
    
    return jsonify({
        "success": True,
        "message": "Document compliance retrieved successfully",
        "document": document.to_dict(),
        "compliance_results": document.compliance_results
    }), 200
