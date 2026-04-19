# ================================================
# config.py – Secure Nest Flask Configuration
# ================================================
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "secure-nest-secret-2026")
    FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
    FIREBASE_DB_URL = os.getenv("FIREBASE_DB_URL", "https://your-project-default-rtdb.firebaseio.com")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
    THREAD_POOL_WORKERS = int(os.getenv("THREAD_POOL_WORKERS", "10"))
    WEATHER_API_KEY = os.getenv("WEATHER_API_KEY", "")
    DEBUG = os.getenv("DEBUG", "True") == "True"
    PORT = int(os.getenv("PORT", "5000"))
