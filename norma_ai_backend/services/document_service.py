import os
import random
from flask import current_app

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt'}

def allowed_file(filename):
    """Check if the file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def analyze_document(file_path, document_id):
    """
    Analyze a document for compliance with Italian law.
    In a real app, this would use NLP or other techniques to analyze the document.
    For this example, we'll simulate analysis with random compliance issues.
    """
    # Get file extension
    file_extension = file_path.rsplit('.', 1)[1].lower()
    
    # Simulate document analysis with random compliance issues
    italian_laws = [
        "Regolamento Generale sulla Protezione dei Dati (GDPR)",
        "Decreto Legislativo 231/2001",
        "Codice Civile Italiano",
        "Codice del Consumo",
        "Legge sulla Privacy (196/2003)",
        "Decreto Legislativo 81/2008 (Sicurezza sul Lavoro)",
        "Legge Antiriciclaggio (231/2007)"
    ]
    
    # Generate random compliance issues
    num_issues = random.randint(0, 5)
    compliance_issues = []
    
    for _ in range(num_issues):
        law = random.choice(italian_laws)
        severity = random.choice(['low', 'medium', 'high'])
        compliance_issues.append({
            "law": law,
            "description": f"Potential compliance issue with {law}",
            "severity": severity,
            "page": random.randint(1, 10),
            "recommendations": f"Review and ensure compliance with {law}"
        })
    
    # Determine overall compliance status
    compliance_status = "compliant" if len(compliance_issues) == 0 else "non-compliant"
    
    # Return analysis results
    return {
        "document_id": document_id,
        "compliance_status": compliance_status,
        "issues_count": len(compliance_issues),
        "issues": compliance_issues,
        "summary": f"Document analysis complete. Found {len(compliance_issues)} potential compliance issues."
    }
