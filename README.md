# Hospital Management System

A lightweight, zero-dependency hospital reception and OPD queue management system written in Python, paired with a browser-based dashboard.

It is built around two classic data structures—a **Singly Linked List** for patient records and a **FIFO double-ended queue (`collections.deque`)** for consultation scheduling—served over Python's standard-library `ThreadingHTTPServer`.

## Features

- **Patient Registration & Lookup**: Store patient records in a custom `PatientNode` singly linked list with input validation, duplicate-ID prevention, and sequential search by ID.
- **FIFO Consultation Queue**: Book appointments in O(1) time and advance the queue with `Call Next`, automatically updating patient statuses (`Registered` -> `In Queue` -> `In Progress` -> `Attended`).
- **Doctor Directory**: Tracks available specialists across General Medicine, Cardiology, Orthopedics, Pediatrics, ENT & Dermatology, and Neurology.
- **Zero External Dependencies**: Runs on Python 3.9+ using only the standard library (`http.server`, `collections`, `threading`, `json`, `argparse`).
- **One-Click Sample Data**: Populate sample patient records and appointments from the UI or via `POST /api/demo-seed`.

## Quick Start

1. Clone the repository:

```bash
git clone https://github.com/HyHamza/Hospital-Management-System.git
cd Hospital-Management-System
```

2. Start the server:

```bash
python server.py
```

By default, the server binds to `http://127.0.0.1:8000` and opens the dashboard in your default browser.

### CLI Options

```bash
python server.py --host 127.0.0.1 --port 8080 --no-browser
```

- `--host`: Bind address (default: `127.0.0.1`)
- `--port`: Port number (default: `8000`)
- `--no-browser`: Start the server without opening a browser tab

## Project Structure

```text
.
├── hospital_system.py       # PatientNode, HospitalSystem, linked list & FIFO queue logic
├── server.py                # ThreadingHTTPServer, static file serving, and JSON REST API
├── web/
│   ├── index.html           # Clinical dashboard layout
│   ├── styles.css           # Dashboard styling
│   └── app.js               # Frontend state, API calls, and DOM updates
├── docs/
│   ├── architecture.md      # Data structures, concurrency model, and state lifecycle
│   └── api.md               # REST API reference and payload examples
├── tests/
│   └── test_hospital_system.py  # Unit and HTTP API integration tests
├── CONTRIBUTING.md
└── LICENSE
```

## Running Tests

Run the test suite with Python's built-in `unittest` runner:

```bash
python -m unittest discover -s tests -v
```

## Documentation

- [Architecture & Data Structures](docs/architecture.md)
- [REST API Reference](docs/api.md)

## License

Released under the [MIT License](LICENSE).
