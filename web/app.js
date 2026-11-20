/* Hospital Management System — single-page UI logic.
   All 11 operations live on the front page; clicking a tile opens its
   form in the central workspace. No page reloads, no separate pages. */

let state = null;
let currentOp = "dashboard";
let sortField = "id";
let bookEmergency = false;

const $ = (sel) => document.querySelector(sel);
const body = document.getElementById("workspace-body");
const titleEl = document.getElementById("workspace-title");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function api(path, method = "GET", payload = null) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : null,
  });
  return res.json();
}

let toastTimer = null;
function toast(msg, isErr = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("err", isErr);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

function refreshStats() {
  if (!state) return;
  const s = state.stats;
  document.getElementById("stat-patients").textContent = s.patients;
  document.getElementById("stat-doctors").textContent = s.doctors;
  document.getElementById("stat-waiting").textContent = s.waiting;
  document.getElementById("stat-beds").textContent = s.free_beds;
  document.getElementById("last-update").textContent =
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function loadState() {
  const res = await api("/api/state");
  if (res.ok) {
    state = res.state;
    refreshStats();
  }
  return state;
}

/* ------------------------------------------------------------------ ops */

const OPS = {
  "add-patient": "Add Patient",
  "view-sorted": "View Sorted",
  "find-patient": "Find Patient",
  "add-note": "Add Note",
  "doctors": "Doctors",
  "book-appointment": "Book Appointment",
  "beds": "Beds",
  "pharmacy": "Pharmacy Queue",
  "shifts": "Shifts",
  "dashboard": "Dashboard",
  "undo": "Undo",
};

function openOp(op) {
  currentOp = op;
  titleEl.textContent = OPS[op] || op;
  document.querySelectorAll(".tile").forEach((t) =>
    t.classList.toggle("active", t.dataset.op === op));
  ({
    "add-patient": renderAddPatient,
    "view-sorted": renderViewSorted,
    "find-patient": renderFindPatient,
    "add-note": renderAddNote,
    "doctors": renderDoctors,
    "book-appointment": renderBook,
    "beds": renderBeds,
    "pharmacy": renderPharmacy,
    "shifts": renderShifts,
    "dashboard": renderDashboard,
    "undo": renderUndo,
  })[op]();
}

function msgHtml(text, ok = true) {
  return text ? `<div class="msg ${ok ? "msg-ok" : "msg-err"}">${esc(text)}</div>` : "";
}

function renderAddPatient(msg = "", ok = true) {
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    <form id="f-add-patient" class="form-grid">
      <div class="field"><label>Patient ID</label>
        <input type="number" name="id" min="1" placeholder="e.g. 101" required></div>
      <div class="field"><label>Full Name</label>
        <input type="text" name="name" placeholder="e.g. Ahmed Khan" required></div>
      <div class="field-row">
        <div class="field"><label>Age</label>
          <input type="number" name="age" min="0" max="150" placeholder="e.g. 32" required></div>
        <div class="field"><label>Problem / Symptoms</label>
          <input type="text" name="problem" placeholder="e.g. Cough, fever" required></div>
      </div>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">Create Patient +</button>
        <button type="button" class="btn btn-ghost" onclick="openOp('dashboard')">Cancel</button>
      </div>
    </form>`;
  document.getElementById("f-add-patient").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await api("/api/patients", "POST", {
      id: Number(f.get("id")), name: f.get("name"),
      age: Number(f.get("age")), problem: f.get("problem"),
    });
    await loadState();
    if (res.ok) {
      toast(res.message);
      renderAddPatient(res.message, true);
    } else {
      toast(res.error, true);
      renderAddPatient(res.error, false);
    }
  });
}

function patientsTable(patients) {
  if (!patients.length) return `<p class="muted">No patients yet. Add one first.</p>`;
  return `<table class="tbl"><thead><tr>
      <th>ID</th><th>Name</th><th>Age</th><th>Problem</th><th>Visits</th>
    </tr></thead><tbody>
    ${patients.map((p) => `<tr><td>${p.id}</td><td>${esc(p.name)}</td><td>${p.age}</td>
      <td>${esc(p.problem)}</td><td>${p.visits}</td></tr>`).join("")}
    </tbody></table>`;
}

function renderViewSorted() {
  const list = state ? state.patients : [];
  const sorted = [...list].sort((a, b) =>
    sortField === "age" ? a.age - b.age : a.id - b.id);
  body.innerHTML = `
    <div class="field" style="margin-bottom:12px"><label>Sort by</label>
      <div class="seg">
        <button type="button" id="sort-id" class="${sortField === "id" ? "on" : ""}">ID</button>
        <button type="button" id="sort-age" class="${sortField === "age" ? "on" : ""}">Age</button>
      </div>
    </div>
    ${patientsTable(sorted)}`;
  document.getElementById("sort-id").onclick = () => { sortField = "id"; renderViewSorted(); };
  document.getElementById("sort-age").onclick = () => { sortField = "age"; renderViewSorted(); };
}

function patientCard(p) {
  return `<div class="card">
    <h3>${esc(p.name)} <span class="muted">#${p.id}</span></h3>
    <p>Age: <b>${p.age}</b> &nbsp;•&nbsp; Problem: <b>${esc(p.problem)}</b> &nbsp;•&nbsp; Visits: <b>${p.visits}</b></p>
    <p class="muted">Notes (${p.notes.length}):</p>
    ${p.notes.length
      ? `<ul class="q-list">${p.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      : `<p class="muted">No notes yet.</p>`}
  </div>`;
}

function renderFindPatient(msg = "", ok = true) {
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    <form id="f-find" class="form-grid">
      <div class="field"><label>Patient ID</label>
        <input type="number" name="id" min="1" placeholder="e.g. 101" required></div>
      <div class="btn-row"><button type="submit" class="btn btn-primary">Find Patient</button></div>
    </form>
    <div id="find-result" style="margin-top:14px"></div>`;
  document.getElementById("f-find").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = Number(new FormData(e.target).get("id"));
    const res = await api(`/api/patients/${id}`);
    document.getElementById("find-result").innerHTML = res.ok
      ? patientCard(res.patient)
      : `<div class="msg msg-err">${esc(res.error)}</div>`;
  });
}

function renderAddNote(msg = "", ok = true) {
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    <form id="f-note" class="form-grid">
      <div class="field"><label>Patient ID</label>
        <input type="number" name="id" min="1" placeholder="e.g. 101" required></div>
      <div class="field"><label>Note</label>
        <textarea name="note" rows="3" placeholder="e.g. Follow-up in 2 weeks, BP normal" required></textarea></div>
      <div class="btn-row"><button type="submit" class="btn btn-primary">Add Note +</button></div>
    </form>`;
  document.getElementById("f-note").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await api(`/api/patients/${Number(f.get("id"))}/notes`, "POST", { note: f.get("note") });
    await loadState();
    if (res.ok) {
      toast(res.message);
      renderAddNote(res.message, true);
    } else {
      toast(res.error, true);
      renderAddNote(res.error, false);
    }
  });
}

function renderDoctors(msg = "", ok = true) {
  const docs = state ? state.doctors : [];
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    ${docs.map((d) => `
      <div class="card">
        <h3>${esc(d.name)} <span class="muted">${esc(d.id)} • ${esc(d.spec)} • Fee Rs ${d.fee}</span></h3>
        <p>Waiting: <b>${d.waiting}</b> ${d.queue.length
          ? "— " + d.queue.map((q) => `<span class="tag ${q.emergency ? "tag-emg" : "tag-nor"}">${esc(q.token)} · ${esc(q.patient_name)}</span>`).join(" ")
          : `<span class="muted">queue empty</span>`}</p>
      </div>`).join("") || `<p class="muted">No doctors yet.</p>`}
    <h3 style="margin:16px 0 8px">Add Doctor</h3>
    <form id="f-doc" class="form-grid">
      <div class="field-row">
        <div class="field"><label>Doctor ID</label><input type="text" name="id" placeholder="e.g. D6" required></div>
        <div class="field"><label>Full Name</label><input type="text" name="name" placeholder="e.g. Dr. Sana" required></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Specialty</label><input type="text" name="spec" placeholder="e.g. Physician" required></div>
        <div class="field"><label>Token Fee (Rs)</label><input type="number" name="fee" min="0" placeholder="e.g. 1200" required></div>
      </div>
      <div class="btn-row"><button type="submit" class="btn btn-primary">Add Doctor +</button></div>
    </form>`;
  document.getElementById("f-doc").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await api("/api/doctors", "POST", {
      id: f.get("id"), name: f.get("name"), spec: f.get("spec"), fee: Number(f.get("fee")),
    });
    await loadState();
    if (res.ok) {
      toast(res.message);
      renderDoctors(res.message, true);
    } else {
      toast(res.error, true);
      renderDoctors(res.error, false);
    }
  });
}

function renderBook(msg = "", ok = true) {
  const docs = state ? state.doctors : [];
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    <form id="f-book" class="form-grid">
      <div class="field"><label>Doctor</label>
        <select name="doctor_id" required>
          ${docs.map((d) => `<option value="${esc(d.id)}">${esc(d.name)} — ${esc(d.spec)} (Rs ${d.fee})</option>`).join("")}
        </select></div>
      <div class="field"><label>Patient ID</label>
        <input type="number" name="patient_id" min="1" placeholder="e.g. 101" required></div>
      <div class="field"><label>Priority</label>
        <div class="seg">
          <button type="button" id="pri-n" class="${!bookEmergency ? "on" : ""}">Normal</button>
          <button type="button" id="pri-e" class="emg ${bookEmergency ? "on" : ""}">Emergency</button>
        </div>
      </div>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">+ Book Now</button>
        <button type="button" class="btn btn-ghost" onclick="openOp('dashboard')">Cancel</button>
      </div>
    </form>
    <div id="book-result" style="margin-top:14px"></div>`;
  document.getElementById("pri-n").onclick = () => { bookEmergency = false; renderBook(); };
  document.getElementById("pri-e").onclick = () => { bookEmergency = true; renderBook(); };
  document.getElementById("f-book").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await api("/api/appointments", "POST", {
      doctor_id: f.get("doctor_id"),
      patient_id: Number(f.get("patient_id")),
      emergency: bookEmergency,
    });
    await loadState();
    if (res.ok) {
      toast(res.message);
      document.getElementById("book-result").innerHTML = `
        <div class="card"><h3>Token ${esc(res.token)} ${res.emergency ? '<span class="tag tag-emg">EMERGENCY</span>' : '<span class="tag tag-nor">NORMAL</span>'}</h3>
        <p>${esc(res.patient)} with ${esc(res.doctor)} — Fee Rs ${res.fee}</p></div>`;
    } else {
      toast(res.error, true);
      document.getElementById("book-result").innerHTML =
        `<div class="msg msg-err">${esc(res.error)}</div>`;
    }
  });
}

function renderBeds(msg = "", ok = true) {
  const beds = state ? state.beds : [];
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    <div class="beds-grid">
      ${beds.map((b) => `<div class="bed ${b.status === "Free" ? "free" : "occ"}">
          Bed ${b.bed}<small>${b.status === "Free" ? "Free" : "Patient " + b.patient_id}</small>
        </div>`).join("")}
    </div>
    <form id="f-bed" class="form-grid">
      <div class="field-row">
        <div class="field"><label>Bed (1–10)</label>
          <input type="number" name="bed" min="1" max="10" placeholder="e.g. 3" required></div>
        <div class="field"><label>Patient ID</label>
          <input type="number" name="patient_id" min="1" placeholder="e.g. 101" required></div>
      </div>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">Assign Bed</button>
        <button type="button" id="btn-free-bed" class="btn btn-ghost">Free This Bed</button>
      </div>
    </form>`;
  document.getElementById("f-bed").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await api("/api/beds/assign", "POST", {
      bed: Number(f.get("bed")), patient_id: Number(f.get("patient_id")),
    });
    await loadState();
    toast(res.ok ? res.message : res.error, !res.ok);
    renderBeds(res.ok ? res.message : res.error, res.ok);
  });
  document.getElementById("btn-free-bed").addEventListener("click", async () => {
    const bed = Number(document.querySelector('#f-bed [name="bed"]').value);
    if (!bed) { toast("Enter a bed number first.", true); return; }
    const res = await api("/api/beds/free", "POST", { bed });
    await loadState();
    toast(res.ok ? res.message : res.error, !res.ok);
    renderBeds(res.ok ? res.message : res.error, res.ok);
  });
}

function renderPharmacy(msg = "", ok = true) {
  const q = state ? state.pharmacy : [];
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    <form id="f-pharm" class="form-grid">
      <div class="field"><label>Token / Name</label>
        <input type="text" name="token" placeholder="e.g. T-12 or patient name" required></div>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">Add Token +</button>
        <button type="button" id="btn-serve" class="btn btn-green">Serve Next</button>
      </div>
    </form>
    <h3 style="margin:16px 0 8px">Queue (${q.length})</h3>
    ${q.length
      ? `<ol class="q-list">${q.map((t, i) => `<li>${i === 0 ? "▶ " : ""}${esc(t)}</li>`).join("")}</ol>`
      : `<p class="muted">Pharmacy queue is empty.</p>`}`;
  document.getElementById("f-pharm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await api("/api/pharmacy", "POST", { token: new FormData(e.target).get("token") });
    await loadState();
    toast(res.ok ? res.message : res.error, !res.ok);
    renderPharmacy(res.ok ? res.message : res.error, res.ok);
  });
  document.getElementById("btn-serve").addEventListener("click", async () => {
    const res = await api("/api/pharmacy/serve", "POST", {});
    await loadState();
    toast(res.ok ? res.message : res.error, !res.ok);
    renderPharmacy(res.ok ? res.message : res.error, res.ok);
  });
}

function renderShifts(msg = "", ok = true) {
  const shifts = state ? state.shifts : [];
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    <p>On duty now: <b>${state && state.on_duty ? esc(state.on_duty) : "—"}</b></p>
    <ol class="q-list">
      ${shifts.map((s, i) => `<li>${esc(s)} ${i === 0 ? '<span class="tag tag-duty">ON DUTY</span>' : ""}</li>`).join("")}
    </ol>
    <div class="btn-row" style="margin-top:14px">
      <button type="button" id="btn-rotate" class="btn btn-primary">Rotate Shift ↻</button>
    </div>`;
  document.getElementById("btn-rotate").addEventListener("click", async () => {
    const res = await api("/api/shifts/rotate", "POST", {});
    await loadState();
    toast(res.ok ? res.message : res.error, !res.ok);
    renderShifts(res.ok ? res.message : res.error, res.ok);
  });
}

function renderDashboard() {
  const s = state ? state.stats : { patients: 0, doctors: 0, waiting: 0, free_beds: 0, total_beds: 10 };
  const docs = state ? state.doctors : [];
  const beds = state ? state.beds : [];
  body.innerHTML = `
    <div class="stats" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 14px">
      <div class="stat-card stat-teal"><div class="stat-text"><span class="stat-label">Patients</span><span class="stat-num">${s.patients}</span></div></div>
      <div class="stat-card stat-blue"><div class="stat-text"><span class="stat-label">Doctors</span><span class="stat-num">${s.doctors}</span></div></div>
      <div class="stat-card stat-blue"><div class="stat-text"><span class="stat-label">Waiting</span><span class="stat-num">${s.waiting}</span></div></div>
      <div class="stat-card stat-teal"><div class="stat-text"><span class="stat-label">Free Beds</span><span class="stat-num">${s.free_beds}/${s.total_beds}</span></div></div>
    </div>
    <h3 style="margin:6px 0 8px">Doctor queues</h3>
    ${docs.map((d) => `<p><b>${esc(d.name)}</b> <span class="muted">(${esc(d.spec)})</span> — waiting <b>${d.waiting}</b></p>`).join("") || `<p class="muted">No doctors.</p>`}
    <h3 style="margin:14px 0 8px">Beds</h3>
    <div class="beds-grid">
      ${beds.map((b) => `<div class="bed ${b.status === "Free" ? "free" : "occ"}">Bed ${b.bed}<small>${b.status === "Free" ? "Free" : "Patient " + b.patient_id}</small></div>`).join("")}
    </div>`;
}

function describeUndo(last) {
  if (!last) return "Nothing to undo.";
  const kind = last[0];
  if (kind === "ADD_PATIENT") return `Add Patient — patient ID ${last[1]}`;
  if (kind === "ADD_NOTE") return `Add Note — patient ID ${last[1]}`;
  if (kind === "BOOK_APPT") return `Book Appointment — token ${last[2]} (doctor ${last[1]})`;
  if (kind === "BED") return `Bed ${last[1] + 1} — ${last[2] === 0 ? "was assigned" : "was freed (patient " + last[2] + ")"}`;
  return kind;
}

function renderUndo(msg = "", ok = true) {
  const last = state ? state.undo_last : null;
  body.innerHTML = `
    ${msgHtml(msg, ok)}
    <div class="card">
      <h3>Last action</h3>
      <p>${esc(describeUndo(last))}</p>
    </div>
    <div class="btn-row">
      <button type="button" id="btn-undo" class="btn btn-danger" ${last ? "" : "disabled"}>Undo Last Action ↩</button>
    </div>
    <p class="muted">Undo reverses the last add-patient, add-note, booking or bed change.</p>`;
  document.getElementById("btn-undo").addEventListener("click", doUndo);
}

async function doUndo() {
  const res = await api("/api/undo", "POST", {});
  await loadState();
  toast(res.ok ? res.message : res.error, !res.ok);
  if (currentOp === "undo") renderUndo(res.ok ? res.message : res.error, res.ok);
  else openOp(currentOp);
}

/* ------------------------------------------------------------------ boot */

document.querySelectorAll(".tile").forEach((t) =>
  t.addEventListener("click", () => openOp(t.dataset.op)));

document.getElementById("top-undo").addEventListener("click", doUndo);

const themeBtn = document.getElementById("theme-toggle");
function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  document.getElementById("theme-icon-moon").classList.toggle("hidden", dark);
  document.getElementById("theme-icon-sun").classList.toggle("hidden", !dark);
  document.getElementById("theme-label").textContent = dark ? "Light Mode" : "Dark Mode";
  try { localStorage.setItem("hms-theme", dark ? "dark" : "light"); } catch (e) { /* ignore */ }
}
themeBtn.addEventListener("click", () =>
  applyTheme(!document.body.classList.contains("dark")));
try {
  applyTheme(localStorage.getItem("hms-theme") === "dark");
} catch (e) { applyTheme(false); }

loadState().then(() => openOp("dashboard"));
