# ================================================
# log_routes.py – Access Logs API Routes
# ================================================
from flask import Blueprint, request, jsonify, Response
from services import firebase_service as fb
from datetime import datetime
import csv, io

log_bp = Blueprint("logs", __name__, url_prefix="/api/logs")

DEMO_LOGS = [
    {"user":"John Doe","door":"Front Door","method":"Face","status":"Granted","timestamp":"2026-04-19T08:30:00"},
    {"user":"Unknown Person","door":"Back Door","method":"Face","status":"Denied","timestamp":"2026-04-19T02:15:00"},
    {"user":"Admin User","door":"Garage Door","method":"Web App","status":"Granted","timestamp":"2026-04-18T22:45:00"},
    {"user":"Sarah Smith","door":"Front Door","method":"Fingerprint","status":"Granted","timestamp":"2026-04-18T18:10:00"},
]


@log_bp.route("", methods=["GET"])
def get_logs():
    """GET /api/logs – Fetch access logs."""
    door   = request.args.get("door", "")
    status = request.args.get("status", "")
    limit  = int(request.args.get("limit", 50))

    logs = fb.read("access_logs") or {}
    result = list(logs.values()) if isinstance(logs, dict) else DEMO_LOGS

    if door:   result = [l for l in result if l.get("door") == door]
    if status: result = [l for l in result if l.get("status") == status]

    result.sort(key=lambda x: x.get("timestamp",""), reverse=True)
    return jsonify({"success": True, "logs": result[:limit], "total": len(result)})


@log_bp.route("/add", methods=["POST"])
def add_log():
    """POST /api/logs/add – Add a new log entry (called from ESP32/RPi)."""
    data = request.get_json(silent=True) or {}
    data["timestamp"] = datetime.now().isoformat()
    key = fb.push("access_logs", data)
    return jsonify({"success": True, "key": key})


@log_bp.route("/export", methods=["GET"])
def export_csv():
    """GET /api/logs/export – Export logs as CSV."""
    logs = fb.read("access_logs") or {}
    rows = list(logs.values()) if isinstance(logs, dict) else DEMO_LOGS
    rows.sort(key=lambda x: x.get("timestamp",""), reverse=True)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["user","door","method","status","timestamp"])
    writer.writeheader()
    for row in rows:
        writer.writerow({k: row.get(k,"") for k in ["user","door","method","status","timestamp"]})

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=access_logs.csv"}
    )


@log_bp.route("/export/pdf", methods=["GET"])
def export_pdf():
    """GET /api/logs/export/pdf – Export logs as PDF."""
    from fpdf import FPDF
    
    logs = fb.read("access_logs") or {}
    rows = list(logs.values()) if isinstance(logs, dict) else DEMO_LOGS
    rows.sort(key=lambda x: x.get("timestamp",""), reverse=True)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(190, 10, "Secure Nest – Access Logs Report", ln=True, align="C")
    pdf.set_font("Arial", "", 10)
    pdf.cell(190, 10, f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True, align="C")
    pdf.ln(10)

    # Table Header
    pdf.set_fill_color(59, 130, 246)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(40, 10, "User", 1, 0, "C", True)
    pdf.cell(50, 10, "Timestamp", 1, 0, "C", True)
    pdf.cell(40, 10, "Door", 1, 0, "C", True)
    pdf.cell(30, 10, "Method", 1, 0, "C", True)
    pdf.cell(30, 10, "Status", 1, 1, "C", True)

    # Table Rows
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Arial", "", 9)
    for row in rows:
        ts = row.get("timestamp", "").replace("T", " ")[:19]
        pdf.cell(40, 8, str(row.get("user","")), 1)
        pdf.cell(50, 8, ts, 1)
        pdf.cell(40, 8, str(row.get("door","")), 1)
        pdf.cell(30, 8, str(row.get("method","")), 1)
        pdf.cell(30, 8, str(row.get("status","")), 1, 1)

    return Response(
        pdf.output(),
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment;filename=access_logs_report.pdf"}
    )

