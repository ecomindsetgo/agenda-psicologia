        const PAGE_TITLES = {
            citas:     { title: 'Panel de Control',          eyebrow: 'Citas de Hoy' },
            pacientes: { title: 'Pacientes',                  eyebrow: 'Directorio Clínico' },
            finanzas:  { title: 'Estadísticas y Finanzas',    eyebrow: 'Análisis del Consultorio' }
        };
        const SIDEBAR_TAB_INACTIVE = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/90 hover:bg-white/10 font-medium text-sm transition-all tab-transition";
        const SIDEBAR_TAB_ACTIVE   = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white text-sage-700 font-semibold text-sm shadow-md transition-all tab-transition";

        function switchTab(target) {
            ['citas','pacientes','finanzas'].forEach(t => {
                document.getElementById('sec-' + t).classList.add('hidden');
                document.getElementById('tab-' + t).className = SIDEBAR_TAB_INACTIVE;
            });
            document.getElementById('sec-' + target).classList.remove('hidden');
            document.getElementById('tab-' + target).className = SIDEBAR_TAB_ACTIVE;

            const info = PAGE_TITLES[target];
            if (info) {
                const titleEl = document.getElementById('page-title');
                const eyebrowEl = document.getElementById('page-title-eyebrow');
                if (titleEl)   titleEl.innerText = info.title;
                if (eyebrowEl) eyebrowEl.innerText = info.eyebrow;
            }
            if (window.innerWidth < 768) closeSidebar();
        }

        function openSidebar() {
            document.getElementById('sidebar').classList.remove('-translate-x-full');
            document.getElementById('sidebar-overlay').classList.remove('hidden');
        }
        function closeSidebar() {
            document.getElementById('sidebar').classList.add('-translate-x-full');
            document.getElementById('sidebar-overlay').classList.add('hidden');
        }
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('-translate-x-full')) { openSidebar(); } else { closeSidebar(); }
        }

        function setFilterStatus(status) {
            ['todas','pendiente','completada','cancelada'].forEach(st => {
                document.getElementById('btn-f-' + st).className = st === status
                    ? "px-3 py-1 bg-sage-600 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    : "px-3 py-1 bg-graphite-100 hover:bg-graphite-200 text-graphite-600 text-xs font-semibold rounded-lg transition";
            });
            // Puente limpio hacia el scope del módulo
            document.body.dispatchEvent(new CustomEvent('filter-status-changed', { detail: status }));
        }

        function shiftDate(days) {
            const input = document.getElementById('date-filter');
            const d = new Date(input.value + 'T00:00:00');
            d.setDate(d.getDate() + days);
            input.value = d.toISOString().split('T')[0];
            window.renderAppointments();
        }

        function goToToday() {
            document.getElementById('date-filter').value = new Date().toISOString().split('T')[0];
            window.renderAppointments();
        }

        function toggleFloatingMenu() {
            const menu    = document.getElementById('fab-menu');
            const mainBtn = document.getElementById('btn-fab-main');
            if (menu.classList.contains('hidden')) {
                menu.classList.remove('hidden');
                setTimeout(() => { menu.classList.remove('scale-95','opacity-0'); menu.classList.add('scale-100','opacity-100'); mainBtn.classList.add('rotate-45','bg-graphite-700'); }, 10);
            } else {
                menu.classList.remove('scale-100','opacity-100');
                menu.classList.add('scale-95','opacity-0');
                mainBtn.classList.remove('rotate-45','bg-graphite-700');
                setTimeout(() => menu.classList.add('hidden'), 200);
            }
        }

        function openAppointmentModal(editMode) {
            if (!editMode) {
                document.getElementById('appointment-form').reset();
                document.getElementById('app-id').value = '';
                document.getElementById('app-modal-title').innerText = "🗓️ Programar Nueva Cita";
                document.getElementById('app-date').value = document.getElementById('date-filter').value;
                document.getElementById('app-modality-presencial').checked = true;
                document.getElementById('app-attention-individual').checked = true;
                document.getElementById('app-rate-type').value = 'sesion';
                document.getElementById('app-payment').disabled = false;
                document.getElementById('app-package-consumed').value = '';
                updateAppointmentPricing();
            }
            const m = document.getElementById('appointment-modal');
            m.classList.remove('hidden'); m.classList.add('flex');
        }
        function closeAppointmentModal() {
            const m = document.getElementById('appointment-modal');
            m.classList.add('hidden'); m.classList.remove('flex');
        }

        function openPatientModal(editMode) {
            if (!editMode) {
                document.getElementById('patient-form').reset();
                document.getElementById('patient-id').value = '';
                document.getElementById('patient-modal-title').innerText = "👤 Registrar Paciente Clínico";
            }
            const m = document.getElementById('patient-modal');
            m.classList.remove('hidden'); m.classList.add('flex');
        }
        function closePatientModal() {
            const m = document.getElementById('patient-modal');
            m.classList.add('hidden'); m.classList.remove('flex');
        }

        function switchToNewPatientFromAppoint() {
            closeAppointmentModal();
            setTimeout(() => openPatientModal(), 200);
        }

        function setPrintCategory(category) {
            window._printCategory = category;
            const activeCls   = "flex-1 px-3 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg transition";
            const inactiveCls = "flex-1 px-3 py-2 bg-graphite-100 hover:bg-graphite-200 text-graphite-600 text-xs font-semibold rounded-lg transition";
            document.getElementById('btn-pc-citas').className    = category === 'citas'    ? activeCls : inactiveCls;
            document.getElementById('btn-pc-finanzas').className = category === 'finanzas' ? activeCls : inactiveCls;
        }

        function setPrintType(type) {
            window._printType = type;
            const activeCls   = "flex-1 px-3 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg transition";
            const inactiveCls = "flex-1 px-3 py-2 bg-graphite-100 hover:bg-graphite-200 text-graphite-600 text-xs font-semibold rounded-lg transition";
            document.getElementById('btn-pt-dia').className    = type === 'dia'    ? activeCls : inactiveCls;
            document.getElementById('btn-pt-semana').className = type === 'semana' ? activeCls : inactiveCls;
            document.getElementById('btn-pt-mes').className    = type === 'mes'    ? activeCls : inactiveCls;
            // "Día" y "Semana" comparten el mismo selector de fecha (para semana, se
            // usa como una fecha de referencia dentro de la semana a reportar).
            document.getElementById('print-date-wrap').classList.toggle('hidden', type === 'mes');
            document.getElementById('print-month-wrap').classList.toggle('hidden', type !== 'mes');
            const dateLabel = document.getElementById('print-date-wrap-label');
            if (dateLabel) {
                dateLabel.innerText = type === 'semana' ? 'Fecha dentro de la semana a reportar' : 'Fecha de Reporte';
            }
        }

        function openPrintModal(presetType, presetCategory) {
            document.getElementById('print-date-select').value = document.getElementById('date-filter').value;
            const now = new Date();
            document.getElementById('print-month-select').value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            // Auto-cargar nombre del especialista desde el perfil guardado
            const user = window._profileState && window._profileState.currentUser;
            if (user) {
                const saved = JSON.parse(localStorage.getItem('userProfile_' + user.uid) || '{}');
                const name = saved.displayName || user.email.split('@')[0];
                document.getElementById('print-specialist-name').value = name;
            }
            setPrintCategory(presetCategory || 'citas');
            setPrintType(presetType || 'dia');
            const m = document.getElementById('print-modal');
            m.classList.remove('hidden'); m.classList.add('flex');
        }
        function closePrintModal() {
            const m = document.getElementById('print-modal');
            m.classList.add('hidden'); m.classList.remove('flex');
        }

        function openProfileModal() {
            const user = window._profileState && window._profileState.currentUser;
            const email = user ? user.email : '';
            document.getElementById('profile-modal-email').innerText = email;

            // Cargar datos guardados del perfil
            const saved = JSON.parse(localStorage.getItem('userProfile_' + (user ? user.uid : '')) || '{}');
            document.getElementById('profile-displayname').value = saved.displayName || '';
            document.getElementById('profile-specialty').value   = saved.specialty   || '';
            document.getElementById('profile-phone').value       = saved.phone       || '';

            // Limpiar campos de clave
            document.getElementById('profile-current-pwd').value  = '';
            document.getElementById('profile-new-pwd').value      = '';
            document.getElementById('profile-confirm-pwd').value  = '';

            // Limpiar mensajes
            ['profile-edit-error','profile-edit-success','profile-pwd-error','profile-pwd-success']
                .forEach(id => document.getElementById(id).classList.add('hidden'));

            // Mostrar tab perfil por defecto
            switchProfileTab('perfil');

            const m = document.getElementById('profile-modal');
            m.classList.remove('hidden'); m.classList.add('flex');
        }

        function closeProfileModal() {
            const m = document.getElementById('profile-modal');
            m.classList.add('hidden'); m.classList.remove('flex');
        }

        function switchProfileTab(tab) {
            ['perfil','clave'].forEach(t => {
                document.getElementById('psec-' + t).classList.add('hidden');
                document.getElementById('ptab-' + t).className =
                    'flex-1 py-2 text-xs font-semibold rounded-lg text-white/80 hover:bg-white/15 transition';
            });
            document.getElementById('psec-' + tab).classList.remove('hidden');
            document.getElementById('ptab-' + tab).className =
                'flex-1 py-2 text-xs font-semibold rounded-lg bg-white text-sage-700 shadow transition';
        }

        function saveProfileData() {
            const errDiv = document.getElementById('profile-edit-error');
            const okDiv  = document.getElementById('profile-edit-success');
            errDiv.classList.add('hidden');
            okDiv.classList.add('hidden');

            const displayName = document.getElementById('profile-displayname').value.trim();
            const specialty   = document.getElementById('profile-specialty').value.trim();
            const phone       = document.getElementById('profile-phone').value.trim();

            if (!displayName) {
                errDiv.innerText = 'El nombre no puede estar vacío.';
                errDiv.classList.remove('hidden');
                return;
            }

            const user = window._profileState && window._profileState.currentUser;
            const key  = 'userProfile_' + (user ? user.uid : 'guest');
            localStorage.setItem(key, JSON.stringify({ displayName, specialty, phone }));

            // Actualizar nombre en el header
            const headerName = document.getElementById('header-user-name');
            if (headerName) headerName.innerText = displayName;

            okDiv.innerText = '✅ Perfil actualizado correctamente.';
            okDiv.classList.remove('hidden');
            setTimeout(() => okDiv.classList.add('hidden'), 3000);
        }




        
        async function saveNewPassword() {
            const errDiv = document.getElementById('profile-pwd-error');
            const okDiv  = document.getElementById('profile-pwd-success');
            errDiv.classList.add('hidden');
            okDiv.classList.add('hidden');

            const currentPwd = document.getElementById('profile-current-pwd').value;
            const newPwd     = document.getElementById('profile-new-pwd').value;
            const confirmPwd = document.getElementById('profile-confirm-pwd').value;

            if (!currentPwd) {
                errDiv.innerText = 'Ingresa tu contraseña actual.';
                errDiv.classList.remove('hidden'); return;
            }
            if (newPwd.length < 8) {
                errDiv.innerText = 'La nueva contraseña debe tener al menos 8 caracteres.';
                errDiv.classList.remove('hidden'); return;
            }
            if (newPwd.startsWith('temp_')) {
                errDiv.innerText = "No puedes usar una contraseña que empiece con 'temp_'.";
                errDiv.classList.remove('hidden'); return;
            }
            if (newPwd !== confirmPwd) {
                errDiv.innerText = 'Las contraseñas no coinciden.';
                errDiv.classList.remove('hidden'); return;
            }

            // Re-autenticar con la contraseña actual antes de cambiar
            try {
                const { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } = window._firebaseAuthRef;
                const auth = getAuth();
                const user = auth.currentUser;
                const credential = EmailAuthProvider.credential(user.email, currentPwd);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPwd);

                okDiv.innerText = '✅ Contraseña actualizada con éxito.';
                okDiv.classList.remove('hidden');
                document.getElementById('profile-current-pwd').value  = '';
                document.getElementById('profile-new-pwd').value      = '';
                document.getElementById('profile-confirm-pwd').value  = '';
                setTimeout(() => okDiv.classList.add('hidden'), 4000);
            } catch (error) {
                let msg = 'Error al actualizar la contraseña. Intenta de nuevo.';
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    msg = 'La contraseña actual es incorrecta.';
                } else if (error.code === 'auth/too-many-requests') {
                    msg = 'Demasiados intentos. Espera unos minutos.';
                }
                errDiv.innerText = msg;
                errDiv.classList.remove('hidden');
            }
        }

