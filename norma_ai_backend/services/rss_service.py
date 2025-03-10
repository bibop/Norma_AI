import feedparser
import requests
from datetime import datetime
from flask import current_app

def get_legal_updates():
    """
    Fetch the latest legal updates from the Italian government's RSS feed.
    """
    try:
        # Get RSS feed URL from config
        rss_url = current_app.config['RSS_FEED_URL']
        
        # Fetch and parse RSS feed
        feed = feedparser.parse(rss_url)
        
        # Process feed entries
        legal_updates = []
        for entry in feed.entries:
            legal_updates.append({
                'title': entry.title,
                'link': entry.link,
                'published': entry.published if 'published' in entry else '',
                'summary': entry.summary if 'summary' in entry else '',
                'fetched_at': datetime.utcnow().isoformat()
            })
        
        return {
            "success": True,
            "message": "Legal updates fetched successfully",
            "updates": legal_updates
        }
    except Exception as e:
        current_app.logger.error(f"Error fetching RSS feed: {str(e)}")
        return {
            "success": False,
            "message": f"Error fetching legal updates: {str(e)}",
            "updates": []
        }
