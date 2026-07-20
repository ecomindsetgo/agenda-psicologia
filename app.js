import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEU4_jah1qhMnG4BPgp9zWWWOP73jjTkk",
    authDomain: "agenda-psicologica-pro.firebaseapp.com",
    projectId: "agenda-psicologica-pro",
    storageBucket: "agenda-psicologica-pro.firebasestorage.app",
    messagingSenderId: "164610159912",
    appId: "1:164610159912:web:4b29a3185058938e008c1d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado Global de la App
let globalCitas = [];
let globalPacientes = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Manejo de Pestañas
    const tabs = ['citas', 'pacientes', 'finanzas'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        if (btn) {
            btn.addEventListener('click', () => switchTab(tab));
        }
    });

    // 2. Autenticación
    const loginBtn = document.getElementById('auth-submit-btn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("¿Seguro que deseas cerrar sesión?")) signOut(auth);
        });
    }

    const forgotBtn = document.getElementById('btn-forgot-password');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value.trim();
            if (!email) {
                alert("Por favor ingresa tu correo electrónico primero.");
                return;
            }
            try {
                await sendPasswordResetEmail(auth, email);
                alert("Se ha enviado un correo para restablecer tu contraseña.");
            } catch (e) {
                alert("Error al enviar el correo: " + e.message);
            }
        });
    }

    // 3. Fecha actual en cabecera
    const dateLbl = document.getElementById('current-date-lbl');
    if (dateLbl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateLbl.innerText = new Date().toLocaleDateString('es-ES', options);
    }

    // 4. Botones principales de acción
    const btnNewCita = document.getElementById('btn-new-cita');
    if (btnNewCita) btnNewCita.addEventListener('click', () => openCitaModal());

    const btnNewPatient = document.getElementById('btn-new-patient');
    if (btnNewPatient) btnNewPatient.addEventListener('click', () => openPatientModal());

    const btnOpenPrint = document.getElementById('btn-open-print');
    if (btnOpenPrint) btnOpenPrint.addEventListener('click', () => window.print());

    // 5. Filtros de búsqueda en tiempo real
    const searchPatientInput = document.getElementById('search-patient');
    if (searchPatientInput) {
        searchPatientInput.addEventListener('input', (e) => renderPatients(e.target.value));
    }

    const filterDateInput = document.getElementById('filter-date');
    if (filterDateInput) {
        filterDateInput.value = new Date().toISOString().split('T')[0];
        filterDateInput.addEventListener('change', () => renderCitas());
    }
});

// Control de Pestañas
function switchTab(target) {
    const tabs = ['citas', 'pacientes', 'finanzas'];
    tabs.forEach(t => {
        const section = document.getElementById(`sec-${t}`);
        const tabBtn = document.getElementById(`tab-${t}`);
        if (section) section.classList.add('hidden');
        if (tabBtn) {
            tabBtn.className = "py-3.5 px-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-medium text-sm flex items-center gap-2 tab-transition";
        }
    });

    const activeSec = document.getElementById(`sec-${target}`);
    const activeBtn = document.getElementById(`tab-${target}`);
    if (activeSec) activeSec.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.className = "py-3.5 px-3 border-b-2 border-indigo-600 text-indigo-600 font-semibold text-sm flex items-center gap-2 tab-transition";
    }
    if (target === 'finanzas') calculateFinances();
}

// Login
async function handleLogin() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorDiv = document.getElementById('auth-error-msg');

    if (!email || !password) {
        errorDiv.innerText = "Por favor completa el correo y la contraseña.";
        errorDiv.classList.remove('hidden');
        return;
    }
    errorDiv.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorDiv.innerText = "Credenciales incorrectas o correo no autorizado.";
        errorDiv.classList.remove('hidden');
        document.getElementById('auth-password').value = '';
    }
}

// Observer de Sesión y Carga de Datos en Tiempo Real
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('flex');
        initFirestoreListeners();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('flex');
    }
});

function initFirestoreListeners() {
    // Escuchar Citas
    onSnapshot(query(collection(db, "citas"), orderBy("date", "asc")), (snapshot) => {
        globalCitas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCitas();
        if (!document.getElementById('sec-finanzas').classList.contains('hidden')) {
            calculateFinances();
        }
    });

    // Escuchar Pacientes
    onSnapshot(query(collection(db, "pacientes"), orderBy("name", "asc")), (snapshot) => {
        globalPacientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPatients();
    });
}

// Renderizado de Citas
function renderCitas() {
    const container = document.getElementById('citas-container');
    if (!container) return;

    const selectedDate = document.getElementById('filter-date')?.value || new Date().toISOString().split('T')[0];
    const filteredCitas = globalCitas.filter(c => c.date === selectedDate);

    if (filteredCitas.length === 0) {
        container.innerHTML = `<div class="bg-white p-6 rounded-2xl text-center text-slate-400 border border-slate-100 shadow-sm">No hay citas programadas para esta fecha.</div>`;
        return;
    }

    container.innerHTML = filteredCitas.map(c => `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition hover:shadow-md">
            <div>
                <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">⏰ ${c.time || 'Sin hora'}</span>
                <h4 class="font-bold text-slate-800 text-base mt-1">${escapeHtml(c.patientName || 'Paciente')}</h4>
                <p class="text-xs text-slate-500">Motivo: ${escapeHtml(c.reason || 'Consulta general')} | Costo: S/ ${c.cost || '0.00'}</p>
            </div>
            <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${c.status === 'Atendido' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}">${c.status || 'Pendiente'}</span>
                <div class="flex items-center gap-1">
                    <button class="btn-toggle-status bg-slate-100 hover:bg-slate-200 p-2 rounded-xl text-xs transition" data-id="${c.id}" data-status="${c.status}" title="Cambiar Estado">🔄</button>
                    <button class="btn-delete-cita bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-xl text-xs transition" data-id="${c.id}" title="Eliminar Cita">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');

    // Asignar eventos a los botones dinámicos de citas
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const currentStatus = e.currentTarget.dataset.status;
            const newStatus = currentStatus === 'Atendido' ? 'Pendiente' : 'Atendido';
            try {
                await updateDoc(doc(db, "citas", id), { status: newStatus });
            } catch (err) {
                alert("Error al actualizar estado: " + err.message);
            }
        });
    });

    document.querySelectorAll('.btn-delete-cita').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm("¿Estás seguro de eliminar esta cita?")) {
                try {
                    await deleteDoc(doc(db, "citas", id));
                } catch (err) {
                    alert("Error al eliminar: " + err.message);
                }
            }
        });
    });
}

// Renderizado de Pacientes
function renderPatients(filter = '') {
    const container = document.getElementById('patients-container');
    if (!container) return;

    const filtered = globalPacientes.filter(p => 
        (p.name && p.name.toLowerCase().includes(filter.toLowerCase())) || 
        (p.dni && p.dni.includes(filter))
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full bg-white p-6 rounded-2xl text-center text-slate-400 border border-slate-100 shadow-sm">No se encontraron pacientes registrados.</div>`;
        return;
    }

    container.innerHTML = filtered.map(p => `
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3 transition hover:shadow-md">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-slate-800 text-base">${escapeHtml(p.name)}</h4>
                    <p class="text-xs text-slate-400 mt-0.5">DNI: ${escapeHtml(p.dni || 'No reg.')} | Tel: ${escapeHtml(p.phone || 'S/N')}</p>
                </div>
                <span class="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2.5 py-1 rounded-lg">Expediente</span>
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-slate-50">
                <button class="btn-view-patient bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-xl text-xs transition" data-id="${p.id}">Ver Ficha</button>
                <button class="btn-delete-patient bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs transition" data-id="${p.id}">Eliminar</button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.btn-view-patient').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const patient = globalPacientes.find(p => p.id === id);
            if (patient) openPatientDetailModal(patient);
        });
    });

    document.querySelectorAll('.btn-delete-patient').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm("¿Estás seguro de eliminar este paciente y su expediente?")) {
                try {
                    await deleteDoc(doc(db, "pacientes", id));
                } catch (err) {
                    alert("Error al eliminar paciente: " + err.message);
                }
            }
        });
    });
}

// Cálculo de Finanzas
function calculateFinances() {
    let totalIncome = 0;
    let pendingIncome = 0;
    let attendedCount = 0;

    globalCitas.forEach(c => {
        const cost = parseFloat(c.cost) || 0;
        if (c.status === 'Atendido' || c.status === 'Pagado') {
            totalIncome += cost;
            attendedCount++;
        } else {
            pendingIncome += cost;
        }
    });

    const incomeElem = document.getElementById('fin-month-income');
    const sessionsElem = document.getElementById('fin-total-sessions');
    const pendingElem = document.getElementById('fin-pending-income');

    if (incomeElem) incomeElem.innerText = `S/ ${totalIncome.toFixed(2)}`;
    if (sessionsElem) sessionsElem.innerText = attendedCount;
    if (pendingElem) pendingElem.innerText = `S/ ${pendingIncome.toFixed(2)}`;
}

// Modales Interactivos
function openCitaModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-200">
                <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 class="font-extrabold text-lg text-slate-800">Programar Nueva Cita</h3>
                    <button id="close-modal" class="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Nombre del Paciente</label>
                        <input type="text" id="modal-patient-name" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Ej. María Pérez">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Fecha</label>
                            <input type="date" id="modal-date" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Hora</label>
                            <input type="time" id="modal-time" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Costo (S/)</label>
                            <input type="number" id="modal-cost" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="50.00" value="50">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Estado</label>
                            <select id="modal-status" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                                <option value="Pendiente">Pendiente</option>
                                <option value="Atendido">Atendido</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Motivo / Notas</label>
                        <textarea id="modal-reason" rows="2" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Motivo de la consulta..."></textarea>
                    </div>
                    <button id="save-cita-btn" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-md transition">Guardar Cita</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('close-modal').addEventListener('click', () => modalContainer.innerHTML = '');
    document.getElementById('modal-date').value = document.getElementById('filter-date')?.value || new Date().toISOString().split('T')[0];

    document.getElementById('save-cita-btn').addEventListener('click', async () => {
        const patientName = document.getElementById('modal-patient-name').value.trim();
        const date = document.getElementById('modal-date').value;
        const time = document.getElementById('modal-time').value;
        const cost = document.getElementById('modal-cost').value;
        const status = document.getElementById('modal-status').value;
        const reason = document.getElementById('modal-reason').value.trim();

        if (!patientName || !date) {
            alert("Por favor completa al menos el nombre del paciente y la fecha.");
            return;
        }

        try {
            await addDoc(collection(db, "citas"), { patientName, date, time, cost, status, reason });
            modalContainer.innerHTML = '';
        } catch (err) {
            alert("Error al guardar cita: " + err.message);
        }
    });
}

function openPatientModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-200">
                <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 class="font-extrabold text-lg text-slate-800">Registrar Nuevo Paciente</h3>
                    <button id="close-modal" class="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Nombre Completo</label>
                        <input type="text" id="pat-name" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Apellidos y Nombres">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">DNI</label>
                            <input type="text" id="pat-dni" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Número de DNI">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Teléfono</label>
                            <input type="text" id="pat-phone" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Celular de contacto">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Observaciones Iniciales</label>
                        <textarea id="pat-obs" rows="3" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Antecedentes o motivo principal..."></textarea>
                    </div>
                    <button id="save-patient-btn" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-md transition">Guardar Paciente</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('close-modal').addEventListener('click', () => modalContainer.innerHTML = '');

    document.getElementById('save-patient-btn').addEventListener('click', async () => {
        const name = document.getElementById('pat-name').value.trim();
        const dni = document.getElementById('pat-dni').value.trim();
        const phone = document.getElementById('pat-phone').value.trim();
        const observations = document.getElementById('pat-obs').value.trim();

        if (!name) {
            alert("Por favor ingresa el nombre del paciente.");
            return;
        }

        try {
            await addDoc(collection(db, "pacientes"), { name, dni, phone, observations, createdAt: new Date().toISOString() });
            modalContainer.innerHTML = '';
        } catch (err) {
            alert("Error al registrar paciente: " + err.message);
        }
    });
}

function openPatientDetailModal(patient) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 class="font-extrabold text-lg text-slate-800">Expediente Clínico</h3>
                    <button id="close-modal" class="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
                </div>
                <div class="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <h4 class="font-bold text-slate-800 text-base">${escapeHtml(patient.name)}</h4>
                    <p class="text-xs text-slate-600"><strong>DNI:</strong> ${escapeHtml(patient.dni || 'No registrado')}</p>
                    <p class="text-xs text-slate-600"><strong>Teléfono:</strong> ${escapeHtml(patient.phone || 'No registrado')}</p>
                    <p class="text-xs text-slate-600"><strong>Observaciones:</strong> ${escapeHtml(patient.observations || 'Ninguna')}</p>
                </div>
                <button id="close-detail" class="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition">Cerrar</button>
            </div>
        </div>
    `;

    document.getElementById('close-modal').addEventListener('click', () => modalContainer.innerHTML = '');
    document.getElementById('close-detail').addEventListener('click', () => modalContainer.innerHTML = '');
}

// Utilidad XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}