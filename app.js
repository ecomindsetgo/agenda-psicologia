        // ─── CAPTURA GLOBAL DE ERRORES (para que nunca más "no pase nada") ────────
        // Si algo falla en cualquier parte del script, se muestra aquí en vez de
        // fallar en silencio. Revisa igual la consola (F12) para el detalle técnico.
        function mostrarErrorGlobal(msg) {
            const errorDiv = document.getElementById('auth-error-msg');
            if (errorDiv) {
                errorDiv.innerText = msg;
                errorDiv.classList.remove('hidden');
            }
        }
        window.addEventListener('error', (e) => {
            console.error('[Error capturado]', e.error || e.message);
            mostrarErrorGlobal('⚠️ Error al cargar la app: ' + (e.message || 'revisa la consola (F12)') + '. Si persiste, contacta a soporte.');
        });
        window.addEventListener('unhandledrejection', (e) => {
            console.error('[Promesa rechazada]', e.reason);
            const detalle = (e.reason && e.reason.message) ? e.reason.message : 'revisa la consola (F12)';
            mostrarErrorGlobal('⚠️ Error: ' + detalle + '. Si persiste, contacta a soporte.');
        });

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";
import {
    getAuth, signInWithEmailAndPassword, signOut,
    onAuthStateChanged, sendPasswordResetEmail, updatePassword,
    EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore, doc, setDoc, deleteDoc,
    onSnapshot, collection, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const appId = 'psicologia-agenda-default-v2';

        const firebaseConfig = {
            apiKey: "AIzaSyCEU4_jah1qhMnG4BPgp9zWWWOP73jjTkk",
            authDomain: "agenda-psicologica-pro.firebaseapp.com",
            projectId: "agenda-psicologica-pro",
            storageBucket: "agenda-psicologica-pro.firebasestorage.app",
            messagingSenderId: "164610159912",
            appId: "1:164610159912:web:4b29a3185058938e008c1d"
        };

// ─── INICIALIZACIÓN DE FIREBASE (protegida) ───────────────────────────────
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);

    // App Check — pega la Site Key del reCAPTCHA v3 de ESTE proyecto
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider("6Ld0s4QtAAAAADBZkz-urUfz_V5dqBGlWvpHYWSC"),
        isTokenAutoRefreshEnabled: true
    });

    auth = getAuth(app);
    db = getFirestore(app);
} catch (initError) {
    console.error('[Error inicializando Firebase]', initError);
    mostrarErrorGlobal('⚠️ No se pudo conectar con el servidor de autenticación. Revisa la consola (F12) o contacta a soporte.');
}

        let activeListeners = [];
        // Exponer referencias globales para funciones del modal de perfil
        window._firebaseAuthRef = { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword };
        window._profileState = null; // se asignará cuando el user esté disponible

        let state = {
            appointments: [],
            patients: [],
            histories: [],
            notes:[],
            activeTab: 'citas',
            filterStatus: 'todas',
            citasView: 'dia',
            monthViewDate: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
            financePeriod: 'todo',
            currentUser: null
        };

        window._profileState = state;

        // ── Hora actual de Perú (GMT-5). Se usa para deshabilitar horas ya
        // pasadas al agendar una cita para el día de hoy.
        function getLimaNow() {
            const limaStr = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' });
            return new Date(limaStr);
        }
        function getLimaDateStr(d) {
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }

        // Fecha inicial
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('date-filter').value = todayStr;
        document.getElementById('current-date-lbl').innerText = new Date().toLocaleDateString('es-PE', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // ─── LOGIN ────────────────────────────────────────────────────────────────
        // Se expone como función global para que el botón inline pueda llamarla
        window.handleLogin = async function() {
            const email    = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;   // leemos ANTES de resetear
            const errorDiv = document.getElementById('auth-error-msg');

            if (!auth) {
                errorDiv.innerText = "⚠️ La app no se conectó correctamente al servidor. Recarga la página o contacta a soporte.";
                errorDiv.classList.remove('hidden');
                return;
            }

            if (!email || !password) {
                errorDiv.innerText = "Por favor completa el correo y la contraseña.";
                errorDiv.classList.remove('hidden');
                return;
            }
            errorDiv.classList.add('hidden');

            try {
                await signInWithEmailAndPassword(auth, email, password);

                // ── Detección de contraseña temporal ──────────────────────────
                // Convención: las contraseñas creadas por el admin empiezan con "temp_"
                // Ej: temp_Clinica2024
                if (password.startsWith('temp_')) {
                    // Guardamos la referencia para usarla al cambiar la contraseña
                    window._tempPassword = password;
                    showChangePwdModal();
                }
                // Si no es temporal, onAuthStateChanged se encarga de mostrar la app
            } catch (error) {
                errorDiv.innerText = "Credenciales incorrectas o correo no autorizado.";
                errorDiv.classList.remove('hidden');
                // Limpiamos solo la contraseña, no el email (mejor UX)
                document.getElementById('auth-password').value = '';
            }
        };

        // ─── RECUPERAR CONTRASEÑA ─────────────────────────────────────────────────
        // FIX: se lee el email ANTES de cualquier reset de formulario
        window.recuperarContrasena = async function() {
            if (!auth) {
                alert("⚠️ La app no se conectó correctamente al servidor. Recarga la página o contacta a soporte.");
                return;
            }
            const email = document.getElementById('auth-email').value.trim();

            if (!email) {
                alert("Primero escribe tu correo electrónico en el campo de arriba.");
                document.getElementById('auth-email').focus();
                return;
            }

            try {
                await sendPasswordResetEmail(auth, email);
                alert(`✅ Correo de recuperación enviado a:\n${email}\n\nRevisa tu bandeja de entrada o la carpeta de Spam.`);
            } catch (error) {
                // Mapeamos los códigos de error de Firebase a mensajes amigables
                const mensajes = {
                    'auth/user-not-found':    'No existe ninguna cuenta registrada con ese correo.',
                    'auth/invalid-email':     'El formato del correo electrónico no es válido.',
                    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
                };
                const msg = mensajes[error.code] || ('Error: ' + error.message);
                alert('❌ ' + msg);
            }
        };

        // ─── MODAL CAMBIO DE CONTRASEÑA TEMPORAL ─────────────────────────────────
        function showChangePwdModal() {
            document.getElementById('change-password-modal').classList.remove('hidden');
            document.getElementById('change-password-modal').classList.add('flex');
            // Ocultamos la pantalla de login mientras dure el proceso
            document.getElementById('auth-screen').classList.add('hidden');
        }

        function hideChangePwdModal() {
            document.getElementById('change-password-modal').classList.add('hidden');
            document.getElementById('change-password-modal').classList.remove('flex');
        }

        window.handleChangePassword = async function() {
            const newPwd     = document.getElementById('new-password-input').value;
            const confirmPwd = document.getElementById('confirm-password-input').value;
            const errorDiv   = document.getElementById('change-pwd-error');
            const successDiv = document.getElementById('change-pwd-success');

            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');

            // Validaciones
            if (newPwd.length < 8) {
                errorDiv.innerText = "La contraseña debe tener al menos 8 caracteres.";
                errorDiv.classList.remove('hidden');
                return;
            }
            if (newPwd.startsWith('temp_')) {
                errorDiv.innerText = "No puedes usar una contraseña que empiece con 'temp_'. Elige otra.";
                errorDiv.classList.remove('hidden');
                return;
            }
            if (newPwd !== confirmPwd) {
                errorDiv.innerText = "Las contraseñas no coinciden. Vuelve a intentarlo.";
                errorDiv.classList.remove('hidden');
                return;
            }

            try {
                await updatePassword(auth.currentUser, newPwd);
                successDiv.innerText = "✅ ¡Contraseña actualizada con éxito! Ingresando a tu agenda...";
                successDiv.classList.remove('hidden');
                window._tempPassword = null;

                // Esperamos 1.5s para que el usuario lea el mensaje y luego abrimos la app
                setTimeout(() => {
                    hideChangePwdModal();
                    openApp(auth.currentUser);
                }, 1500);
            } catch (error) {
                // updatePassword puede fallar si el token es muy antiguo (reauthentication required)
                errorDiv.innerText = "Error al cambiar la contraseña. Por favor cierra sesión y vuelve a ingresar.";
                errorDiv.classList.remove('hidden');
            }
        };

        // ─── OBSERVER DE SESIÓN ───────────────────────────────────────────────────
        if (auth) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                state.currentUser = user;
                // Solo abrimos la app si NO hay un cambio de contraseña pendiente
                const changePwdVisible = !document.getElementById('change-password-modal').classList.contains('hidden');
                if (!changePwdVisible) {
                    openApp(user);
                }
            } else {
                state.currentUser = null;
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('app-container').classList.add('hidden');
                document.getElementById('app-container').classList.remove('flex');
                activeListeners.forEach(u => u());
                activeListeners = [];
                state.appointments = [];
                state.patients = [];
                renderAll();
            }
        });
        } // fin de if (auth)

        function openApp(user) {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('app-container').classList.add('flex');
            setupFirestoreSync(user.uid);

            // Cargar nombre de perfil en el header
            const saved = JSON.parse(localStorage.getItem('userProfile_' + user.uid) || '{}');
            const headerName = document.getElementById('header-user-name');
            if (headerName) headerName.innerText = saved.displayName || user.email.split('@')[0];
        }

        document.getElementById('logout-btn').addEventListener('click', () => {
            if (confirm("¿Seguro de cerrar sesión?")) signOut(auth);
        });

        // ─── FIRESTORE SYNC ───────────────────────────────────────────────────────
        function setupFirestoreSync(userId) {
            const appointmentsRef = collection(db, 'artifacts', appId, 'users', userId, 'appointments');
            const patientsRef     = collection(db, 'artifacts', appId, 'users', userId, 'patients');
            const historiesRef = collection(db, 'artifacts', appId, 'users', userId, 'clinicalHistories');
            const notesRef = collection(db, 'artifacts', appId, 'users', userId, 'clinicalNotes');
            const unsubAppts = onSnapshot(appointmentsRef, (snapshot) => {
                state.appointments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                renderAppointments();
                if (state.citasView === 'mes') renderMonthView();
                updateStatsDashboard();
            });

            const unsubPatients = onSnapshot(patientsRef, (snapshot) => {
                state.patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                renderPatients();
                updatePatientDropdowns();
                updateStatsDashboard();
            });
            const unsubHistories = onSnapshot(
            historiesRef,
            (snapshot) => {

            state.histories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
            }));

    }
);
          
const unsubNotes = onSnapshot(
notesRef,
(snapshot)=>{

state.notes=snapshot.docs.map(doc=>({

id:doc.id,

...doc.data()

}));

}
);

  activeListeners.push(unsubAppts, unsubPatients, unsubHistories, unsubNotes);
        }

        // ─── CRUD PACIENTES ───────────────────────────────────────────────────────
        document.getElementById('patient-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.currentUser) return;
            const pid = document.getElementById('patient-id').value || 'pat_' + Date.now();
            const payload = {
                name:       document.getElementById('pat-name').value.trim(),
                dni:        document.getElementById('pat-dni').value.trim(),
                phone:      document.getElementById('pat-phone').value.trim(),
                birth:      document.getElementById('pat-birth').value,
                history:    document.getElementById('pat-history').value.trim(),
                origen:     document.getElementById('pat-origen').value,
                canal:      document.getElementById('pat-canal').value,
                leadStatus: document.getElementById('pat-lead-status').value,
                currency:   document.getElementById('pat-currency') ? document.getElementById('pat-currency').value : 'PEN',
                updatedAt: new Date().toISOString()
            };
            const ref = doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'patients', pid);
            await setDoc(ref, payload, { merge: true });
            closePatientModal();
        });

        window.deletePatient = async function(pid) {
            if (state.appointments.some(a => a.patientId === pid)) {
                alert("No se puede eliminar: el paciente tiene citas vinculadas.");
                return;
            }
            if (confirm("¿Eliminar la ficha de este paciente?")) {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'patients', pid));
            }
        };
window.openClinicalHistory = function(patientId){

    const patient = state.patients.find(p => p.id === patientId);

    if(!patient){

        alert("No se encontró el paciente.");

        return;

    }

    const history = state.histories.find(h => h.id === patientId);

    document.getElementById("hc-patient-id").value = patientId;

    document.getElementById("hc-patient-name").value = patient.name || "";

    document.getElementById("hc-patient-dni").value = patient.dni || "";

    document.getElementById("hc-motivo").value = history?.motivo || "";

    document.getElementById("hc-problema").value = history?.problema || "";

    document.getElementById("hc-antecedentes").value = history?.antecedentes || "";

    document.getElementById("hc-familiares").value = history?.familiares || "";

    document.getElementById("hc-diagnostico").value = history?.diagnostico || "";

    document.getElementById("hc-objetivos").value = history?.objetivos || "";

    document.getElementById("hc-tratamiento").value = history?.tratamiento || "";

    document.getElementById("hc-observaciones").value = history?.observaciones || "";

    const container =
document.getElementById("clinical-notes-container");

container.innerHTML = "";

state.notes
.filter(n => n.patientId === patientId)
.sort((a,b)=>a.fecha.localeCompare(b.fecha))
.forEach(n => newClinicalNote(n));
const modal = document.getElementById("clinical-history-modal");

    modal.classList.remove("hidden");

    modal.classList.add("flex");

}
window.closeClinicalHistory=function(){

const modal=document.getElementById("clinical-history-modal");

modal.classList.remove("flex");

modal.classList.add("hidden");

}
window.saveClinicalHistory = async function(){

try{

    const patientId = document.getElementById("hc-patient-id").value;

    // 1. Guardar los datos de la historia clínica
    await setDoc(
        doc(
            db,
            'artifacts',
            appId,
            'users',
            state.currentUser.uid,
            'clinicalHistories',
            patientId
        ),
        {
            motivo: document.getElementById("hc-motivo").value,
            problema: document.getElementById("hc-problema").value,
            antecedentes: document.getElementById("hc-antecedentes").value,
            familiares: document.getElementById("hc-familiares").value,
            diagnostico: document.getElementById("hc-diagnostico").value,
            objetivos: document.getElementById("hc-objetivos").value,
            tratamiento: document.getElementById("hc-tratamiento").value,
            observaciones: document.getElementById("hc-observaciones").value,
            updatedAt: new Date().toISOString()
        },
        { merge: true }
    );

    // 2. Guardar cada nota clínica asociada a la sesión
    const cards = document.querySelectorAll("#clinical-notes-container > div");
    for (const card of cards) {
        const id = card.dataset.id;
        await setDoc(
            doc(
                db,
                "artifacts",
                appId,
                "users",
                state.currentUser.uid,
                "clinicalNotes",
                id
            ),
            {
                patientId,
                fecha: card.querySelector(".note-date").value,
                sesion: card.querySelector(".note-session").value,
                evolucion: card.querySelector(".note-text").value,
                updatedAt: new Date().toISOString()
            },
            { merge: true }
        );
    }

    closeClinicalHistory();
    alert("✅ Historia Clínica guardada correctamente.");

} catch (error) {
    console.error('[Error guardando historia clínica]', error);
    alert("❌ No se pudo guardar la Historia Clínica. Revisa la consola (F12) para más detalles.");
}

};

window.newClinicalNote = function(note = {}) {

    const id = note.id || ("note_" + Date.now());

    const div = document.createElement("div");

    div.className = "border rounded-xl p-4 bg-graphite-50";

    div.dataset.id = id;

    div.innerHTML = `
        <div class="grid md:grid-cols-2 gap-3">

            <div>
                <label class="font-semibold">Fecha</label>
                <input type="date"
                       class="note-date w-full border rounded-lg p-2"
                       value="${note.fecha || new Date().toISOString().split("T")[0]}">
            </div>

            <div>
                <label class="font-semibold">Sesión</label>
                <input type="text"
                       class="note-session w-full border rounded-lg p-2"
                       value="${note.sesion || ""}"
                       placeholder="Sesión 1">
            </div>

        </div>

        <div class="mt-3">

            <label class="font-semibold">

                Evolución Clínica

            </label>

            <textarea
                class="note-text w-full border rounded-xl p-3 mt-2"
                rows="5">${note.evolucion || ""}</textarea>

        </div>

        <div class="text-right mt-3">

            <button
                type="button"
                onclick="deleteClinicalNoteCard('${id}', this)"
                class="bg-red-500 text-white px-3 py-2 rounded-lg">

                Eliminar

            </button>

        </div>
    `;

    document.getElementById("clinical-notes-container")
            .appendChild(div);

}

window.deleteClinicalNoteCard = async function(noteId, btnEl) {

    if (!confirm("¿Eliminar esta evolución? Esta acción no se puede deshacer.")) {
        return;
    }

    try {
        if (state.currentUser) {
            // Se borra el documento real en Firestore para que no vuelva a aparecer al guardar.
            await deleteDoc(
                doc(
                    db,
                    'artifacts',
                    appId,
                    'users',
                    state.currentUser.uid,
                    'clinicalNotes',
                    noteId
                )
            );
        }
        // También se quita cualquier referencia local en memoria, por si el listener
        // de Firestore tarda en refrescar el arreglo state.notes.
        if (Array.isArray(state.notes)) {
            const idx = state.notes.findIndex(n => n.id === noteId);
            if (idx !== -1) state.notes.splice(idx, 1);
        }
    } catch (error) {
        console.error('[Error eliminando evolución]', error);
        alert("❌ No se pudo eliminar la evolución. Revisa la consola (F12) para más detalles.");
        return;
    }

    // Recién ahora se quita la tarjeta visualmente.
    btnEl.closest('.border').remove();
};

window.printClinicalHistory = function() {

    const patientId = document.getElementById("hc-patient-id").value;
    const patient = state.patients.find(p => p.id === patientId);

    if (!patient) {
        alert("No se encontró el paciente.");
        return;
    }

    // Especialista desde el perfil guardado
    const user = window._profileState && window._profileState.currentUser;
    let specialistName = 'Especialista';
    if (user) {
        const saved = JSON.parse(localStorage.getItem('userProfile_' + user.uid) || '{}');
        specialistName = saved.displayName || user.email.split('@')[0];
    }

    document.getElementById('pch-specialist').innerText = specialistName;
    document.getElementById('pch-specialist-foot').innerText = specialistName;
    document.getElementById('pch-date').innerText = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

    document.getElementById('pch-name').innerText = patient.name || '—';
    document.getElementById('pch-dni').innerText  = patient.dni  || '—';

    document.getElementById('pch-motivo').innerText        = document.getElementById('hc-motivo').value        || 'Sin información registrada.';
    document.getElementById('pch-problema').innerText      = document.getElementById('hc-problema').value      || 'Sin información registrada.';
    document.getElementById('pch-antecedentes').innerText  = document.getElementById('hc-antecedentes').value  || 'Sin información registrada.';
    document.getElementById('pch-familiares').innerText    = document.getElementById('hc-familiares').value    || 'Sin información registrada.';
    document.getElementById('pch-diagnostico').innerText   = document.getElementById('hc-diagnostico').value   || 'Sin información registrada.';
    document.getElementById('pch-objetivos').innerText     = document.getElementById('hc-objetivos').value     || 'Sin información registrada.';
    document.getElementById('pch-tratamiento').innerText   = document.getElementById('hc-tratamiento').value   || 'Sin información registrada.';
    document.getElementById('pch-observaciones').innerText = document.getElementById('hc-observaciones').value || 'Sin información registrada.';

    // Evolución clínica: se toma directamente de las tarjetas abiertas en el modal
    const cards = Array.from(document.querySelectorAll('#clinical-notes-container > div'));
    const notesData = cards
        .map(card => ({
            fecha:     card.querySelector('.note-date').value    || '—',
            sesion:    card.querySelector('.note-session').value || '—',
            evolucion: card.querySelector('.note-text').value    || ''
        }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const tbody = document.getElementById('pch-notes-body');
    if (notesData.length) {
        tbody.innerHTML = '';
        notesData.forEach(n => {
            const tr = document.createElement('tr');
            tr.className = 'border-b align-top';

            const tdFecha = document.createElement('td');
            tdFecha.className = 'py-2 px-2 font-semibold whitespace-nowrap';
            tdFecha.innerText = n.fecha;

            const tdSesion = document.createElement('td');
            tdSesion.className = 'py-2 px-2 font-medium whitespace-nowrap';
            tdSesion.innerText = n.sesion;

            const tdEvol = document.createElement('td');
            tdEvol.className = 'py-2 px-2 whitespace-pre-line';
            tdEvol.innerText = n.evolucion || '—';

            tr.appendChild(tdFecha);
            tr.appendChild(tdSesion);
            tr.appendChild(tdEvol);
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" class="py-3 text-center text-graphite-400">Sin evolución clínica registrada.</td></tr>';
    }

    // Ocultar todo lo demás e imprimir solo la historia clínica
    const clinicalModal = document.getElementById('clinical-history-modal');
    const cardSection    = document.getElementById('print-patient-card');
    const reportSection  = document.getElementById('print-section');
    const pchSection     = document.getElementById('print-clinical-history');

    clinicalModal.classList.add('hidden');
    clinicalModal.classList.remove('flex');
    if (cardSection)   cardSection.classList.add('hidden');
    if (reportSection) reportSection.classList.add('hidden');
    pchSection.classList.remove('hidden');

    setTimeout(() => {
        window.print();
        pchSection.classList.add('hidden');
        clinicalModal.classList.remove('hidden');
        clinicalModal.classList.add('flex');
    }, 300);
};

        window.editPatient = function(pid) {
            const p = state.patients.find(p => p.id === pid);
            if (!p) return;
            document.getElementById('patient-id').value  = p.id;
            document.getElementById('pat-name').value    = p.name;
            document.getElementById('pat-dni').value     = p.dni    || '';
            document.getElementById('pat-phone').value   = p.phone;
            document.getElementById('pat-birth').value   = p.birth   || '';
            document.getElementById('pat-history').value = p.history || '';
            document.getElementById('pat-origen').value      = p.origen     || 'otro';
            document.getElementById('pat-canal').value       = p.canal      || 'whatsapp';
            document.getElementById('pat-lead-status').value = p.leadStatus || 'nuevo';
            const patCurrencyEl = document.getElementById('pat-currency');
            if (patCurrencyEl) patCurrencyEl.value = p.currency === 'USD' ? 'USD' : 'PEN';
            document.getElementById('patient-modal-title').innerText = "✏️ Editar Paciente";
            openPatientModal(true);
        };

        // ─── CRUD CITAS ───────────────────────────────────────────────────────────
        // ─── TARIFARIO: sesión individual / paquetes ───────────────────────────────
        // Nota: el precio del paquete NO varía por modalidad (presencial/virtual).
        const RATE_TABLE = {
            individual: {
                presencial: { sesion: 50, paquete6: 240, paquete8: 320 },
                virtual:    { sesion: 45, paquete6: 240, paquete8: 320 }
            },
            pareja: {
                presencial: { sesion: 60, paquete6: 300, paquete8: 400 },
                virtual:    { sesion: 55, paquete6: 300, paquete8: 400 }
            }
        };

        // ── Tarifario en DÓLARES para pacientes marcados como "extranjero" (USD)
        // en su ficha. AJUSTA estos montos a lo que realmente quieras cobrar —
        // son valores de partida, no un cálculo automático desde soles.
        const RATE_TABLE_USD = {
            individual: {
                presencial: { sesion: 15, paquete6: 80, paquete8: 105 },
                virtual:    { sesion: 15, paquete6: 80, paquete8: 105 }
            },
            pareja: {
                presencial: { sesion: 20, paquete6: 105, paquete8: 140 },
                virtual:    { sesion: 20, paquete6: 105, paquete8: 140 }
            }
        };

        // currency: 'PEN' (por defecto) o 'USD'. Se determina por la ficha del
        // paciente (patientObj.currency), nunca por la cita en sí.
        function getRate(attentionType, modality, rateType, currency) {
            const table = (currency === 'USD') ? RATE_TABLE_USD : RATE_TABLE;
            const at = table[attentionType] ? attentionType : 'individual';
            const md = (modality === 'virtual') ? 'virtual' : 'presencial';
            const rateGroup = table[at][md];
            return rateGroup[rateType] !== undefined ? rateGroup[rateType] : rateGroup.sesion;
        }

        // Símbolo/formateo de moneda para mostrar montos consistentemente.
        function currencySymbol(currency) {
            return currency === 'USD' ? '$' : 'S/';
        }
        function formatMoney(amount, currency) {
            return `${currencySymbol(currency)} ${Number(amount || 0).toFixed(2)}`;
        }
        // Citas sin "currency" guardado (creadas antes de este cambio) se
        // asumen en soles, igual que siempre.
        function isPenAppt(a) { return a.currency !== 'USD'; }
        function isUsdAppt(a) { return a.currency === 'USD'; }

        function packageSizeFromRateType(rateType) {
            if (rateType === 'paquete6') return 6;
            if (rateType === 'paquete8') return 8;
            return 0;
        }

        // Número de sesión en la que corresponde cobrar la segunda mitad del paquete.
        // Paquete de 6 sesiones -> se cobra en la sesión 4.
        // Paquete de 8 sesiones -> se cobra en la sesión 5.
        function secondPaymentSessionNumber(size) {
            if (size === 6) return 4;
            if (size === 8) return 5;
            return null;
        }

        // Busca un paquete del paciente que aún tenga sesiones disponibles,
        // del mismo tipo de atención y del mismo tamaño (6 u 8).
        // Se recorre en orden inverso (del más reciente al más antiguo) para que,
        // si hay más de un paquete activo del mismo tamaño (p.ej. uno viejo de
        // prueba que quedó sin usar), siempre se proponga el creado más
        // recientemente en vez del más antiguo.
        function findActivePackage(patientObj, attentionType, size) {
            if (!patientObj || !Array.isArray(patientObj.packages)) return null;
            const list = patientObj.packages.slice().reverse();
            return list.find(pk =>
                pk.attentionType === attentionType &&
                pk.size === size &&
                pk.sessionsUsed < pk.sessionsTotal
            ) || null;
        }

        // Busca cualquier paquete activo del paciente (6 u 8 sesiones) para un
        // tipo de atención dado, sin importar el tamaño. Igual que arriba,
        // prioriza el paquete creado más recientemente.
        function findActivePackageAnySize(patientObj, attentionType) {
            if (!patientObj || !Array.isArray(patientObj.packages)) return null;
            const list = patientObj.packages.slice().reverse();
            return list.find(pk =>
                pk.attentionType === attentionType &&
                pk.sessionsUsed < pk.sessionsTotal
            ) || null;
        }

        // Se ejecuta al cambiar de PACIENTE o de TIPO DE ATENCIÓN en el modal de
        // "Nueva Cita" (nunca al editar una cita ya existente). Si el paciente
        // seleccionado tiene un paquete activo para ese tipo de atención, selecciona
        // automáticamente "Paquete 6/8" en la tarifa para que la sesión se contabilice
        // dentro del paquete. Si el paciente NO tiene paquete activo, se asegura de
        // limpiar cualquier "Paquete" que haya quedado seleccionado por el paciente
        // anterior (evita el arrastre de datos de una ficha a otra).
        function autoSelectPatientPackage() {
            if (document.getElementById('app-id').value) return; // no tocar citas en edición

            const patientId  = document.getElementById('app-patient-select').value;
            const patientObj = state.patients.find(p => p.id === patientId);
            const attentionInput = document.querySelector('input[name="app-attention-type"]:checked');
            const attentionType  = attentionInput ? attentionInput.value : 'individual';
            const rateTypeEl = document.getElementById('app-rate-type');

            const activePkg = patientObj ? findActivePackageAnySize(patientObj, attentionType) : null;
            if (activePkg) {
                rateTypeEl.value = activePkg.size === 8 ? 'paquete8' : 'paquete6';
            } else if (rateTypeEl.value !== 'sesion') {
                rateTypeEl.value = 'sesion';
            }
        }
        window.autoSelectPatientPackage = autoSelectPatientPackage;

        // Recalcula precio/paquete cada vez que cambia paciente, tipo de atención,
        // modalidad o tarifa seleccionada en el modal de citas.
        function updateAppointmentPricing() {
            const attentionInput = document.querySelector('input[name="app-attention-type"]:checked');
            const attentionType  = attentionInput ? attentionInput.value : 'individual';
            const modalityInput  = document.querySelector('input[name="app-modality"]:checked');
            const modality       = modalityInput ? modalityInput.value : 'presencial';
            const rateType       = document.getElementById('app-rate-type').value;
            const patientId      = document.getElementById('app-patient-select').value;
            const patientObj     = state.patients.find(p => p.id === patientId);

            const costInput    = document.getElementById('app-cost');
            const paymentSel   = document.getElementById('app-payment');
            const infoBox      = document.getElementById('app-package-info');
            const packageIdEl  = document.getElementById('app-package-id');
            const packageTypeEl= document.getElementById('app-package-type');
            const sessionValEl = document.getElementById('app-session-value');

            const size = packageSizeFromRateType(rateType);
            const currency = patientObj && patientObj.currency === 'USD' ? 'USD' : 'PEN';
            const sym = currencySymbol(currency);
            const costLabelEl = document.getElementById('app-cost-label');
            if (costLabelEl) costLabelEl.innerText = `Precio (${sym}) *`;

            if (size === 0) {
                // Sesión suelta: se cobra normalmente
                const price = getRate(attentionType, modality, 'sesion', currency);
                costInput.value = price.toFixed(2);
                sessionValEl.value = price;
                packageIdEl.value = '';
                packageTypeEl.value = '';
                paymentSel.disabled = false;
                infoBox.classList.add('hidden');
                infoBox.innerHTML = '';
                return;
            }

            // Tarifa de paquete
            const packagePrice = getRate(attentionType, modality, rateType, currency);
            const halfPrice    = packagePrice / 2;
            const secondPayAt  = secondPaymentSessionNumber(size);
            const activePkg = patientObj ? findActivePackage(patientObj, attentionType, size) : null;

            if (activePkg) {
                const restantes = activePkg.sessionsTotal - activePkg.sessionsUsed;
                const nextSessionNumber = activePkg.sessionsUsed + 1;
                const pendingSecondPayment = secondPayAt && nextSessionNumber === secondPayAt &&
                    activePkg.secondPaymentStatus !== 'pagado';

                if (pendingSecondPayment) {
                    // Esta cita corresponde a la sesión donde se cobra la segunda mitad del paquete
                    costInput.value = halfPrice.toFixed(2);
                    sessionValEl.value = (activePkg.price / activePkg.sessionsTotal).toFixed(2);
                    packageIdEl.value = activePkg.id;
                    packageTypeEl.value = String(size);
                    paymentSel.value = activePkg.secondPaymentStatus || 'pendiente';
                    paymentSel.disabled = false;
                    infoBox.classList.remove('hidden');
                    infoBox.className = 'text-xs rounded-xl p-3 border space-y-1 bg-amber-50 border-amber-200 text-amber-800';
                    infoBox.innerHTML = `
                        <p class="font-bold">💰 Segundo pago del paquete (mitad)</p>
                        <p>Esta es la sesión ${nextSessionNumber} de ${activePkg.sessionsTotal} · quedan <strong>${restantes}</strong></p>
                        <p>Corresponde cobrar la segunda mitad: ${sym} ${halfPrice.toFixed(2)}.</p>`;
                } else {
                    costInput.value = '0.00';
                    sessionValEl.value = (activePkg.price / activePkg.sessionsTotal).toFixed(2);
                    packageIdEl.value = activePkg.id;
                    packageTypeEl.value = String(size);
                    paymentSel.value = 'pagado';
                    paymentSel.disabled = true;
                    infoBox.classList.remove('hidden');
                    infoBox.className = 'text-xs rounded-xl p-3 border space-y-1 bg-emerald-50 border-emerald-200 text-emerald-800';
                    infoBox.innerHTML = `
                        <p class="font-bold">📦 Paquete activo detectado</p>
                        <p>${activePkg.sessionsUsed} / ${activePkg.sessionsTotal} sesiones utilizadas · quedan <strong>${restantes}</strong></p>
                        <p>Sesión incluida en el paquete — no se vuelve a cobrar${secondPayAt ? ` (el segundo pago se cobra en la sesión ${secondPayAt}).` : '.'}</p>`;
                }
            } else {
                // Nuevo paquete: se cobra la primera mitad al iniciar
                costInput.value = halfPrice.toFixed(2);
                sessionValEl.value = (packagePrice / size).toFixed(2);
                packageIdEl.value = 'NEW';
                packageTypeEl.value = String(size);
                paymentSel.disabled = false;
                infoBox.classList.remove('hidden');
                infoBox.className = 'text-xs rounded-xl p-3 border space-y-1 bg-sage-50 border-sage-200 text-sage-800';
                infoBox.innerHTML = `
                    <p class="font-bold">🆕 Se creará un nuevo paquete</p>
                    <p>${size} sesiones · ${sym} ${packagePrice.toFixed(2)} en total (${sym} ${(packagePrice/size).toFixed(2)} por sesión)</p>
                    <p>Primer pago (mitad) ahora: ${sym} ${halfPrice.toFixed(2)}. Segundo pago (mitad) se cobrará en la sesión ${secondPayAt}.</p>`;
            }
        }
        window.updateAppointmentPricing = updateAppointmentPricing;

        // ─── RESTRINGIR HORAS YA PASADAS EN #app-time ──────────────────────────────
        // #app-time es un <input type="time">, así que en vez de "deshabilitar
        // opciones" (como en un <select>) usamos el atributo min. Si la fecha
        // elegida es HOY (hora de Perú), no se puede elegir una hora ya pasada.
        // Si se está EDITANDO una cita ya existente, no restringimos nada (para
        // no bloquear ver/editar una cita que ya ocurrió).
        function applyMinTimeForToday() {
            const dateInput = document.getElementById('app-date');
            const timeInput = document.getElementById('app-time');
            const idInput   = document.getElementById('app-id');
            if (!dateInput || !timeInput) return;

            if (idInput && idInput.value) {
                timeInput.removeAttribute('min');
                return;
            }

            const dateVal = dateInput.value;
            if (!dateVal) { timeInput.removeAttribute('min'); return; }

            const limaNow = getLimaNow();
            const isToday = dateVal === getLimaDateStr(limaNow);

            if (isToday) {
                const hh = String(limaNow.getHours()).padStart(2, '0');
                const mm = String(limaNow.getMinutes()).padStart(2, '0');
                timeInput.min = `${hh}:${mm}`;
                // Si ya había una hora seleccionada y quedó en el pasado, se limpia
                if (timeInput.value && timeInput.value < timeInput.min) {
                    timeInput.value = '';
                }
            } else {
                timeInput.removeAttribute('min');
            }
        }
        window.applyMinTimeForToday = applyMinTimeForToday;

        document.addEventListener('DOMContentLoaded', () => {
            const dateInput = document.getElementById('app-date');
            if (dateInput) dateInput.addEventListener('change', applyMinTimeForToday);

            // Envolvemos openAppointmentModal (definida en ui.js) para recalcular
            // la hora mínima cada vez que se abre el modal de "Nueva Cita".
            if (typeof window.openAppointmentModal === 'function') {
                const _origOpenAppointmentModal = window.openAppointmentModal;
                window.openAppointmentModal = function(...args) {
                    _origOpenAppointmentModal.apply(this, args);
                    setTimeout(applyMinTimeForToday, 60);
                };
            }

            // Envolvemos openPatientModal para que, al registrar un paciente
            // NUEVO (sin patient-id), el selector de moneda vuelva a "Soles" en
            // vez de arrastrar el valor del último paciente editado.
            if (typeof window.openPatientModal === 'function') {
                const _origOpenPatientModal = window.openPatientModal;
                window.openPatientModal = function(...args) {
                    _origOpenPatientModal.apply(this, args);
                    setTimeout(() => {
                        const idEl = document.getElementById('patient-id');
                        const currencyEl = document.getElementById('pat-currency');
                        if (currencyEl && idEl && !idEl.value) {
                            currencyEl.value = 'PEN';
                        }
                    }, 30);
                };
            }
        });

        // ─── PAQUETES: helpers de persistencia ──────────────────────────────────
        // Guarda el arreglo completo de paquetes del paciente en Firestore.
        async function savePatientPackages(patientId, packages) {
            const ref = doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'patients', patientId);
            await setDoc(ref, { packages: packages }, { merge: true });
            const p = state.patients.find(p => p.id === patientId);
            if (p) p.packages = packages;
        }

        // Suma (o resta) 1 sesión utilizada de un paquete específico del paciente.
        async function adjustPackageSession(patientId, packageId, delta) {
            if (!packageId) return;
            const patientObj = state.patients.find(p => p.id === patientId);
            if (!patientObj || !Array.isArray(patientObj.packages)) return;
            const packages = patientObj.packages.map(pk => {
                if (pk.id !== packageId) return pk;
                let used = pk.sessionsUsed + delta;
                used = Math.max(0, Math.min(pk.sessionsTotal, used));
                return { ...pk, sessionsUsed: used };
            });
            await savePatientPackages(patientId, packages);
        }

        // Elimina un paquete del paciente. Por seguridad:
        //  - Si el paquete ya tiene sesiones usadas, se pide confirmación extra
        //    (se perdería el registro de esas sesiones/pagos).
        //  - Si hay citas (de cualquier estado) vinculadas a ese paquete, se
        //    bloquea el borrado para no dejar citas "huérfanas" apuntando a un
        //    packageId que ya no existe; primero hay que reasignar/editar esas
        //    citas (cambiar su tarifa) para que apunten al paquete correcto.
        window.deletePatientPackage = async function(patientId, packageId) {
            const patientObj = state.patients.find(p => p.id === patientId);
            if (!patientObj || !Array.isArray(patientObj.packages)) return;
            const pkg = patientObj.packages.find(pk => pk.id === packageId);
            if (!pkg) return;

            const linkedAppts = state.appointments.filter(a => a.packageId === packageId);
            if (linkedAppts.length > 0) {
                alert(`⚠️ No se puede eliminar este paquete\n\nTiene ${linkedAppts.length} cita(s) vinculada(s). Primero edita esa(s) cita(s) y cambia su tarifa (por ejemplo, al paquete correcto) para desvincularlas, y luego vuelve a intentar eliminar el paquete.`);
                return;
            }

            const usadas = pkg.sessionsUsed || 0;
            const msg = usadas > 0
                ? `Este paquete de ${pkg.sessionsTotal} sesiones ya tiene ${usadas} sesión(es) marcada(s) como usada(s).\n\n¿Seguro que deseas eliminarlo? Esta acción no se puede deshacer.`
                : `¿Eliminar este paquete de ${pkg.sessionsTotal} sesiones (sin sesiones usadas)?\n\nEsta acción no se puede deshacer.`;
            if (!confirm(msg)) return;

            const updatedPackages = patientObj.packages.filter(pk => pk.id !== packageId);
            await savePatientPackages(patientId, updatedPackages);

            // Refrescar la vista del historial si está abierta para este paciente
            if (window._currentHistoryPatientId === patientId) {
                window.openPatientHistory(patientId);
            }
        };

        // Marca/desmarca la sesión de paquete de una cita como "consumida" y
        // ajusta el contador del paquete cuando la cita entra o sale de "completada".
        async function syncPackageOnStatusChange(appointment, oldStatus, newStatus) {
            if (!appointment || !appointment.packageId) return;
            const wasConsumed = appointment.packageConsumed === true;
            const ref = doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'appointments', appointment.id);

            if (newStatus === 'completada' && oldStatus !== 'completada' && !wasConsumed) {
                await adjustPackageSession(appointment.patientId, appointment.packageId, +1);
                await updateDoc(ref, { packageConsumed: true });
                appointment.packageConsumed = true;
            } else if (oldStatus === 'completada' && newStatus !== 'completada' && wasConsumed) {
                await adjustPackageSession(appointment.patientId, appointment.packageId, -1);
                await updateDoc(ref, { packageConsumed: false });
                appointment.packageConsumed = false;
            }
        }

        document.getElementById('appointment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.currentUser) return;
            const aid       = document.getElementById('app-id').value || 'app_' + Date.now();
            const patientId = document.getElementById('app-patient-select').value;
            const patientObj = state.patients.find(p => p.id === patientId);
            if (!patientObj) { alert("Selecciona un paciente válido."); return; }

            const newDate = document.getElementById('app-date').value;
            const newTime = document.getElementById('app-time').value;
            const modalityInput = document.querySelector('input[name="app-modality"]:checked');
            const modality = modalityInput ? modalityInput.value : 'presencial';
            const attentionInput = document.querySelector('input[name="app-attention-type"]:checked');
            const attentionType  = attentionInput ? attentionInput.value : 'individual';
            const rateType  = document.getElementById('app-rate-type').value;
            const newStatus = document.getElementById('app-status').value;

            // ─── VALIDACIÓN DE DUPLICADOS ────────────────────────────────────────
            // Excluir la cita que se está editando (si aplica)
            const otherAppts = state.appointments.filter(a => a.id !== aid);

            // 1) Verificar si ya existe otra cita en la misma fecha y hora (cualquier paciente)
            const sameSlot = otherAppts.find(a => a.date === newDate && a.time === newTime);
            if (sameSlot) {
                alert(`⚠️ Horario ocupado\n\nYa existe una cita el ${newDate} a las ${newTime} para el paciente "${sameSlot.patientName}".\n\nPor favor elige otro horario.`);
                return;
            }

            // 2) Verificar si el mismo paciente ya tiene una cita en esa fecha (cualquier hora)
            const samePatientDay = otherAppts.find(a => a.date === newDate && a.patientId === patientId);
            if (samePatientDay) {
                alert(`⚠️ Paciente ya agendado\n\n"${patientObj.name}" ya tiene una cita programada el ${newDate} a las ${samePatientDay.time}.\n\nNo se puede agendar el mismo paciente dos veces en el mismo día.`);
                return;
            }
            // ────────────────────────────────────────────────────────────────────

            const existingAppt = state.appointments.find(a => a.id === aid);
            const oldStatus = existingAppt ? existingAppt.status : null;

            // ─── RESOLVER PAQUETE (si la tarifa seleccionada es un paquete) ───────
            const size = packageSizeFromRateType(rateType);
            let packageId = '';
            let packageConsumed = existingAppt ? (existingAppt.packageConsumed === true) : false;

            const apptCurrency = patientObj.currency === 'USD' ? 'USD' : 'PEN';

            if (size > 0) {
                const rawPackageId = document.getElementById('app-package-id').value;
                if (rawPackageId === 'NEW') {
                    // Crear un nuevo paquete para el paciente (pago dividido en 2 mitades)
                    const price = getRate(attentionType, modality, rateType, apptCurrency);
                    const firstPaymentStatus = document.getElementById('app-payment').value;
                    const newPkg = {
                        id: 'pkg_' + Date.now(),
                        attentionType: attentionType,
                        size: size,
                        price: price,
                        currency: apptCurrency,
                        sessionsTotal: size,
                        sessionsUsed: 0,
                        halfPrice: price / 2,
                        secondPaymentSession: secondPaymentSessionNumber(size),
                        firstPaymentStatus: firstPaymentStatus,
                        secondPaymentStatus: 'pendiente',
                        paid: false, // se marca true solo cuando ambas mitades están pagadas
                        purchaseDate: new Date().toISOString().slice(0, 10)
                    };
                    const currentPackages = Array.isArray(patientObj.packages) ? patientObj.packages : [];
                    const updatedPackages = [...currentPackages, newPkg];
                    await savePatientPackages(patientId, updatedPackages);
                    packageId = newPkg.id;
                } else {
                    packageId = rawPackageId; // paquete existente ya activo

                    // Si esta cita corresponde a la sesión del segundo pago (mitad), registrar su estado
                    const existingPkg = (patientObj.packages || []).find(pk => pk.id === packageId);
                    const chargedCost = parseFloat(document.getElementById('app-cost').value || 0);
                    if (existingPkg && chargedCost > 0) {
                        const secondPaymentStatusVal = document.getElementById('app-payment').value;
                        if (existingPkg.secondPaymentStatus !== secondPaymentStatusVal) {
                            const updatedPackages = patientObj.packages.map(pk => pk.id === packageId
                                ? {
                                    ...pk,
                                    secondPaymentStatus: secondPaymentStatusVal,
                                    paid: pk.firstPaymentStatus === 'pagado' && secondPaymentStatusVal === 'pagado'
                                  }
                                : pk);
                            await savePatientPackages(patientId, updatedPackages);
                        }
                    }
                }
            }

            const payload = {
                patientId:      patientId,
                patientName:    patientObj.name,
                date:           newDate,
                time:           newTime,
                modality:       modality,
                attentionType:  attentionType,
                rateType:       rateType,
                packageType:    size || null,
                packageId:      packageId || null,
                sessionValue:   parseFloat(document.getElementById('app-session-value').value || 0),
                cost:           parseFloat(document.getElementById('app-cost').value || 0),
                currency:       apptCurrency,
                paymentStatus:  document.getElementById('app-payment').value,
                status:         newStatus,
                packageConsumed: packageConsumed,
                notes:          document.getElementById('app-notes').value.trim(),
                updatedAt:      new Date().toISOString()
            };
            const ref = doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'appointments', aid);
            await setDoc(ref, payload, { merge: true });

            // Sincronizar consumo de sesión de paquete según el estado guardado
            if (packageId) {
                await syncPackageOnStatusChange({ ...payload, id: aid }, oldStatus, newStatus);
            }

            closeAppointmentModal();
        });

        window.deleteAppointment = async function(aid) {
            if (confirm("¿Remover esta cita?")) {
                const a = state.appointments.find(x => x.id === aid);
                if (a && a.packageId && a.packageConsumed) {
                    await adjustPackageSession(a.patientId, a.packageId, -1);
                }
                if (a && a.calendlyCancelUrl) {
                    if (confirm("Esta cita viene de Calendly. ¿Abrir la página de cancelación para cancelarla también allá? (Recomendado, así el paciente es notificado y el evento se borra del Calendar)")) {
                        window.open(a.calendlyCancelUrl, '_blank');
                    }
                }
                await deleteDoc(doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'appointments', aid));
            }
        };

        window.quickToggleStatus = async function(aid, currentStatus) {
            const next = { pendiente: 'completada', completada: 'cancelada', cancelada: 'pendiente' };
            const newStatus = next[currentStatus] || 'pendiente';
            const a = state.appointments.find(x => x.id === aid);
            const ref  = doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'appointments', aid);
            await updateDoc(ref, { status: newStatus });
            if (a) await syncPackageOnStatusChange(a, currentStatus, newStatus);
        };

        window.editAppointment = function(aid) {
            const a = state.appointments.find(a => a.id === aid);
            if (!a) return;
            document.getElementById('app-id').value                  = a.id;
            document.getElementById('app-date').value                 = a.date;
            document.getElementById('app-time').value                 = a.time;
            document.getElementById('app-cost').value                 = a.cost;
            // Actualizar la etiqueta "Precio ($/S/)" según la moneda REAL de
            // esta cita (a.currency), sin llamar a updateAppointmentPricing()
            // porque esa función recalcula y sobrescribiría el monto que
            // acabamos de cargar arriba. Antes de este fix la etiqueta se
            // quedaba con el valor de la última cita nueva abierta, por eso
            // una cita en dólares podía mostrarse con el símbolo "S/".
            const editCostLabelEl = document.getElementById('app-cost-label');
            if (editCostLabelEl) editCostLabelEl.innerText = `Precio (${currencySymbol(a.currency)}) *`;
            document.getElementById('app-payment').value              = a.paymentStatus;
            document.getElementById('app-status').value               = a.status;
            document.getElementById('app-notes').value                = a.notes || '';
            document.getElementById('app-package-id').value           = a.packageId || '';
            document.getElementById('app-package-type').value         = a.packageType || '';
            document.getElementById('app-session-value').value        = a.sessionValue || a.cost || '';
            document.getElementById('app-package-consumed').value     = a.packageConsumed ? '1' : '';
            document.getElementById('app-rate-type').value            = a.rateType || 'sesion';
            document.getElementById('app-modal-title').innerText      = "✏️ Editar Cita";
            document.getElementById('app-payment').disabled           = !!(a.packageId && a.rateType && a.rateType !== 'sesion' && parseFloat(a.cost || 0) === 0);
            // Reiniciar SIEMPRE el recuadro informativo de paquete antes de mostrar
            // esta cita: si no se limpia aquí, queda visible la info del paciente
            // que se editó anteriormente (aunque la cita actual no tenga paquete).
            const infoBoxReset = document.getElementById('app-package-info');
            infoBoxReset.classList.add('hidden');
            infoBoxReset.innerHTML = '';
            infoBoxReset.className = 'text-xs rounded-xl p-3 border space-y-1 hidden';
            openAppointmentModal(true);
            // El select necesita setearse DESPUÉS de que el modal esté visible
            setTimeout(() => {
                document.getElementById('app-patient-select').value = a.patientId;
                const modalityValue = a.modality === 'virtual' ? 'app-modality-virtual' : 'app-modality-presencial';
                const modalityRadio = document.getElementById(modalityValue);
                if (modalityRadio) modalityRadio.checked = true;
                const attentionValue = a.attentionType === 'pareja' ? 'app-attention-pareja' : 'app-attention-individual';
                const attentionRadio = document.getElementById(attentionValue);
                if (attentionRadio) attentionRadio.checked = true;
                // Mostrar el panel informativo del paquete SOLO si esta cita en
                // particular tiene paquete asociado (si no, queda oculto/limpio,
                // sin recalcular ni reasignar el paquete, para no alterar lo ya guardado).
                const infoBox = document.getElementById('app-package-info');
                if (a.packageId && a.rateType && a.rateType !== 'sesion') {
                    const patientObj = state.patients.find(p => p.id === a.patientId);
                    const pkg = patientObj && Array.isArray(patientObj.packages)
                        ? patientObj.packages.find(pk => pk.id === a.packageId) : null;
                    infoBox.classList.remove('hidden');
                    infoBox.className = 'text-xs rounded-xl p-3 border space-y-1 bg-emerald-50 border-emerald-200 text-emerald-800';
                    if (pkg) {
                        infoBox.innerHTML = `
                            <p class="font-bold">📦 Cita vinculada a un paquete</p>
                            <p>${pkg.sessionsUsed} / ${pkg.sessionsTotal} sesiones utilizadas del paquete</p>`;
                    } else {
                        infoBox.innerHTML = `<p class="font-bold">📦 Cita vinculada a un paquete de ${a.packageType} sesiones</p>`;
                    }
                } else {
                    infoBox.classList.add('hidden');
                    infoBox.innerHTML = '';
                }
            }, 50);
        };

        // ─── RENDERS ─────────────────────────────────────────────────────────────
        function renderAll() {
            renderAppointments();
            renderPatients();
            updatePatientDropdowns();
            if (state.citasView === 'mes') renderMonthView();
        }

        window.renderAppointments = function() {
            const container  = document.getElementById('appointments-list');
            const dateFilter = document.getElementById('date-filter').value;
            const searchVal  = document.getElementById('appointment-search').value.toLowerCase().trim();

            let filtered = state.appointments.filter(a => a.date === dateFilter);
            if (state.filterStatus !== 'todas') filtered = filtered.filter(a => a.status === state.filterStatus);
            if (searchVal) filtered = filtered.filter(a =>
                a.patientName.toLowerCase().includes(searchVal) ||
                (a.notes || '').toLowerCase().includes(searchVal)
            );
            filtered.sort((a, b) => a.time.localeCompare(b.time));

            if (!filtered.length) {
                container.innerHTML = `<div class="text-center p-8 bg-white rounded-2xl border border-graphite-100 text-graphite-400 text-sm">No hay citas programadas para este filtro o fecha.</div>`;
                return;
            }
            container.innerHTML = filtered.map(a => {
                const badge = a.status === 'completada'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : a.status === 'cancelada'
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200';
                const payBadge = a.paymentStatus === 'pagado' ? '💳 Pagado' : '⏳ Pendiente';
                const modalityBadge = a.modality === 'virtual'
                    ? '<span class="text-xs font-semibold px-2 py-0.5 rounded-xl border bg-sky-50 text-sky-700 border-sky-200">💻 Virtual</span>'
                    : '<span class="text-xs font-semibold px-2 py-0.5 rounded-xl border bg-graphite-50 text-graphite-600 border-graphite-200">🏢 Presencial</span>';
                return `
                <div class="bg-white p-5 rounded-3xl border border-sage-100/70 card-soft flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:shadow-md transition">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-bold text-graphite-700 bg-graphite-100 px-2 py-0.5 rounded-lg">⏰ ${a.time}</span>
                            <h4 class="font-extrabold text-graphite-800 text-base">${a.patientName}</h4>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-xl border ${badge}">${a.status.toUpperCase()}</span>
                            ${modalityBadge}
                        </div>
                        <p class="text-xs text-graphite-500 italic">"${a.notes || 'Sin observaciones para esta sesión'}"</p>
                    </div>
                    <div class="flex items-center gap-3 self-end sm:self-center">
                        <button onclick="enviarRecordatorioWhatsapp('${a.id}')" title="Enviar recordatorio por WhatsApp" class="bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1">📲 WhatsApp</button>
                        <button onclick="quickToggleStatus('${a.id}','${a.status}')" class="bg-graphite-50 border hover:bg-graphite-100 text-graphite-600 text-xs px-3 py-1.5 rounded-xl font-semibold">🔄 Estado</button>
                        <button onclick="editAppointment('${a.id}')" class="text-sage-600 hover:text-sage-800 text-xs font-bold">✏️</button>
                        <button onclick="deleteAppointment('${a.id}')" class="text-red-500 hover:text-red-700 text-xs font-bold">🗑️</button>
                    </div>
                </div>`;
            }).join('');
        };

        // ─── RECORDATORIO POR WHATSAPP ──────────────────────────────────────────────
        // Abre WhatsApp Web/App con un mensaje pre-armado para el paciente de la cita.
        // Usa el prefijo +51 (Perú) por defecto; si el teléfono ya incluye código de
        // país (empieza con '+' o tiene más de 9 dígitos) lo respeta tal cual.
        window.enviarRecordatorioWhatsapp = function(aid) {
            const a = state.appointments.find(x => x.id === aid);
            if (!a) return;
            const patient = state.patients.find(p => p.id === a.patientId);
            const rawPhone = (patient && patient.phone) ? patient.phone : '';
            const digits = rawPhone.replace(/\D/g, '');
            if (!digits) {
                alert('Este paciente no tiene un número de teléfono registrado. Agrégalo desde su ficha para poder enviarle recordatorios.');
                return;
            }
            const tel = digits.length > 9 ? digits : '51' + digits;
            const fechaBonita = new Date(a.date + 'T00:00:00').toLocaleDateString('es-PE', {
                weekday: 'long', day: 'numeric', month: 'long'
            });
            const nombrePaciente = (patient && patient.name) ? patient.name.split(' ')[0] : a.patientName.split(' ')[0];
            const especialista = (window._profileState && window._profileState.currentUser)
                ? (JSON.parse(localStorage.getItem('userProfile_' + window._profileState.currentUser.uid) || '{}').displayName || '')
                : '';
            const firma = especialista ? `\n\n— ${especialista}` : '';
            const modalidadTxt = a.modality === 'virtual' ? 'sesión virtual' : 'sesión presencial';
            const mensaje = `Hola ${nombrePaciente} 👋, te recordamos tu ${modalidadTxt} programada para el ${fechaBonita} a las ${a.time}. Por favor confírmanos tu asistencia. ¡Te esperamos!${firma}`;
            window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank');
        };

        // ─── VISTA MENSUAL DE CITAS ────────────────────────────────────────────────
        window.setCitasView = function(view) {
            state.citasView = view;
            const dayView   = document.getElementById('citas-day-view');
            const monthView = document.getElementById('citas-month-view');
            const btnDia    = document.getElementById('btn-view-dia');
            const btnMes    = document.getElementById('btn-view-mes');
            const activeCls   = "px-3 py-1.5 bg-sage-600 text-white text-xs font-semibold rounded-lg shadow-sm transition";
            const inactiveCls = "px-3 py-1.5 bg-graphite-100 hover:bg-graphite-200 text-graphite-600 text-xs font-semibold rounded-lg transition";

            if (view === 'dia') {
                dayView.classList.remove('hidden');
                monthView.classList.add('hidden');
                btnDia.className = activeCls;
                btnMes.className = inactiveCls;
            } else {
                dayView.classList.add('hidden');
                monthView.classList.remove('hidden');
                btnMes.className = activeCls;
                btnDia.className = inactiveCls;
                const df = document.getElementById('date-filter').value || todayStr;
                state.monthViewDate = df.substring(0, 7);
                renderMonthView();
            }
        };

        window.shiftMonth = function(delta) {
            const [y, m] = state.monthViewDate.split('-').map(Number);
            const d = new Date(y, (m - 1) + delta, 1);
            state.monthViewDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            renderMonthView();
        };

        window.jumpToDay = function(dateStr) {
            document.getElementById('date-filter').value = dateStr;
            window.setCitasView('dia');
            window.renderAppointments();
            updateStatsDashboard();
        };

        function renderMonthView() {
            const [y, m] = state.monthViewDate.split('-').map(Number);
            let monthLabel = new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
            monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
            document.getElementById('month-view-label').innerText = monthLabel;

            const monthApps = state.appointments.filter(a => a.date.startsWith(state.monthViewDate));
            document.getElementById('month-view-total').innerText = monthApps.length;
            document.getElementById('month-view-completed').innerText = monthApps.filter(a => a.status === 'completada').length;
            // Solo se suman las citas en soles; las de pacientes extranjeros (USD)
            // no se mezclan en este total para no dar una cifra sin sentido.
            const rev = monthApps.filter(a => a.status === 'completada' && isPenAppt(a)).reduce((s, a) => s + a.cost, 0);
            const revUsd = monthApps.filter(a => a.status === 'completada' && isUsdAppt(a)).reduce((s, a) => s + a.cost, 0);
            document.getElementById('month-view-revenue').innerText = `S/ ${rev.toFixed(2)}` + (revUsd > 0 ? ` (+ $ ${revUsd.toFixed(2)})` : '');

            const byDate = {};
            monthApps.forEach(a => {
                if (!byDate[a.date]) byDate[a.date] = [];
                byDate[a.date].push(a);
            });
            const dates = Object.keys(byDate).sort();

            const container = document.getElementById('month-view-list');
            if (!dates.length) {
                container.innerHTML = `<div class="text-center p-8 bg-white rounded-2xl border border-graphite-100 text-graphite-400 text-sm">No hay citas registradas para este mes.</div>`;
                return;
            }
            container.innerHTML = dates.map(dateStr => {
                const apps = byDate[dateStr].sort((a, b) => a.time.localeCompare(b.time));
                let dayLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
                dayLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
                const rows = apps.map(a => {
                    const badge = a.status === 'completada'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : a.status === 'cancelada'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200';
                    const modalityIcon = a.modality === 'virtual' ? '💻' : '🏢';
                    return `<div class="flex items-center justify-between py-1.5 border-b border-graphite-50 last:border-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-bold text-graphite-600 bg-graphite-100 px-2 py-0.5 rounded-lg">⏰ ${a.time}</span>
                            <span class="text-sm font-semibold text-graphite-700">${modalityIcon} ${a.patientName}</span>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-xl border ${badge}">${a.status.toUpperCase()}</span>
                        </div>
                        <span class="text-xs font-semibold text-graphite-500">${formatApptCostLabel(a)}</span>
                    </div>`;
                }).join('');
                return `<div class="bg-white p-4 rounded-3xl border border-sage-100/70 card-soft">
                    <div class="flex justify-between items-center mb-2 cursor-pointer" onclick="jumpToDay('${dateStr}')">
                        <h4 class="font-bold text-graphite-800 text-sm">📅 ${dayLabel}</h4>
                        <span class="text-xs font-semibold text-sage-600 bg-sage-50 px-2 py-1 rounded-lg">${apps.length} cita${apps.length !== 1 ? 's' : ''} · Ver día ▶</span>
                    </div>
                    <div>${rows}</div>
                </div>`;
            }).join('');
        }
        window.renderMonthView = renderMonthView;

        // Texto de costo a mostrar en listados de citas: si la cita es una sesión
        // de un paquete ya pagado, se aclara en vez de mostrar "S/ 0.00" a secas.
        function formatApptCostLabel(a) {
            const cost = parseFloat(a.cost || 0);
            const sym = currencySymbol(a.currency);
            if (a.packageId && a.rateType && a.rateType !== 'sesion') {
                if (cost > 0) return `${sym} ${cost.toFixed(2)} (pago de paquete)`;
                return `📦 Sesión de paquete (incluida)`;
            }
            return `${sym} ${cost.toFixed(2)}`;
        }
        window.formatApptCostLabel = formatApptCostLabel;

        // Devuelve el HTML con el resumen de paquetes activos/agotados de un paciente,
        // usado tanto en la tarjeta de la lista de pacientes como en el historial.
        function renderPackagesSummary(p) {
            const packages = Array.isArray(p.packages) ? p.packages : [];
            if (!packages.length) return '';
            const attentionLabel = { individual: '👤 Individual', pareja: '👥 Pareja' };
            const rows = packages
                .slice()
                .sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''))
                .map(pk => {
                    const restantes = pk.sessionsTotal - pk.sessionsUsed;
                    const activo = restantes > 0;
                    const pct = Math.min(100, Math.round((pk.sessionsUsed / pk.sessionsTotal) * 100));
                    const badgeClass = activo
                        ? 'bg-sage-50 text-sage-700 border-sage-200'
                        : 'bg-graphite-100 text-graphite-500 border-graphite-200';
                    // Compatibilidad con paquetes antiguos que solo tenían el campo booleano "paid"
                    const hasSplitPayment = pk.firstPaymentStatus !== undefined;
                    const firstStatus  = hasSplitPayment ? pk.firstPaymentStatus  : (pk.paid ? 'pagado' : 'pendiente');
                    const secondStatus = hasSplitPayment ? pk.secondPaymentStatus : (pk.paid ? 'pagado' : 'pendiente');
                    const secondSession = pk.secondPaymentSession || secondPaymentSessionNumber(pk.sessionsTotal);
                    const half = pk.halfPrice || (pk.price / 2);
                    const pkgSym = currencySymbol(pk.currency);
                    const paymentLine = secondSession
                        ? `1er pago (${pkgSym} ${half.toFixed(2)}) ${firstStatus === 'pagado' ? '✅' : '⏳'} · 2do pago sesión ${secondSession} (${pkgSym} ${half.toFixed(2)}) ${secondStatus === 'pagado' ? '✅' : '⏳'}`
                        : `${pkgSym} ${pk.price.toFixed(2)} ${pk.paid ? '✅ pagado' : '⏳ pendiente'}`;
                    return `<div class="border rounded-xl p-2.5 text-xs space-y-1 ${badgeClass}">
                        <div class="flex justify-between items-center">
                            <span class="font-bold">${attentionLabel[pk.attentionType] || pk.attentionType} · Paquete ${pk.sessionsTotal}</span>
                            <span class="flex items-center gap-2">
                                <span class="font-semibold">${activo ? `${pk.sessionsUsed}/${pk.sessionsTotal} usadas` : 'Completado'}</span>
                                <button type="button" title="Eliminar paquete" onclick="window.deletePatientPackage('${p.id}','${pk.id}')" class="text-graphite-400 hover:text-red-600 transition">🗑️</button>
                            </span>
                        </div>
                        <div class="text-[10px] text-graphite-400">Creado: ${pk.purchaseDate || '—'} · ID: ${pk.id}</div>
                        <div class="w-full bg-white/60 rounded-full h-1.5 overflow-hidden border border-white">
                            <div class="h-full bg-sage-500" style="width:${pct}%"></div>
                        </div>
                        <div class="flex justify-between text-[11px]">
                            <span>${activo ? `Restan ${restantes} sesión(es)` : 'Sin sesiones restantes'}</span>
                        </div>
                        <div class="text-[11px]">${paymentLine}</div>
                    </div>`;
                }).join('');
            return `<div class="space-y-1.5"><p class="text-[11px] font-bold uppercase text-graphite-400">📦 Paquetes</p>${rows}</div>`;
        }
        window.renderPackagesSummary = renderPackagesSummary;

        const ORIGEN_LABELS = {
            instagram:   { label: 'Instagram',           icon: '📸' },
            facebook:    { label: 'Facebook',             icon: '👍' },
            tiktok:      { label: 'TikTok',                icon: '🎵' },
            marketplace: { label: 'FB Marketplace',        icon: '🛒' },
            web:         { label: 'Página web',            icon: '🌐' },
            whatsapp:    { label: 'WhatsApp directo',      icon: '💬' },
            calendly:    { label: 'Calendly',              icon: '📅' },
            google:      { label: 'Google',                icon: '🔍' },
            referido:    { label: 'Referido',              icon: '🤝' },
            otro:        { label: 'Otro',                  icon: '❔' }
        };
        const LEAD_STATUS_LABELS = {
            nuevo:         { label: 'Nuevo',         cls: 'bg-graphite-100 text-graphite-600' },
            contactado:    { label: 'Contactado',    cls: 'bg-blue-50 text-blue-600' },
            interesado:    { label: 'Interesado',    cls: 'bg-amber-50 text-amber-600' },
            cita_agendada: { label: 'Cita agendada', cls: 'bg-sage-50 text-sage-600' },
            atendido:      { label: 'Atendido',      cls: 'bg-emerald-50 text-emerald-600' },
            no_asistio:    { label: 'No asistió',    cls: 'bg-red-50 text-red-600' },
            cancelo:       { label: 'Canceló',       cls: 'bg-red-50 text-red-600' },
            recurrente:    { label: 'Recurrente',    cls: 'bg-violet-50 text-violet-600' }
        };

        window.renderPatients = function() {
            const grid      = document.getElementById('patients-grid');
            const searchVal = document.getElementById('patient-search-input').value.toLowerCase().trim();
            let filtered    = state.patients.filter(p =>
                !searchVal || p.name.toLowerCase().includes(searchVal) || p.phone.includes(searchVal)
            );
            filtered.sort((a, b) => a.name.localeCompare(b.name));

            if (!filtered.length) {
                grid.innerHTML = `<p class="text-graphite-400 text-sm col-span-2 text-center py-8">No hay registros de pacientes.</p>`;
                return;
            }
            grid.innerHTML = filtered.map(p => `
                <div class="bg-white p-5 rounded-3xl border border-sage-100/70 card-soft flex flex-col justify-between space-y-3">
                    <div class="space-y-2">
                        <div class="flex justify-between items-start">
                            <h4 class="font-bold text-graphite-800 text-base">${p.name}</h4>
                            <span class="text-xs bg-graphite-100 text-graphite-600 px-2.5 py-1 rounded-xl">📞 ${p.phone}</span>
                        </div>
                        <p class="text-xs text-graphite-500"><strong>Nacimiento:</strong> ${p.birth || 'No especificada'}</p>
                        <div class="flex flex-wrap gap-1.5">
                            <span class="text-xs bg-sage-50 text-sage-600 px-2.5 py-1 rounded-lg font-medium">${(ORIGEN_LABELS[p.origen] || ORIGEN_LABELS.otro).icon} ${(ORIGEN_LABELS[p.origen] || ORIGEN_LABELS.otro).label}</span>
                            ${p.currency === 'USD' ? '<span class="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-medium border border-amber-200">🌎 Extranjero (USD)</span>' : ''}
                            <span class="text-xs px-2.5 py-1 rounded-lg font-medium ${(LEAD_STATUS_LABELS[p.leadStatus] || LEAD_STATUS_LABELS.nuevo).cls}">${(LEAD_STATUS_LABELS[p.leadStatus] || LEAD_STATUS_LABELS.nuevo).label}</span>
                        </div>
                        <p class="text-xs text-graphite-600 bg-graphite-50 p-2.5 rounded-xl border border-graphite-100"><strong>Antecedentes:</strong> ${p.history || 'Sin observaciones históricas.'}</p>
                        ${renderPackagesSummary(p)}
                    </div>
                    <div class="flex justify-end gap-2 border-t pt-2 border-graphite-100 flex-wrap">
                        <button onclick="openPatientHistory('${p.id}')" class="text-graphite-600 text-xs font-semibold px-3 py-1.5 bg-graphite-50 hover:bg-graphite-100 rounded-lg border border-graphite-200 transition">📋 Historial</button>
                        <button onclick="openClinicalHistory('${p.id}')" class="text-sage-600 text-xs font-semibold px-3 py-1.5 bg-sage-50 hover:bg-sage-100 rounded-lg border border-sage-200">🩺 Historia Clínica</button>
                        <button onclick="editPatient('${p.id}')" class="text-sage-600 text-xs font-semibold px-3 py-1.5 hover:underline">✏️ Editar</button>
                        <button onclick="deletePatient('${p.id}')" class="text-red-500 text-xs font-semibold px-3 py-1.5 hover:underline">🗑️ Eliminar</button>
                    </div>
                </div>`).join('');
        };

        function updatePatientDropdowns() {
            const select = document.getElementById('app-patient-select');
            const sortedPatients = state.patients.slice().sort((a, b) =>
                (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })
            );
            select.innerHTML = sortedPatients.length
                ? sortedPatients.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
                : '<option value="">-- No hay pacientes registrados --</option>';
        }

        // ─── HELPERS DE PERIODO PARA FINANZAS ──────────────────────────────────────
        function getWeekRangeStr(refDateStr) {
            // Devuelve [lunesStr, domingoStr] de la semana que contiene refDateStr (o hoy)
            const base = refDateStr ? new Date(refDateStr + 'T00:00:00') : new Date();
            const monday = getMondayOf(base);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            return [horarioDateStr(monday), horarioDateStr(sunday)];
        }

        function getFinanceAppointments() {
            if (state.financePeriod === 'dia') {
                return state.appointments.filter(a => a.date === todayStr);
            } else if (state.financePeriod === 'semana') {
                const [lunes, domingo] = getWeekRangeStr(todayStr);
                return state.appointments.filter(a => a.date >= lunes && a.date <= domingo);
            } else if (state.financePeriod === 'mes') {
                const monthStr = todayStr.substring(0, 7);
                return state.appointments.filter(a => a.date.startsWith(monthStr));
            }
            return state.appointments;
        }

        window.setFinancePeriod = function(period) {
            state.financePeriod = period;
            ['todo', 'mes', 'semana', 'dia'].forEach(p => {
                const btn = document.getElementById('btn-fp-' + p);
                if (!btn) return;
                btn.className = p === period
                    ? "px-3 py-1.5 bg-sage-600 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    : "px-3 py-1.5 bg-graphite-100 hover:bg-graphite-200 text-graphite-600 text-xs font-semibold rounded-lg transition";
            });
            const labels = { todo: 'Todo el tiempo', mes: 'Este mes', semana: 'Esta semana', dia: 'Hoy' };
            const lbl = document.getElementById('finance-period-label');
            if (lbl) lbl.innerText = 'Mostrando datos de: ' + labels[period];
            updateStatsDashboard();
        };

        function updateStatsDashboard() {
            const todayFilter = document.getElementById('date-filter').value;
            const todayApps   = state.appointments.filter(a => a.date === todayFilter);

            document.getElementById('stat-citas-hoy').innerText       = todayApps.length;
            document.getElementById('stat-citas-pendientes').innerText = todayApps.filter(a => a.status === 'pendiente').length;
            document.getElementById('stat-citas-completas').innerText  = todayApps.filter(a => a.status === 'completada').length;
            const ingresosHoy = todayApps.filter(a => a.status === 'completada' && isPenAppt(a)).reduce((s, a) => s + a.cost, 0);
            const ingresosHoyUsd = todayApps.filter(a => a.status === 'completada' && isUsdAppt(a)).reduce((s, a) => s + a.cost, 0);
            document.getElementById('stat-citas-ingresos').innerText   = `S/ ${ingresosHoy.toFixed(2)}` + (ingresosHoyUsd > 0 ? ` (+ $ ${ingresosHoyUsd.toFixed(2)})` : '');

            // ── Sección Finanzas: filtrada por periodo seleccionado (todo / mes / día) ──
            const financeApps = getFinanceAppointments();

            const uniquePatientsInPeriod = state.financePeriod === 'todo'
                ? state.patients.length
                : new Set(financeApps.map(a => a.patientId)).size;

            document.getElementById('stats-total-patients').innerText     = uniquePatientsInPeriod;
            document.getElementById('stats-total-appointments').innerText  = financeApps.length;
            // Ingresos S/ y $ se muestran POR SEPARADO — sumarlos en un solo
            // número no tendría sentido (son monedas distintas).
            const totalRev    = financeApps.filter(a => a.status === 'completada' && isPenAppt(a)).reduce((s, a) => s + a.cost, 0);
            const totalRevUsd = financeApps.filter(a => a.status === 'completada' && isUsdAppt(a)).reduce((s, a) => s + a.cost, 0);
            document.getElementById('stats-revenue-total').innerText       = `S/ ${totalRev.toFixed(2)}`;
            const revUsdEl = document.getElementById('stats-revenue-total-usd');
            if (revUsdEl) revUsdEl.innerText = `$ ${totalRevUsd.toFixed(2)} USD`;

            const penApps = financeApps.filter(isPenAppt);
            const avgCost      = penApps.length ? penApps.reduce((s, a) => s + Number(a.cost || 0), 0) / penApps.length : 0;
            const pendingCobro = penApps.filter(a => a.paymentStatus === 'pendiente').reduce((s, a) => s + Number(a.cost || 0), 0);
            const futureCobro  = penApps.filter(a => a.status === 'pendiente').reduce((s, a) => s + Number(a.cost || 0), 0);

            const usdApps = financeApps.filter(isUsdAppt);
            const pendingCobroUsd = usdApps.filter(a => a.paymentStatus === 'pendiente').reduce((s, a) => s + Number(a.cost || 0), 0);
            const futureCobroUsd  = usdApps.filter(a => a.status === 'pendiente').reduce((s, a) => s + Number(a.cost || 0), 0);

            document.getElementById('finance-average-cost').innerText  = `S/ ${avgCost.toFixed(2)}`;
            document.getElementById('finance-pending-cobro').innerText = `S/ ${pendingCobro.toFixed(2)}` + (pendingCobroUsd > 0 ? ` (+ $ ${pendingCobroUsd.toFixed(2)})` : '');
            document.getElementById('finance-future-cobro').innerText  = `S/ ${futureCobro.toFixed(2)}` + (futureCobroUsd > 0 ? ` (+ $ ${futureCobroUsd.toFixed(2)})` : '');
            // ── Tasa de asistencia: completadas vs. (completadas + canceladas) ──
            const consideradas = financeApps.filter(a => a.status === 'completada' || a.status === 'cancelada');
            const asistenciaRate = consideradas.length
                ? (financeApps.filter(a => a.status === 'completada').length / consideradas.length) * 100
                : 0;
            const attEl = document.getElementById('finance-attendance-rate');
            if (attEl) attEl.innerText = `${asistenciaRate.toFixed(0)}%`;
            const attSubEl = document.getElementById('finance-attendance-sub');
            if (attSubEl) {
                const comp = financeApps.filter(a => a.status === 'completada').length;
                const canc = financeApps.filter(a => a.status === 'cancelada').length;
                attSubEl.innerText = `${comp} asistidas / ${canc} canceladas`;
            }

            renderLeadsBySource(financeApps);
            renderWeeklyBarChart();

            // ── Tarjetas adicionales exclusivas del Dashboard general ──
            const dashPatientsEl = document.getElementById('dash-total-pacientes');
            if (dashPatientsEl) dashPatientsEl.innerText = state.patients.length;

            const monthStr    = todayStr.substring(0, 7);
            const monthApps   = state.appointments.filter(a => a.date.startsWith(monthStr));
            const monthRev    = monthApps.filter(a => a.status === 'completada' && isPenAppt(a)).reduce((s, a) => s + a.cost, 0);
            const monthRevUsd = monthApps.filter(a => a.status === 'completada' && isUsdAppt(a)).reduce((s, a) => s + a.cost, 0);
            const dashIngresosEl = document.getElementById('dash-ingresos-mes');
            if (dashIngresosEl) {
                dashIngresosEl.innerText = `S/ ${monthRev.toFixed(2)}` + (monthRevUsd > 0 ? ` (+ $ ${monthRevUsd.toFixed(2)})` : '');
            }

            const dashCancelEl = document.getElementById('dash-tasa-cancelacion');
            if (dashCancelEl) {
                const consideradasMes = monthApps.filter(a => a.status === 'completada' || a.status === 'cancelada');
                const tasaCancel = consideradasMes.length
                    ? (monthApps.filter(a => a.status === 'cancelada').length / consideradasMes.length) * 100
                    : 0;
                dashCancelEl.innerText = `${tasaCancel.toFixed(0)}%`;
            }

            renderDashboardTodayList();
        }

        // ─── DASHBOARD GENERAL: RESUMEN DEL DÍA (mini-lista de citas de hoy) ───────
        function renderDashboardTodayList() {
            const container = document.getElementById('dashboard-today-list');
            if (!container) return;
            const todayApps = state.appointments
                .filter(a => a.date === todayStr && a.status !== 'cancelada')
                .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            if (!todayApps.length) {
                container.innerHTML = '<p class="text-sm text-graphite-400 text-center py-8">No hay citas programadas para hoy.</p>';
                return;
            }

            const badge = (status) => status === 'completada'
                ? '<span class="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full whitespace-nowrap">Completada</span>'
                : '<span class="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">Pendiente</span>';

            container.innerHTML = todayApps.slice(0, 8).map(a => `
                <div class="flex items-center justify-between gap-3 py-2.5 border-b border-graphite-100 last:border-0">
                    <div class="min-w-0">
                        <p class="text-sm font-semibold text-graphite-800 truncate">${a.patientName}</p>
                        <p class="text-xs text-graphite-400">⏰ ${(a.time || '').slice(0, 5)}</p>
                    </div>
                    ${badge(a.status)}
                </div>`).join('');
        }
        window.renderDashboardTodayList = renderDashboardTodayList;

        // ─── GRÁFICO DE CITAS POR DÍA DE LA SEMANA (semana actual, Lun-Dom) ────────
        // Se pinta en dos posibles ubicaciones: la sección Finanzas (id clásico) y,
        // si existe, una copia dentro del Dashboard general (id con prefijo dash-).
        function renderWeeklyBarChart() {
            const containerIds = ['weekly-chart-svg-wrap', 'dash-weekly-chart-svg-wrap'];
            const labelIds     = ['weekly-chart-range-label', 'dash-weekly-chart-range-label'];
            const anyContainer = containerIds.some(id => document.getElementById(id));
            if (!anyContainer) return;

            const [lunes] = getWeekRangeStr(todayStr);
            const mondayDate = new Date(lunes + 'T00:00:00');
            const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
            const dayData = dayLabels.map((label, i) => {
                const d = new Date(mondayDate);
                d.setDate(d.getDate() + i);
                const dStr = horarioDateStr(d);
                const appsOfDay = state.appointments.filter(a => a.date === dStr);
                return {
                    label,
                    dateStr: dStr,
                    total: appsOfDay.length,
                    completadas: appsOfDay.filter(a => a.status === 'completada').length,
                    canceladas: appsOfDay.filter(a => a.status === 'cancelada').length
                };
            });

            const maxVal = Math.max(1, ...dayData.map(d => d.total));
            const chartH = 140, barW = 28, gap = 22, leftPad = 10, topPad = 10;
            const svgW = leftPad * 2 + dayData.length * (barW + gap);
            const todayIdx = dayData.findIndex(d => d.dateStr === todayStr);

            const bars = dayData.map((d, i) => {
                const x = leftPad + i * (barW + gap);
                const totalH = (d.total / maxVal) * chartH;
                const compH  = d.total ? (d.completadas / d.total) * totalH : 0;
                const y = topPad + (chartH - totalH);
                const isToday = i === todayIdx;
                return `
                    <g>
                        <rect x="${x}" y="${y}" width="${barW}" height="${totalH}" rx="4"
                              fill="${isToday ? '#c7d2fe' : '#e2e8f0'}" />
                        <rect x="${x}" y="${topPad + (chartH - compH)}" width="${barW}" height="${compH}" rx="4"
                              fill="${isToday ? '#4f46e5' : '#6366f1'}" />
                        <text x="${x + barW / 2}" y="${topPad + chartH + 16}" text-anchor="middle"
                              font-size="11" font-weight="${isToday ? '800' : '600'}"
                              fill="${isToday ? '#4338ca' : '#64748b'}">${d.label}</text>
                        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle"
                              font-size="11" font-weight="700" fill="#334155">${d.total || ''}</text>
                    </g>`;
            }).join('');

            const svgHtml = `
                <svg viewBox="0 0 ${svgW} ${chartH + topPad + 26}" width="100%" height="${chartH + topPad + 26}" xmlns="http://www.w3.org/2000/svg">
                    ${bars}
                </svg>`;
            containerIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = svgHtml;
            });

            const totalSemana = dayData.reduce((s, d) => s + d.total, 0);
            const completadasSemana = dayData.reduce((s, d) => s + d.completadas, 0);
            const canceladasSemana = dayData.reduce((s, d) => s + d.canceladas, 0);
            const domingo = new Date(mondayDate); domingo.setDate(domingo.getDate() + 6);
            const fmt = (d) => d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
            const rangeTxt = `Semana del ${fmt(mondayDate)} al ${fmt(domingo)} — ${totalSemana} citas (${completadasSemana} completadas, ${canceladasSemana} canceladas)`;
            labelIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = rangeTxt;
            });
        }
        window.renderWeeklyBarChart = renderWeeklyBarChart;

        // ─── FASE 3: DASHBOARD "LEADS POR ORIGEN" ─────────────────────────────────
        function renderLeadsBySource(financeApps) {
            const tbody = document.getElementById('leads-by-source-body');
            if (!tbody) return;

            // Agrupa citas del periodo por origen del paciente al que pertenecen
            const byOrigen = {};
            Object.keys(ORIGEN_LABELS).forEach(key => {
                byOrigen[key] = { leads: 0, citas: 0, atendidos: 0, ingresos: 0, ingresosUsd: 0 };
            });

            state.patients.forEach(p => {
                const key = ORIGEN_LABELS[p.origen] ? p.origen : 'otro';
                byOrigen[key].leads += 1;
            });

            financeApps.forEach(a => {
                const patient = state.patients.find(p => p.id === a.patientId);
                const key = patient && ORIGEN_LABELS[patient.origen] ? patient.origen : 'otro';
                byOrigen[key].citas += 1;
                if (a.status === 'completada') {
                    byOrigen[key].atendidos += 1;
                    if (isUsdAppt(a)) {
                        byOrigen[key].ingresosUsd += (a.cost || 0);
                    } else {
                        byOrigen[key].ingresos += (a.cost || 0);
                    }
                }
            });

            const rows = Object.entries(byOrigen)
                .filter(([, v]) => v.leads > 0 || v.citas > 0)
                .sort((a, b) => (b[1].ingresos + b[1].ingresosUsd) - (a[1].ingresos + a[1].ingresosUsd));

            if (!rows.length) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-graphite-400 py-4">Aún no hay datos suficientes. Registra el "Origen del contacto" al crear tus pacientes.</td></tr>`;
                return;
            }

            tbody.innerHTML = rows.map(([key, v]) => {
                const conv = v.leads ? ((v.atendidos / v.leads) * 100).toFixed(1) : '0.0';
                const meta = ORIGEN_LABELS[key];
                const ingresosLbl = `S/ ${v.ingresos.toFixed(2)}` + (v.ingresosUsd > 0 ? ` (+ $ ${v.ingresosUsd.toFixed(2)})` : '');
                return `
                    <tr class="border-b border-graphite-50 hover:bg-graphite-50">
                        <td class="py-2 pr-2 font-semibold text-graphite-700">${meta.icon} ${meta.label}</td>
                        <td class="py-2 pr-2 text-center">${v.leads}</td>
                        <td class="py-2 pr-2 text-center">${v.citas}</td>
                        <td class="py-2 pr-2 text-center">${v.atendidos}</td>
                        <td class="py-2 pr-2 text-center">${conv}%</td>
                        <td class="py-2 pr-2 text-right font-semibold text-emerald-600">${ingresosLbl}</td>
                    </tr>`;
            }).join('');
        }

        // ─── IMPRESIÓN ────────────────────────────────────────────────────────────
        window.executeReportPrint = function() {
            const printType = window._printType || 'dia';
            const printCategory = window._printCategory || 'citas';
            if (printCategory === 'finanzas') {
                executeFinanceReportPrint(printType);
            } else if (printCategory === 'recepcion') {
                executeReceptionReportPrint(printType);
            } else {
                executeAppointmentsReportPrint(printType);
            }
        };

        function executeAppointmentsReportPrint(printType) {
            const specialistName = document.getElementById('print-specialist-name').value.trim() || 'Especialista General';
            let reportApps = [];
            let periodLabel = '';
            const isMonth = printType === 'mes';
            const isWeek  = printType === 'semana';

            if (isMonth) {
                const monthVal = document.getElementById('print-month-select').value; // YYYY-MM
                reportApps = state.appointments
                    .filter(a => a.date.startsWith(monthVal))
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
                const [y, m] = monthVal.split('-').map(Number);
                let lbl = new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
                periodLabel = lbl.charAt(0).toUpperCase() + lbl.slice(1);
                document.getElementById('print-title-main').innerText = 'REPORTE MENSUAL DE AGENDA';
                document.getElementById('print-head-date-label').innerText = 'PERIODO';
            } else if (isWeek) {
                const refDate = document.getElementById('print-date-select').value;
                const [lunes, domingo] = getWeekRangeStr(refDate);
                reportApps = state.appointments
                    .filter(a => a.date >= lunes && a.date <= domingo)
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
                const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
                periodLabel = `Semana del ${fmt(lunes)} al ${fmt(domingo)}`;
                document.getElementById('print-title-main').innerText = 'REPORTE SEMANAL DE AGENDA';
                document.getElementById('print-head-date-label').innerText = 'PERIODO';
            } else {
                const targetDate = document.getElementById('print-date-select').value;
                reportApps = state.appointments.filter(a => a.date === targetDate).sort((a, b) => a.time.localeCompare(b.time));
                periodLabel = new Date(targetDate + 'T00:00:00')
                    .toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
                document.getElementById('print-title-main').innerText = 'REPORTE DIARIO DE AGENDA';
                document.getElementById('print-head-date-label').innerText = 'FECHA';
            }

            document.getElementById('print-head-specialist').innerText = specialistName;
            document.getElementById('print-foot-specialist').innerText = specialistName;
            document.getElementById('print-head-date').innerText = periodLabel;

            const completas  = reportApps.filter(a => a.status === 'completada').length;
            const recaudado  = reportApps.filter(a => a.status === 'completada' && isPenAppt(a)).reduce((s, a) => s + a.cost, 0);
            const recaudadoUsd = reportApps.filter(a => a.status === 'completada' && isUsdAppt(a)).reduce((s, a) => s + a.cost, 0);
            document.getElementById('print-stat-total').innerText     = reportApps.length;
            document.getElementById('print-stat-completed').innerText = completas;
            document.getElementById('print-stat-revenue').innerText   = `S/ ${recaudado.toFixed(2)}` + (recaudadoUsd > 0 ? ` (+ $ ${recaudadoUsd.toFixed(2)})` : '');

            const dateHeader = document.getElementById('print-date-column-header');
            const tbody = document.getElementById('print-table-rows');

            const modalityLabel = (a) => a.modality === 'virtual' ? '💻 Virtual' : '🏢 Presencial';

            if (isMonth || isWeek) {
                dateHeader.classList.remove('hidden');
                tbody.innerHTML = reportApps.length
                    ? reportApps.map(a => `
                        <tr class="border-b">
                            <td class="py-2.5 px-2 font-bold whitespace-nowrap">${a.date}</td>
                            <td class="py-2.5 px-2 font-bold">${a.time}</td>
                            <td class="py-2.5 px-2">${modalityLabel(a)}</td>
                            <td class="py-2.5 px-2 font-semibold">${a.patientName}</td>
                            <td class="py-2.5 px-2">${formatApptCostLabel(a)} (${a.paymentStatus.toUpperCase()})</td>
                            <td class="py-2.5 px-2 font-medium">${a.status.toUpperCase()}</td>
                            <td class="py-2.5 px-2 text-graphite-600">${a.notes || 'Sin observaciones.'}</td>
                        </tr>`).join('')
                    : `<tr><td colspan="7" class="py-4 text-center text-graphite-400">No hay consultas agendadas para este periodo.</td></tr>`;
            } else {
                dateHeader.classList.add('hidden');
                tbody.innerHTML = reportApps.length
                    ? reportApps.map(a => `
                        <tr class="border-b">
                            <td class="py-2.5 px-2 font-bold">${a.time}</td>
                            <td class="py-2.5 px-2">${modalityLabel(a)}</td>
                            <td class="py-2.5 px-2 font-semibold">${a.patientName}</td>
                            <td class="py-2.5 px-2">${formatApptCostLabel(a)} (${a.paymentStatus.toUpperCase()})</td>
                            <td class="py-2.5 px-2 font-medium">${a.status.toUpperCase()}</td>
                            <td class="py-2.5 px-2 text-graphite-600">${a.notes || 'Sin observaciones.'}</td>
                        </tr>`).join('')
                    : `<tr><td colspan="6" class="py-4 text-center text-graphite-400">No hay consultas agendadas para esta fecha.</td></tr>`;
            }

            // Asegurar que sólo se muestre la plantilla de citas
            document.getElementById('print-section').classList.remove('hidden');
            document.getElementById('print-section-finance').classList.add('hidden');
            document.getElementById('print-section-reception').classList.add('hidden');

            closePrintModal();
            setTimeout(() => window.print(), 300);
        }

        // ─── REPORTE FINANCIERO (solo montos por fecha, sin datos clínicos) ───────
        function executeFinanceReportPrint(printType) {
            const specialistName = document.getElementById('print-specialist-name').value.trim() || 'Especialista General';
            let reportApps = [];
            let periodLabel = '';
            const isMonth = printType === 'mes';
            const isWeek  = printType === 'semana';

            if (isMonth) {
                const monthVal = document.getElementById('print-month-select').value; // YYYY-MM
                reportApps = state.appointments.filter(a => a.date.startsWith(monthVal));
                const [y, m] = monthVal.split('-').map(Number);
                let lbl = new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
                periodLabel = lbl.charAt(0).toUpperCase() + lbl.slice(1);
                document.getElementById('pf-title-main').innerText = 'REPORTE FINANCIERO MENSUAL';
                document.getElementById('pf-head-date-label').innerText = 'PERIODO';
            } else if (isWeek) {
                const refDate = document.getElementById('print-date-select').value;
                const [lunes, domingo] = getWeekRangeStr(refDate);
                reportApps = state.appointments.filter(a => a.date >= lunes && a.date <= domingo);
                const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
                periodLabel = `Semana del ${fmt(lunes)} al ${fmt(domingo)}`;
                document.getElementById('pf-title-main').innerText = 'REPORTE FINANCIERO SEMANAL';
                document.getElementById('pf-head-date-label').innerText = 'PERIODO';
            } else {
                const targetDate = document.getElementById('print-date-select').value;
                reportApps = state.appointments.filter(a => a.date === targetDate);
                periodLabel = new Date(targetDate + 'T00:00:00')
                    .toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
                document.getElementById('pf-title-main').innerText = 'REPORTE FINANCIERO DIARIO';
                document.getElementById('pf-head-date-label').innerText = 'FECHA';
            }

            document.getElementById('pf-head-specialist').innerText = specialistName;
            document.getElementById('pf-foot-specialist').innerText = specialistName;
            document.getElementById('pf-head-date').innerText = periodLabel;

            // Agrupar por fecha: sólo montos, sin nombres de pacientes ni notas clínicas
            const byDate = {};
            reportApps.forEach(a => {
                if (!byDate[a.date]) {
                    byDate[a.date] = { total: 0, completadas: 0, recaudado: 0, pendiente: 0, recaudadoUsd: 0, pendienteUsd: 0 };
                }
                byDate[a.date].total++;
                const usd = isUsdAppt(a);
                if (a.status === 'completada') {
                    byDate[a.date].completadas++;
                    if (usd) byDate[a.date].recaudadoUsd += a.cost; else byDate[a.date].recaudado += a.cost;
                }
                if (a.paymentStatus === 'pendiente') {
                    if (usd) byDate[a.date].pendienteUsd += a.cost; else byDate[a.date].pendiente += a.cost;
                }
            });
            const dates = Object.keys(byDate).sort();

            const totalCitas       = reportApps.length;
            const totalCompletadas = reportApps.filter(a => a.status === 'completada').length;
            const totalRecaudado   = reportApps.filter(a => a.status === 'completada' && isPenAppt(a)).reduce((s, a) => s + a.cost, 0);
            const totalRecaudadoUsd = reportApps.filter(a => a.status === 'completada' && isUsdAppt(a)).reduce((s, a) => s + a.cost, 0);
            const totalPendiente   = reportApps.filter(a => a.paymentStatus === 'pendiente' && isPenAppt(a)).reduce((s, a) => s + a.cost, 0);
            const totalPendienteUsd = reportApps.filter(a => a.paymentStatus === 'pendiente' && isUsdAppt(a)).reduce((s, a) => s + a.cost, 0);

            document.getElementById('pf-stat-total').innerText     = totalCitas;
            document.getElementById('pf-stat-completed').innerText = totalCompletadas;
            document.getElementById('pf-stat-revenue').innerText   = `S/ ${totalRecaudado.toFixed(2)}` + (totalRecaudadoUsd > 0 ? ` (+ $ ${totalRecaudadoUsd.toFixed(2)})` : '');
            document.getElementById('pf-stat-pending').innerText   = `S/ ${totalPendiente.toFixed(2)}` + (totalPendienteUsd > 0 ? ` (+ $ ${totalPendienteUsd.toFixed(2)})` : '');

            document.getElementById('pf-total-citas').innerText       = totalCitas;
            document.getElementById('pf-total-completadas').innerText = totalCompletadas;
            document.getElementById('pf-total-recaudado').innerText   = `S/ ${totalRecaudado.toFixed(2)}` + (totalRecaudadoUsd > 0 ? ` (+ $ ${totalRecaudadoUsd.toFixed(2)})` : '');
            document.getElementById('pf-total-pendiente').innerText   = `S/ ${totalPendiente.toFixed(2)}` + (totalPendienteUsd > 0 ? ` (+ $ ${totalPendienteUsd.toFixed(2)})` : '');

            const tbody = document.getElementById('pf-table-rows');
            tbody.innerHTML = dates.length
                ? dates.map(dateStr => {
                    const d = byDate[dateStr];
                    const recaudadoLbl = `S/ ${d.recaudado.toFixed(2)}` + (d.recaudadoUsd > 0 ? ` (+ $ ${d.recaudadoUsd.toFixed(2)})` : '');
                    const pendienteLbl = `S/ ${d.pendiente.toFixed(2)}` + (d.pendienteUsd > 0 ? ` (+ $ ${d.pendienteUsd.toFixed(2)})` : '');
                    return `<tr class="border-b">
                        <td class="py-2.5 px-2 font-bold whitespace-nowrap">${dateStr}</td>
                        <td class="py-2.5 px-2">${d.total}</td>
                        <td class="py-2.5 px-2">${d.completadas}</td>
                        <td class="py-2.5 px-2 font-semibold">${recaudadoLbl}</td>
                        <td class="py-2.5 px-2 font-semibold text-amber-700">${pendienteLbl}</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="5" class="py-4 text-center text-graphite-400">No hay datos financieros para este periodo.</td></tr>`;

            // Asegurar que sólo se muestre la plantilla financiera
            document.getElementById('print-section').classList.add('hidden');
            document.getElementById('print-section-finance').classList.remove('hidden');
            document.getElementById('print-section-reception').classList.add('hidden');

            closePrintModal();
            setTimeout(() => window.print(), 300);
        }

        // ─── REPORTE PARA RECEPCIÓN (lista simple: hora, paciente, modalidad) ──────
        function executeReceptionReportPrint(printType) {
            const specialistName = document.getElementById('print-specialist-name').value.trim() || 'Especialista General';
            const onlyPresencial = document.getElementById('print-only-presencial')
                ? document.getElementById('print-only-presencial').checked
                : false;
            let reportApps = [];
            let periodLabel = '';
            const isMonth = printType === 'mes';
            const isWeek  = printType === 'semana';

            if (isMonth) {
                const monthVal = document.getElementById('print-month-select').value; // YYYY-MM
                reportApps = state.appointments
                    .filter(a => a.date.startsWith(monthVal))
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
                const [y, m] = monthVal.split('-').map(Number);
                let lbl = new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
                periodLabel = lbl.charAt(0).toUpperCase() + lbl.slice(1);
                document.getElementById('pr-title-main').innerText = 'LISTA DE CITAS DEL MES';
                document.getElementById('pr-head-date-label').innerText = 'PERIODO';
            } else if (isWeek) {
                const refDate = document.getElementById('print-date-select').value;
                const [lunes, domingo] = getWeekRangeStr(refDate);
                reportApps = state.appointments
                    .filter(a => a.date >= lunes && a.date <= domingo)
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
                const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
                periodLabel = `Semana del ${fmt(lunes)} al ${fmt(domingo)}`;
                document.getElementById('pr-title-main').innerText = 'LISTA DE CITAS DE LA SEMANA';
                document.getElementById('pr-head-date-label').innerText = 'PERIODO';
            } else {
                const targetDate = document.getElementById('print-date-select').value;
                reportApps = state.appointments.filter(a => a.date === targetDate).sort((a, b) => a.time.localeCompare(b.time));
                periodLabel = new Date(targetDate + 'T00:00:00')
                    .toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
                document.getElementById('pr-title-main').innerText = 'LISTA DE CITAS DEL DÍA';
                document.getElementById('pr-head-date-label').innerText = 'FECHA';
            }

            if (onlyPresencial) {
                reportApps = reportApps.filter(a => a.modality !== 'virtual');
            }

            document.getElementById('pr-head-specialist').innerText = specialistName;
            document.getElementById('pr-head-date').innerText = periodLabel;
            document.getElementById('pr-stat-total').innerText = reportApps.length;

            const dateHeader = document.getElementById('pr-date-column-header');
            const tbody = document.getElementById('pr-table-rows');
            const modalityLabel = (a) => a.modality === 'virtual' ? '💻 Virtual' : '🏢 Presencial';

            if (isMonth || isWeek) {
                dateHeader.classList.remove('hidden');
                tbody.innerHTML = reportApps.length
                    ? reportApps.map(a => `
                        <tr class="border-b">
                            <td class="py-2.5 px-2 font-bold whitespace-nowrap">${a.date}</td>
                            <td class="py-2.5 px-2 font-bold">${a.time}</td>
                            <td class="py-2.5 px-2 font-semibold">${a.patientName}</td>
                            <td class="py-2.5 px-2">${modalityLabel(a)}</td>
                            <td class="py-2.5 px-2"></td>
                        </tr>`).join('')
                    : `<tr><td colspan="5" class="py-4 text-center text-graphite-400">No hay consultas agendadas para este periodo.</td></tr>`;
            } else {
                dateHeader.classList.add('hidden');
                tbody.innerHTML = reportApps.length
                    ? reportApps.map(a => `
                        <tr class="border-b">
                            <td class="py-2.5 px-2 font-bold">${a.time}</td>
                            <td class="py-2.5 px-2 font-semibold">${a.patientName}</td>
                            <td class="py-2.5 px-2">${modalityLabel(a)}</td>
                            <td class="py-2.5 px-2"></td>
                        </tr>`).join('')
                    : `<tr><td colspan="4" class="py-4 text-center text-graphite-400">No hay consultas agendadas para esta fecha.</td></tr>`;
            }

            // Asegurar que sólo se muestre la plantilla de recepción
            document.getElementById('print-section').classList.add('hidden');
            document.getElementById('print-section-finance').classList.add('hidden');
            document.getElementById('print-section-reception').classList.remove('hidden');

            closePrintModal();
            setTimeout(() => window.print(), 300);
        }

        // Enlace de filtro de estado al estado interno del módulo
        // (evita el complejo puente de eventos del código original)
        document.body.addEventListener('filter-status-changed', (e) => {
            state.filterStatus = e.detail;
            renderAppointments();
        });

        // ─── HISTORIAL DE PACIENTE ────────────────────────────────────────────────
        window._currentHistoryPatientId = null;

        window.openPatientHistory = function(pid) {
            const p = state.patients.find(p => p.id === pid);
            if (!p) return;
            window._currentHistoryPatientId = pid;

            // Calcular edad
            let ageStr = 'No especificada';
            if (p.birth) {
                const born = new Date(p.birth + 'T00:00:00');
                const today = new Date();
                let age = today.getFullYear() - born.getFullYear();
                const m = today.getMonth() - born.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
                ageStr = age + ' años';
            }

            document.getElementById('hist-modal-title').innerText = '📋 Historial — ' + p.name;
            document.getElementById('hist-modal-subtitle').innerText = '📞 ' + p.phone + (p.birth ? '  •  🎂 ' + p.birth + ' (' + ageStr + ')' : '');

            document.getElementById('hist-patient-info').innerHTML = `
                <div><span class="font-bold text-graphite-500 text-xs uppercase block mb-0.5">Nombre</span><span class="font-semibold">${p.name}</span></div>
                <div><span class="font-bold text-graphite-500 text-xs uppercase block mb-0.5">Teléfono</span><span>${p.phone}</span></div>
                <div><span class="font-bold text-graphite-500 text-xs uppercase block mb-0.5">Nacimiento</span><span>${p.birth || '—'}</span></div>
                <div><span class="font-bold text-graphite-500 text-xs uppercase block mb-0.5">Edad</span><span>${ageStr}</span></div>
            `;
            document.getElementById('hist-patient-history').innerText = p.history || 'Sin antecedentes registrados.';

            const pkgsHtml = renderPackagesSummary(p);
            document.getElementById('hist-patient-packages').innerHTML = pkgsHtml
                ? pkgsHtml
                : '<p class="text-sm text-graphite-400 text-center py-3">Este paciente no tiene paquetes registrados.</p>';

            // Citas del paciente ordenadas por fecha desc
            const appts = state.appointments
                .filter(a => a.patientId === pid)
                .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

            document.getElementById('hist-count').innerText = appts.length;

            if (!appts.length) {
                document.getElementById('hist-appointments-list').innerHTML =
                    '<p class="text-sm text-graphite-400 text-center py-4">No hay citas registradas para este paciente.</p>';
            } else {
                document.getElementById('hist-appointments-list').innerHTML = appts.map(a => {
                    const badge = a.status === 'completada'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : a.status === 'cancelada'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200';
                    const payBadge = a.paymentStatus === 'pagado'
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                        : 'text-amber-600 bg-amber-50 border-amber-200';
                    const modalityBadge = a.modality === 'virtual'
                        ? '<span class="text-xs font-semibold px-2 py-0.5 rounded-xl border bg-sky-50 text-sky-700 border-sky-200">💻 Virtual</span>'
                        : '<span class="text-xs font-semibold px-2 py-0.5 rounded-xl border bg-graphite-100 text-graphite-600 border-graphite-200">🏢 Presencial</span>';
                    return `<div class="bg-graphite-50 border border-graphite-200 rounded-xl p-3 space-y-1">
                        <div class="flex flex-wrap gap-2 items-center">
                            <span class="text-xs font-bold text-graphite-700">📅 ${a.date}</span>
                            <span class="text-xs font-semibold text-graphite-600 bg-graphite-200 px-2 py-0.5 rounded-lg">⏰ ${a.time}</span>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-xl border ${badge}">${a.status.toUpperCase()}</span>
                            ${modalityBadge}
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-xl border ${payBadge}">${a.paymentStatus === 'pagado' ? '💳 Pagado' : '⏳ Pendiente'} — ${formatApptCostLabel(a)}</span>
                        </div>
                        ${a.notes ? `<p class="text-xs text-graphite-500 italic">"${a.notes}"</p>` : ''}
                    </div>`;
                }).join('');
            }

            const m = document.getElementById('patient-history-modal');
            m.classList.remove('hidden'); m.classList.add('flex');
        };

        window.closeHistoryModal = function() {
            const m = document.getElementById('patient-history-modal');
            m.classList.add('hidden'); m.classList.remove('flex');
            window._currentHistoryPatientId = null;
        };

        window.printPatientCard = function() {
            const pid = window._currentHistoryPatientId;
            if (!pid) return;
            const p = state.patients.find(p => p.id === pid);
            if (!p) return;

            // Especialista desde perfil
            const user = window._profileState && window._profileState.currentUser;
            let specialistName = 'Especialista';
            if (user) {
                const saved = JSON.parse(localStorage.getItem('userProfile_' + user.uid) || '{}');
                specialistName = saved.displayName || user.email.split('@')[0];
            }

            // Calcular edad
            let ageStr = '—';
            if (p.birth) {
                const born = new Date(p.birth + 'T00:00:00');
                const today = new Date();
                let age = today.getFullYear() - born.getFullYear();
                const m2 = today.getMonth() - born.getMonth();
                if (m2 < 0 || (m2 === 0 && today.getDate() < born.getDate())) age--;
                ageStr = age + ' años';
            }

            document.getElementById('print-card-specialist').innerText = specialistName;
            document.getElementById('print-card-specialist-foot').innerText = specialistName;
            document.getElementById('print-card-date').innerText = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
            document.getElementById('print-card-name').innerText  = p.name;
            document.getElementById('print-card-phone').innerText = p.phone;
            document.getElementById('print-card-birth').innerText = p.birth || '—';
            document.getElementById('print-card-age').innerText   = ageStr;
            document.getElementById('print-card-history').innerText = p.history || 'Sin antecedentes registrados.';

            const appts = state.appointments
                .filter(a => a.patientId === pid)
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

            const tbody = document.getElementById('print-card-appointments');
            tbody.innerHTML = appts.length
                ? appts.map(a => `
                    <tr class="border-b">
                        <td class="py-1.5 px-2 font-semibold">${a.date}</td>
                        <td class="py-1.5 px-2">${a.time}</td>
                        <td class="py-1.5 px-2">${a.modality === 'virtual' ? '💻 Virtual' : '🏢 Presencial'}</td>
                        <td class="py-1.5 px-2 font-medium">${a.status.toUpperCase()}</td>
                        <td class="py-1.5 px-2">${a.paymentStatus.toUpperCase()}</td>
                        <td class="py-1.5 px-2">${formatApptCostLabel(a)}</td>
                        <td class="py-1.5 px-2 text-graphite-500">${a.notes || '—'}</td>
                    </tr>`).join('')
                : `<tr><td colspan="7" class="py-3 text-center text-graphite-400">Sin citas registradas.</td></tr>`;

            // Ocultar el modal de historial para la impresión y mostrar solo la ficha
            const histModal = document.getElementById('patient-history-modal');
            const cardSection = document.getElementById('print-patient-card');
            const reportSection = document.getElementById('print-section');
            histModal.classList.add('hidden');
            cardSection.classList.remove('hidden');
            reportSection.classList.add('hidden');
            setTimeout(() => {
                window.print();
                histModal.classList.remove('hidden');
                histModal.classList.add('flex');
                cardSection.classList.add('hidden');
                reportSection.classList.remove('hidden');
            }, 300);
        };

        // ─── HORARIO SEMANAL (Modal "Revisar Horario") ─────────────────────────────
        const HORARIO_SLOTS = ['10:00','11:00','12:00','16:00','17:00','18:00','19:00'];
        const HORARIO_DAYS  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

        function getMondayOf(d) {
            const date = new Date(d);
            const day = date.getDay(); // 0 = domingo
            const diff = day === 0 ? -6 : 1 - day;
            date.setDate(date.getDate() + diff);
            date.setHours(0, 0, 0, 0);
            return date;
        }
        function horarioDateStr(d) {
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }

        window.openHorarioModal = function () {
            const baseDateStr = document.getElementById('date-filter') ? document.getElementById('date-filter').value : '';
            const baseDate = baseDateStr ? new Date(baseDateStr + 'T00:00:00') : new Date();
            state.horarioWeekStart = getMondayOf(baseDate);
            document.getElementById('modal-horario').classList.remove('hidden');
            actualizarGridHorarios();
        };

        window.goToCurrentHorarioWeek = function () {
            state.horarioWeekStart = getMondayOf(new Date());
            actualizarGridHorarios();
        };

        window.shiftHorarioWeek = function (dir) {
            const d = new Date(state.horarioWeekStart || getMondayOf(new Date()));
            d.setDate(d.getDate() + dir * 7);
            state.horarioWeekStart = d;
            actualizarGridHorarios();
        };

        window.actualizarGridHorarios = function () {
            const container = document.getElementById('schedule-occupancy-grid');
            if (!container) return;
            if (!state.horarioWeekStart) state.horarioWeekStart = getMondayOf(new Date());
            const weekStart = state.horarioWeekStart;

            const dayDates = HORARIO_DAYS.map((_, i) => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                return d;
            });

            const first = dayDates[0], last = dayDates[dayDates.length - 1];
            const mesLbl = last.toLocaleDateString('es-PE', { month: 'long' });
            const rangeEl = document.getElementById('horario-week-range');
            if (rangeEl) {
                rangeEl.innerText = `Del ${first.getDate()} al ${last.getDate()} de ${mesLbl.charAt(0).toUpperCase() + mesLbl.slice(1)}`;
            }

            const todayStr = horarioDateStr(new Date());
            const appts = (state.appointments || []).filter(a => a.status !== 'cancelada');

            let html = `<div class="grid gap-1.5" style="grid-template-columns: 110px repeat(${HORARIO_DAYS.length}, minmax(90px,1fr));">`;

            // Fila de cabecera con los días
            html += `<div></div>`;
            dayDates.forEach((d, i) => {
                const isToday = horarioDateStr(d) === todayStr;
                html += `<div class="text-center py-2.5 rounded-xl font-extrabold text-[11px] uppercase tracking-wide ${isToday ? 'bg-sage-600 text-white' : 'bg-clay-200 text-graphite-700'}">
                            ${HORARIO_DAYS[i]}<br><span class="font-medium opacity-80 normal-case">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</span>
                         </div>`;
            });

            // Filas por franja horaria
            HORARIO_SLOTS.forEach(slot => {
                const [h, m] = slot.split(':').map(Number);
                const endLabel = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                html += `<div class="flex items-center justify-center text-center px-1.5 py-2.5 rounded-xl bg-clay-100 font-extrabold text-[11px] text-graphite-600">${slot} - ${endLabel}</div>`;

                dayDates.forEach((d, dayIdx) => {
                    const dateStr = horarioDateStr(d);
                    const isSabado = HORARIO_DAYS[dayIdx] === 'Sábado';
                    const isTardeNoche = ['16:00', '17:00', '18:00', '19:00'].includes(slot);
                    const bloqueadoPorDefecto = isSabado && isTardeNoche;
                    const occupied = bloqueadoPorDefecto || appts.some(a => a.date === dateStr && a.time && a.time.slice(0, 5) === slot);
                    html += occupied
                        ? `<div class="flex items-center justify-center py-2.5 rounded-xl bg-rose-300 text-rose-800 font-extrabold text-[11px] uppercase tracking-wide">Ocupado</div>`
                        : `<div class="flex items-center justify-center py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-extrabold text-[11px] uppercase tracking-wide">Libre</div>`;
                });
            });

            html += `</div>`;
            container.innerHTML = html;
        };

        window.downloadHorarioImage = async function () {
            const btn = document.getElementById('btn-descargar-horario');
            const area = document.getElementById('horario-capture-area');
            const scrollWrap = document.getElementById('horario-scroll-wrap');
            if (!area || typeof html2canvas === 'undefined') {
                alert('No se pudo generar la imagen. Revisa tu conexión a internet e inténtalo de nuevo.');
                return;
            }
            const originalLabel = btn ? btn.innerHTML : '';
            if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Generando...'; }

            // Guardamos los estilos originales para poder revertirlos después
            const prevAreaWidth = area.style.width;
            const prevAreaMaxWidth = area.style.maxWidth;
            const prevWrapOverflow = scrollWrap ? scrollWrap.style.overflow : '';
            const prevWrapWidth = scrollWrap ? scrollWrap.style.width : '';

            try {
                // Quitamos temporalmente el recorte/scroll horizontal para que
                // html2canvas capture el ancho COMPLETO de la tabla, no solo
                // la parte visible en pantalla (importante en celulares).
                if (scrollWrap) {
                    scrollWrap.style.overflow = 'visible';
                    scrollWrap.style.width = 'max-content';
                }
                area.style.width = 'max-content';
                area.style.maxWidth = 'none';
                // Forzamos un reflow para que los estilos se apliquen antes de capturar
                void area.offsetWidth;

                const canvas = await html2canvas(area, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    windowWidth: area.scrollWidth,
                    width: area.scrollWidth,
                    height: area.scrollHeight
                });
                const weekStart = state.horarioWeekStart || getMondayOf(new Date());
                const fileDate = horarioDateStr(weekStart);
                const link = document.createElement('a');
                link.download = `horario-semanal-${fileDate}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (err) {
                console.error(err);
                alert('Ocurrió un error al generar la imagen del horario.');
            } finally {
                // Restauramos los estilos originales (scroll horizontal en móvil)
                if (scrollWrap) {
                    scrollWrap.style.overflow = prevWrapOverflow;
                    scrollWrap.style.width = prevWrapWidth;
                }
                area.style.width = prevAreaWidth;
                area.style.maxWidth = prevAreaMaxWidth;
                if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }
            }
        };
