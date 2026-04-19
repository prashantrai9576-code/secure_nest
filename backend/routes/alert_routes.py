# ================================================
# alert_routes.py – Security Alerts API Routes
# ================================================
from flask import Blueprint, request, jsonify
from services import firebase_service as fb
from datetime import datetime

alert_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")

DEMO_ALERTS = [
    {"id":"1","level":"high","title":"Multiple Failed Attempts","desc":"5 failed scans at Front Door","timestamp":"2026-04-19T11:50:00"},
    {"id":"2","level":"high","title":"Unknown Person Detected","desc":"Unrecognized face at Back Door","timestamp":"2026-04-19T11:45:00"},
    {"id":"3","level":"warn","title":"Low Battery","desc":"Back Door lock at 15%","timestamp":"2026-04-19T10:00:00"},
]


@alert_bp.route("", methods=["GET"])
def get_alerts():
    """GET /api/alerts – Return active alerts."""
    data = fb.read("alerts") or {}
    alerts = list(data.values()) if isinstance(data, dict) else DEMO_ALERTS
    alerts.sort(key=lambda x: x.get("timestamp",""), reverse=True)
    return jsonify({"success": True, "alerts": alerts, "count": len(alerts)})


@alert_bp.route("/add", methods=["POST"])
def add_alert():
    """POST /api/alerts/add – Add alert (from ESP32/RPi)."""
    data = request.get_json(silent=True) or {}
    data["timestamp"] = datetime.now().isoformat()
    key = fb.push("alerts", data)
    return jsonify({"success": True, "key": key})


@alert_bp.route("/dismiss", methods=["POST"])
def dismiss_alert():
    """POST /api/alerts/dismiss – Remove an alert."""
    data = request.get_json(silent=True) or {}
    alert_id = data.get("alert_id", "")
    if alert_id:
        ref = fb.get_ref(f"alerts/{alert_id}")
        if ref:
            ref.delete()
    return jsonify({"success": True})


@alert_bp.route("/dismiss-all", methods=["POST"])
def dismiss_all():
    """POST /api/alerts/dismiss-all – Clear all alerts."""
    fb.write("alerts", {})
    return jsonify({"success": True})
