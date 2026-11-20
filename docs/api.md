# REST API Reference

Base URL: `http://127.0.0.1:8000`

All endpoints return JSON with an `ok` boolean field. Mutation endpoints also return the updated `state` snapshot so the UI can re-render without an extra round-trip.

## Endpoints

### `GET /api/state`

Returns the full application state (`patients`, `queue`, `doctors`, `current_attending`, and `stats`).

**Response (`200 OK`)**

```json
{
  "ok": true,
  "state": {
    "patients": [],
    "queue": [],
    "doctors": [
      {
        "name": "Dr. Ibrahim Ashraf",
        "field": "General Medicine",
        "status": "Available"
      }
    ],
    "current_attending": null,
    "stats": {
      "patient_count": 0,
      "pending_appointments": 0,
      "available_doctors": 5,
      "total_doctors": 6,
      "next_in_queue": null,
      "next_appointment": null,
      "head_id": null
    }
  }
}
```

### `POST /api/patients`

Registers a new patient in the singly linked list.

**Request Body**

```json
{
  "id": 101,
  "name": "Ali Khan",
  "age": 32,
  "disease": "Seasonal Fever",
  "doctor": "Dr. Ibrahim Ashraf — General Medicine"
}
```

- `id`: Positive integer (must be unique).
- `name`: Non-empty string.
- `age`: Integer between `0` and `150`.
- `disease`: Non-empty string.
- `doctor`: Optional string (defaults to `"General OPD"`).

**Responses**: `201 Created` on success, `400 Bad Request` on validation failure or duplicate ID.

### `GET /api/patients/<id>`

Searches the linked list for a patient by integer ID.

**Response (`200 OK`)**

```json
{
  "ok": true,
  "found": true,
  "patient": {
    "id": 101,
    "name": "Ali Khan",
    "age": 32,
    "disease": "Seasonal Fever",
    "doctor": "Dr. Ibrahim Ashraf — General Medicine",
    "status": "Registered",
    "next_id": null
  },
  "message": "Patient record found"
}
```

Returns `400 Bad Request` if `<id>` is not a valid integer.

### `POST /api/appointments`

Enqueues a patient into the FIFO consultation queue.

**Request Body**

```json
{
  "name": "Ali Khan",
  "doctor": "Dr. Ibrahim Ashraf — General Medicine"
}
```

`doctor` is optional. If omitted, it uses the registered patient's assigned doctor or falls back to the first doctor in the directory.

**Responses**: `201 Created` on success, `400 Bad Request` if `name` is empty.

### `POST /api/appointments/call-next`

Dequeues the next patient from the front of the queue and marks them as `current_attending`.

**Response (`200 OK`)**

```json
{
  "ok": true,
  "message": "Now attending: Ali Khan",
  "attended": {
    "name": "Ali Khan",
    "doctor": "Dr. Ibrahim Ashraf — General Medicine"
  },
  "state": { "..." : "..." }
}
```

If the queue is empty, returns `200 OK` with `"ok": false` and `"message": "No pending appointments"`.

### `POST /api/demo-seed`

Loads four sample patient records (`101`–`104`) and two initial appointments if the queue is empty. Idempotent for already-loaded IDs.
