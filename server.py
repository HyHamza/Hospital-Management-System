"""
Zero-Dependency Python Web Server for Hospital Management System.

Bridges the HTML/CSS/JS Clinical Dashboard directly to the core
HospitalSystem (Singly Linked List + collections.deque + Doctors) backend.

Run with:
    python server.py
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import os
import threading
import urllib.parse
import webbrowser
from typing import Any, Dict

from hospital_system import HospitalSystem, PatientNode

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
HOST = "127.0.0.1"
PORT = 8000

hospital = HospitalSystem()
state_lock = threading.Lock()


def serialize_patient(node: PatientNode) -> Dict[str, Any]:
    return {
        "id": node.id,
        "name": node.name,
        "age": node.age,
        "disease": node.disease,
        "doctor": node.doctor,
        "status": node.status,
        "next_id": node.next.id if node.next is not None else None,
    }


def build_state_payload() -> Dict[str, Any]:
    patients = [serialize_patient(p) for p in hospital.display_patients()]
    queue = [dict(item) for item in hospital.appointments]
    return {
        "patients": patients,
        "queue": queue,
        "doctors": hospital.doctors,
        "current_attending": hospital.current_attending,
        "stats": {
            "patient_count": hospital.patient_count,
            "pending_appointments": hospital.pending_appointments_count,
            "available_doctors": hospital.available_doctors_count,
            "total_doctors": len(hospital.doctors),
            "next_in_queue": hospital.next_in_queue,
            "next_appointment": hospital.next_appointment,
            "head_id": hospital.head.id if hospital.head is not None else None,
        },
    }


class HospitalRequestHandler(SimpleHTTPRequestHandler):
    """Serves static HTML/CSS/JS from /web and JSON REST endpoints under /api."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"  [HTTP] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/state":
            with state_lock:
                self._send_json({"ok": True, "state": build_state_payload()})
            return

        if path.startswith("/api/patients/"):
            raw_id = path.removeprefix("/api/patients/").strip("/")
            try:
                patient_id = int(raw_id)
            except ValueError:
                self._send_json(
                    {"ok": False, "found": False, "message": "Patient ID must be a valid integer."},
                    status=400,
                )
                return

            with state_lock:
                node = hospital.search_patient(patient_id)
                if node is None:
                    self._send_json(
                        {"ok": True, "found": False, "patient": None, "message": "Patient not found"}
                    )
                else:
                    self._send_json(
                        {
                            "ok": True,
                            "found": True,
                            "patient": serialize_patient(node),
                            "message": "Patient record found",
                        }
                    )
            return

        if path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        data = self._read_json_body()

        if path == "/api/patients":
            raw_id = data.get("id")
            name = data.get("name", "")
            raw_age = data.get("age")
            disease = data.get("disease", "")
            doctor = data.get("doctor", "General OPD")

            try:
                patient_id = int(raw_id)
            except (TypeError, ValueError):
                self._send_json(
                    {"ok": False, "message": "Patient ID must be a positive integer."},
                    status=400,
                )
                return

            try:
                age = int(raw_age)
            except (TypeError, ValueError):
                self._send_json(
                    {"ok": False, "message": "Patient age must be an integer between 0 and 150."},
                    status=400,
                )
                return

            with state_lock:
                ok, message = hospital.add_patient(
                    patient_id, str(name), age, str(disease), str(doctor)
                )
                status = 201 if ok else 400
                self._send_json(
                    {"ok": ok, "message": message, "state": build_state_payload()},
                    status=status,
                )
            return

        if path == "/api/appointments":
            name = data.get("name", "")
            doctor = data.get("doctor")
            with state_lock:
                ok, message = hospital.book_appointment(
                    str(name), str(doctor) if doctor else None
                )
                status = 201 if ok else 400
                self._send_json(
                    {"ok": ok, "message": message, "state": build_state_payload()},
                    status=status,
                )
            return

        if path == "/api/appointments/call-next":
            with state_lock:
                ok, message = hospital.call_next()
                attended = hospital.current_attending if ok else None
                self._send_json(
                    {
                        "ok": ok,
                        "message": message,
                        "attended": attended,
                        "state": build_state_payload(),
                    }
                )
            return

        if path == "/api/demo-seed":
            samples = [
                (101, "Ali Khan", 32, "Seasonal Fever", "Dr. Ibrahim Ashraf — General Medicine"),
                (102, "Sara Ahmed", 25, "Chronic Migraine", "Dr. Usman Raza — Neurology"),
                (103, "Usman Tariq", 47, "Hypertension", "Dr. Shawal Nadeem — Cardiology"),
                (104, "Ayesha Malik", 19, "Allergic Asthma", "Dr. Bisma Iqbal — ENT & Dermatology"),
            ]
            with state_lock:
                added = 0
                for pid, pname, page, pdisease, pdoctor in samples:
                    ok, _ = hospital.add_patient(pid, pname, page, pdisease, pdoctor)
                    if ok:
                        added += 1
                if hospital.pending_appointments_count == 0:
                    hospital.book_appointment("Ali Khan", "Dr. Ibrahim Ashraf — General Medicine")
                    hospital.book_appointment("Sara Ahmed", "Dr. Usman Raza — Neurology")
                msg = (
                    f"Loaded {added} sample patient records & 2 appointments"
                    if added > 0
                    else "Sample records are already loaded"
                )
                self._send_json({"ok": True, "message": msg, "state": build_state_payload()})
            return

        self._send_json({"ok": False, "message": "Endpoint not found"}, status=404)


def run_server(host: str = HOST, port: int = PORT, open_browser: bool = True) -> None:
    server = ThreadingHTTPServer((host, port), HospitalRequestHandler)
    url = f"http://{host}:{port}"
    print("=" * 64)
    print("  HOSPITAL MANAGEMENT SYSTEM — WEB SERVER RUNNING")
    print(f"  Open in browser: {url}")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 64)

    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Hospital Management System server...")
    finally:
        server.server_close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Hospital Management System web server."
    )
    parser.add_argument("--host", default=HOST, help=f"Bind host (default: {HOST})")
    parser.add_argument(
        "--port", type=int, default=PORT, help=f"Bind port (default: {PORT})"
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not automatically open the dashboard in a browser",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_server(host=args.host, port=args.port, open_browser=not args.no_browser)
