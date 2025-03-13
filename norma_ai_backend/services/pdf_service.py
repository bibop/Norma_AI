import os
from datetime import datetime
from flask import current_app
import io
import logging
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem
from reportlab.lib.units import inch
from models import Document, User

# Configure logging
logger = logging.getLogger(__name__)

def generate_compliance_pdf(document_id, user_id):
    """
    Generate a PDF compliance report for the specified document.
    
    Args:
        document_id: ID of the document to generate report for
        user_id: ID of the user requesting the report
    
    Returns:
        PDF file path
    """
    try:
        # Get document
        document = Document.query.get(document_id)
        if not document:
            logger.error(f"Document with ID {document_id} not found")
            raise ValueError(f"Document with ID {document_id} not found")
        
        # Check ownership
        if document.user_id != user_id:
            logger.error(f"User {user_id} does not own document {document_id}")
            raise ValueError("User does not own this document")
        
        # Get compliance results
        compliance_results = document.compliance_results
        if not compliance_results:
            logger.error(f"No compliance results for document {document_id}")
            raise ValueError("No compliance analysis results available for this document")
        
        # Format jurisdiction for display
        jurisdiction_parts = document.jurisdiction.split('-') if document.jurisdiction else []
        jurisdiction_display = "Unknown"
        
        if len(jurisdiction_parts) >= 2:
            main_region = jurisdiction_parts[0].upper()
            sub_region = jurisdiction_parts[1].upper()
            jurisdiction_display = f"{main_region}-{sub_region}"
        elif len(jurisdiction_parts) == 1:
            jurisdiction_display = jurisdiction_parts[0].upper()
        
        # Create directories if they don't exist
        app_upload_folder = current_app.config['UPLOAD_FOLDER']
        reports_dir = os.path.join(app_upload_folder, 'reports')
        os.makedirs(reports_dir, exist_ok=True)
        
        # Set directory permissions
        try:
            os.chmod(reports_dir, 0o755)
        except Exception as e:
            logger.warning(f"Could not set permissions on reports directory: {e}")
            
        # Generate PDF path with timestamp to avoid conflicts
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        pdf_filename = f"compliance_report_{document_id}_{timestamp}.pdf"
        pdf_path = os.path.join(reports_dir, pdf_filename)
        
        # Log the PDF path for debugging
        logger.info(f"Generating PDF at: {pdf_path}")
        logger.info(f"Directory exists: {os.path.exists(os.path.dirname(pdf_path))}")
        logger.info(f"Directory is writable: {os.access(os.path.dirname(pdf_path), os.W_OK)}")
        
        # Ensure the directory has proper permissions
        try:
            if not os.access(os.path.dirname(pdf_path), os.W_OK):
                logger.error(f"No write permission for directory: {os.path.dirname(pdf_path)}")
                os.chmod(os.path.dirname(pdf_path), 0o755)  # Try to fix permissions
        except Exception as e:
            logger.error(f"Permission check failed: {str(e)}")
        
        # Setup PDF document
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, 
                                rightMargin=72, leftMargin=72,
                                topMargin=72, bottomMargin=72)
        
        # Initialize styles
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name='Title', 
                                fontName='Helvetica-Bold',
                                fontSize=16, 
                                alignment=1,  # 0=left, 1=center, 2=right
                                spaceAfter=12))
        
        styles.add(ParagraphStyle(name='Heading2', 
                                fontName='Helvetica-Bold',
                                fontSize=14, 
                                spaceBefore=12,
                                spaceAfter=6))
        
        styles.add(ParagraphStyle(name='Heading3', 
                                fontName='Helvetica-Bold',
                                fontSize=12, 
                                spaceBefore=10,
                                spaceAfter=5))
        
        styles.add(ParagraphStyle(name='Normal', 
                                fontName='Helvetica',
                                fontSize=10, 
                                spaceBefore=6,
                                spaceAfter=6))
        
        styles.add(ParagraphStyle(name='Footer', 
                                fontName='Helvetica',
                                fontSize=8, 
                                textColor=colors.gray,
                                alignment=1))
        
        # Initialize document elements
        elements = []
        
        # Add title
        elements.append(Paragraph("Norma AI Compliance Report", styles['Title']))
        elements.append(Spacer(1, 0.25*inch))
        elements.append(Paragraph(f"Document: {document.title}", styles['Heading2']))
        elements.append(Spacer(1, 0.1*inch))
        
        # Add metadata
        meta_data = [
            ["Generated Date:", datetime.now().strftime('%Y-%m-%d %H:%M')],
            ["Document Date:", document.created.strftime('%Y-%m-%d %H:%M')],
            ["File:", document.filename],
            ["Jurisdiction:", jurisdiction_display]
        ]
        
        meta_table = Table(meta_data, colWidths=[1.5*inch, 4*inch])
        meta_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
        ]))
        
        elements.append(meta_table)
        elements.append(Spacer(1, 0.25*inch))
        
        # Add compliance summary
        elements.append(Paragraph("Compliance Summary", styles['Heading2']))
        
        if compliance_results.get('compliance_status') == 'compliant':
            summary_text = "✓ Compliant with Legal Requirements - No compliance issues were found in this document."
            summary_style = ParagraphStyle(name='SummaryGood', 
                                        parent=styles['Normal'],
                                        textColor=colors.green)
        else:
            issues_count = compliance_results.get('issues_count', 0)
            issue_word = "issue" if issues_count == 1 else "issues"
            summary_text = f"✗ Non-Compliant with Legal Requirements - The document has {issues_count} compliance {issue_word} that need to be addressed."
            summary_style = ParagraphStyle(name='SummaryBad', 
                                        parent=styles['Normal'],
                                        textColor=colors.red)
        
        elements.append(Paragraph(summary_text, summary_style))
        elements.append(Spacer(1, 0.15*inch))
        
        # Add applicable laws section
        if compliance_results.get('applicable_laws'):
            elements.append(Paragraph("Applicable Laws and Regulations", styles['Heading2']))
            
            law_items = []
            for law in compliance_results.get('applicable_laws', []):
                law_items.append(ListItem(Paragraph(f"<b>{law.get('name')}</b> - {law.get('description')}", styles['Normal'])))
            
            elements.append(ListFlowable(law_items, bulletType='bullet', start=None))
            elements.append(Spacer(1, 0.15*inch))
        
        # Add compliance issues section
        if compliance_results.get('issues'):
            elements.append(Paragraph(f"Compliance Issues ({compliance_results.get('issues_count', 0)})", styles['Heading2']))
            
            for idx, issue in enumerate(compliance_results.get('issues', [])):
                elements.append(Paragraph(f"Issue {idx+1}: {issue.get('issue_type')}", styles['Heading3']))
                
                severity_style = ParagraphStyle(
                    name=f'Severity{idx}', 
                    parent=styles['Normal'],
                    textColor=(colors.red if issue.get('severity', '').lower() == 'high' else 
                            colors.orange if issue.get('severity', '').lower() == 'medium' else 
                            colors.green)
                )
                
                elements.append(Paragraph(f"Severity: {issue.get('severity', 'Unknown')}", severity_style))
                elements.append(Paragraph(f"Description: {issue.get('description', '')}", styles['Normal']))
                
                if issue.get('context'):
                    context_style = ParagraphStyle(
                        name=f'Context{idx}', 
                        parent=styles['Normal'],
                        fontName='Courier',
                        backColor=colors.lightgrey,
                        borderPadding=5
                    )
                    elements.append(Paragraph(f"Context: {issue.get('context', '')}", context_style))
                
                elements.append(Paragraph(f"Recommendation: {issue.get('recommendation', '')}", styles['Normal']))
                elements.append(Spacer(1, 0.15*inch))
        
        # Add categories section
        if compliance_results.get('categories'):
            elements.append(Paragraph("Compliance by Category", styles['Heading2']))
            
            # Create table data
            cat_data = [["Category", "Status", "Issues"]]
            for cat in compliance_results.get('categories', []):
                status = "✓ Compliant" if cat.get('compliant') else "✗ Non-Compliant"
                cat_data.append([cat.get('name', ''), status, str(cat.get('issues_count', 0))])
            
            # Create table
            cat_table = Table(cat_data, colWidths=[2.5*inch, 1.5*inch, 1*inch])
            cat_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('ALIGN', (1, 1), (1, -1), 'CENTER'),
                ('ALIGN', (2, 1), (2, -1), 'CENTER'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            
            elements.append(cat_table)
            elements.append(Spacer(1, 0.15*inch))
        
        # Add footer
        elements.append(Spacer(1, 0.5*inch))
        elements.append(Paragraph("This report was automatically generated by Norma AI. The analysis is based on the document content "
                                f"and the selected jurisdiction's legal requirements as of {datetime.now().strftime('%Y-%m-%d')}.", 
                                styles['Footer']))
        elements.append(Paragraph(f" Norma AI. All rights reserved.", styles['Footer']))
        
        # Build the PDF
        doc.build(elements)
        
        # Save the PDF
        try:
            with open(pdf_path, 'wb') as f:
                pdf_data = buffer.getvalue()
                logger.info(f"PDF generated, size: {len(pdf_data)} bytes")
                f.write(pdf_data)
                
            # Verify the file was created and is readable
            if not os.path.exists(pdf_path):
                logger.error(f"PDF file was not created at {pdf_path}")
                raise ValueError(f"PDF file was not created")
                
            if not os.access(pdf_path, os.R_OK):
                logger.error(f"PDF file is not readable: {pdf_path}")
                os.chmod(pdf_path, 0o644)  # Try to fix permissions
                
            file_size = os.path.getsize(pdf_path)
            logger.info(f"PDF file created successfully at: {pdf_path}, size: {file_size} bytes")
            
            if file_size == 0:
                logger.error(f"PDF file is empty: {pdf_path}")
                raise ValueError("Generated PDF file is empty")
                
            return pdf_path
            
        except Exception as file_error:
            logger.error(f"Error saving PDF file: {str(file_error)}")
            raise
        
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        raise
