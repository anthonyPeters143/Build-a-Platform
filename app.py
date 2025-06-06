from flask import Flask, render_template
from blueprints.ai_routes import ai_bp

# Create and configure flask app object
app = Flask(__name__)

# Register blueprint for ai routes
app.register_blueprint(ai_bp)



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

# ----------------------------------------
# Route: GET /api/summaries
# ----------------------------------------
@app.route('/api/summaries', methods=['GET'])
def get_summaries():
    """
    Return all stored location summaries (most recent first).
    """