/**
 * Hospital Management System — Frontend Controller
 */

const state = {
  patients: [],
  queue: [],
  doctors: [],
  current_attending: null,
  stats: {
    patient_count: 0,
    pending_appointments: 0,
    available_doctors: 0,
    total_doctors: 0,
    next_in_queue: null,
    next_appointment: null,
  },
  highlightedPatientId: null,
  selectedDoctorLabel: null,
};

// DOM References
const elLiveClock = document.getElementById("live-clock");
const elStatPatients = document.getElementById("stat-patients");
const elStatQueue = document.getElementById("stat-queue");
const elStatDoctors = document.getElementById("stat-doctors");
const elStatDoctorsTotal = document.getElementById("stat-doctors-total");
const elStatNext = document.getElementById("stat-next");
const elStatNextDoc = document.getElementById("stat-next-doc");
const elConnectionStatus = document.getElementById("connection-status");

const elDoctorsList = document.getElementById("doctors-list");
const elSelectDoctor = document.getElementById("input-doctor");
const elSelectApptDoctor = document.getElementById("input-appt-doctor");
const elPatientsDatalist = document.getElementById("registered-patients-datalist");

const elAttendingBanner = document.getElementById("attending-banner");
const elAttendingName = document.getElementById("attending-name");
const elAttendingDoctor = document.getElementById("attending-doctor");
const btnDismissAttending = document.getElementById("btn-dismiss-attending");

const formAddPatient = document.getElementById("form-add-patient");
const elAddPatientError = document.getElementById("add-patient-error");

const formSearchPatient = document.getElementById("form-search-patient");
const elSearchResult = document.getElementById("search-result");

const formBookAppt = document.getElementById("form-book-appointment");
const elInputApptName = document.getElementById("input-appt-name");
const elBookApptError = document.getElementById("book-appt-error");

const elQueueList = document.getElementById("queue-list");
const elPatientsTbody = document.getElementById("patients-tbody");
const elToastContainer = document.getElementById("toast-container");

const btnCallNext = document.getElementById("btn-call-next");
const btnCallNextTop = document.getElementById("btn-call-next-top");
const btnSeedDemo = document.getElementById("btn-seed-demo");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function doctorLabel(doc) {
  return `${doc.name} — ${doc.field}`;
}

function statusClass(status) {
  const s = (status || "").toLowerCase();
  if (s === "in progress") return "in-progress";
  if (s === "in queue") return "in-queue";
  if (s === "attended") return "attended";
  return "registered";
}

function updateClock() {
  if (!elLiveClock) return;
  const now = new Date();
  elLiveClock.textContent = now.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elToastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s ease";
    setTimeout(() => toast.remove(), 220);
  }, 3000);
}

function setOnlineStatus(online) {
  if (online) {
    elConnectionStatus.classList.remove("offline");
    elConnectionStatus.innerHTML = `<span class="status-dot"></span>Online`;
  } else {
    elConnectionStatus.classList.add("offline");
    elConnectionStatus.innerHTML = `<span class="status-dot"></span>Offline`;
  }
}

async function apiRequest(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json();
    setOnlineStatus(true);
    return { status: res.status, data };
  } catch (err) {
    setOnlineStatus(false);
    showToast("Server offline. Please start server.py.", "error");
    throw err;
  }
}

function applyState(newState) {
  state.patients = newState.patients || [];
  state.queue = newState.queue || [];
  state.doctors = newState.doctors || state.doctors;
  state.current_attending = newState.current_attending || null;
  state.stats = newState.stats || state.stats;
  renderAll();
}

function renderAll() {
  renderStats();
  renderDoctors();
  renderDoctorDropdowns();
  renderPatientDatalist();
  renderQueue();
  renderPatientsTable();
}

function renderStats() {
  const {
    patient_count,
    pending_appointments,
    available_doctors,
    total_doctors,
    next_appointment,
  } = state.stats;

  elStatPatients.textContent = String(patient_count);
  elStatQueue.textContent = String(pending_appointments);
  elStatDoctors.textContent = String(available_doctors);
  elStatDoctorsTotal.textContent = `of ${total_doctors}`;

  if (next_appointment && next_appointment.name) {
    elStatNext.textContent = next_appointment.name;
    elStatNext.classList.remove("empty");
    elStatNextDoc.textContent = next_appointment.doctor || "";
  } else {
    elStatNext.textContent = "No appointments";
    elStatNext.classList.add("empty");
    elStatNextDoc.textContent = "";
  }
}

function renderDoctors() {
  if (!state.doctors.length) {
    elDoctorsList.innerHTML = "";
    return;
  }

  elDoctorsList.innerHTML = state.doctors
    .map((doc) => {
      const label = doctorLabel(doc);
      const isAvailable = doc.status === "Available";
      const isSelected = state.selectedDoctorLabel === label;
      return `
        <button
          type="button"
          class="doctor-chip ${isSelected ? "selected" : ""}"
          data-doctor-label="${escapeHtml(label)}"
        >
          <span class="doctor-chip-name">${escapeHtml(doc.name)}</span>
          <span class="doctor-chip-field">&mdash; ${escapeHtml(doc.field)}</span>
          <span class="doctor-status-badge ${isAvailable ? "available" : "on-duty"}">
            ${escapeHtml(doc.status)}
          </span>
        </button>
      `;
    })
    .join("");
}

function renderDoctorDropdowns() {
  if (!state.doctors.length) return;

  const currentPatientDoc = elSelectDoctor.value;
  const currentApptDoc = elSelectApptDoctor.value;

  const optionsHtml = state.doctors
    .map((doc) => {
      const label = doctorLabel(doc);
      return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  if (elSelectDoctor.options.length !== state.doctors.length) {
    elSelectDoctor.innerHTML = optionsHtml;
    if (currentPatientDoc) elSelectDoctor.value = currentPatientDoc;
  }

  if (elSelectApptDoctor.options.length !== state.doctors.length) {
    elSelectApptDoctor.innerHTML = optionsHtml;
    if (currentApptDoc) elSelectApptDoctor.value = currentApptDoc;
  }
}

function renderPatientDatalist() {
  elPatientsDatalist.innerHTML = state.patients
    .map((p) => `<option value="${escapeHtml(p.name)}"></option>`)
    .join("");
}

function renderQueue() {
  if (!state.queue.length) {
    elQueueList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">No pending appointments</p>
      </div>
    `;
    return;
  }

  const fragments = [];
  state.queue.forEach((entry, idx) => {
    const isFront = idx === 0;
    const name = typeof entry === "string" ? entry : entry.name;
    const doctor = typeof entry === "string" ? "" : entry.doctor || "";
    fragments.push(`
      <div class="queue-ticket ${isFront ? "is-front" : ""}">
        <span class="queue-pos">${idx + 1}</span>
        <div class="queue-info">
          <span class="queue-name">${escapeHtml(name)}</span>
          <span class="queue-sub">${isFront ? "Next Up" : `#${idx + 1} in line`}</span>
          ${doctor ? `<span class="queue-doc">${escapeHtml(doctor)}</span>` : ""}
        </div>
      </div>
    `);
    if (idx < state.queue.length - 1) {
      fragments.push(`<span class="queue-arrow" aria-hidden="true">&rarr;</span>`);
    }
  });

  elQueueList.innerHTML = fragments.join("");
}

function renderPatientsTable() {
  if (!state.patients.length) {
    elPatientsTbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <p class="empty-title">No patient records found</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  elPatientsTbody.innerHTML = state.patients
    .map((p) => {
      const isHighlighted = state.highlightedPatientId === p.id;
      return `
        <tr class="${isHighlighted ? "row-highlight" : ""}">
          <td class="col-id"><span class="id-pill">#${p.id}</span></td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td class="col-age">${p.age}</td>
          <td><span class="disease-pill">${escapeHtml(p.disease)}</span></td>
          <td class="doctor-cell">${escapeHtml(p.doctor || "General OPD")}</td>
          <td>
            <span class="status-badge ${statusClass(p.status)}">
              ${escapeHtml(p.status || "Registered")}
            </span>
          </td>
          <td class="col-action">
            <button
              type="button"
              class="btn btn-secondary btn-xs"
              data-quick-book-name="${escapeHtml(p.name)}"
              data-quick-book-doctor="${escapeHtml(p.doctor || "")}"
            >
              Book
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

// ==========================================================================
// Event Handlers
// ==========================================================================

elDoctorsList.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-doctor-label]");
  if (!chip) return;
  const label = chip.getAttribute("data-doctor-label");
  if (!label) return;

  state.selectedDoctorLabel = label;
  elSelectDoctor.value = label;
  elSelectApptDoctor.value = label;
  renderDoctors();
  showToast(`Selected ${label}`, "info");
});

elInputApptName.addEventListener("change", () => {
  const entered = elInputApptName.value.trim().toLowerCase();
  const matched = state.patients.find((p) => p.name.toLowerCase() === entered);
  if (matched && matched.doctor) {
    elSelectApptDoctor.value = matched.doctor;
  }
});

formAddPatient.addEventListener("submit", async (e) => {
  e.preventDefault();
  elAddPatientError.classList.add("hidden");

  const id = document.getElementById("input-id").value.trim();
  const name = document.getElementById("input-name").value.trim();
  const age = document.getElementById("input-age").value.trim();
  const disease = document.getElementById("input-disease").value.trim();
  const doctor = elSelectDoctor.value;

  if (!id || !name || !age || !disease) {
    elAddPatientError.textContent = "Please fill in all fields.";
    elAddPatientError.classList.remove("hidden");
    return;
  }

  try {
    const { data } = await apiRequest("/api/patients", {
      method: "POST",
      body: JSON.stringify({ id: Number(id), name, age: Number(age), disease, doctor }),
    });

    if (data.ok) {
      formAddPatient.reset();
      if (state.selectedDoctorLabel) {
        elSelectDoctor.value = state.selectedDoctorLabel;
      }
      state.highlightedPatientId = Number(id);
      applyState(data.state);
      showToast(data.message, "success");
    } else {
      elAddPatientError.textContent = data.message;
      elAddPatientError.classList.remove("hidden");
      showToast(data.message, "error");
    }
  } catch {
    // Handled by apiRequest
  }
});

formSearchPatient.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rawId = document.getElementById("input-search-id").value.trim();
  if (!rawId) return;

  try {
    const { data } = await apiRequest(`/api/patients/${encodeURIComponent(rawId)}`);

    elSearchResult.classList.remove("hidden", "found", "not-found");
    if (data.found && data.patient) {
      const p = data.patient;
      state.highlightedPatientId = p.id;
      renderPatientsTable();

      elSearchResult.classList.add("found");
      elSearchResult.innerHTML = `
        <div class="search-card-head">
          <span class="search-card-title">Patient Found</span>
          <span class="id-pill">#${p.id}</span>
        </div>
        <div class="search-card-grid">
          <div class="search-meta-item">
            <span>Name</span>
            <strong>${escapeHtml(p.name)}</strong>
          </div>
          <div class="search-meta-item">
            <span>Age</span>
            <strong>${p.age} years</strong>
          </div>
          <div class="search-meta-item">
            <span>Disease</span>
            <strong>${escapeHtml(p.disease)}</strong>
          </div>
          <div class="search-meta-item">
            <span>Status</span>
            <strong>${escapeHtml(p.status || "Registered")}</strong>
          </div>
          <div class="search-meta-item" style="grid-column: span 2;">
            <span>Doctor &amp; Field</span>
            <strong>${escapeHtml(p.doctor || "General OPD")}</strong>
          </div>
        </div>
      `;
    } else {
      state.highlightedPatientId = null;
      renderPatientsTable();

      elSearchResult.classList.add("not-found");
      elSearchResult.textContent = data.message || "Patient not found";
      showToast(data.message || "Patient not found", "warning");
    }
  } catch {
    // Handled by apiRequest
  }
});

async function bookAppointmentByName(name, doctor) {
  elBookApptError.classList.add("hidden");
  try {
    const { data } = await apiRequest("/api/appointments", {
      method: "POST",
      body: JSON.stringify({ name, doctor }),
    });

    if (data.ok) {
      applyState(data.state);
      showToast(data.message, "success");
      return true;
    } else {
      elBookApptError.textContent = data.message;
      elBookApptError.classList.remove("hidden");
      showToast(data.message, "error");
      return false;
    }
  } catch {
    return false;
  }
}

formBookAppt.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = elInputApptName.value.trim();
  const doctor = elSelectApptDoctor.value;
  if (!name) {
    elBookApptError.textContent = "Please enter a patient name.";
    elBookApptError.classList.remove("hidden");
    return;
  }

  const ok = await bookAppointmentByName(name, doctor);
  if (ok) {
    elInputApptName.value = "";
  }
});

elPatientsTbody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-quick-book-name]");
  if (!btn) return;
  const name = btn.getAttribute("data-quick-book-name");
  const doctor = btn.getAttribute("data-quick-book-doctor") || elSelectApptDoctor.value;
  if (name) {
    bookAppointmentByName(name, doctor);
  }
});

async function handleCallNext() {
  try {
    const { data } = await apiRequest("/api/appointments/call-next", {
      method: "POST",
    });

    applyState(data.state);
    if (data.ok && data.attended) {
      elAttendingName.textContent = data.attended.name || data.attended;
      elAttendingDoctor.textContent = data.attended.doctor || "";
      elAttendingDoctor.classList.toggle("hidden", !data.attended.doctor);
      elAttendingBanner.classList.remove("hidden");
      showToast(data.message, "success");
    } else {
      showToast(data.message || "No pending appointments", "warning");
    }
  } catch {
    // Handled by apiRequest
  }
}

btnCallNext.addEventListener("click", handleCallNext);
btnCallNextTop.addEventListener("click", handleCallNext);
btnDismissAttending.addEventListener("click", () => {
  elAttendingBanner.classList.add("hidden");
});

btnSeedDemo.addEventListener("click", async () => {
  try {
    const { data } = await apiRequest("/api/demo-seed", { method: "POST" });
    if (data.ok) {
      applyState(data.state);
      showToast(data.message, "info");
    }
  } catch {
    // Handled by apiRequest
  }
});

// Initial State Load & Live Clock
updateClock();
setInterval(updateClock, 30000);

(async function init() {
  try {
    const { data } = await apiRequest("/api/state");
    if (data.ok) {
      applyState(data.state);
    }
  } catch {
    // Handled by apiRequest
  }
})();
