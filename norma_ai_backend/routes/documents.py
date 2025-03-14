import os
import traceback
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from models import db, Document, User
from services.document_service import analyze_document, allowed_file

documents_bp = Blueprint('documents', __name__)

@documents_bp.route('/documents/upload', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload a document for compliance analysis."""
    try:
        current_app.logger.info("Document upload initiated")
        user_id = int(get_jwt_identity())
        
        # Check if the request has a file
        if 'file' not in request.files:
            current_app.logger.warning("No file part in request")
            return jsonify({"success": False, "message": "No file part"}), 400
        
        file = request.files['file']
        
        # Check if file is empty
        if file.filename == '':
            current_app.logger.warning("No file selected")
            return jsonify({"success": False, "message": "No file selected"}), 400
        
        # Check if file type is allowed
        if not allowed_file(file.filename):
            current_app.logger.warning(f"File type not allowed: {file.filename}")
            return jsonify({"success": False, "message": "File type not allowed"}), 400
        
        # Get jurisdiction from request or user preferences
        jurisdiction = request.form.get('jurisdiction')
        if not jurisdiction:
            # Get user's preferred jurisdiction if not specified in request
            user = User.query.get(user_id)
            if not user:
                current_app.logger.error(f"User {user_id} not found")
                return jsonify({"success": False, "message": "User not found"}), 404
                
            jurisdiction = user.preferred_jurisdiction
            
        # Ensure jurisdiction has the correct format (main-sub or just main)
        if jurisdiction and '-' not in jurisdiction:
            # If only main jurisdiction is provided, append default sub-jurisdiction
            main_jurisdiction = jurisdiction
            # Check if we have hierarchical jurisdictions data for this main jurisdiction
            if main_jurisdiction in ['us', 'eu', 'uk', 'ca', 'au', 'br', 'jp', 'sg', 'global']:
                if main_jurisdiction == 'us':
                    jurisdiction = f"{main_jurisdiction}-federal"
                elif main_jurisdiction == 'eu':
                    jurisdiction = f"{main_jurisdiction}-general"
                elif main_jurisdiction == 'uk':
                    jurisdiction = f"{main_jurisdiction}-general"
                elif main_jurisdiction == 'ca':
                    jurisdiction = f"{main_jurisdiction}-federal"
                elif main_jurisdiction == 'au':
                    jurisdiction = f"{main_jurisdiction}-federal"
                else:
                    jurisdiction = f"{main_jurisdiction}-general"
        
        # Secure the filename and save the file
        original_filename = file.filename
        filename = secure_filename(file.filename)
        file_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{user_id}_{filename}"
        
        # Ensure upload directory exists
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        file_path = os.path.join(upload_folder, unique_filename)
        
        current_app.logger.info(f"Saving file to {file_path}")
        file.save(file_path)
        
        if not os.path.exists(file_path):
            current_app.logger.error(f"Failed to save file to {file_path}")
            return jsonify({"success": False, "message": "Failed to save file"}), 500
            
        file_size = os.path.getsize(file_path)
        
        # Create document record in database
        new_document = Document(
            filename=unique_filename,
            original_filename=original_filename,
            file_type=file_extension,
            file_size=file_size,
            user_id=user_id,
            jurisdiction=jurisdiction,
            status='uploaded'  # Set initial status to uploaded
        )
        
        db.session.add(new_document)
        db.session.commit()
        current_app.logger.info(f"Document record created with ID: {new_document.id}")
        
        try:
            # Analyze the document for compliance
            current_app.logger.info(f"Starting analysis for document {new_document.id}")
            analysis_result = analyze_document(file_path, new_document.id, jurisdiction)
            
            # Update document with analysis results
            new_document.compliance_results = analysis_result
            new_document.status = 'analyzed'
            new_document.last_analyzed = datetime.utcnow()
            db.session.commit()
            current_app.logger.info(f"Analysis completed for document {new_document.id}")
        except Exception as analysis_error:
            # If analysis fails, still keep the document but mark it as failed analysis
            current_app.logger.error(f"Analysis failed for document {new_document.id}: {str(analysis_error)}")
            current_app.logger.error(traceback.format_exc())
            new_document.status = 'analysis_failed'
            new_document.analysis_error = str(analysis_error)
            db.session.commit()
            
            # Still return success for the upload, but note the analysis failure
            return jsonify({
                "success": True,
                "message": "Document uploaded, but analysis failed. Please try again later.",
                "document": new_document.to_dict(),
                "error": str(analysis_error)
            }), 201
        
        return jsonify({
            "success": True,
            "message": "Document uploaded and analyzed successfully",
            "document": new_document.to_dict()
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Document upload failed: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "message": "An error occurred during document upload",
            "error": str(e)
        }), 500

@documents_bp.route('/documents', methods=['GET'])
@jwt_required()
def get_documents():
    """Get all documents for the current user."""
    user_id = int(get_jwt_identity())
    
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
    user_id = int(get_jwt_identity())
    
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

@documents_bp.route('/document/<int:document_id>', methods=['DELETE'])
@jwt_required()
def delete_document(document_id):
    """Delete a specific document."""
    user_id = int(get_jwt_identity())
    
    # Find the document
    document = Document.query.filter_by(id=document_id, user_id=user_id).first()
    
    if not document:
        return jsonify({"success": False, "message": "Document not found or access denied"}), 404
    
    try:
        # Delete the actual file
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], document.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Delete from database
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Document deleted successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Error deleting document: {str(e)}"
        }), 500

@documents_bp.route('/document/<int:document_id>/analyze', methods=['POST'])
@jwt_required()
def reanalyze_document(document_id):
    """Re-analyze a specific document."""
    user_id = int(get_jwt_identity())
    
    # Find the document
    document = Document.query.filter_by(id=document_id, user_id=user_id).first()
    
    if not document:
        return jsonify({"success": False, "message": "Document not found or access denied"}), 404
    
    try:
        # Get the file path
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], document.filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                "success": False,
                "message": "Document file not found on server"
            }), 404
        
        # Get jurisdiction from request or use existing document jurisdiction
        jurisdiction = request.json.get('jurisdiction') if request.json else None
        if not jurisdiction:
            jurisdiction = document.jurisdiction
            
            # If document doesn't have a jurisdiction, use user's preference
            if not jurisdiction:
                user = User.query.get(user_id)
                jurisdiction = user.preferred_jurisdiction
        
        # Re-analyze the document
        analysis_result = analyze_document(file_path, document.id, jurisdiction)
        
        # Update document with new analysis results
        document.compliance_results = analysis_result
        document.status = 'analyzed'
        document.jurisdiction = jurisdiction
        document.last_analyzed = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Document re-analyzed successfully",
            "document": document.to_dict(),
            "compliance_results": document.compliance_results
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Error re-analyzing document: {str(e)}"
        }), 500

# New endpoint to get available jurisdictions
@documents_bp.route('/jurisdictions', methods=['GET'])
@jwt_required()
def get_jurisdictions():
    """Get list of available jurisdictions for compliance analysis."""
    hierarchical_jurisdictions = {
        'us': {
            'code': 'us',
            'name': 'United States',
            'description': 'US federal and state laws',
            'subRegions': [
                { 'code': 'federal', 'name': 'Federal (All States)', 'description': 'Federal regulations only' },
                { 'code': 'ca', 'name': 'California', 'description': 'Including CCPA, CPRA' },
                { 'code': 'ny', 'name': 'New York', 'description': 'Including SHIELD Act, NYDFS' },
                { 'code': 'tx', 'name': 'Texas', 'description': 'Including TDPSA, Texas Privacy Act' },
                { 'code': 'va', 'name': 'Virginia', 'description': 'Including VCDPA' },
                { 'code': 'co', 'name': 'Colorado', 'description': 'Including CPA' },
                { 'code': 'il', 'name': 'Illinois', 'description': 'Including BIPA' },
                { 'code': 'fl', 'name': 'Florida', 'description': 'Including FIPA' },
                { 'code': 'other', 'name': 'Other States', 'description': 'General compliance for other states' }
            ]
        },
        'eu': {
            'code': 'eu',
            'name': 'European Union',
            'description': 'EU and member state regulations',
            'subRegions': [
                { 'code': 'general', 'name': 'EU General', 'description': 'Pan-EU regulations including GDPR, ePrivacy' },
                { 'code': 'de', 'name': 'Germany', 'description': 'Including BDSG, Telemediengesetz' },
                { 'code': 'fr', 'name': 'France', 'description': 'Including CNIL regulations, French Data Protection Act' },
                { 'code': 'it', 'name': 'Italy', 'description': 'Including Italian Privacy Code' },
                { 'code': 'es', 'name': 'Spain', 'description': 'Including LOPDGDD' },
                { 'code': 'nl', 'name': 'Netherlands', 'description': 'Including Dutch Telecommunications Act' },
                { 'code': 'se', 'name': 'Sweden', 'description': 'Including Swedish Data Protection Act' },
                { 'code': 'other', 'name': 'Other EU Countries', 'description': 'General compliance for other EU states' }
            ]
        },
        'uk': {
            'code': 'uk',
            'name': 'United Kingdom',
            'description': 'UK laws and regulations',
            'subRegions': [
                { 'code': 'general', 'name': 'UK General', 'description': 'Including UK GDPR, Data Protection Act, PECR' },
                { 'code': 'england', 'name': 'England', 'description': 'England-specific regulations' },
                { 'code': 'scotland', 'name': 'Scotland', 'description': 'Scotland-specific regulations' },
                { 'code': 'wales', 'name': 'Wales', 'description': 'Wales-specific regulations' },
                { 'code': 'ni', 'name': 'Northern Ireland', 'description': 'Northern Ireland-specific regulations' }
            ]
        },
        'ca': {
            'code': 'ca',
            'name': 'Canada',
            'description': 'Canadian regulations',
            'subRegions': [
                { 'code': 'federal', 'name': 'Federal', 'description': 'Including PIPEDA, CASL' },
                { 'code': 'qc', 'name': 'Quebec', 'description': 'Including Quebec Privacy Law (Law 25)' },
                { 'code': 'bc', 'name': 'British Columbia', 'description': 'Including PIPA BC' },
                { 'code': 'ab', 'name': 'Alberta', 'description': 'Including PIPA Alberta' },
                { 'code': 'on', 'name': 'Ontario', 'description': 'Including Ontario privacy regulations' },
                { 'code': 'other', 'name': 'Other Provinces', 'description': 'General compliance for other provinces' }
            ]
        },
        'au': {
            'code': 'au',
            'name': 'Australia',
            'description': 'Australian laws',
            'subRegions': [
                { 'code': 'federal', 'name': 'Federal', 'description': 'Including Privacy Act, Consumer Law' },
                { 'code': 'nsw', 'name': 'New South Wales', 'description': 'NSW-specific regulations' },
                { 'code': 'vic', 'name': 'Victoria', 'description': 'Victoria-specific regulations' },
                { 'code': 'qld', 'name': 'Queensland', 'description': 'Queensland-specific regulations' },
                { 'code': 'other', 'name': 'Other States/Territories', 'description': 'General compliance for other areas' }
            ]
        },
        'br': {
            'code': 'br',
            'name': 'Brazil',
            'description': 'Brazilian laws',
            'subRegions': [
                { 'code': 'general', 'name': 'Federal', 'description': 'Including LGPD and federal regulations' }
            ]
        },
        'jp': {
            'code': 'jp',
            'name': 'Japan',
            'description': 'Japanese laws',
            'subRegions': [
                { 'code': 'general', 'name': 'National', 'description': 'Including APPI and national regulations' }
            ]
        },
        'sg': {
            'code': 'sg',
            'name': 'Singapore',
            'description': 'Singapore laws',
            'subRegions': [
                { 'code': 'general', 'name': 'National', 'description': 'Including PDPA and national regulations' }
            ]
        },
        'global': {
            'code': 'global',
            'name': 'Global',
            'description': 'Global compliance standards',
            'subRegions': [
                { 'code': 'general', 'name': 'International', 'description': 'General international compliance standards' }
            ]
        }
    }
    
    return jsonify({
        "success": True,
        "message": "Jurisdictions retrieved successfully",
        "jurisdictions": list(hierarchical_jurisdictions.values())
    }), 200

# New endpoint to update user's preferred jurisdiction
@documents_bp.route('/user/jurisdiction', methods=['PUT'])
@jwt_required()
def update_preferred_jurisdiction():
    """Update user's preferred jurisdiction."""
    user_id = int(get_jwt_identity())
    
    # Get jurisdiction from request
    data = request.json
    if not data or 'jurisdiction' not in data:
        return jsonify({"success": False, "message": "Jurisdiction not provided"}), 400
        
    jurisdiction = data['jurisdiction']
    valid_jurisdictions = ['us', 'eu', 'uk', 'ca', 'au']
    
    if jurisdiction not in valid_jurisdictions:
        return jsonify({"success": False, "message": "Invalid jurisdiction code"}), 400
    
    # Update user's preferred jurisdiction
    user = User.query.get(user_id)
    user.preferred_jurisdiction = jurisdiction
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Preferred jurisdiction updated successfully",
        "user": user.to_dict()
    }), 200

# Generate and download a compliance report PDF
@documents_bp.route('/documents/<int:document_id>/compliance-report-pdf', methods=['GET'])
@jwt_required()
def download_compliance_report_pdf(document_id):
    """Generate and download a PDF compliance report for the specified document."""
    user_id = int(get_jwt_identity())
    
    try:
        # Get the document
        document = Document.query.filter_by(id=document_id, user_id=user_id).first()
        
        if not document:
            current_app.logger.error(f"Document {document_id} not found for user {user_id}")
            return jsonify({
                "success": False,
                "message": "Document not found or you don't have permission to access it"
            }), 404
        
        if not document.compliance_results:
            current_app.logger.error(f"No compliance results for document {document_id}")
            return jsonify({
                "success": False,
                "message": "No compliance analysis results available for this document"
            }), 400
        
        # Import the PDF service
        from services.pdf_service import generate_compliance_pdf
        
        current_app.logger.info(f"Generating PDF for document {document_id} requested by user {user_id}")
        
        # Generate the PDF
        pdf_path = generate_compliance_pdf(document_id, user_id)
        
        if not pdf_path or not os.path.exists(pdf_path):
            current_app.logger.error(f"PDF generation failed for document {document_id}, path does not exist: {pdf_path}")
            return jsonify({
                "success": False,
                "message": "Failed to generate PDF report"
            }), 500
        
        # Get filename
        pdf_filename = f"compliance_report_{document.title}.pdf"
        
        # Check file size and permissions
        file_size = os.path.getsize(pdf_path)
        current_app.logger.info(f"Sending PDF file: {pdf_path}, size: {file_size} bytes")
        
        if file_size == 0:
            current_app.logger.error(f"PDF file is empty: {pdf_path}")
            return jsonify({
                "success": False,
                "message": "Generated PDF file is empty"
            }), 500
            
        # Return the file for download
        try:
            return send_file(
                pdf_path,
                as_attachment=True,
                download_name=pdf_filename,
                mimetype='application/pdf'
            )
        except Exception as send_error:
            current_app.logger.error(f"Error sending PDF file: {str(send_error)}")
            return jsonify({
                "success": False,
                "message": f"Error sending PDF file: {str(send_error)}"
            }), 500
    
    except Exception as e:
        current_app.logger.error(f"Error generating PDF report: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Error generating PDF report: {str(e)}"
        }), 500
