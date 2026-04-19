# ================================================
# firebase_service.py – Firebase Admin SDK Service
# Thread-safe read/write wrapper
# ================================================
import firebase_admin
from firebase_admin import credentials, db, auth
import threading
import logging
import sys
import os

logger = logging.getLogger(__name__)
_lock = threading.Lock()
_initialized = False


def init_firebase(cred_path: str, db_url: str):
    """Initialize Firebase Admin SDK (call once at startup)."""
    global _initialized
    with _lock:
        if _initialized:
            return
        if not os.path.exists(cred_path):
            logger.warning(f"Firebase credentials not found at {cred_path}. Running in demo mode.")
            _initialized = True
            return
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {"databaseURL": db_url})
            _initialized = True
            logger.info("Firebase Admin SDK initialized.")
        except Exception as e:
            logger.error(f"Firebase init failed: {e}")


def get_ref(path: str):
    """Get a Firebase DB reference (thread-safe)."""
    try:
        return db.reference(path)
    except Exception as e:
        logger.error(f"Firebase get_ref error: {e}")
        return None


def read(path: str):
    """Read data from Firebase path."""
    ref = get_ref(path)
    if ref is None:
        return None
    try:
        return ref.get()
    except Exception as e:
        logger.error(f"Firebase read error at {path}: {e}")
        return None


def write(path: str, data: dict):
    """Write data to Firebase path."""
    ref = get_ref(path)
    if ref is None:
        return False
    try:
        ref.set(data)
        return True
    except Exception as e:
        logger.error(f"Firebase write error at {path}: {e}")
        return False


def update(path: str, data: dict):
    """Update data at Firebase path."""
    ref = get_ref(path)
    if ref is None:
        return False
    try:
        ref.update(data)
        return True
    except Exception as e:
        logger.error(f"Firebase update error at {path}: {e}")
        return False


def push(path: str, data: dict):
    """Push new entry to Firebase list."""
    ref = get_ref(path)
    if ref is None:
        return None
    try:
        new_ref = ref.push(data)
        return new_ref.key
    except Exception as e:
        logger.error(f"Firebase push error at {path}: {e}")
        return None


def verify_token(id_token: str):
    """Verify Firebase ID token, returns decoded token or None."""
    try:
        return auth.verify_id_token(id_token)
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None
