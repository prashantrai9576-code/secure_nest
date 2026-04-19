# ================================================
# lock_routes.py – Lock Control API Routes
# ================================================
from flask import Blueprint, request, jsonify
from concurrent.futures import ThreadPoolExecutor
from services import lock_service

lock_bp = Blueprint("locks", __name__, url_prefix="/api/lock")
executor = ThreadPoolExecutor(max_workers=5)


@lock_bp.route("/status", methods=["GET"])
def get_lock_status():
    """GET /api/lock/status – Return all lock states."""
    states = lock_service.get_all_lock_states()
    return jsonify({"success": True, "locks": states})


@lock_bp.route("/toggle", methods=["POST"])
def toggle_lock():
    """POST /api/lock/toggle – Toggle a lock via thread pool."""
    data = request.get_json(silent=True) or {}
    lock_id = data.get("lock_id") or data.get("name", "")
    command = data.get("command", "lock")
    user    = data.get("user", "Web App")

    if not lock_id:
        return jsonify({"success": False, "error": "lock_id required"}), 400

    # Dispatch async in thread pool so Flask doesn't block
    future = executor.submit(lock_service.send_lock_command, lock_id, command, user)
    result = future.result(timeout=5)
    return jsonify(result)


@lock_bp.route("/schedule", methods=["POST"])
def schedule_lock():
    """POST /api/lock/schedule – Schedule auto-lock."""
    data = request.get_json(silent=True) or {}
    lock_id = data.get("lock_id", "")
    delay   = int(data.get("delay_seconds", 300))

    import threading
    def auto_lock():
        import time
        time.sleep(delay)
        lock_service.send_lock_command(lock_id, "lock", "Auto-Scheduler")

    t = threading.Thread(target=auto_lock, daemon=True)
    t.start()
    return jsonify({"success": True, "message": f"Auto-lock in {delay}s", "lock_id": lock_id})
