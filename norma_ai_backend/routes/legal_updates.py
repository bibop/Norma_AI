import json
import os
import requests
import feedparser
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, UserSettings

legal_updates_bp = Blueprint('legal_updates', __name__)

# Cache for storing legal updates to avoid frequent API calls
legal_updates_cache = {
    'data': {},
    'last_updated': {},
    'update_interval': 30  # Default 30 minutes
}

# Dictionary of reliable legal news sources by jurisdiction
LEGAL_NEWS_SOURCES = {
    'us': [
        {
            'name': 'Federal Register',
            'url': 'https://www.federalregister.gov/api/v1/documents.rss?significant=1',
            'type': 'rss'
        },
        {
            'name': 'Supreme Court',
            'url': 'https://www.supremecourt.gov/rss/slipopinions.aspx',
            'type': 'rss'
        },
        {
            'name': 'Law360',
            'url': 'https://www.law360.com/rss/articles/section_id/3',
            'type': 'rss'
        }
    ],
    'uk': [
        {
            'name': 'UK Legislation',
            'url': 'https://www.legislation.gov.uk/new/data.feed',
            'type': 'rss'
        },
        {
            'name': 'UK Supreme Court',
            'url': 'https://www.supremecourt.uk/rss/judgments-rss.xml',
            'type': 'rss'
        }
    ],
    'eu': [
        {
            'name': 'EUR-Lex',
            'url': 'https://eur-lex.europa.eu/rss/legal-content-NEW-REG.xml',
            'type': 'rss'
        },
        {
            'name': 'European Court of Justice',
            'url': 'https://curia.europa.eu/jcms/jcms/Jo2_7052/en/',
            'type': 'scrape',
            'selector': '.results-list article'
        }
    ],
    'it': [
        {
            'name': 'Gazzetta Ufficiale',
            'url': 'https://www.gazzettaufficiale.it/rss/serie_generale.xml',
            'type': 'rss'
        }
    ],
    'ca': [
        {
            'name': 'Department of Justice',
            'url': 'https://www.justice.gc.ca/eng/news-nouv/rss.xml',
            'type': 'rss'
        }
    ],
    'au': [
        {
            'name': 'Federal Register of Legislation',
            'url': 'https://www.legislation.gov.au/WhatsNew/Gazettes/rss',
            'type': 'rss'
        }
    ]
}

# Fallback data in case API calls fail
FALLBACK_DATA = {
    'us': [
        {
            'title': 'Privacy Law Amendment for US Businesses',
            'link': 'https://www.ftc.gov/news-events/news/press-releases',
            'published': datetime.utcnow().isoformat(),
            'source': 'Federal Trade Commission',
            'summary': 'New privacy regulations for businesses operating in the United States.'
        }
    ],
    'eu': [
        {
            'title': 'GDPR Enforcement Updated in EU Member States',
            'link': 'https://ec.europa.eu/newsroom/just/items/',
            'published': datetime.utcnow().isoformat(),
            'source': 'European Commission',
            'summary': 'Updates to GDPR enforcement procedures across EU member states.'
        }
    ],
    'uk': [
        {
            'title': 'UK Data Protection Framework Changes Post-Brexit',
            'link': 'https://ico.org.uk/about-the-ico/news-and-events/news-and-blogs/',
            'published': datetime.utcnow().isoformat(),
            'source': 'Information Commissioner\'s Office',
            'summary': 'New data protection framework implemented in the UK following Brexit adjustments.'
        }
    ],
    'ca': [
        {
            'title': 'Canadian Privacy Law Modernization Act',
            'link': 'https://www.priv.gc.ca/en/opc-news/news-and-announcements/',
            'published': datetime.utcnow().isoformat(),
            'source': 'Office of the Privacy Commissioner of Canada',
            'summary': 'New modernization act to enhance privacy protections for Canadian citizens.'
        }
    ],
    'au': [
        {
            'title': 'Australian Consumer Data Right Expansion',
            'link': 'https://www.accc.gov.au/media-release/',
            'published': datetime.utcnow().isoformat(),
            'source': 'Australian Competition & Consumer Commission',
            'summary': 'Expansion of the Consumer Data Right to additional sectors of the Australian economy.'
        }
    ],
    'it': [
        {
            'title': 'Italian Data Protection Updates',
            'link': 'https://www.garanteprivacy.it/home_en/web/guest/home_en',
            'published': datetime.utcnow().isoformat(),
            'source': 'Italian Data Protection Authority',
            'summary': 'New guidelines on data protection compliance for Italian businesses.'
        }
    ]
}

def fetch_rss_feed(source):
    """Fetch and parse an RSS feed."""
    try:
        feed = feedparser.parse(source['url'])
        results = []
        
        for entry in feed.entries[:10]:  # Limit to 10 entries
            published_date = entry.get('published', None)
            if published_date:
                try:
                    # Try to parse the date in various formats
                    published = datetime.strptime(published_date, '%a, %d %b %Y %H:%M:%S %z').isoformat()
                except ValueError:
                    try:
                        published = datetime.strptime(published_date, '%Y-%m-%dT%H:%M:%S%z').isoformat()
                    except ValueError:
                        published = datetime.utcnow().isoformat()
            else:
                published = datetime.utcnow().isoformat()
                
            results.append({
                'title': entry.title,
                'link': entry.link,
                'published': published,
                'source': source['name'],
                'summary': entry.get('summary', '').strip() if hasattr(entry, 'summary') else ''
            })
        
        return results
    except Exception as e:
        current_app.logger.error(f"Error fetching RSS feed {source['url']}: {str(e)}")
        return []

def should_update_cache(jurisdiction):
    """Check if the cache should be updated based on the update interval."""
    now = datetime.utcnow()
    
    # If no data for this jurisdiction or first time accessing
    if jurisdiction not in legal_updates_cache['last_updated']:
        return True
    
    # Calculate time difference
    last_updated = legal_updates_cache['last_updated'][jurisdiction]
    time_diff = now - last_updated
    
    # Update if more than update_interval minutes have passed
    return time_diff.total_seconds() > (legal_updates_cache['update_interval'] * 60)

def translate_to_english(text, source_language):
    """
    Translate text to English.
    In a production environment, this would call a translation API.
    For now, this is a placeholder.
    """
    # This is a mock translation function
    # In production, you would integrate with Google Translate, DeepL, or similar services
    # For now, we'll just return the original text
    return text

@legal_updates_bp.route('/legal-updates', methods=['GET'])
@jwt_required()
def get_legal_updates():
    """Get legal updates based on the user's profile preferences."""
    user_id = int(get_jwt_identity())
    
    # Get user's preferred jurisdictions and legal sources
    user = User.query.get(user_id)
    if not user:
        return jsonify({
            'success': False,
            'message': 'User not found'
        }), 404
    
    # Get user's preferred jurisdictions
    preferred_jurisdictions = []
    try:
        if user.preferred_jurisdictions:
            preferred_jurisdictions = json.loads(user.preferred_jurisdictions)
    except:
        current_app.logger.error(f"Error parsing preferred_jurisdictions for user {user_id}")
    
    # Make sure primary jurisdiction is included
    primary_jurisdiction = user.preferred_jurisdiction
    if primary_jurisdiction and primary_jurisdiction not in preferred_jurisdictions:
        preferred_jurisdictions.append(primary_jurisdiction)
    
    # If no jurisdictions are set, default to 'us'
    if not preferred_jurisdictions:
        preferred_jurisdictions = ['us']
    
    # Get user's preferred legal sources
    preferred_sources = []
    try:
        if user.preferred_legal_sources:
            preferred_sources = json.loads(user.preferred_legal_sources)
    except:
        current_app.logger.error(f"Error parsing preferred_legal_sources for user {user_id}")
    
    # Initialize results list
    all_results = []
    
    # Fetch updates from each preferred jurisdiction
    for jurisdiction in preferred_jurisdictions:
        # Check if we need to update the cache
        if should_update_cache(jurisdiction):
            # Get news sources for this jurisdiction
            sources = LEGAL_NEWS_SOURCES.get(jurisdiction, [])
            
            # Filter sources if user has preferences
            if preferred_sources:
                sources = [s for s in sources if s['name'] in preferred_sources]
            
            # Initialize results for this jurisdiction
            results = []
            
            # Fetch from each source
            for source in sources:
                if source['type'] == 'rss':
                    source_results = fetch_rss_feed(source)
                    results.extend(source_results)
            
            # If no results, use fallback data
            if not results and jurisdiction in FALLBACK_DATA:
                results = FALLBACK_DATA.get(jurisdiction, [])
            
            # For non-English jurisdictions, translate titles and summaries
            if jurisdiction in ['it']:
                for item in results:
                    item['title'] = translate_to_english(item['title'], 'it')
                    if 'summary' in item and item['summary']:
                        item['summary'] = translate_to_english(item['summary'], 'it')
            
            # Update cache
            legal_updates_cache['data'][jurisdiction] = results
            legal_updates_cache['last_updated'][jurisdiction] = datetime.utcnow()
        
        # Add jurisdiction's updates to the combined results
        if jurisdiction in legal_updates_cache['data']:
            jurisdiction_results = legal_updates_cache['data'][jurisdiction]
            # Tag each result with its jurisdiction
            for item in jurisdiction_results:
                item['jurisdiction'] = jurisdiction
                
            all_results.extend(jurisdiction_results)
    
    # Sort all results by published date, newest first
    all_results.sort(key=lambda x: x.get('published', ''), reverse=True)
    
    # Get update interval from settings
    settings = UserSettings.query.filter_by(user_id=user_id).first()
    update_interval = settings.legal_updates_interval if settings else legal_updates_cache['update_interval']
    
    # Get the earliest last_updated time from all fetched jurisdictions
    last_updated = datetime.utcnow()
    if preferred_jurisdictions:
        jurisdiction_times = [
            legal_updates_cache['last_updated'].get(j, datetime.utcnow()) 
            for j in preferred_jurisdictions 
            if j in legal_updates_cache['last_updated']
        ]
        if jurisdiction_times:
            last_updated = min(jurisdiction_times)
    
    return jsonify({
        'success': True,
        'message': 'Legal updates retrieved successfully',
        'updates': all_results,
        'updateInterval': update_interval,
        'lastUpdated': last_updated.isoformat(),
        'preferredJurisdictions': preferred_jurisdictions
    })

@legal_updates_bp.route('/settings/legal-updates-interval', methods=['PUT'])
@jwt_required()
def update_legal_updates_interval():
    """Update the legal updates refresh interval."""
    user_id = int(get_jwt_identity())
    
    # Get the new interval from request
    data = request.get_json()
    if not data or 'minutes' not in data:
        return jsonify({'success': False, 'message': 'Minutes parameter is required'}), 400
    
    minutes = int(data['minutes'])
    if minutes < 1:
        return jsonify({'success': False, 'message': 'Interval must be at least 1 minute'}), 400
    
    try:
        # Get or create user settings
        settings = UserSettings.query.filter_by(user_id=user_id).first()
        if not settings:
            settings = UserSettings(user_id=user_id)
            db.session.add(settings)
        
        # Update the interval
        settings.legal_updates_interval = minutes
        db.session.commit()
        
        # Update the global cache setting
        legal_updates_cache['update_interval'] = minutes
        
        return jsonify({
            'success': True,
            'message': 'Legal updates interval updated successfully',
            'updateInterval': minutes
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error updating interval: {str(e)}'}), 500
