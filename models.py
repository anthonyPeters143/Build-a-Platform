# ----------------------------------------
# Purpose:
#   - Define SQLAlchemy ORM models for 'Message' and 'Summary'
#   - Each model can serialize itself to a JSON-friendly dict
#
# Imports Summary:
#   - datetime, timezone: for timestamp defaults and conversion
#   - db (from db.py): SQLAlchemy instance for model definitions
# ----------------------------------------

from datetime import datetime, timezone

# Local imports
from db import db

class Message(db.Model):
    """
    ORM model for storing user messages with coordinates and timestamps.
    """

    # Message identifier, text, coordinates, and posted at timezone aware time (default is current time UTC)
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.Text, nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    posted_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        """
        Serialize a Message instance to a JSON-compatible dictionary.

        - Ensures 'posted_at' is UTC-aware and formatted as ISO string.
        """

        # Check if there is a timezone and update time to use it else use utc
        dt = self.posted_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)

        # Formate datetime as 'YYYY-MM-DDTHH:MM:SSZ'
        formateDatetime = dt.strftime('%Y-%m-%dT%H:%M:%SZ')

        # Return serialized message
        return {
            'id': self.id,
            'message': self.message,
            'lat': self.lat,
            'lng': self.lng,
            'posted_at': formateDatetime
        }
    
class Summary(db.Model):
    """
    ORM model for storing AI-generated summaries of locations (lat/lng).
    """
        
    # Summary identifier, text, location, coorindates, and posted at timezone aware time (default is current time UTC)
    id = db.Column(db.Integer, primary_key=True)
    summary = db.Column(db.Text, nullable=False)
    location = db.Column(db.Text, nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    posted_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    
    def to_dict(self):
        """
        Serialize a Summary instance to a JSON-compatible dictionary.

        - Ensures 'posted_at' is UTC-aware and formatted as ISO string.
        """
        
        # Check if there is a timezone and update time to use it else use utc
        dt = self.posted_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)

        # Formate datetime as 'YYYY-MM-DDTHH:MM:SSZ'
        formateDatetime = dt.strftime('%Y-%m-%dT%H:%M:%SZ')

        # Return serialized summary
        return {
            'id': self.id,
            'summary': self.summary,
            'lat': self.lat,
            'lng': self.lng,
            'location': self.location,
            'posted_at': formateDatetime
        }