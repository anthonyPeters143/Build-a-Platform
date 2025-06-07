import os
import requests
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify, abort

from extensions import limiter, cache
from db import db
from models import Summary

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

# ----------------------------------------
# Load environment and constants
# ----------------------------------------
load_dotenv()

RESPONSE_LENGTH = os.getenv("RESPONSE_WORD_LENGTH")
GEO_API = os.getenv("GEOAPIFY_API")
GEO_TOKEN = os.getenv("GEOAPIFY_API_TOKEN")

CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID")
CF_API_TOKEN = os.getenv("CF_API_TOKEN")
CF_MODEL = os.getenv("CF_MODEL")

# Construct Cloudflare AI endpoint and headers
CF_ENDPOINT = (
    f"https://api.cloudflare.com/client/v4/accounts/"
    f"{CF_ACCOUNT_ID}/ai/run/{CF_MODEL}"
)
CF_HEADERS = {
    "Authorization": f"Bearer {CF_API_TOKEN}",
    "Content-Type": "application/json"
}

# ----------------------------------------
# Route: GET /api/location-summary
# ----------------------------------------
@ai_bp.route("/location-summary", methods=["GET"])
@limiter.limit("10/minute")
# Cache for 24 hours, using lat and lng inputs
@cache.cached(timeout=86400, query_string=True)
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

    # Create ai mmodel prompt
    prompt = f"Give me an description of the area {description} within {RESPONSE_LENGTH} words, without stopping in the middle of a sentence".strip()

    # Attempt to prompt ai model
    try:
        payload = {
            "prompt": prompt,
            "parameters": {
                "max_tokens": 60,
                "temperature": 0.7,
                "top_p": 0.9
            }
        }
        resp = requests.post(CF_ENDPOINT, headers=CF_HEADERS, json=payload, timeout=30)
        resp.raise_for_status()
        generated = resp.json().get("result", {}).get("response", "") 
    except Exception as e:
        # Throw error if model is unable to respond
        return jsonify({
            "error": "Model response error",
            "details": repr(e)
        }), 502

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
        "summary": generated,
        "posted_at": summary.posted_at
    })