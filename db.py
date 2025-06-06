# ----------------------------------------
# Purpose:
#   - Instantiate a SQLAlchemy database object for use across the Flask app
#
# Imports Summary:
#   - flask_sqlalchemy.SQLAlchemy: ORM toolkit
#   - datetime (unused here, but kept for default timestamps in models)
# ----------------------------------------

from flask_sqlalchemy import SQLAlchemy

# ----------------------------------------
# Create and export a single SQLAlchemy instance for the entire app
# ----------------------------------------
db = SQLAlchemy()