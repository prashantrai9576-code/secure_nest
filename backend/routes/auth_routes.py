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
    """GET /api/auth/profile – Return user profile from DB."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"success": False, "error": "Missing token"}), 401
    
    token = auth_header.split(" ")[1]
    decoded_token = fb.verify_token(token)
    if not decoded_token:
        return jsonify({"success": False, "error": "Invalid token"}), 401
    
    uid = decoded_token["uid"]
    email = decoded_token.get("email")
    user_data = fb.read(f"users/{uid}")
    
    if not user_data:
        # If user exists in Auth but not in DB, create a default entry
        role = "SuperAdmin" if email == "hr239531@gmail.com" else "Member"
        user_data = {
            "name": decoded_token.get("name", "Super Admin" if email == "hr239531@gmail.com" else "Unknown"),
            "email": email,
            "role": role,
            "createdAt": {".sv": "timestamp"}
        }
        fb.write(f"users/{uid}", user_data)
    elif email == "hr239531@gmail.com" and user_data.get("role") != "SuperAdmin":
        # Force SuperAdmin role for this specific email
        user_data["role"] = "SuperAdmin"
        fb.update(f"users/{uid}", {"role": "SuperAdmin"})

    return jsonify({"success": True, "profile": user_data})

@auth_bp.route("/users", methods=["GET"])
def list_users():
    """GET /api/auth/users – List all users (Super Admin only)."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"success": False, "error": "Missing token"}), 401
    
    token = auth_header.split(" ")[1]
    decoded_token = fb.verify_token(token)
    if not decoded_token:
        return jsonify({"success": False, "error": "Invalid token"}), 401
    
    # Check if requester is Super Admin
    requester_uid = decoded_token["uid"]
    requester_data = fb.read(f"users/{requester_uid}")
    if not requester_data or requester_data.get("role") != "SuperAdmin":
        return jsonify({"success": False, "error": "Unauthorized. Super Admin access required."}), 403
    
    users = fb.read("users")
    if not users:
        return jsonify({"success": True, "users": []})
    
    # Convert dict to list and include UIDs
    user_list = []
    for uid, data in users.items():
        data["uid"] = uid
        user_list.append(data)
        
    return jsonify({"success": True, "users": user_list})

@auth_bp.route("/update-role", methods=["POST"])
def update_user_role():
    """POST /api/auth/update-role – Update a user's role (Super Admin only)."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"success": False, "error": "Missing token"}), 401
    
    token = auth_header.split(" ")[1]
    decoded_token = fb.verify_token(token)
    if not decoded_token:
        return jsonify({"success": False, "error": "Invalid token"}), 401
    
    # Check if requester is Super Admin
    requester_uid = decoded_token["uid"]
    requester_data = fb.read(f"users/{requester_uid}")
    if not requester_data or requester_data.get("role") != "SuperAdmin":
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    
    data = request.json
    target_uid = data.get("uid")
    new_role = data.get("role")
    
    if not target_uid or not new_role:
        return jsonify({"success": False, "error": "Missing UID or role"}), 400
    
    # Prevent changing own role or modifying other Super Admins if needed
    # But for now, just update
    fb.update(f"users/{target_uid}", {"role": new_role})
    return jsonify({"success": True, "message": f"User role updated to {new_role}"})

@auth_bp.route("/delete-user", methods=["DELETE"])
def delete_user():
    """DELETE /api/auth/delete-user – Remove a user (Super Admin only)."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"success": False, "error": "Missing token"}), 401
    
    token = auth_header.split(" ")[1]
    decoded_token = fb.verify_token(token)
    if not decoded_token:
        return jsonify({"success": False, "error": "Invalid token"}), 401
    
    # Check if requester is Super Admin
    requester_uid = decoded_token["uid"]
    requester_data = fb.read(f"users/{requester_uid}")
    if not requester_data or requester_data.get("role") != "SuperAdmin":
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    
    target_uid = request.args.get("uid")
    if not target_uid:
        return jsonify({"success": False, "error": "Missing UID"}), 400
    
    # Delete from DB
    fb.get_ref(f"users/{target_uid}").delete()
    
    # Note: This doesn't delete from Firebase Auth, only from our DB
    # To delete from Auth, we'd need firebase_admin.auth.delete_user(uid)
    return jsonify({"success": True, "message": "User deleted from database"})
