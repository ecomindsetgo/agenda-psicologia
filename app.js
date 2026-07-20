import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// ─── CONTROL DE INTERFAZ Y EVENT LISTENERS LIMPIOS ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // 1. Gestión de Pestañas (Tabs)
    const tabs = ['citas', 'pacientes', 'finanzas'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        if (btn) {
            btn.addEventListener('click', () => switchTab(tab));
        }
    });

    // 2. Botón de Login
    const loginBtn = document.getElementById('auth-submit-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    // 3. Botón de Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("¿Seguro que deseas cerrar sesión?")) {
                signOut(auth);
            }
        });
    }
});

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
}

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

// ─── OBSERVER DE SESIÓN ───────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('flex');
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('flex');
    }
});