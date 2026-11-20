# Architecture

## Overview

The application is split into three layers:

1. **Core Domain (`hospital_system.py`)**: Pure Python data structures and business rules (`PatientNode`, `HospitalSystem`). No HTTP or UI dependencies.
2. **HTTP Server (`server.py`)**: Serves the static frontend from `web/` and exposes JSON endpoints under `/api/*`.
3. **Frontend (`web/`)**: Vanilla HTML, CSS, and JavaScript that polls/fetches state from `/api/state` and renders the dashboard.

## Data Structures

| Component | Implementation | Time Complexity | Purpose |
| --- | --- | --- | --- |
| Patient Registry | Singly Linked List (`PatientNode`) | Insert: O(n) (duplicate check), Search: O(n), Traverse: O(n) | Dynamic in-memory patient storage preserving registration order |
| Appointment Queue | `collections.deque` | Enqueue (`append`): O(1), Dequeue (`popleft`): O(1), Peek: O(1) | Strict FIFO consultation scheduling |
| Doctor Directory | `list[dict[str, str]]` | Lookup/count: O(d) | Tracks doctor names, specialties, and availability |

## Patient Status Lifecycle

When a patient is registered via `HospitalSystem.add_patient`, their status starts as `Registered`. If they are later booked into the consultation queue (matched case-insensitively by name), their status transitions as follows:

```text
Registered ──(book_appointment)──▶ In Queue ──(call_next)──▶ In Progress ──(next call_next)──▶ Attended
```

Walk-in patients who are not yet in the linked list can still be booked into the appointment queue; they are queued with the selected (or default) doctor without creating a `PatientNode`.

## Concurrency & State

- `server.py` uses `http.server.ThreadingHTTPServer` so concurrent browser requests do not block one another.
- All reads and mutations on the shared `HospitalSystem` instance are guarded by `state_lock` (`threading.Lock()`).
- State is stored in memory and resets when the server process stops.
