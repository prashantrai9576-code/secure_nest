# ================================================
# lock_service.py – Lock Command Dispatch Service
# Runs lock/unlock commands in thread pool
# ================================================
import time
import logging
from datetime import datetime
from services import firebase_service as fb

logger = logging.getLogger(__name__)

LOCK_NAMES = {
    "front_door":  "Front Door",
    "back_door":   "Back Door",
    "garage_door": "Garage Door",
}


def send_lock_command(lock_id: str, command: str, user: str = "Web App") -> dict:
    """
    Dispatch lock/unlock command to Firebase.
    This function is called inside a thread pool executor.
    """
    try:
        lock_key = lock_id.lower().replace(" ", "_")
        is_locked = (command == "lock")
        ts = datetime.now().isoformat()

        # 1. Update lock state in Firebase
        fb.write(f"locks/{lock_key}", {
            "locked": is_locked,
            "last_command": command,
            "updated_by": user,
            "updated_at": ts,
        })

        # 2. Write access log
        fb.push("access_logs", {
            "user": user,
            "door": LOCK_NAMES.get(lock_key, lock_id),
            "method": "Web App",
            "status": "Granted",
            "action": command,
            "timestamp": ts,
        })

        logger.info(f"Lock command '{command}' sent for {lock_key} by {user}")
        return {"success": True, "lock_id": lock_key, "command": command}

    except Exception as e:
        logger.error(f"Lock command failed: {e}")
        return {"success": False, "error": str(e)}


def get_all_lock_states() -> dict:
    """Fetch current lock states from Firebase."""
    data = fb.read("locks") or {}
    result = {}
    for key, name in LOCK_NAMES.items():
        state = data.get(key, {})
        result[key] = {
            "name": name,
            "locked": state.get("locked", True),
            "updated_at": state.get("updated_at", "N/A"),
            "updated_by": state.get("updated_by", "System"),
        }
    return result
