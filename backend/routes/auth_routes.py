# ================================================
# auth_routes.py – Authentication API Routes
# ================================================
from flask import Blueprint, request, jsonify
from services import firebase_service as fb

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/verify", methods=["POST"])
def verify_token():
    """POST /api/auth/verify – Verify Firebase ID token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"success": False, "error": "Missing token"}), 401
    
    token = auth_header.split(" ")[1]
    decoded_token = fb.verify_token(token)
    
    if not decoded_token:
        return jsonify({"success": False, "error": "Invalid token"}), 401
    
    return jsonify({"success": True, "uid": decoded_token["uid"]})

@auth_bp.route("/profile", methods=["GET"])
def get_profile():
    """GET /api/auth/profile – Return user profile."""
    # This would typically fetch from Firestore
    return jsonify({"success": True, "profile": {"role": "Admin", "name": "Admin User"}})
