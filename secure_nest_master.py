import os
import time
import cv2
import json
import threading
import logging
from datetime import datetime
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from ultralytics import YOLO
import face_recognition
import firebase_admin
from firebase_admin import credentials, db, auth, storage

# --- 1. GLOBAL SETTINGS & LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
# Serve frontend from the 'frontend' directory
app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)

# Route to serve the main frontend
@app.route("/")
def index_page():
    return app.send_static_file('index.html')

@app.route("/dashboard")
def dashboard_page():
    return app.send_static_file('dashboard.html')

@app.route("/auth")
def auth_page():
    return app.send_static_file('auth.html')

class SecureNestConfig:
    FACES_DB = "known_faces"
    MODEL_PATH = "face.pt" # Use the YOLO model we just copied
    FB_CRED = "nest-61a74-firebase-adminsdk-fbsvc-daedfb9e10.json"
    FB_DB_URL = "https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app/"
    FB_BUCKET = "nest-61a74.firebasestorage.app"
    PORT = 5000           

# --- 2. CORE SERVICES (AI & CLOUD) ---
class SecureNestAI:
    def __init__(self):
        if not os.path.exists(SecureNestConfig.FACES_DB):
            os.makedirs(SecureNestConfig.FACES_DB)
        
        logging.info("🚀 Loading YOLO Engine...")
        self.yolo_model = YOLO(SecureNestConfig.MODEL_PATH)
        self.known_face_encodings = []
        self.known_face_names = []
        self.load_known_faces()

    def load_known_faces(self):
        logging.info("🧠 Learning faces from Database...")
        for root, _, files in os.walk(SecureNestConfig.FACES_DB):
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    img_path = os.path.join(root, file)
                    try:
                        image = face_recognition.load_image_file(img_path)
                        encodings = face_recognition.face_encodings(image)
                        if encodings:
                            # Use folder name as identity if filename is generic
                            parent_dir = os.path.basename(root)
                            if parent_dir != SecureNestConfig.FACES_DB and parent_dir != "known_faces":
                                name = parent_dir
                            else:
                                name = file.split('_')[1].split('.')[0] if '_' in file else "User"
                            
                            self.known_face_encodings.append(encodings[0])
                            self.known_face_names.append(name)
                            logging.info(f"   [MEMORY] Learned Identity: {name}")
                    except Exception as e:
                        logging.error(f"   [ERROR] Learning {file}: {e}")
        logging.info(f"✅ AI Engine fully trained with {len(self.known_face_names)} identities.")

    def verify(self, image_path):
        try:
            frame = cv2.imread(image_path)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # 1. YOLO Detection
            results = self.yolo_model.predict(source=frame, conf=0.6, verbose=False)
            
            for result in results:
                boxes = result.boxes
                if boxes is not None and len(boxes) > 0:
                    logging.info(f"🔍 [AI] Detected {len(boxes)} potential faces in frame.")
                    for box in boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        # 2. Face Recognition within the YOLO box
                        face_location = [(y1, x2, y2, x1)]
                        encodings = face_recognition.face_encodings(rgb_frame, face_location)
                        
                        if encodings:
                            matches = face_recognition.compare_faces(self.known_face_encodings, encodings[0], tolerance=0.6)
                            if True in matches:
                                first_match_index = matches.index(True)
                                name = self.known_face_names[first_match_index]
                                logging.info(f"✨ [AI] MATCH FOUND: {name}")
                                return True, name, 0.95
                            else:
                                logging.info("👤 [AI] Face detected but identity is UNKNOWN.")
            
            return False, None, 0
        except Exception as e:
            logging.error(f"❌ [AI] Error: {e}")
            return False, None, 0

class SecureNestCloud:
    def __init__(self):
        try:
            if os.path.exists(SecureNestConfig.FB_CRED):
                cred = credentials.Certificate(SecureNestConfig.FB_CRED)
                firebase_admin.initialize_app(cred, {
                    'databaseURL': SecureNestConfig.FB_DB_URL,
                    'storageBucket': SecureNestConfig.FB_BUCKET
                })
                self.bucket = storage.bucket()
                logging.info("✅ Cloud Engine Ready")
            else:
                logging.warning("⚠️ Firebase Credentials not found. Running in local mode.")
        except Exception as e:
            logging.error(f"Cloud Init Error: {e}")

    def log_access(self, user, door, method, status, image_path=None):
        # NOTE: Firebase Storage upload disabled (bucket not provisioned).
        # Access logs still saved to Realtime Database without image.
        try:
            db.reference("access_logs").push({
                "user": user, 
                "door": door, 
                "method": method, 
                "status": status, 
                "timestamp": datetime.now().isoformat(),
                "image_url": None
            })
            logging.info(f"✅ Access logged: {user} – {status}")
        except Exception as e:
            logging.error(f"Logging Error: {e}")

# Initialize Engines
ai_engine = SecureNestAI()
cloud_engine = SecureNestCloud()

# Global variable for streaming
latest_frame = None
frame_lock = threading.Lock()

def gen_frames():
    global latest_frame
    while True:
        with frame_lock:
            if latest_frame is None:
                continue
            
            # Professional OSD (On-Screen Display)
            frame_overlay = latest_frame.copy()
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(frame_overlay, f"SECURE NEST | {timestamp}", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            cv2.rectangle(frame_overlay, (0,0), (frame_overlay.shape[1], frame_overlay.shape[0]), (0,255,0), 1)
            
            ret, buffer = cv2.imencode('.jpg', frame_overlay)
            frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route("/video_feed")
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/api/status")
def api_status():
    return jsonify({"project": "Secure Nest Master Backend", "status": "Online"})

@app.route("/api/face/recognize", methods=["POST"])
def recognize():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
        
    file = request.files['image']
    temp_path = "temp_auth.jpg"
    file.save(temp_path)
    
    is_auth, user_id, confidence = ai_engine.verify(temp_path)
    
    if is_auth:
        # Unlock the door in Firebase for the ESP32 to see
        try:
            db.reference("locks/front_door").update({"status": "unlocked", "user": user_id})
        except: pass
        
        cloud_engine.log_access(user_id, "Front Door", "Face", "Granted")
        return jsonify({"status": "unlocked", "user": user_id, "confidence": float(confidence)})
    
    cloud_engine.log_access("Unknown", "Front Door", "Face", "Denied")
    return jsonify({"status": "denied", "reason": "Unrecognized Face"})

@app.route("/api/lock/toggle", methods=["POST"])
def toggle_lock():
    data = request.json
    lock_id = data.get("lock_id", "front_door")
    command = data.get("command", "lock")
    try:
        db.reference(f"locks/{lock_id}").update({"status": command, "updated_by": "Web App"})
    except: pass
    return jsonify({"success": True})

# --- USER MANAGEMENT APIS (For Super Admin) ---

def verify_sa_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split('Bearer ')[1]
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        # Check if user is SuperAdmin in DB
        user_role = db.reference(f"users/{uid}/role").get()
        if user_role == 'SuperAdmin':
            return uid
        return None
    except Exception as e:
        logging.error(f"Auth Error: {e}")
        return None


@app.route("/api/auth/users", methods=["GET"])
def list_users():
    if not verify_sa_token():
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    
    try:
        users_data = db.reference("users").get() or {}
        users_list = []
        for uid, data in users_data.items():
            data['uid'] = uid
            users_list.append(data)
        return jsonify({"success": True, "users": users_list})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/auth/update-role", methods=["POST"])
def update_role():
    if not verify_sa_token():
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    
    data = request.json
    target_uid = data.get("uid")
    new_role = data.get("role")
    
    if not target_uid or not new_role:
        return jsonify({"success": False, "error": "Missing parameters"}), 400
        
    try:
        db.reference(f"users/{target_uid}").update({"role": new_role})
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/auth/delete-user", methods=["DELETE"])
def delete_user():
    if not verify_sa_token():
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    
    target_uid = request.args.get("uid")
    if not target_uid:
        return jsonify({"success": False, "error": "Missing UID"}), 400
        
    try:
        # Delete from Realtime DB
        db.reference(f"users/{target_uid}").delete()
        # Note: Deleting from Auth usually requires Admin SDK delete_user(uid)
        auth.delete_user(target_uid)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/logs", methods=["GET"])
def get_logs():
    try:
        logs_data = db.reference("access_logs").order_by_key().limit_to_last(50).get() or {}
        logs_list = list(logs_data.values())[::-1]
    except:
        logs_list = []
    return jsonify({"success": True, "logs": logs_list})

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    try:
        alerts_data = db.reference("alerts").order_by_key().limit_to_last(20).get() or {}
        alerts_list = list(alerts_data.values())
    except:
        alerts_list = []
    return jsonify({"success": True, "alerts": alerts_list, "count": len(alerts_list)})

# --- 4. WEBCAM GATEKEEPER THREAD ---
# Global for continuous recognition
face_tracker = {
    "name": None,
    "first_seen": 0,
    "alert_sent": False
}

def auto_recognize_thread():
    global latest_frame
    while True:
        time.sleep(1) # Check every 1 second
        frame_to_check = None
        with frame_lock:
            if latest_frame is not None:
                frame_to_check = latest_frame.copy()
        
        if frame_to_check is not None:
            temp_path = "auto_capture.jpg"
            cv2.imwrite(temp_path, frame_to_check)
            success, uid, conf = ai_engine.verify(temp_path)
            
            if success and uid:
                current_time = time.time()
                if face_tracker["name"] == uid:
                    # Same person seen again
                    if current_time - face_tracker["first_seen"] >= 2 and not face_tracker["alert_sent"]:
                        # Seen for 2 seconds
                        logging.info(f"🔔 [SECURITY] {uid} is waiting at the gate. Sending alert...")
                        try:
                            cloud_engine.log_access(uid, "Front Door", "Face (Auto-detect)", "Waiting", temp_path)
                            db.reference("alerts").push({
                                "title": f"{uid} is waiting at the gate. Please open the door.",
                                "type": "face_alert",
                                "timestamp": datetime.now().isoformat()
                            })
                            logging.info(f"✅ [CLOUD] Alert sent to Firebase for {uid}")
                        except Exception as e:
                            logging.error(f"⚠️ [CLOUD] Firebase Update Failed: {e}")
                        face_tracker["alert_sent"] = True
                else:
                    # New person detected
                    logging.info(f"👀 [AI] Monitoring: {uid}")
                    face_tracker["name"] = uid
                    face_tracker["first_seen"] = current_time
                    face_tracker["alert_sent"] = False
            else:
                # Nobody recognized
                face_tracker["name"] = None
                face_tracker["alert_sent"] = False

def run_gatekeeper():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        logging.error("Failed to open Webcam")
        return
        
    print("🎥 Camera Thread: ONLINE (Monitoring...)")
    
    # Start the continuous face recognition thread
    auto_rec_thread = threading.Thread(target=auto_recognize_thread)
    auto_rec_thread.daemon = True
    auto_rec_thread.start()
    
    while True:

        ret, frame = cap.read()
        if not ret: break
        
        # Share frame with streaming endpoint
        global latest_frame
        with frame_lock:
            latest_frame = frame.copy()
        
        # Display window
        cv2.imshow('Secure Nest Gatekeeper', frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

# --- 5. START EVERYTHING ---
if __name__ == "__main__":
    # Start Camera Thread
    cam_thread = threading.Thread(target=run_gatekeeper)
    cam_thread.daemon = True
    cam_thread.start()

    # Start Flask API
    print(f"🚀 API Thread: ONLINE (Port {SecureNestConfig.PORT})")
    # Setting debug=False is important when running with threads
    app.run(host="0.0.0.0", port=SecureNestConfig.PORT, debug=False, threaded=True)
