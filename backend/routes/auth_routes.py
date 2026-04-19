import random
import smtplib
import os
from email.mime.text import MIMEText
from flask import Blueprint, request, jsonify
from services import firebase_service as fb

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Temporary OTP storage (In-memory)
temp_otps = {}

@auth_bp.route("/send-otp", methods=["POST"])
def send_otp():
    data = request.json
    email = data.get("email")
    if not email: return jsonify({"error": "Email required"}), 400
    
    otp = str(random.randint(100000, 999999))
    temp_otps[email] = otp
    
    print(f"\n[DEBUG] OTP for {email} is: {otp}\n")  # Print for testing

    # ==============================================================
    # STEP 5 (IMPORTANT): CHANGE THESE TWO LINES TO YOUR GMAIL DETAILS
    # ==============================================================
    sender_email = "your_email@gmail.com"  # <--- Apni Gmail id yahan daalo
    sender_password = "your_app_password"  # <--- Apna 16-digit App Password yahan daalo

    try:
        if sender_email == "your_email@gmail.com":
            return jsonify({"success": False, "error": "Bhai, auth_routes.py file open karke apna sender_email aur password daalo!"}), 400

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        
        message = f"Subject: Secure Nest OTP\n\nYour OTP is {otp}"
        server.sendmail(sender_email, email, message)
        server.quit()
        
        return jsonify({
            "success": True, 
            "message": "OTP Sent Successfully!",
            "otp_debug": otp
        }), 200

    except Exception as e:
        print(f"[ERROR] Failed to send email: {e}")
        return jsonify({
            "success": False, 
            "error": "Email bhejne mein error. Kya aapne Gmail App password sahi daala hai?"
        }), 500





@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")
    
    if email in temp_otps and temp_otps[email] == otp:
        # OTP is valid, remove it from storage
        del temp_otps[email]
        return jsonify({"success": True}), 200
    return jsonify({"success": False, "error": "Invalid or expired OTP"}), 400

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
