import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from hospital_system import HospitalSystem
import server


class TestHospitalSystem(unittest.TestCase):
    def setUp(self) -> None:
        self.hs = HospitalSystem()

    def test_add_and_display_patients_preserves_order(self) -> None:
        ok1, _ = self.hs.add_patient(101, "Ali Khan", 32, "Fever", "Dr. Ibrahim Ashraf")
        ok2, _ = self.hs.add_patient(102, "Sara Ahmed", 25, "Migraine")

        self.assertTrue(ok1)
        self.assertTrue(ok2)
        self.assertEqual(self.hs.patient_count, 2)

        patients = self.hs.display_patients()
        self.assertEqual([p.id for p in patients], [101, 102])
        self.assertEqual(patients[0].next, patients[1])
        self.assertIsNone(patients[1].next)
        self.assertEqual(patients[1].doctor, "General OPD")

    def test_duplicate_patient_id_rejected(self) -> None:
        self.hs.add_patient(101, "Ali Khan", 32, "Fever")
        ok, msg = self.hs.add_patient(101, "Duplicate", 40, "Cold")
        self.assertFalse(ok)
        self.assertIn("already exists", msg)
        self.assertEqual(self.hs.patient_count, 1)

    def test_patient_validation_rejects_bad_inputs(self) -> None:
        cases = [
            (0, "Ali", 20, "Fever"),
            (-5, "Ali", 20, "Fever"),
            (True, "Ali", 20, "Fever"),
            (1, "   ", 20, "Fever"),
            (1, "Ali", -1, "Fever"),
            (1, "Ali", 151, "Fever"),
            (1, "Ali", False, "Fever"),
            (1, "Ali", 20, ""),
        ]
        for pid, name, age, disease in cases:
            ok, _ = self.hs.add_patient(pid, name, age, disease)
            self.assertFalse(ok)
        self.assertEqual(self.hs.patient_count, 0)

    def test_search_patient(self) -> None:
        self.hs.add_patient(201, "Usman Tariq", 47, "Hypertension")
        found = self.hs.search_patient(201)
        self.assertIsNotNone(found)
        self.assertEqual(found.name, "Usman Tariq")
        self.assertIsNone(self.hs.search_patient(999))
        self.assertIsNone(self.hs.search_patient(True))

    def test_fifo_appointments_and_status_transitions(self) -> None:
        self.hs.add_patient(101, "Ali Khan", 32, "Fever")
        self.hs.add_patient(102, "Sara Ahmed", 25, "Migraine")

        ok1, _ = self.hs.book_appointment("ali khan", "Dr. Ibrahim Ashraf")
        ok2, _ = self.hs.book_appointment("Sara Ahmed")
        self.assertTrue(ok1)
        self.assertTrue(ok2)
        self.assertEqual(self.hs.pending_appointments_count, 2)
        self.assertEqual(self.hs.search_patient(101).status, "In Queue")

        ok_call1, _ = self.hs.call_next()
        self.assertTrue(ok_call1)
        self.assertEqual(self.hs.search_patient(101).status, "In Progress")

        ok_call2, _ = self.hs.call_next()
        self.assertTrue(ok_call2)
        self.assertEqual(self.hs.search_patient(101).status, "Attended")
        self.assertEqual(self.hs.search_patient(102).status, "In Progress")

        ok_empty, msg = self.hs.call_next()
        self.assertFalse(ok_empty)
        self.assertEqual(msg, "No pending appointments")


class TestServerAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        server.hospital = HospitalSystem()
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.HospitalRequestHandler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def _request(self, method: str, path: str, body: dict | None = None):
        url = f"http://127.0.0.1:{self.port}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"} if body is not None else {}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            return err.code, json.loads(err.read().decode("utf-8"))

    def test_api_workflow(self) -> None:
        status, payload = self._request("GET", "/api/state")
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["state"]["stats"]["patient_count"], 0)

        status, payload = self._request(
            "POST",
            "/api/patients",
            {"id": 1, "name": "Ayesha Malik", "age": 19, "disease": "Allergy"},
        )
        self.assertEqual(status, 201)
        self.assertTrue(payload["ok"])

        status, payload = self._request("GET", "/api/patients/1")
        self.assertEqual(status, 200)
        self.assertTrue(payload["found"])
        self.assertEqual(payload["patient"]["name"], "Ayesha Malik")

        status, payload = self._request(
            "POST", "/api/appointments", {"name": "Ayesha Malik"}
        )
        self.assertEqual(status, 201)
        self.assertEqual(payload["state"]["stats"]["pending_appointments"], 1)

        status, payload = self._request("POST", "/api/appointments/call-next", {})
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["attended"]["name"], "Ayesha Malik")


if __name__ == "__main__":
    unittest.main()
