import os
import random
from flask import current_app
from models import User, db

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt'}

def allowed_file(filename):
    """Check if the file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def analyze_document(file_path, document_id, jurisdiction=None):
    """
    Analyze a document for compliance with legal requirements based on jurisdiction.
    In a real app, this would use NLP or other techniques to analyze the document.
    For this example, we'll simulate analysis with random compliance issues specific to the jurisdiction.
    
    Args:
        file_path: Path to the document file
        document_id: ID of the document in the database
        jurisdiction: Jurisdiction code (e.g., 'us', 'us-ca', 'eu-de', etc.)
    
    Returns:
        Dictionary containing analysis results
    """
    # Get file extension
    file_extension = file_path.rsplit('.', 1)[1].lower()
    
    # Default to US if no jurisdiction provided
    if not jurisdiction:
        jurisdiction = 'us'
    
    # Parse hierarchical jurisdiction (e.g., 'us-ca' for US-California)
    main_jurisdiction = jurisdiction.split('-')[0] if '-' in jurisdiction else jurisdiction
    sub_jurisdiction = jurisdiction.split('-')[1] if '-' in jurisdiction else None
    
    # Define jurisdiction-specific laws and regulations
    jurisdiction_laws = {
        'us': {
            'federal': [
                "General Data Protection Regulation (GDPR) Compliance",
                "Health Insurance Portability and Accountability Act (HIPAA)",
                "Fair Labor Standards Act (FLSA)",
                "Americans with Disabilities Act (ADA)",
                "Family and Medical Leave Act (FMLA)",
                "Equal Employment Opportunity (EEO) Laws"
            ],
            'ca': [
                "California Consumer Privacy Act (CCPA)",
                "California Privacy Rights Act (CPRA)",
                "California Consumer Financial Protection Law",
                "California Online Privacy Protection Act (CalOPPA)",
                "California Fair Employment and Housing Act (FEHA)",
                "California Family Rights Act (CFRA)"
            ],
            'ny': [
                "New York SHIELD Act",
                "New York Department of Financial Services Cybersecurity Regulation (NYDFS)",
                "New York Stop Hacks and Improve Electronic Data Security Act",
                "New York State Human Rights Law",
                "New York City Human Rights Law",
                "New York Paid Family Leave"
            ],
            'tx': [
                "Texas Identity Theft Enforcement and Protection Act",
                "Texas Data Protection Act (TDPSA)",
                "Texas Privacy Protection Act",
                "Texas Medical Records Privacy Act",
                "Texas Labor Code",
                "Texas Deceptive Trade Practices Act"
            ],
            'va': [
                "Virginia Consumer Data Protection Act (VCDPA)",
                "Virginia Privacy Law",
                "Virginia Human Rights Act",
                "Virginia Consumer Protection Act",
                "Virginia Information Technologies Agency (VITA) regulations",
                "Virginia Fraud Against Taxpayers Act"
            ],
            'other': [
                "General Data Protection Regulation (GDPR) Compliance",
                "Health Insurance Portability and Accountability Act (HIPAA)",
                "Fair Labor Standards Act (FLSA)",
                "Americans with Disabilities Act (ADA)",
                "Family and Medical Leave Act (FMLA)",
                "Equal Employment Opportunity (EEO) Laws"
            ]
        },
        'eu': {
            'general': [
                "General Data Protection Regulation (GDPR)",
                "ePrivacy Directive",
                "Network and Information Security (NIS) Directive",
                "Digital Services Act",
                "Digital Markets Act",
                "Consumer Rights Directive",
                "Unfair Commercial Practices Directive"
            ],
            'de': [
                "Federal Data Protection Act (BDSG)",
                "German Telemediengesetz (TMG)",
                "General Equal Treatment Act (Allgemeines Gleichbehandlungsgesetz)",
                "German Civil Code (BGB) consumer protection provisions",
                "Telecommunications Act (TKG)",
                "Works Constitution Act (Betriebsverfassungsgesetz)"
            ],
            'fr': [
                "French Data Protection Act (Loi Informatique et Libertés)",
                "French Consumer Code (Code de la consommation)",
                "CNIL Guidelines and Regulations",
                "French Labor Code (Code du travail)",
                "French Commercial Code (Code de commerce)",
                "French Electronic Communications Law"
            ],
            'other': [
                "General Data Protection Regulation (GDPR)",
                "ePrivacy Directive",
                "Network and Information Security (NIS) Directive",
                "Digital Services Act",
                "Digital Markets Act",
                "Consumer Rights Directive",
                "Unfair Commercial Practices Directive"
            ]
        },
        'uk': {
            'general': [
                "UK GDPR",
                "Data Protection Act 2018",
                "Privacy and Electronic Communications Regulations (PECR)",
                "Freedom of Information Act",
                "Equality Act 2010",
                "Consumer Rights Act 2015",
                "Employment Rights Act 1996"
            ],
            'england': [
                "UK GDPR",
                "Data Protection Act 2018",
                "Privacy and Electronic Communications Regulations (PECR)",
                "England-specific employment regulations",
                "Consumer Rights Act 2015",
                "England-specific local trading standards"
            ],
            'other': [
                "UK GDPR",
                "Data Protection Act 2018",
                "Privacy and Electronic Communications Regulations (PECR)",
                "Freedom of Information Act",
                "Equality Act 2010",
                "Consumer Rights Act 2015",
                "Employment Rights Act 1996"
            ]
        },
        'ca': {
            'federal': [
                "Personal Information Protection and Electronic Documents Act (PIPEDA)",
                "Consumer Protection Act",
                "Anti-Spam Legislation (CASL)",
                "Employment Standards Act",
                "Personal Health Information Protection Act (PHIPA)",
                "Human Rights Code",
                "Competition Act"
            ],
            'qc': [
                "Quebec Privacy Law (Law 25)",
                "Quebec Consumer Protection Act",
                "Quebec Charter of Human Rights and Freedoms",
                "Quebec Labor Standards Act",
                "Quebec Civil Code provisions",
                "Quebec Business Corporations Act"
            ],
            'other': [
                "Personal Information Protection and Electronic Documents Act (PIPEDA)",
                "Consumer Protection Act",
                "Anti-Spam Legislation (CASL)",
                "Employment Standards Act",
                "Personal Health Information Protection Act (PHIPA)",
                "Human Rights Code",
                "Competition Act"
            ]
        },
        'au': {
            'federal': [
                "Privacy Act 1988",
                "Australian Consumer Law",
                "Spam Act 2003",
                "Fair Work Act",
                "Telecommunications Act",
                "Competition and Consumer Act",
                "Corporations Act"
            ],
            'nsw': [
                "NSW Privacy and Personal Information Protection Act",
                "NSW Fair Trading Act",
                "NSW Industrial Relations Act",
                "NSW Work Health and Safety Act",
                "NSW specific business regulations",
                "NSW consumer protection laws"
            ],
            'other': [
                "Privacy Act 1988",
                "Australian Consumer Law",
                "Spam Act 2003",
                "Fair Work Act",
                "Telecommunications Act",
                "Competition and Consumer Act",
                "Corporations Act"
            ]
        }
    }
    
    # Get laws based on jurisdiction and sub-jurisdiction
    if main_jurisdiction in jurisdiction_laws:
        if sub_jurisdiction and sub_jurisdiction in jurisdiction_laws[main_jurisdiction]:
            applicable_laws = jurisdiction_laws[main_jurisdiction][sub_jurisdiction]
        elif 'other' in jurisdiction_laws[main_jurisdiction]:
            applicable_laws = jurisdiction_laws[main_jurisdiction]['other']
        else:
            # Fallback to the first sub-jurisdiction if available
            first_sub = next(iter(jurisdiction_laws[main_jurisdiction].keys()), None)
            applicable_laws = jurisdiction_laws[main_jurisdiction][first_sub] if first_sub else []
    else:
        # If jurisdiction not found, default to US federal
        applicable_laws = jurisdiction_laws['us']['federal']
    
    # Example non-compliant text sections tailored to each jurisdiction
    non_compliant_texts = {
        'us': [
            "The company reserves the right to use customer data for any purpose without explicit consent.",
            "Employees must disclose their medical history during the hiring process.",
            "All disputes shall be resolved through mandatory arbitration in a venue of the company's choosing.",
            "The company is not liable for any damages, even those resulting from gross negligence.",
            "Workers may be terminated at any time without cause or notice.",
            "Customer data will be retained indefinitely, even after account termination.",
            "All rights to employee-created intellectual property belong exclusively to the company, regardless of when or where created."
        ],
        'eu': [
            "By using our service, you consent to all data processing activities described in this policy.",
            "We may transfer your data outside the EU without additional safeguards.",
            "We will retain your data as long as necessary for our business purposes.",
            "Cookies will be placed on your device when you visit our website.",
            "We may change these terms at any time without notice.",
            "You waive your right to file class action lawsuits against our company.",
            "All content you upload becomes our property to use as we see fit."
        ],
        'uk': [
            "We may process your data on the basis of legitimate interest without specific consent.",
            "You must opt-out if you do not wish to receive marketing communications.",
            "We are not required to notify you of data breaches affecting your information.",
            "We may share your data with third parties without further notice.",
            "Disputes will be governed by laws other than those of the United Kingdom.",
            "The limitation period for bringing claims is reduced to six months.",
            "We reserve the right to monitor employee communications without notice."
        ],
        'ca': [
            "We may send you marketing emails without your express consent.",
            "By using our service, you opt-in to receive commercial electronic messages.",
            "We collect your data automatically when you visit our website.",
            "Personal health information may be used for research without anonymization.",
            "We may update these terms without notifying users.",
            "Refunds will not be provided under any circumstances.",
            "Employee monitoring may occur without prior notification."
        ],
        'au': [
            "We collect personal information without a clear privacy notice.",
            "You cannot opt-out of receiving marketing communications.",
            "We may use your data for purposes beyond those for which it was collected.",
            "Prices displayed do not include applicable taxes and fees.",
            "Product warranties can be voided at our discretion.",
            "All statutory consumer guarantees are excluded to the extent permitted by law.",
            "We make no commitment to data security measures."
        ]
    }
    
    # Get non-compliant texts based on main jurisdiction
    non_compliant = non_compliant_texts.get(main_jurisdiction, non_compliant_texts['us'])
    
    # Example recommended replacement texts for each jurisdiction
    suggested_texts = {
        'us': {
            'federal': [
                "The company will only use customer data for purposes specified in this agreement and with explicit customer consent, as required by applicable privacy laws.",
                "Employees are only required to disclose medical information that is directly relevant to their ability to perform essential job functions.",
                "Disputes may be resolved through arbitration or court proceedings, at the claimant's choice, in a mutually agreed upon venue.",
                "The company assumes liability for damages resulting from negligence or failure to exercise reasonable care.",
                "Workers will be given appropriate notice before termination except in cases of gross misconduct, and in accordance with state and federal laws.",
                "Customer data will be retained only as long as necessary for the purposes described in this agreement, and will be deleted upon account termination unless otherwise required by law.",
                "Rights to intellectual property created by employees outside of work hours and using personal resources remain with the employee, unless specifically related to company business."
            ],
            'ca': [
                "The company will only use customer data with explicit consent and for the specific purposes disclosed at the time of collection, in compliance with the CCPA and CPRA.",
                "We will not collect or use sensitive personal information without providing the consumer with the right to limit its use, as required by the CPRA.",
                "California residents have the right to opt-out of the sale or sharing of their personal information, delete personal information, correct inaccurate personal information, and limit the use of sensitive information.",
                "We honor consumer requests to know, delete, correct, and limit use of personal information within the timeframes mandated by California law.",
                "We provide California employees with all privacy protections required under California employment laws.",
                "California consumers may designate an authorized agent to make requests on their behalf regarding their personal information.",
                "We will not discriminate against California consumers for exercising their privacy rights."
            ],
            'other': [
                "The company will only use customer data for purposes specified in this agreement and with explicit customer consent, as required by applicable privacy laws.",
                "Employees are only required to disclose medical information that is directly relevant to their ability to perform essential job functions.",
                "Disputes may be resolved through arbitration or court proceedings, at the claimant's choice, in a mutually agreed upon venue.",
                "The company assumes liability for damages resulting from negligence or failure to exercise reasonable care.",
                "Workers will be given appropriate notice before termination except in cases of gross misconduct, and in accordance with state and federal laws.",
                "Customer data will be retained only as long as necessary for the purposes described in this agreement, and will be deleted upon account termination unless otherwise required by law.",
                "Rights to intellectual property created by employees outside of work hours and using personal resources remain with the employee, unless specifically related to company business."
            ]
        },
        'eu': [
            "We will process your data only after obtaining your specific, informed consent for each processing activity, as required by GDPR Art. 6(1)(a).",
            "Any data transfers outside the EU will be protected by appropriate safeguards such as Standard Contractual Clauses or adequacy decisions.",
            "We will retain your data only for the specific period necessary for the purposes outlined in this policy, after which it will be securely deleted.",
            "We will only place cookies on your device after you have given explicit consent through our cookie banner, with the exception of strictly necessary cookies.",
            "Any changes to these terms will be communicated to you at least 30 days in advance, requiring your affirmative consent to continue using our services.",
            "These terms do not restrict your right to join class actions or collective redress mechanisms as protected under EU law.",
            "You retain ownership of content you upload; we only obtain a limited license to use it for providing our services as specified."
        ],
        'uk': [
            "We will only process your data with a valid lawful basis, and where relying on legitimate interest, we will conduct and document a balancing test that respects your rights and interests.",
            "We will only send marketing communications when you have positively opted in, and each communication will include a simple way to opt out.",
            "We will notify you of any data breach that poses a risk to your rights and freedoms without undue delay, as required by UK GDPR Art. 33-34.",
            "Any sharing of your data with third parties will be clearly communicated to you in advance, with details of recipients and purposes.",
            "All disputes will be governed by the laws of the United Kingdom and subject to the exclusive jurisdiction of UK courts.",
            "The limitation period for bringing claims aligns with statutory requirements and will not be artificially shortened.",
            "Employee communications will only be monitored where there is a legitimate reason, after providing clear notification, and in accordance with ICO guidance."
        ],
        'ca': [
            "We will only send you marketing emails after obtaining your express consent, as required by CASL.",
            "We will obtain your explicit opt-in consent before sending commercial electronic messages, with clear identification and unsubscribe options.",
            "We clearly disclose all data collection practices in our privacy policy, and obtain consent before collecting your data when visiting our website.",
            "Personal health information will only be used for research purposes after obtaining consent or when properly anonymized in accordance with PHIPA.",
            "We will notify users of material changes to these terms at least 30 days in advance, requiring acknowledgment for continued use.",
            "Refunds will be provided in accordance with Canadian consumer protection laws in your province.",
            "Employees will be notified of any workplace monitoring in accordance with applicable employment standards."
        ],
        'au': [
            "We collect personal information in accordance with the Australian Privacy Principles, with a clear privacy notice explaining all collection purposes.",
            "All marketing communications include an easy opt-out mechanism, and we respect your choice not to receive such communications.",
            "We will only use your data for the primary purpose for which it was collected, or for related secondary purposes that you would reasonably expect.",
            "All prices displayed include GST and any other applicable taxes or fees, in compliance with Australian Consumer Law.",
            "Product warranties comply with consumer guarantees under Australian Consumer Law and cannot be voided unless permitted by law.",
            "Our products come with guarantees that cannot be excluded under the Australian Consumer Law, including the right to a repair, replacement or refund for a major failure.",
            "We implement reasonable security measures to protect personal information from misuse, interference, loss, and unauthorized access, as required by the Privacy Act."
        ]
    }
    
    # Get suggested texts based on jurisdiction
    if main_jurisdiction in suggested_texts:
        if isinstance(suggested_texts[main_jurisdiction], dict):
            # If the main jurisdiction has sub-jurisdictions
            if sub_jurisdiction and sub_jurisdiction in suggested_texts[main_jurisdiction]:
                suggested = suggested_texts[main_jurisdiction][sub_jurisdiction]
            elif 'other' in suggested_texts[main_jurisdiction]:
                suggested = suggested_texts[main_jurisdiction]['other']
            else:
                # Fallback to the first sub-jurisdiction if available
                first_sub = next(iter(suggested_texts[main_jurisdiction].keys()), None)
                suggested = suggested_texts[main_jurisdiction][first_sub] if first_sub else []
        else:
            # If the main jurisdiction doesn't have sub-jurisdictions
            suggested = suggested_texts[main_jurisdiction]
    else:
        # Default to US federal
        suggested = suggested_texts['us']['federal']
    
    # Generate random compliance issues
    num_issues = random.randint(0, 5)
    compliance_issues = []
    
    for i in range(num_issues):
        law = random.choice(applicable_laws)
        severity = random.choice(['low', 'medium', 'high'])
        text_index = random.randint(0, len(non_compliant) - 1)
        page = random.randint(1, 10)
        section = f"Section {random.randint(1, 12)}.{random.randint(1, 10)}"
        
        issue_descriptions = [
            f"The language used violates {law} requirements.",
            f"This clause creates compliance risks under {law}.",
            f"This provision doesn't meet the standards set by {law}.",
            f"This language creates potential legal exposure under {law}."
        ]
        
        recommendation_texts = [
            f"Replace with language that complies with {law} requirements.",
            f"Modify this section to explicitly address {law} compliance concerns.",
            f"Revise this clause to properly protect both parties while meeting {law} requirements.",
            f"Update this provision to align with current legal standards under {law}."
        ]
        
        compliance_issues.append({
            "law": law,
            "description": random.choice(issue_descriptions),
            "severity": severity,
            "page": page,
            "section": section,
            "original_text": non_compliant[text_index],
            "recommendations": random.choice(recommendation_texts),
            "suggested_text": suggested[text_index]
        })
    
    # Determine overall compliance status
    compliance_status = "compliant" if len(compliance_issues) == 0 else "non-compliant"
    
    # Return analysis results
    return {
        "document_id": document_id,
        "jurisdiction": jurisdiction,
        "compliance_status": compliance_status,
        "issues_count": len(compliance_issues),
        "issues": compliance_issues,
        "summary": f"Document analysis complete. Found {len(compliance_issues)} potential compliance issues that require review under {jurisdiction.upper()} jurisdiction."
    }
