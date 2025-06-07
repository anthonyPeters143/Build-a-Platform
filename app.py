import os
from datetime import datetime, timedelta, timezone
from flask import Flask, render_template, request, jsonify, Response
from dotenv import load_dotenv
import json
from better_profanity import profanity

from extensions import limiter, csrf, cache
from db import db
from models import Message, Summary
from blueprints.ai_routes import ai_bp

# Loads in .env files
load_dotenv()

# Check env for varaibles
required_env = [
    'FLASK_SECRET_KEY',
    'DATABASE_URL', 
    'GEOAPIFY_API_TOKEN', 
    'CF_API_TOKEN', 
    'CF_ACCOUNT_ID', 
    'CF_MODEL'
    ]
missing = [v for v in required_env if not os.getenv(v)]
if missing:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


# Create and configure flask app object
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')
app.config['DEBUG'] = os.getenv('FLASK_ENV') != 'production'
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initlizalize app extensions
db.init_app(app)
csrf.init_app(app)
cache.init_app(app, config={
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": "instance/cache_data",
    "CACHE_DEFAULT_TIMEOUT": int(os.getenv("CACHE_DEFAULT_TIMEOUT", "3600"))
})
limiter.init_app(app)

# Create database tables
with app.app_context():
    db.create_all()

# Register blueprint for ai routes
app.register_blueprint(ai_bp)

# Load from badwords.json for profanity filter
with open('static/badwords.json', encoding='utf-8') as f:
    custom_badwords = json.load(f)
profanity.load_censor_words(custom_words=custom_badwords)



# ----------------------------------------
# Helper functions (not exposed as routes)
# ----------------------------------------
def remove_old_messages():
    """
    Delete messages older than TTL (from MESSAGE_TTL_MINUTES) from the database.
    """
    
    # Determine cutoff datetime from env variable
    ttl_minutes = int(os.getenv('MESSAGE_TTL_MINUTES', '3600'))
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)

    # Remove old messages from the database by filtering for older than ttl
    Message.query.filter(Message.posted_at < cutoff).delete(synchronize_session=False)
    db.session.commit()

def filter_messages():
    """
    Build a filtered query for Message based on optional URL parameters:
        - start, end: ISO datetime strings
        - lat_min, lat_max, lng_min, lng_max: float bounds
    Returns a list of Message objects sorted descending by posted_at.
    """

    # Get message objects
    query = Message.query

    # Get filters values
    start = request.args.get('start')
    end = request.args.get('end')
    lat_min = request.args.get('lat_min', type=float)
    lat_max = request.args.get('lat_max', type=float)
    lng_min = request.args.get('lng_min', type=float)
    lng_max = request.args.get('lng_max', type=float)

    # Check if start dates is not empty
    if start:
        try:
            # Reformate start date 
            start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))

            # Filter dates by start date
            query = query.filter(Message.posted_at >= start_dt)

        except ValueError:
            # Respond if format is invalid 
            return Response(
                'Invalid start date format',
                status=400,
                content_type='text/plain'
            )

    # Check if end dates is not empty 
    if end:
        try:
            # Reformate start date 
            end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))

            # Filter dates by start date
            query = query.filter(Message.posted_at <= end_dt)

        except ValueError:
            # Respond if format is invalid 
            Response(
                'Invalid end date format',
                status=400,
                content_type='text/plain'
            )

    # Check if cooridnate values are not empty and if so then filter using that option
    if lat_min is not None:
        query = query.filter(Message.lat >= lat_min)
    if lat_max is not None:
        query = query.filter(Message.lat <= lat_max)
    if lng_min is not None:
        query = query.filter(Message.lng >= lng_min)
    if lng_max is not None:
        query = query.filter(Message.lng <= lng_max)

    # Order stored messages by datetime posted 
    messages = query.order_by(Message.posted_at.desc()).all()

    # Return filtered messages
    return messages

def create_message():
    """
    Validate, sanitize, and save a new Message from JSON payload:
        - 'message': non-empty string (no profanity)
        - 'lat' and 'lng': required floats
    Returns the new Message instance.
    """
    # Get data from request or create an empty object
    data = request.get_json() or {}

    # Strip and store values from request
    msg = data.get('message', '').strip()
    lat = data.get('lat')
    lng = data.get('lng')

    # Check if message amd cooridates are not empty
    if not msg or lat is None or lng is None:
        # Respond if coordinates are not found
        return Response(
            'Lat and long inputs are required',
            status=400,
            content_type='text/plain'
        )

    # Create message object and add it to the database
    message = Message(
        message=msg, 
        lat=float(lat), 
        lng=float(lng)
    )
    db.session.add(message)
    db.session.commit()

    # Return message object
    return message

# ----------------------------------------
# Routes
# ----------------------------------------
# ----------------------------------------
# Route: GET /
# ----------------------------------------
@app.route('/')
def index():
    """
    Serve main application page (index.html).
    """

    # Return template
    return render_template('index.html', project_name='ChatOnline.World')

# ----------------------------------------
# Route: GET or POST /api/messages
# ----------------------------------------
@app.route('/api/messages', methods=['GET', 'POST'])
def messages():
    """
    GET /api/messages:
        - Purge old messages
        - Retrieve filtered messages
        - Return JSON list via Message.to_dict() OR a plain‐text 400 Respons

    POST /api/messages:
        - Create a new message from JSON payload
        - Return JSON of created Message.to_dict() OR a plain‐text 400 Respons
    """

    # Check request type
    if request.method == 'GET':
        # Remove old messages from database
        remove_old_messages()
        
        # Get and filter messages from database
        messages = filter_messages()

        # Check if messages is a error response
        if isinstance(messages, Response):
            return messages 
        
        # Return JSON of messages
        return jsonify([m.to_dict() for m in messages])

    if request.method == 'POST':
        # Message creation
        message = create_message()

        # Check if message is a error response
        if isinstance(message, Response):
            return message 

        # Return JSON of message
        return jsonify(message.to_dict()), 201 

# ----------------------------------------
# Route: GET /api/summaries
# ----------------------------------------
@app.route('/api/summaries', methods=['GET'])
def get_summaries():
    """
    Return all stored location summaries (most recent first).
    """

    # Get summaries
    summaries = Summary.query.order_by(Summary.posted_at.desc()).all()
    
    # Serialize summaries
    return jsonify([s.to_dict() for s in summaries])

# Entry point
if __name__ == '__main__':
    app.run(debug=False)
