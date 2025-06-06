from flask import Blueprint

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

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