from flask import Blueprint, jsonify

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

@ai_bp.route("/describe", methods=["POST"])
def describe_location():
    return jsonify({ "success": True })
