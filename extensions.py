# ----------------------------------------
# Purpose:
#   - Define and configure shared Flask extensions (rate limiter, CSRF, caching)
#
# Imports Summary:
#   - flask_limiter.Limiter: rate-limiting support
#   - flask_limiter.util.get_remote_address: key function for identifying clients
#   - flask_wtf.CSRFProtect: CSRF protection
#   - flask_caching.Cache: caching support
# ----------------------------------------

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf import CSRFProtect
from flask_caching import Cache

# ----------------------------------------
# Rate limiter: uses client IP as key
# ----------------------------------------
limiter = Limiter(key_func=get_remote_address)

# ----------------------------------------
# CSRF protection middleware for form submissions
# ----------------------------------------
csrf = CSRFProtect()

# ----------------------------------------
# system cache for view results
# ----------------------------------------
cache = Cache()