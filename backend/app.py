# ================================================
# app.py – Secure Nest Main Entry Point
# Flask with Multithreading
# ================================================
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from services import firebase_service as fb
from routes.lock_routes import lock_bp
from routes.log_routes import log_bp
from routes.alert_routes import alert_bp
from routes.auth_routes import auth_bp

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Enable CORS for frontend connectivity
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    
    # Initialize Firebase Admin SDK
    fb.init_firebase(app.config["FIREBASE_CREDENTIALS"], app.config["FIREBASE_DB_URL"])
    
    # Register Blueprints
    app.register_blueprint(lock_bp)
    app.register_blueprint(log_bp)
    app.register_blueprint(alert_bp)
    app.register_blueprint(auth_bp)
    
    @app.route("/")
    def index():
        return jsonify({
            "name": "Secure Nest API",
            "version": "1.0.0",
            "status": "online"
        })

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app

if __name__ == "__main__":
    app = create_app()
    logger.info(f"Starting Secure Nest Backend on port {Config.PORT}...")
    # Flask's built-in server is multithreaded by default in recent versions (threaded=True)
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
