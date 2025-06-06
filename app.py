from flask import Flask, render_template
from blueprints.ai_routes import ai_bp

app = Flask(__name__)

app.register_blueprint(ai_bp)
@app.route("/")
def index():
    return render_template("index.html")
