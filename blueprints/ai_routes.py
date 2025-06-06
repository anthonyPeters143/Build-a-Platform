import os
import requests
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify, abort

from db import db
from models import Summary

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

# ----------------------------------------
# Load environment and constants
# ----------------------------------------
load_dotenv()

GEO_API = os.getenv("GEOAPIFY_API")
GEO_TOKEN = os.getenv("GEOAPIFY_API_TOKEN")

# ----------------------------------------
# Route: GET /api/location-summary
# ----------------------------------------
@ai_bp.route("/location-summary", methods=["GET"])
def location_summary():
    """
    Reverse-geocode a given lat/lng, prompt AI to generate a summary, and store it.
    
    Imported Variables Used:
      - GEO_API, GEO_TOKEN: Geoapify reverse-geocoding URL and API key
      - CF_ENDPOINT, CF_HEADERS: Cloudflare AI endpoint details
      - RESPONSE_LENGTH: target word length for the summary
      - db.session, models.Summary: to persist new summaries
    """

    # Gets and determines if lat and long cooridates are valid
    lat = request.args.get("lat")
    lng = request.args.get("lng")
    if lat is None or lng is None:
        # Abort if not valid
        abort(400, "lat and lng query parameters required")

    # Reverse-geocode via Geoapify and check if response is valid
    params = {"lat": lat, "lon": lng, "apiKey": GEO_TOKEN}
    geo_resp = requests.get(GEO_API, params=params, timeout=5)
    if geo_resp.status_code != 200:
        # Abort if not valid
        abort(502, f"Geoapify error: {geo_resp.text}")

    # Store and check features from reverse-geocode
    features = geo_resp.json().get("features")
    if not features:
        # Abort if not valid
        abort(404, "No location data found")

    # Create and store properties of location
    props = features[0]["properties"]
    place_parts = []
    for key in ("state","country"):

        # Check for redundant descriptions
        v = props.get(key)
        if v and v not in place_parts:
            place_parts.append(v)
    
    # Create a comma sperated string from the description
    description = ", ".join(place_parts)

    # Attempt to save location summary
    try:
        # Create new summary object in database
        summary = Summary(
            location=description, 
            summary=None, 
            lat=float(lat), 
            lng=float(lng))
        db.session.add(summary)
        db.session.commit()
    except Exception as e:
        # Abort if saving failed
        abort(500,"Failed to save location summary")
        
    # Return JSON of id, lat, long, description, summary, and posted at values
    return jsonify({
        "id": summary.id,
        "lat": lat,
        "lng": lng,
        "description": description,
        "summary": None,
        "posted_at": summary.posted_at
    })