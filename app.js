        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
        import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-lite.js";

        const firebaseConfig = {
            apiKey: "AIzaSyDaVsm4cs9O-R0plj1hk62Iy1uU2IYZLfc",
            authDomain: "sipa-d4ec9.firebaseapp.com",
            projectId: "sipa-d4ec9",
            storageBucket: "sipa-d4ec9.firebasestorage.app",
            messagingSenderId: "560354492263",
            appId: "1:560354492263:web:653ac26f811153537c79c2"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        const NOMBRE_SUPERVISOR_LPMD = "ALFREDO CRUZADO PALACIOS";
        const DOMINIO_INSTITUCIONAL = "pj.gob.pe";

        const repositorios = ["SÓTANO NCPP", "SAENZ PEÑA", "PADILLA", "DUNAS", "DOMUS"];
        const listaPersonalRoles = {
            "JORGE DESPOSORIO": "Responsable de Archivo",
            "ROBERTO DÁVILA": "Personal de Archivo",
            "ALFREDO CRUZADO": "Personal de Archivo",
            "LUIS EPIFANÍA": "Personal de Archivo",
            "JORGE IZQUIERDO": "Personal de Archivo",
            "MANUEL BARANDIARAN": "Personal de Archivo",
            "RAÚL RODRIGUEZ": "Personal de Archivo",
            "TEÓFILO GABINO": "Personal de Archivo",
            "IVÁN ROCHA": "Personal de Archivo",
            "ROSA CHUMBES": "Personal de Archivo"
        };

        const dataMaestra = {
            personal: [
                "ALFREDO CRUZADO", "RAÚL RODRIGUEZ", "JORGE DESPOSORIO", 
                "JORGE IZQUIERDO", "LUIS EPIFANÍA", "MANUEL BARANDIARAN", 
                "ROBERTO DÁVILA", "TEÓFILO GABINO", "IVÁN ROCHA"
            ],
            repositorios: [
                "SÓTANO NCPP", "SAENZ PEÑA", "PADILLA", "DUNAS", "DOMUS"
            ]
        };

        const PERMISOS = {
            reingresos_escritura: ["ALFREDO CRUZADO", "ACRUZADO", "ROBERTO DAVILA", "RDAVILA", "JORGE IZQUIERDO", "JIZQUIERDO", "MANUEL BARANDIARAN", "MBARANDIARAN"],
            inventario_escritura: ["ALFREDO CRUZADO", "ACRUZADO", "ROBERTO DAVILA", "RDAVILA", "JORGE IZQUIERDO", "JIZQUIERDO", "MANUEL BARANDIARAN", "MBARANDIARAN", "TEOFILO GABINO", "TGABINO"],
            microformas_escritura: ["ALFREDO CRUZADO", "ACRUZADO"]
        };

        function normalizarTexto(texto) {
            if (!texto) return '';
            return texto.trim().toUpperCase().replace(/\s+/g, ' ');
        }

        function esUsuarioAdministradorLog(nombreUsuario) {
            const u = normalizarTexto(nombreUsuario);
            return u === "ALFREDO CRUZADO" || u === "ACRUZADO";
        }

        function esUsuarioMicroformasVisualizador(nombreUsuario) {
            const u = normalizarTexto(nombreUsuario);
            return u === "ROBERTO DÁVILA" || u === "ROBERTO DAVILA" || u === "RDAVILA" || u === "JORGE DESPOSORIO" || u === "JDESPOSORIO" || esUsuarioAdministradorLog(u);
        }

        function aplicarPermisos(nombreUsuario) {
            const usuarioLimpio = normalizarTexto(nombreUsuario);
            
            const reingresosLimpios = PERMISOS.reingresos_escritura.map(n => normalizarTexto(n));
            const inventarioLimpios = PERMISOS.inventario_escritura.map(n => normalizarTexto(n));
            const microformasLimpios = PERMISOS.microformas_escritura.map(n => normalizarTexto(n));

            const puedeReingresos = reingresosLimpios.includes(usuarioLimpio);
            const puedeInventario = inventarioLimpios.includes(usuarioLimpio);
            const puedeMicroformasEscritura = microformasLimpios.includes(usuarioLimpio);
            const puedeVerMicroformas = esUsuarioMicroformasVisualizador(usuarioLimpio);
            const esAdminLog = esUsuarioAdministradorLog(usuarioLimpio);

            const menuMicroformas = document.getElementById('menu-link-microformas');
            if (menuMicroformas) {
                menuMicroformas.style.display = puedeVerMicroformas ? 'flex' : 'none';
            }

            const menuAuditoria = document.getElementById('menu-link-auditoria');
            if (menuAuditoria) {
                menuAuditoria.style.display = esAdminLog ? 'flex' : 'none';
            }

            const btnImprimirDash = document.getElementById('btn-imprimir-dashboard');
            if (btnImprimirDash) {
                if (esAdminLog) {
                    btnImprimirDash.style.setProperty('display', 'flex', 'important');
                } else {
                    btnImprimirDash.style.setProperty('display', 'none', 'important');
                }
            }

            const btnNuevaMicroforma = document.getElementById('btn-nueva-microforma');
            if (btnNuevaMicroforma) {
                btnNuevaMicroforma.style.display = puedeMicroformasEscritura ? 'flex' : 'none';
            }

            document.getElementById('btn-guardar-reingreso')?.toggleAttribute('disabled', !puedeReingresos);
            
            const btnAgregarExpediente = document.querySelector('button[onclick="agregarFilaReingreso()"]');
            if (btnAgregarExpediente) {
                btnAgregarExpediente.disabled = !puedeReingresos;
                btnAgregarExpediente.style.pointerEvents = puedeReingresos ? 'auto' : 'none';
                btnAgregarExpediente.classList.toggle('opacity-50', !puedeReingresos);
            }

            const btnGenerarPDF = document.querySelector('button[onclick="generarReporteReingresoPDF()"]');
            if (btnGenerarPDF) {
                btnGenerarPDF.disabled = !puedeReingresos;
                btnGenerarPDF.style.pointerEvents = puedeReingresos ? 'auto' : 'none';
                btnGenerarPDF.classList.toggle('opacity-50', !puedeReingresos);
            }

            document.querySelectorAll('#view-reingresos input, #view-reingresos select').forEach(el => el.disabled = !puedeReingresos);

            document.getElementById('btn-guardar-traslado')?.removeAttribute('disabled');
            
            const btnAgregarTraslado = document.querySelector('button[onclick="agregarFilaTraslado()"]');
            if (btnAgregarTraslado) {
                btnAgregarTraslado.disabled = false;
                btnAgregarTraslado.style.pointerEvents = 'auto';
                btnAgregarTraslado.classList.remove('opacity-50');
            }

            const btnGenerarPDFTraslado = document.querySelector('button[onclick="generarReporteTrasladoPDF()"]');
            if (btnGenerarPDFTraslado) {
                btnGenerarPDFTraslado.disabled = false;
                btnGenerarPDFTraslado.style.pointerEvents = 'auto';
                btnGenerarPDFTraslado.classList.remove('opacity-50');
            }

            document.querySelectorAll('#view-traslados input, #view-traslados select').forEach(el => el.disabled = false);

            document.getElementById('form-inventario')?.querySelectorAll('input, select, button[type=submit]').forEach(el => el.disabled = !puedeInventario);

            const btnAgregarRango = document.querySelector('button[onclick="abrirModalRango()"]');
            if (btnAgregarRango) {
                btnAgregarRango.disabled = !puedeInventario;
                btnAgregarRango.style.pointerEvents = puedeInventario ? 'auto' : 'none';
                btnAgregarRango.classList.toggle('opacity-50', !puedeInventario);
            }
        }

        async function sincronizarUsuarioEnFirestore(user, nombreUsuario) {
            try {
                await setDoc(doc(db, "usuarios", user.uid), {
                    nombre: nombreUsuario,
                    email: user.email || '',
                    rol: listaPersonalRoles[nombreUsuario] || "Personal de Archivo",
                    actualizadoEn: Date.now()
                }, { merge: true });
            } catch (e) {
                console.error("No se pudo sincronizar usuarios/{uid}:", e);
            }
        }

        async function registrarInicioSesionEnCloud(user, nombreUsuario) {
            try {
                await addDoc(collection(db, "auditoria_logins"), {
                    email: user.email || '',
                    nombre: nombreUsuario,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.error("Error al registrar login en Cloud:", e);
            }
        }

        let baseDatosInventario = []; 
        let listaRangosCenso = [];    
        let listaFaltantesModal = []; 
        let baseDatosReingresos = [];
        let baseDatosTraslados = [];
        let baseDatosMicroformas = [];
        let baseDatosTarjetas = [];
        let listaLogsAuditoria = [];
        let idReingresoEnEdicion = null;
        let idTrasladoEnEdicion = null;
        let idMicroformaEnEdicion = null;
        let idTarjetaEnEdicion = null;
        let modalInstance = null;
        let modalMicroformaInstance = null;

        // Variables para Paginación de 10 registros
        let paginaActualMicroformas = 1;
        let paginaActualAuditoria = 1;
        const registrosPorPagina = 10;

        function obtenerLogoArchivoBase64() {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = function() { resolve(null); };
                img.src = 'https://ecomindsetgo.github.io/saamir/LOGO%20ARCHIVO.png';
            });
        }

        // Helper genérico que además devuelve el ancho/alto reales de la
        // imagen (en px), para poder mantener su proporción exacta al
        // dibujarla en el PDF (usado por las tarjetas de paquetes, que llevan
        // el logo del Archivo Desconcentrado en una esquina y el logo oficial
        // del Poder Judicial del Perú en la otra).
        function obtenerImagenBase64(url) {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve({ data: canvas.toDataURL('image/png'), w: img.width, h: img.height });
                };
                img.onerror = function() { resolve(null); };
                img.src = url;
            });
        }

        window.addEventListener('DOMContentLoaded', () => {
            let correoGuardado = localStorage.getItem('saamir_ultimo_correo');
            if (correoGuardado) {
                if (correoGuardado.includes('@')) {
                    correoGuardado = correoGuardado.split('@')[0];
                    localStorage.setItem('saamir_ultimo_correo', correoGuardado);
                }
                const inputEmail = document.getElementById("login-alias");
                if (inputEmail) inputEmail.value = correoGuardado;
            }
            inicializarAniosIngresoTarjetas();
            // El generador de tarjetas ya NO agrega filas vacías por defecto.
            // El usuario decide cuántas filas necesita con los botones
            // "+ Añadir Fila" / "+ Añadir 5 Filas".
        });

        function inicializarAniosIngresoTarjetas() {
            const selectAnio = document.getElementById('tar-anio-ingreso');
            if (!selectAnio) return;
            selectAnio.innerHTML = '';
            const anioActual = new Date().getFullYear();
            // Rango solicitado: desde el año 2016 hasta el año actual + 1
            // (ej. en 2026 el rango llega hasta 2027).
            for (let y = anioActual + 1; y >= 2016; y--) {
                selectAnio.options.add(new Option(y, y, false, y === anioActual));
            }
        }

        // El selector de Año de Ingreso solo se habilita cuando el usuario
        // marca que el bloque corresponde a Tarjetas de Recepción.
        window.toggleAnioIngresoTarjetas = function(checkboxEl) {
            const selectAnio = document.getElementById('tar-anio-ingreso');
            if (!selectAnio) return;
            selectAnio.disabled = !checkboxEl.checked;
            if (!checkboxEl.checked) {
                selectAnio.value = '';
            } else if (!selectAnio.value) {
                selectAnio.value = new Date().getFullYear();
            }
        };

        function cargarDataMaestra(usuarioActivoNombre = "") {
            const selectRepo = document.getElementById('inv-repositorio');
            const selectFiltroRepo = document.getElementById('filtro-repo');
            const selectRec = document.getElementById('inv-recibe');

            selectRepo.innerHTML = '<option value="" selected disabled>Seleccione repositorio...</option>';
            selectFiltroRepo.innerHTML = '<option value="">Todos los Repositorios</option>';

            repositorios.forEach(r => {
                selectRepo.options.add(new Option(r, r));
                selectFiltroRepo.options.add(new Option(r, r));
            });
            
            selectRec.innerHTML = '<option value="" selected disabled>Seleccione personal...</option>';
            Object.keys(listaPersonalRoles).forEach(p => {
                if (p !== usuarioActivoNombre) {
                    selectRec.options.add(new Option(p, p));
                }
            });
        }

        function inicializarSelectsReingresos() {
            const sSolicitante = document.getElementById('re-solicitante');
            const sLocal = document.getElementById('re-local');
            const fSolicitante = document.getElementById('filtro-re-solicitante');
            const fEntregado = document.getElementById('filtro-re-entregado');

            sSolicitante.innerHTML = sLocal.innerHTML = '<option value="">Seleccione...</option>';
            if (fSolicitante) fSolicitante.innerHTML = '<option value="">Todos</option>';
            if (fEntregado) fEntregado.innerHTML = '<option value="">Todos</option>';

            dataMaestra.personal.forEach(p => {
                sSolicitante.innerHTML += `<option value="${p}">${p}</option>`;
                if (fSolicitante) fSolicitante.innerHTML += `<option value="${p}">${p}</option>`;
                if (fEntregado) fEntregado.innerHTML += `<option value="${p}">${p}</option>`;
            });

            dataMaestra.repositorios.forEach(r => {
                sLocal.innerHTML += `<option value="${r}">${r}</option>`;
            });
        }

        function inicializarSelectsTraslados(usuarioActivoNombre = "") {
            const fEntregadoTr = document.getElementById('filtro-tr-entregado');
            if (fEntregadoTr) {
                fEntregadoTr.innerHTML = '<option value="">Todos</option>';
                dataMaestra.personal.forEach(p => {
                    fEntregadoTr.innerHTML += `<option value="${p}">${p}</option>`;
                });
            }

            const selectTrRecibe = document.getElementById('tr-recibe');
            if (selectTrRecibe) {
                selectTrRecibe.innerHTML = '<option value="" selected disabled>Seleccione personal...</option>';
                Object.keys(listaPersonalRoles).forEach(p => {
                    if (p !== usuarioActivoNombre) {
                        selectTrRecibe.options.add(new Option(p, p));
                    }
                });
            }
        }

        function resetFormularioReingreso() {
            idReingresoEnEdicion = null;
            const fFecha = document.getElementById('re-fecha');
            const fSolicitante = document.getElementById('re-solicitante');
            const fLocal = document.getElementById('re-local');
            const tbody = document.querySelector('#tabla-reingresos tbody');
            const btnGuardar = document.getElementById('btn-guardar-reingreso');

            if (fFecha) fFecha.valueAsDate = new Date();
            if (fSolicitante) fSolicitante.value = '';
            if (fLocal) fLocal.value = '';
            if (tbody) tbody.innerHTML = '';
            if (btnGuardar) btnGuardar.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Registro';
        }

        function resetFormularioTraslado() {
            idTrasladoEnEdicion = null;
            const fFecha = document.getElementById('tr-fecha');
            const fRecibe = document.getElementById('tr-recibe');
            const tbody = document.querySelector('#tabla-traslados tbody');
            const btnGuardar = document.getElementById('btn-guardar-traslado');

            if (fFecha) fFecha.valueAsDate = new Date();
            if (fRecibe) fRecibe.value = '';
            if (tbody) tbody.innerHTML = '';
            if (btnGuardar) btnGuardar.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Registro';
            actualizarTotalTraslados();
        }

        window.iniciarNuevoReingreso = function() {
            resetFormularioReingreso();
            switchView('view-reingresos', 'Módulo Reingresos');
        };

        window.iniciarNuevoTraslado = function() {
            resetFormularioTraslado();
            switchView('view-traslados', 'Módulo Formato de Traslado');
        };

        function resetFormularioTarjetas() {
            idTarjetaEnEdicion = null;
            const fJuzgado = document.getElementById('tar-juzgado');
            const fJuez = document.getElementById('tar-juez');
            const fFecha = document.getElementById('tar-fecha-recepcion');
            const fOficio = document.getElementById('tar-oficio');
            const chkRecepcion = document.getElementById('tar-es-recepcion');
            const tbody = document.querySelector('#tabla-tarjetas-detalles tbody');
            const btnGuardar = document.querySelector('button[onclick="window.guardarYGenerarPDFTarjetas()"]');

            if (fJuzgado) fJuzgado.value = '';
            if (fJuez) fJuez.value = '';
            if (fFecha) fFecha.value = '';
            if (fOficio) fOficio.value = '';
            if (chkRecepcion) {
                chkRecepcion.checked = false;
                window.toggleAnioIngresoTarjetas(chkRecepcion);
            }
            if (tbody) {
                tbody.innerHTML = `<tr id="tarjetas-fila-vacia">
                    <td colspan="6" class="text-center text-muted py-3">
                        Aún no ha añadido paquetes. Use los botones "+ Añadir Fila" o "+ Añadir 5 Filas".
                    </td>
                </tr>`;
            }
            if (btnGuardar) btnGuardar.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar y Generar PDF';
        }

        window.iniciarNuevaTarjeta = function() {
            resetFormularioTarjetas();
            switchView('view-tarjetas', 'Tarjetas Recepción');
        };

        window.toggleMenuMovil = function() {
            document.getElementById('sidebar').classList.toggle('sidebar-abierto');
            document.getElementById('sidebar-backdrop').classList.toggle('show');
        };

        window.cerrarMenuMovil = function() {
            document.getElementById('sidebar').classList.remove('sidebar-abierto');
            document.getElementById('sidebar-backdrop').classList.remove('show');
        };

        function switchView(viewId, titleText = "Dashboard Principal") {
            cerrarMenuMovil();
            
            if (viewId === 'view-auditoria') {
                const userTitle = auth.currentUser ? normalizarTexto(auth.currentUser.displayName || auth.currentUser.email.split('@')[0]) : '';
                if (!esUsuarioAdministradorLog(userTitle)) {
                    Swal.fire('Acceso Denegado', 'No cuenta con privilegios para ver el log de auditoría.', 'error');
                    return;
                }
                cargarHistorialAuditoriaGlobal();
            }

            if (viewId === 'view-microformas') {
                const userTitle = auth.currentUser ? normalizarTexto(auth.currentUser.displayName || auth.currentUser.email.split('@')[0]) : '';
                if (!esUsuarioMicroformasVisualizador(userTitle)) {
                    Swal.fire('Acceso Denegado', 'No cuenta con autorización para visualizar este módulo.', 'error');
                    return;
                }
                cargarMicroformasDesdeCloud();
            }

            if (viewId === 'view-traslados') {
                const userTitle = auth.currentUser ? normalizarTexto(auth.currentUser.displayName || auth.currentUser.email.split('@')[0]) : '';
                inicializarSelectsTraslados(userTitle);
            }

            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('#sidebar .nav-link').forEach(l => l.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            document.getElementById('page-title').innerText = titleText;
            
            const link = Array.from(document.querySelectorAll('#sidebar .nav-link')).find(l => l.dataset.view === viewId || (l.getAttribute('onclick') && l.getAttribute('onclick').includes(viewId)));
            if(link) link.classList.add('active');

            if (viewId === 'view-consultas-reingresos') {
                cargarHistorialReingresos();
            }

            if (viewId === 'view-consultas-traslados') {
                cargarHistorialTraslados();
            }

            if (viewId === 'view-consultas-tarjetas') {
                cargarHistorialTarjetas();
            }
        }

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            let entrada = document.getElementById("login-alias").value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            const email = entrada.includes('@') ? entrada : `${entrada}@${DOMINIO_INSTITUCIONAL}`;
            try {
                localStorage.setItem('saamir_ultimo_correo', entrada);
                await signInWithEmailAndPassword(auth, email, password);
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Acceso Autorizado', showConfirmButton: false, timer: 2000 });
            } catch (error) {
                Swal.fire('Error', 'Credenciales incorrectas.', 'error');
            }
        });

        onAuthStateChanged(auth, (user) => {
            if (user) {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                
                const userTitle = normalizarTexto(user.displayName ? user.displayName : user.email.split('@')[0]);
                document.getElementById('user-display-name').innerText = userTitle;
                document.getElementById('user-display-role').innerText = listaPersonalRoles[userTitle] || "Personal de Archivo";
                document.getElementById('inv-registra').value = userTitle;
                
                const campoPersonalTarjetas = document.getElementById('tar-personal');
                if (campoPersonalTarjetas) campoPersonalTarjetas.value = userTitle;

                const fechaRecTarjetas = document.getElementById('tar-fecha-recepcion');
                if (fechaRecTarjetas && !fechaRecTarjetas.value) fechaRecTarjetas.valueAsDate = new Date();

                const campoEntregado = document.getElementById('re-entregado');
                if (campoEntregado) campoEntregado.value = userTitle;

                const campoEntregadoTr = document.getElementById('tr-entregado');
                if (campoEntregadoTr) campoEntregadoTr.value = userTitle;

                document.getElementById('perf-email').value = user.email || '';
                document.getElementById('perf-nombre').value = user.displayName || '';
                const formClave = document.getElementById('form-perfil-clave');
                if (formClave) formClave.reset();

                cargarDataMaestra(userTitle);
                aplicarPermisos(userTitle);
                inicializarSelectsReingresos();
                inicializarSelectsTraslados(userTitle);
                resetFormularioReingreso();
                resetFormularioTraslado();

                // Las operaciones de auditoría no deben bloquear la finalización
                // del callback de autenticación ni la carga del documento.
                setTimeout(() => {
                    sincronizarUsuarioEnFirestore(user, userTitle).catch(err => console.error(err));
                    registrarInicioSesionEnCloud(user, userTitle).catch(err => console.error(err));
                }, 0);

                // Cargar los módulos en paralelo y fuera del callback de autenticación.
                // Así la pestaña no queda esperando a que terminen las consultas.
                setTimeout(() => {
                    Promise.allSettled([
                        cargarInventariosDesdeCloud(),
                        cargarHistorialReingresosParaDashboard(),
                        cargarHistorialTrasladosParaDashboard(),
                        cargarMicroformasDesdeCloud(),
                        cargarHistorialTarjetas()
                    ]).then(resultados => {
                        const errores = resultados.filter(r => r.status === 'rejected');
                        if (errores.length) {
                            console.error('SAAMIR: algunas cargas iniciales no pudieron completarse:', errores);
                        }
                    });
                }, 0);
            } else {
                document.getElementById('app-container').style.display = 'none';
                document.getElementById('login-container').style.display = 'flex';
            }
        });

        document.getElementById('btn-logout').addEventListener('click', () => {
            signOut(auth);
            document.getElementById('login-password').value = '';
        });

        document.getElementById('form-perfil-datos').addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const nuevoNombre = normalizarTexto(document.getElementById('perf-nombre').value);
            if (!user) return;
            try {
                await updateProfile(user, { displayName: nuevoNombre });
                document.getElementById('user-display-name').innerText = nuevoNombre;
                document.getElementById('user-display-role').innerText = listaPersonalRoles[nuevoNombre] || "Personal de Archivo";
                document.getElementById('inv-registra').value = nuevoNombre;
                
                const campoPersonalTarjetas = document.getElementById('tar-personal');
                if (campoPersonalTarjetas) campoPersonalTarjetas.value = nuevoNombre;

                const campoEntregado = document.getElementById('re-entregado');
                if (campoEntregado) campoEntregado.value = nuevoNombre;

                const campoEntregadoTr = document.getElementById('tr-entregado');
                if (campoEntregadoTr) campoEntregadoTr.value = nuevoNombre;
                
                cargarDataMaestra(nuevoNombre);
                inicializarSelectsTraslados(nuevoNombre);
                aplicarPermisos(nuevoNombre);
                sincronizarUsuarioEnFirestore(user, nuevoNombre);
                Swal.fire('Éxito', 'Perfil actualizado de forma interna.', 'success');
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        });

        document.getElementById('form-perfil-clave').addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const nuevaClave = document.getElementById('perf-new-password').value;
            const confirmaClave = document.getElementById('perf-confirm-password').value;
            if (!user) return;
            if (nuevaClave !== confirmaClave) { Swal.fire('Aviso', 'Las claves no coinciden.', 'warning'); return; }
            try {
                await updatePassword(user, nuevaClave);
                document.getElementById('form-perfil-clave').reset();
                Swal.fire('Éxito', 'Contraseña modificada de forma segura.', 'success');
            } catch (error) {
                if (error.code === 'auth/requires-recent-login') {
                    const { value: pass } = await Swal.fire({ title: 'Seguridad', text: 'Escriba su clave actual:', input: 'password', showCancelButton: true });
                    if (pass) {
                        try {
                            const cred = EmailAuthProvider.credential(user.email, pass);
                            await reauthenticateWithCredential(user, cred);
                            await updatePassword(user, nuevaClave);
                            document.getElementById('form-perfil-clave').reset();
                            Swal.fire('Éxito', 'Contraseña cambiada.', 'success');
                        } catch(err) { Swal.fire('Error', 'Clave incorrecta.', 'error'); }
                    }
                } else { Swal.fire('Error', error.message, 'error'); }
            }
        });

        function puedeEditarMicroformas(nombreUsuario) {
            const u = normalizarTexto(nombreUsuario);
            return PERMISOS.microformas_escritura.map(n => normalizarTexto(n)).includes(u);
        }

        const REGEX_RANGO_PAQUETE = /^\s*(\d+)-(\d+)\s*$/;
        let contadorFilaSubrango = 0;

        function crearFilaSubrangoHTML(desde = '', hasta = '') {
            const idx = contadorFilaSubrango++;
            return `
                <div class="row g-2 align-items-center mb-2 subrango-row" data-idx="${idx}">
                    <div class="col-5">
                        <input type="text" class="form-control form-control-sm subrango-desde" placeholder="Desde. Ej: 23-916" value="${desde}" oninput="window.recalcularTotalPaquetesMicroforma()">
                    </div>
                    <div class="col-5">
                        <input type="text" class="form-control form-control-sm subrango-hasta" placeholder="Hasta. Ej: 23-963" value="${hasta}" oninput="window.recalcularTotalPaquetesMicroforma()">
                    </div>
                    <div class="col-1 text-center">
                        <span class="badge bg-light text-dark border subrango-cant" title="Cantidad de este sub-rango">0</span>
                    </div>
                    <div class="col-1 text-center">
                        <button type="button" class="btn btn-outline-danger btn-sm py-0 px-1" title="Quitar sub-rango" onclick="window.eliminarSubrangoMicroforma(this)"><i class="bi bi-x-lg"></i></button>
                    </div>
                </div>`;
        }

        window.agregarSubrangoMicroforma = function(desde = '', hasta = '') {
            const cont = document.getElementById('mf-subrangos-container');
            if (!cont) return;
            cont.insertAdjacentHTML('beforeend', crearFilaSubrangoHTML(desde, hasta));
            window.recalcularTotalPaquetesMicroforma();
        };

        window.eliminarSubrangoMicroforma = function(btn) {
            const fila = btn.closest('.subrango-row');
            if (fila) fila.remove();
            const cont = document.getElementById('mf-subrangos-container');
            if (cont && cont.children.length === 0) {
                window.agregarSubrangoMicroforma();
            }
            window.recalcularTotalPaquetesMicroforma();
        };

        function leerSubrangosMicroforma() {
            const filas = document.querySelectorAll('#mf-subrangos-container .subrango-row');
            const subrangos = [];
            let total = 0;
            let huboFilasInvalidas = false;

            filas.forEach(fila => {
                const desdeInput = fila.querySelector('.subrango-desde');
                const hastaInput = fila.querySelector('.subrango-hasta');
                const badgeCant = fila.querySelector('.subrango-cant');
                const desde = desdeInput.value.trim();
                const hasta = hastaInput.value.trim();

                if (!desde && !hasta) {
                    if (badgeCant) badgeCant.textContent = '0';
                    return;
                }

                const matchDesde = desde.match(REGEX_RANGO_PAQUETE);
                const matchHasta = hasta.match(REGEX_RANGO_PAQUETE);

                if (matchDesde && matchHasta) {
                    const numDesde = parseInt(matchDesde[2], 10);
                    const numHasta = parseInt(matchHasta[2], 10);

                    if (!isNaN(numDesde) && !isNaN(numHasta) && numHasta >= numDesde) {
                        const cant = (numHasta - numDesde) + 1;
                        if (badgeCant) badgeCant.textContent = cant;
                        subrangos.push({ desde, hasta, cantidad: cant });
                        total += cant;
                        return;
                    }
                }

                if (badgeCant) badgeCant.textContent = '?';
                huboFilasInvalidas = true;
            });

            return { subrangos, total, huboFilasInvalidas };
        }

        window.recalcularTotalPaquetesMicroforma = function() {
            const { total } = leerSubrangosMicroforma();
            const inputCant = document.getElementById('mf-cant-paquetes');
            const display = document.getElementById('mf-cant-paquetes-display');
            if (inputCant) inputCant.value = total;
            if (display) display.textContent = total;
        };

        window.calcularCantidadPaquetesMicroforma = function() {
            window.recalcularTotalPaquetesMicroforma();
        };

        function construirTextoRango(subrangos) {
            return subrangos.map((s, i) => {
                const tramo = `${s.desde} al ${s.hasta}`;
                return i === 0 ? tramo : `y del ${tramo}`;
            }).join(' ');
        }

        window.abrirModalMicroforma = function(id = null) {
            idMicroformaEnEdicion = id;
            document.getElementById('form-modal-microforma').reset();
            document.getElementById('mf-cant-paquetes').value = '';
            document.getElementById('mf-cant-paquetes-display').textContent = '0';

            const cont = document.getElementById('mf-subrangos-container');
            if (cont) cont.innerHTML = '';

            if (id !== null) {
                const item = baseDatosMicroformas.find(m => m.id === id);
                if (item) {
                    document.getElementById('mf-bloque').value = item.bloque || '';

                    if (Array.isArray(item.subrangos) && item.subrangos.length > 0) {
                        item.subrangos.forEach(s => window.agregarSubrangoMicroforma(s.desde || '', s.hasta || ''));
                    } else if (item.paqueteDesde && item.paqueteHasta) {
                        window.agregarSubrangoMicroforma(item.paqueteDesde, item.paqueteHasta);
                    } else if (item.rango && item.rango.includes(' al ')) {
                        const partes = item.rango.split(' al ');
                        window.agregarSubrangoMicroforma(partes[0].trim(), partes[1].trim());
                    } else {
                        window.agregarSubrangoMicroforma();
                    }

                    window.recalcularTotalPaquetesMicroforma();
                    document.getElementById('mf-juzgado').value = item.juzgado || '';
                    document.getElementById('mf-folios').value = item.folios || '';
                    document.getElementById('mf-imagenes').value = item.imagenes || '';
                    document.getElementById('mf-registros').value = item.registros || '';
                    document.getElementById('mf-expedientes').value = item.expedientes || '';
                    document.getElementById('mf-mes').value = item.mes || '';
                    document.getElementById('mf-fec-inicio').value = item.fecInicio || '';
                    document.getElementById('mf-fec-fin').value = item.fecFin || '';
                    document.getElementById('mf-fec-grabacion').value = item.fecGrabacion || '';
                    document.getElementById('modal-microforma-titulo').innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Bloque de Microformas';
                    document.getElementById('btn-guardar-microforma').innerText = 'Guardar Cambios';
                }
            } else {
                window.agregarSubrangoMicroforma();
                document.getElementById('modal-microforma-titulo').innerHTML = '<i class="bi bi-file-earmark-plus me-2"></i>Registrar Bloque de Microformas';
                document.getElementById('btn-guardar-microforma').innerText = 'Guardar Bloque';
            }

            modalMicroformaInstance = new bootstrap.Modal(document.getElementById('modalMicroforma'));
            modalMicroformaInstance.show();
        };

        window.cerrarModalMicroforma = function() {
            idMicroformaEnEdicion = null;
            if (modalMicroformaInstance) modalMicroformaInstance.hide();
        };

        window.guardarMicroforma = async function() {
            const currentUserObj = auth.currentUser;
            const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

            if (!puedeEditarMicroformas(currentUserName)) {
                Swal.fire('Acceso denegado', 'No cuenta con autorización para registrar o modificar bloques de microformas.', 'error');
                return;
            }

            const bloqueNum = parseInt(document.getElementById('mf-bloque').value, 10);
            const { subrangos, total, huboFilasInvalidas } = leerSubrangosMicroforma();

            if (huboFilasInvalidas) {
                Swal.fire('Rango inválido', 'Uno o más sub-rangos tienen formato incorrecto.', 'warning');
                return;
            }

            if (!bloqueNum || subrangos.length === 0) {
                Swal.fire('Campos incompletos', 'Por favor complete el N° de Bloque y al menos un sub-rango de paquetes válido.', 'warning');
                return;
            }

            const rangoCompleto = construirTextoRango(subrangos);

            const bloqueData = {
                bloque: bloqueNum,
                subrangos: subrangos,
                paqueteDesde: subrangos[0].desde,
                paqueteHasta: subrangos[0].hasta,
                rango: rangoCompleto,
                cantPaquetes: total,
                juzgado: document.getElementById('mf-juzgado').value.trim().toUpperCase(),
                folios: parseInt(document.getElementById('mf-folios').value, 10) || 0,
                imagenes: parseInt(document.getElementById('mf-imagenes').value, 10) || 0,
                registros: parseInt(document.getElementById('mf-registros').value, 10) || 0,
                expedientes: parseInt(document.getElementById('mf-expedientes').value, 10) || 0,
                mes: document.getElementById('mf-mes').value.trim().toUpperCase(),
                fecInicio: document.getElementById('mf-fec-inicio').value,
                fecFin: document.getElementById('mf-fec-fin').value,
                fecGrabacion: document.getElementById('mf-fec-grabacion').value,
                timestamp: Date.now()
            };

            try {
                if (idMicroformaEnEdicion) {
                    bloqueData.auditoriaEdicion = { nombre: currentUserName, timestamp: Date.now() };
                    await updateDoc(doc(db, "control_microformas", idMicroformaEnEdicion), bloqueData);
                    Swal.fire({ icon: 'success', title: 'Bloque Actualizado', text: 'Los cambios se guardaron correctamente.' });
                } else {
                    bloqueData.activo = true;
                    bloqueData.auditoriaCreacion = { nombre: currentUserName, timestamp: Date.now() };
                    await addDoc(collection(db, "control_microformas"), bloqueData);
                    Swal.fire({ icon: 'success', title: 'Bloque Registrado', text: 'El bloque de microformas se añadió con éxito.' });
                }

                cerrarModalMicroforma();
                await cargarMicroformasDesdeCloud();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        async function cargarMicroformasDesdeCloud() {
            try {
                const querySnapshot = await getDocs(collection(db, "control_microformas"));
                baseDatosMicroformas = [];
                querySnapshot.forEach((docSnap) => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    if (data.activo !== false) baseDatosMicroformas.push(data);
                });

                baseDatosMicroformas.sort((a, b) => (a.bloque || 0) - (b.bloque || 0));
                renderTablaMicroformas();
                actualizarDashboardGlobal();
            } catch (e) {
                console.error("Error al cargar microformas:", e);
            }
        }

        function renderTablaMicroformas() {
            const tbody = document.getElementById('tabla-microformas-body');
            const tfoot = document.getElementById('tabla-microformas-foot');
            if (!tbody || !tfoot) return;

            tbody.innerHTML = '';
            if (baseDatosMicroformas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="13" class="text-center text-muted py-4">No hay bloques registrados en el sistema.</td></tr>`;
                tfoot.innerHTML = '';
                document.getElementById('info-paginacion-microformas').innerText = 'Página 1 de 1';
                return;
            }

            // Paginación (10 registros por página)
            const totalPaginas = Math.ceil(baseDatosMicroformas.length / registrosPorPagina) || 1;
            if (paginaActualMicroformas > totalPaginas) paginaActualMicroformas = totalPaginas;
            if (paginaActualMicroformas < 1) paginaActualMicroformas = 1;

            const inicio = (paginaActualMicroformas - 1) * registrosPorPagina;
            const fin = inicio + registrosPorPagina;
            const registrosPaginados = baseDatosMicroformas.slice(inicio, fin);

            document.getElementById('info-paginacion-microformas').innerText = `Página ${paginaActualMicroformas} de ${totalPaginas} (Total: ${baseDatosMicroformas.length} registros)`;
            document.getElementById('btn-micro-prev').disabled = paginaActualMicroformas <= 1;
            document.getElementById('btn-micro-next').disabled = paginaActualMicroformas >= totalPaginas;

            let sumaPaquetes = 0;
            let sumaFolios = 0;
            let sumaImagenes = 0;
            let sumaRegistros = 0;
            let sumaExpedientes = 0;

            const currentUserObj = auth.currentUser;
            const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : '';
            const esEditor = puedeEditarMicroformas(currentUserName);

            registrosPaginados.forEach(item => {
                const folios = item.folios || 0;
                const imagenes = item.imagenes || 0;
                const registros = item.registros || 0;
                const expedientes = item.expedientes || 0;
                const cantPaquetes = item.cantPaquetes || 0;

                const fInicio = item.fecInicio ? item.fecInicio.split('-').reverse().join('/') : '';
                const fFin = item.fecFin ? item.fecFin.split('-').reverse().join('/') : '';
                const fGrab = item.fecGrabacion ? item.fecGrabacion.split('-').reverse().join('/') : '';
                const textoRango = item.rango || (item.paqueteDesde && item.paqueteHasta ? `${item.paqueteDesde} al ${item.paqueteHasta}` : 'N/A');

                const tr = `<tr>
                    <td class="fw-bold">${item.bloque ?? 'N/A'}</td>
                    <td class="text-start ps-2"><code>${textoRango}</code></td>
                    <td class="fw-bold">${cantPaquetes}</td>
                    <td class="text-start ps-2">${item.juzgado || 'N/A'}</td>
                    <td>${folios.toLocaleString()}</td>
                    <td class="fw-bold">${imagenes.toLocaleString()}</td>
                    <td>${registros.toLocaleString()}</td>
                    <td class="fw-bold">${expedientes.toLocaleString()}</td>
                    <td>${item.mes || 'N/A'}</td>
                    <td>${fInicio}</td>
                    <td>${fFin}</td>
                    <td>${fGrab}</td>
                    <td class="col-acciones no-print">
                        ${esEditor ? `
                            <button class="btn btn-xs btn-outline-primary py-0 px-1 me-1" onclick="window.abrirModalMicroforma('${item.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-xs btn-outline-danger py-0 px-1" onclick="window.eliminarMicroforma('${item.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                        ` : `<span class="text-muted small">Sólo lectura</span>`}
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', tr);
            });

            // Totales generales calculados sobre toda la base de datos
            baseDatosMicroformas.forEach(item => {
                sumaPaquetes += item.cantPaquetes || 0;
                sumaFolios += item.folios || 0;
                sumaImagenes += item.imagenes || 0;
                sumaRegistros += item.registros || 0;
                sumaExpedientes += item.expedientes || 0;
            });

            const totalBloques = baseDatosMicroformas.length;
            const promPaquetes = totalBloques > 0 ? (sumaPaquetes / totalBloques).toFixed(0) : 0;
            const promFolios = totalBloques > 0 ? Math.round(sumaFolios / totalBloques) : 0;
            const promImagenes = totalBloques > 0 ? Math.round(sumaImagenes / totalBloques) : 0;
            const promRegistros = totalBloques > 0 ? Math.round(sumaRegistros / totalBloques) : 0;
            const promExpedientes = totalBloques > 0 ? Math.round(sumaExpedientes / totalBloques) : 0;

            tfoot.innerHTML = `
                <tr class="table-warning">
                    <td colspan="2" class="text-end pe-3">TOTALES (GENERAL)</td>
                    <td>${sumaPaquetes}</td>
                    <td>-</td>
                    <td>${sumaFolios.toLocaleString()}</td>
                    <td>${sumaImagenes.toLocaleString()}</td>
                    <td>${sumaRegistros.toLocaleString()}</td>
                    <td>${sumaExpedientes.toLocaleString()}</td>
                    <td colspan="5"></td>
                </tr>
                <tr class="table-info">
                    <td colspan="2" class="text-end pe-3">PROMEDIO</td>
                    <td>${promPaquetes}</td>
                    <td>-</td>
                    <td>${promFolios.toLocaleString()}</td>
                    <td>${promImagenes.toLocaleString()}</td>
                    <td>${promRegistros.toLocaleString()}</td>
                    <td>${promExpedientes.toLocaleString()}</td>
                    <td colspan="5"></td>
                </tr>
            `;
        }

        window.cambiarPaginaMicroformas = function(direccion) {
            paginaActualMicroformas += direccion;
            renderTablaMicroformas();
        };

        window.eliminarMicroforma = async function(id) {
            const currentUserObj = auth.currentUser;
            const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

            if (!puedeEditarMicroformas(currentUserName)) {
                Swal.fire('Acceso denegado', 'No cuenta con autorización para eliminar bloques de microformas.', 'error');
                return;
            }

            const confirmacion = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar bloque?',
                text: 'El bloque de microformas quedará inactivo.',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                confirmButtonColor: '#800000'
            });

            if (!confirmacion.isConfirmed) return;

            try {
                await updateDoc(doc(db, "control_microformas", id), { 
                    activo: false,
                    auditoriaEliminacion: { nombre: currentUserName, timestamp: Date.now() }
                });
                Swal.fire({ icon: 'success', title: 'Bloque eliminado', timer: 1500, showConfirmButton: false });
                await cargarMicroformasDesdeCloud();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        let indiceEdicionRango = null;

        function abrirModalRango(index = null) {
            indiceEdicionRango = (index !== null && index !== undefined) ? index : null;
            document.getElementById('form-modal-rango').reset();
            document.getElementById('form-mod-add-faltante').reset();

            if (indiceEdicionRango !== null && listaRangosCenso[indiceEdicionRango]) {
                const r = listaRangosCenso[indiceEdicionRango];
                document.getElementById('mod-inicial').value = r.inicial;
                document.getElementById('mod-final').value = r.final;
                document.getElementById('mod-archivamiento').value = r.archivamiento;
                listaFaltantesModal = [...(r.detalleFaltantes || [])];
                document.getElementById('modal-rango-titulo').innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Rango de Expedientes';
                document.getElementById('btn-guardar-rango-modal').innerText = 'Guardar Cambios';
            } else {
                listaFaltantesModal = [];
                document.getElementById('modal-rango-titulo').innerHTML = '<i class="bi bi-folder-plus me-2"></i>Configurar Rango de Expedientes';
                document.getElementById('btn-guardar-rango-modal').innerText = 'Agregar a Inventario';
            }

            renderTablaFaltantesModal();
            modalInstance = new bootstrap.Modal(document.getElementById('modalAgregarRango'));
            modalInstance.show();
        }

        function cerrarModalRango() {
            indiceEdicionRango = null;
            if(modalInstance) modalInstance.hide();
        }

        function extraerNumero(cadena) {
            if (!cadena) return 0;
            const match = cadena.match(/(\d+)(?!.*\d)/);
            return match ? parseInt(match[0], 10) : 0;
        }

        function extraerPrefijo(cadena) {
            if (!cadena) return '';
            const match = cadena.match(/(\d+)(?!.*\d)/);
            if (!match) return cadena.trim().toUpperCase();
            return cadena.slice(0, match.index).trim().toUpperCase();
        }

        document.getElementById('form-mod-add-faltante').addEventListener('submit', function(e) {
            e.preventDefault();
            const desdeStr = document.getElementById('mod-falt-desde').value.trim();
            let hastaStr = document.getElementById('mod-falt-hasta').value.trim();
            let cant = 1;

            if(!desdeStr) return;

            const rangoInicial = document.getElementById('mod-inicial').value.trim();
            const rangoFinal = document.getElementById('mod-final').value.trim();

            if (!rangoInicial || !rangoFinal) {
                Swal.fire('Atención', 'Primero complete el Número Inicial y Final del rango antes de registrar faltantes.', 'warning');
                return;
            }

            const prefijoRango = extraerPrefijo(rangoInicial);
            const prefijoDesde = extraerPrefijo(desdeStr);
            if (prefijoDesde !== prefijoRango) {
                Swal.fire('Código no coincide', `El expediente "${desdeStr}" no pertenece al código del rango.`, 'error');
                return;
            }

            const nRangoIni = extraerNumero(rangoInicial);
            const nRangoFin = extraerNumero(rangoFinal);
            const nDesde = extraerNumero(desdeStr);
            if (nDesde < nRangoIni || nDesde > nRangoFin) {
                Swal.fire('Fuera de rango', `El expediente "${desdeStr}" está fuera de los límites del rango.`, 'error');
                return;
            }

            if (!hastaStr || hastaStr === desdeStr) {
                hastaStr = "Único";
                cant = 1;
            } else {
                const prefijoHasta = extraerPrefijo(hastaStr);
                if (prefijoHasta !== prefijoRango) {
                    Swal.fire('Código no coincide', `El expediente "${hastaStr}" no pertenece al código del rango.`, 'error');
                    return;
                }
                const nD = nDesde;
                const nH = extraerNumero(hastaStr);
                if (nH < nRangoIni || nH > nRangoFin) {
                    Swal.fire('Fuera de rango', `El expediente "${hastaStr}" está fuera de los límites.`, 'error');
                    return;
                }
                if(nH < nD) { Swal.fire('Error', 'Rango de faltante al revés.', 'error'); return; }
                cant = (nH - nD) + 1;
            }

            listaFaltantesModal.push({ desde: desdeStr, hasta: hastaStr, cantidad: cant });
            document.getElementById('form-mod-add-faltante').reset();
            renderTablaFaltantesModal();
        });

        function renderTablaFaltantesModal() {
            const tbody = document.getElementById('mod-tabla-faltantes-body');
            tbody.innerHTML = '';
            if(listaFaltantesModal.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No se registran faltantes en este tramo.</td></tr>`;
                return;
            }
            listaFaltantesModal.forEach((f, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${f.desde}</td><td><span class="badge bg-secondary">${f.hasta}</span></td><td class="text-center fw-bold text-danger">${f.cantidad}</td><td class="text-end"><button type="button" class="btn btn-xs btn-outline-danger py-0 px-1" onclick="window.eliminarFaltanteInterno(${idx})"><i class="bi bi-x"></i></button></td>`;
                tbody.appendChild(tr);
            });
        }

        window.eliminarFaltanteInterno = function(index) {
            listaFaltantesModal.splice(index, 1);
            renderTablaFaltantesModal();
        };

        window.inyectarRangoAGrilla = function() {
            const ini = document.getElementById('mod-inicial').value.trim();
            const fin = document.getElementById('mod-final').value.trim();
            const arch = document.getElementById('mod-archivamiento').value;

            if(!ini || !fin) { Swal.fire('Atención', 'Defina los números del rango principal.', 'warning'); return; }

            const prefijoIni = extraerPrefijo(ini);
            const prefijoFin = extraerPrefijo(fin);
            if (prefijoIni !== prefijoFin) {
                Swal.fire('Formato inconsistente', `El Rango Inicial ("${ini}") y el Rango Final ("${fin}") no comparten el mismo código.`, 'error');
                return;
            }

            const nIni = extraerNumero(ini);
            const nFin = extraerNumero(fin);
            if(nFin < nIni) { Swal.fire('Error', 'Rango inválido.', 'error'); return; }

            const totalTeorico = (nFin - nIni) + 1;
            const totalFaltantes = listaFaltantesModal.reduce((sum, f) => sum + f.cantidad, 0);
            const totalReal = Math.max(0, totalTeorico - totalFaltantes);

            const rangoData = {
                inicial: ini,
                final: fin,
                archivamiento: arch,
                teorico: totalTeorico,
                faltantes: totalFaltantes,
                real: totalReal,
                detalleFaltantes: [...listaFaltantesModal]
            };

            if (indiceEdicionRango !== null && listaRangosCenso[indiceEdicionRango]) {
                listaRangosCenso[indiceEdicionRango] = rangoData;
            } else {
                listaRangosCenso.push(rangoData);
            }
            indiceEdicionRango = null;

            cerrarModalRango();
            renderGrillaGrandeCenso();
            calcularConsolidadoGlobal();
        };

        function renderGrillaGrandeCenso() {
            const body = document.getElementById('tabla-censo-rangos-body');
            body.innerHTML = '';
            if(listaRangosCenso.length === 0) {
                body.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Ningún rango cargado al lote. Use el botón superior.</td></tr>`;
                return;
            }
            listaRangosCenso.forEach((r, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><code>${r.inicial}</code></td>
                    <td><code>${r.final}</code></td>
                    <td><span class="badge ${r.archivamiento==='Definitivo'?'bg-danger':'bg-warning text-dark'}">${r.archivamiento}</span></td>
                    <td class="text-center bg-light">${r.teorico}</td>
                    <td class="text-center text-danger fw-bold">${r.faltantes}</td>
                    <td class="text-center table-success fw-bold text-success">${r.real}</td>
                    <td class="text-end">
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-1.5 me-1" onclick="window.editarRangoDeGrilla(${idx})"><i class="bi bi-pencil"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-1.5" onclick="window.quitarRangoDeGrilla(${idx})"><i class="bi bi-trash3"></i></button>
                    </td>
                `;
                body.appendChild(tr);
            });
        }

        window.quitarRangoDeGrilla = function(index) {
            listaRangosCenso.splice(index, 1);
            renderGrillaGrandeCenso();
            calcularConsolidadoGlobal();
        };

        window.editarRangoDeGrilla = function(index) {
            abrirModalRango(index);
        };

        function calcularConsolidadoGlobal() {
            let sumT = 0, sumF = 0, sumR = 0;
            listaRangosCenso.forEach(r => { sumT += r.teorico; sumF += r.faltantes; sumR += r.real; });
            document.getElementById('calc-total-teorico').innerText = sumT;
            document.getElementById('calc-total-faltantes').innerText = sumF;
            document.getElementById('calc-total-real').innerText = sumR;
        }

        let idLoteEnEdicion = null;

        document.getElementById('form-inventario').addEventListener('submit', async (e) => {
            e.preventDefault();
            if(listaRangosCenso.length === 0) {
                Swal.fire('Atención', 'Debe inyectar al menos un rango para guardar el consolidado.', 'warning');
                return;
            }

            const currentUserObj = auth.currentUser;
            const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

            const consolidadoLote = {
                repositorio: document.getElementById('inv-repositorio').value,
                fecha: document.getElementById('inv-fecha').value,
                registra: document.getElementById('inv-registra').value, 
                recibe: document.getElementById('inv-recibe').value,
                observaciones: document.getElementById('inv-observaciones').value.trim() || 'Ninguna.',
                totalTeorico: parseInt(document.getElementById('calc-total-teorico').innerText, 10),
                totalFaltantes: parseInt(document.getElementById('calc-total-faltantes').innerText, 10),
                totalReal: parseInt(document.getElementById('calc-total-real').innerText, 10),
                matrizRangos: [...listaRangosCenso]
            };

            const esEdicion = !!idLoteEnEdicion;

            try {
                if (esEdicion) {
                    consolidadoLote.auditoriaEdicion = {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    };
                    await updateDoc(doc(db, "censo_institucional", idLoteEnEdicion), consolidadoLote);
                } else {
                    consolidadoLote.createdAt = Date.now();
                    consolidadoLote.activo = true;
                    consolidadoLote.auditoria = {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    };
                    await addDoc(collection(db, "censo_institucional"), consolidadoLote);
                }

                idLoteEnEdicion = null;
                document.getElementById('form-inventario').reset();
                document.getElementById('inv-fecha').valueAsDate = new Date();
                
                document.getElementById('inv-registra').value = currentUserName;
                document.getElementById('btn-guardar-inventario').innerText = 'Cerrar y Guardar Consolidado';

                listaRangosCenso = [];
                renderGrillaGrandeCenso();
                calcularConsolidadoGlobal();

                await cargarInventariosDesdeCloud();
                Swal.fire({ icon: 'success', title: esEdicion ? 'Inventario Actualizado' : 'Inventario Guardado', text:'Los registros se acoplaron de forma segura.' });
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        });

        async function cargarInventariosDesdeCloud() {
            try {
                const querySnapshot = await getDocs(collection(db, "censo_institucional"));
                baseDatosInventario = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosInventario.push(data);
                });

                baseDatosInventario.sort((a, b) => {
                    const ta = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : (a.createdAt || a.auditoria?.timestamp || 0);
                    const tb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : (b.createdAt || b.auditoria?.timestamp || 0);
                    return tb - ta;
                });

                actualizarDashboardGlobal();
                filtrarRegistros();
            } catch (error) { console.error(error); }
        }

        async function cargarHistorialReingresosParaDashboard() {
            try {
                const querySnapshot = await getDocs(collection(db, "reingresos"));
                baseDatosReingresos = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosReingresos.push(data);
                });
                baseDatosReingresos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                actualizarDashboardGlobal();
            } catch (error) {
                console.error(error);
            }
        }

        async function cargarHistorialTrasladosParaDashboard() {
            try {
                const querySnapshot = await getDocs(collection(db, "traslados"));
                baseDatosTraslados = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosTraslados.push(data);
                });
                baseDatosTraslados.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            } catch (error) {
                console.error(error);
            }
        }

        function actualizarDashboardGlobal() {
            let sT = 0, sF = 0, sR = 0;
            baseDatosInventario.forEach(lote => { 
                sT += Number(lote.totalTeorico) || 0; 
                sF += Number(lote.totalFaltantes) || 0; 
                sR += Number(lote.totalReal) || 0; 
            });

            document.getElementById('dash-total-teorico').innerText = sT;
            document.getElementById('dash-total-faltantes').innerText = sF;
            document.getElementById('dash-total-real').innerText = sR;

            const porcentajeIntegridad = sT > 0 ? ((sR / sT) * 100).toFixed(2) : "100.00";
            document.getElementById('dash-porcentaje').innerText = porcentajeIntegridad + "%";
            const elPorcentaje = document.getElementById('dash-porcentaje');
            elPorcentaje.style.color = porcentajeIntegridad < 90 ? 'var(--sipa-primary)' : 'inherit';

            let sumBloques = baseDatosMicroformas.length;
            let sumPaquetes = 0;
            let sumExpedientes = 0;
            let sumImágenes = 0;
            let sumFolios = 0;

            baseDatosMicroformas.forEach(m => {
                sumPaquetes += Number(m.cantPaquetes) || 0;
                sumExpedientes += Number(m.expedientes) || 0;
                sumImágenes += Number(m.imagenes) || 0;
                sumFolios += Number(m.folios) || 0;
            });

            document.getElementById('dash-micro-bloques').innerText = sumBloques.toLocaleString();
            document.getElementById('dash-micro-paquetes').innerText = sumPaquetes.toLocaleString();
            document.getElementById('dash-micro-expedientes').innerText = sumExpedientes.toLocaleString();
            document.getElementById('dash-micro-imagenes').innerText = sumImágenes.toLocaleString();
            document.getElementById('dash-micro-folios').innerText = sumFolios.toLocaleString();

            const hoyStr = new Date().toISOString().split('T')[0];
            const mesActualStr = hoyStr.substring(0, 7);

            let reingresosMesCount = 0;
            let reingresosHoyCount = 0;
            let totalAcompanadosCount = 0;

            baseDatosReingresos.forEach(reg => {
                const fechaReg = reg.fecha || '';
                if (fechaReg.startsWith(mesActualStr)) reingresosMesCount++;
                if (fechaReg === hoyStr) reingresosHoyCount++;
                if (reg.expedientes && Array.isArray(reg.expedientes)) {
                    reg.expedientes.forEach(e => {
                        totalAcompanadosCount += parseInt(e.acomp, 10) || 0;
                    });
                }
            });

            document.getElementById('dash-reingresos-mes').innerText = reingresosMesCount;
            document.getElementById('dash-reingresos-hoy').innerText = reingresosHoyCount;
            document.getElementById('dash-total-acompanados').innerText = totalAcompanadosCount;
        }

        function renderizarFiltrosConsultas(datos) {
            const body = document.getElementById('tabla-consultas-body');
            document.getElementById('contador-registros').innerText = `${datos.length} Lote(s) Registrado(s)`;
            body.innerHTML = '';
            if(datos.length === 0) {
                body.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No se acoplan lotes.</td></tr>`;
                return;
            }
            datos.forEach(l => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${l.fecha || 'N/A'}</td><td class="fw-semibold text-primary">${l.repositorio || 'N/A'}</td><td class="text-center fw-bold">${(l.matrizRangos || []).length}</td><td class="text-center">${l.totalTeorico ?? 0}</td><td class="text-center text-danger fw-bold">${l.totalFaltantes ?? 0}</td><td class="text-center table-success fw-bold text-success">${l.totalReal ?? 0}</td><td class="small">${l.registra || 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-danger py-1 px-2 me-1" onclick="window.generarPDFInstitucional('${l.id}')"><i class="bi bi-file-pdf"></i> PDF</button>
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="window.editarLoteInventario('${l.id}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-secondary py-1 px-2" onclick="window.eliminarRegistroLocal('${l.id}')"><i class="bi bi-trash3"></i></button>
                    </td>
                `;
                body.appendChild(tr);
            });
        }

        function filtrarRegistros() {
            const fRepo = document.getElementById('filtro-repo').value;
            const fTexto = document.getElementById('filtro-texto').value.toLowerCase().trim();
            const res = baseDatosInventario.filter(l => {
                const mR = fRepo === "" || l.repositorio === fRepo;
                const mT = fTexto === "" ||
                    (l.registra || "").toLowerCase().includes(fTexto) ||
                    (l.repositorio || "").toLowerCase().includes(fTexto) ||
                    (l.fecha || "").includes(fTexto);
                return mR && mT;
            });
            renderizarFiltrosConsultas(res);
        }

        window.eliminarRegistroLocal = function(id) {
            Swal.fire({
                title: '¿Expulsar Lote del Inventario?', text: "El lote quedará marcado como inactivo.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#800000', confirmButtonText: 'Sí, borrar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const currentUserObj = auth.currentUser;
                    const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

                    await updateDoc(doc(db, "censo_institucional", id), {
                        activo: false,
                        auditoriaEliminacion: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    });
                    await cargarInventariosDesdeCloud();
                }
            });
        };

        window.editarLoteInventario = function(id) {
            const lote = baseDatosInventario.find(l => l.id === id);
            if (!lote) return;

            idLoteEnEdicion = id;
            document.getElementById('inv-repositorio').value = lote.repositorio || '';
            document.getElementById('inv-fecha').value = lote.fecha || '';
            document.getElementById('inv-registra').value = lote.registra || '';
            document.getElementById('inv-recibe').value = lote.recibe || '';
            document.getElementById('inv-observaciones').value = (lote.observaciones && lote.observaciones !== 'Ninguna.') ? lote.observaciones : '';

            listaRangosCenso = JSON.parse(JSON.stringify(lote.matrizRangos || []));
            renderGrillaGrandeCenso();
            calcularConsolidadoGlobal();

            document.getElementById('btn-guardar-inventario').innerText = 'Guardar Cambios del Lote';
            switchView('view-inventario', `Editando Lote: ${lote.repositorio || ''} (${lote.fecha || ''})`);
        };

        window.iniciarNuevoInventario = function() {
            idLoteEnEdicion = null;
            document.getElementById('form-inventario').reset();
            document.getElementById('inv-fecha').valueAsDate = new Date();
            if (auth.currentUser) {
                document.getElementById('inv-registra').value = auth.currentUser.displayName ? normalizarTexto(auth.currentUser.displayName) : normalizarTexto(auth.currentUser.email.split('@')[0]);
            }
            document.getElementById('btn-guardar-inventario').innerText = 'Cerrar y Guardar Consolidado';
            listaRangosCenso = [];
            renderGrillaGrandeCenso();
            calcularConsolidadoGlobal();
            switchView('view-inventario', 'Carga de Inventario de Existencias');
        };

        window.cargarHistorialAuditoriaGlobal = async function() {
            try {
                const tbody = document.getElementById('tabla-auditoria-global');
                if (!tbody) return;
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Cargando registros de auditoría...</td></tr>`;

                listaLogsAuditoria = [];
                const selectUsuario = document.getElementById('filtro-aud-usuario');
                const usuarioSeleccionadoPrevio = selectUsuario ? selectUsuario.value : '';
                if(selectUsuario) selectUsuario.innerHTML = '<option value="">Todos los usuarios</option>';
                const setUsuariosUnicos = new Set();

                try {
                    const snapLogins = await getDocs(collection(db, "auditoria_logins"));
                    snapLogins.forEach(docSnap => {
                        const d = docSnap.data();
                        const timestamp = d.timestamp || 0;
                        const nombreUser = d.nombre || d.email || 'Desconocido';
                        setUsuariosUnicos.add(nombreUser);
                        listaLogsAuditoria.push({
                            fechaISO: timestamp ? new Date(timestamp).toISOString().split('T')[0] : '',
                            fecha: timestamp ? new Date(timestamp).toLocaleString() : 'N/A',
                            timestamp: timestamp,
                            modulo: 'Seguridad / Sesiones',
                            accion: 'Inicio de Sesión',
                            usuario: nombreUser,
                            detalle: `Acceso autorizado al sistema desde el correo: ${d.email || 'N/A'}`
                        });
                    });
                } catch(err) { console.warn(err); }

                // Helper genérico: agrega al log una entrada por cada evento de
                // auditoría embebido en un documento (creación / edición / baja),
                // para que TODAS las acciones del sistema queden trazadas, no
                // solo el inicio de sesión.
                const registrarEventoDoc = (evento, modulo, accionLabel, usuarioDefault, detalleTexto) => {
                    if (!evento) return;
                    const ts = evento.timestamp || 0;
                    const nombreUser = evento.nombre || usuarioDefault || 'Desconocido';
                    setUsuariosUnicos.add(nombreUser);
                    listaLogsAuditoria.push({
                        fechaISO: ts ? new Date(ts).toISOString().split('T')[0] : '',
                        fecha: ts ? new Date(ts).toLocaleString() : 'N/A',
                        timestamp: ts,
                        modulo,
                        accion: accionLabel,
                        usuario: nombreUser,
                        detalle: detalleTexto
                    });
                };

                try {
                    const snapCenso = await getDocs(collection(db, "censo_institucional"));
                    snapCenso.forEach(docSnap => {
                        const d = docSnap.data();
                        const detalle = `Repositorio: ${d.repositorio} | Fecha ejecución: ${d.fecha} | Total Real: ${d.totalReal}`;
                        registrarEventoDoc(d.auditoria || (d.createdAt ? { timestamp: d.createdAt, nombre: d.registra } : null), 'Inventario de Existencias', 'Creación de Lote', d.registra, detalle);
                        registrarEventoDoc(d.auditoriaEdicion, 'Inventario de Existencias', 'Actualización de Lote', d.registra, detalle);
                        registrarEventoDoc(d.auditoriaEliminacion, 'Inventario de Existencias', 'Eliminación / Baja de Lote', d.registra, detalle);
                    });
                } catch(err) { console.warn(err); }

                try {
                    const snapReingresos = await getDocs(collection(db, "reingresos"));
                    snapReingresos.forEach(docSnap => {
                        const d = docSnap.data();
                        const totalExp = Array.isArray(d.expedientes) ? d.expedientes.length : 0;
                        const detalle = `N° ${d.correlativo || 'S/N'} | Solicitante: ${d.solicitante || 'N/A'} | Local: ${d.local || 'N/A'} | Expedientes: ${totalExp}`;
                        registrarEventoDoc(d.auditoria, 'Reingresos', 'Registro de Reingreso', d.solicitante, detalle);
                        registrarEventoDoc(d.auditoriaEdicion, 'Reingresos', 'Edición de Reingreso', d.solicitante, detalle);
                        registrarEventoDoc(d.auditoriaEliminacion, 'Reingresos', 'Eliminación / Baja de Reingreso', d.solicitante, detalle);
                    });
                } catch(err) { console.warn(err); }

                try {
                    const snapTraslados = await getDocs(collection(db, "traslados"));
                    snapTraslados.forEach(docSnap => {
                        const d = docSnap.data();
                        const totalPaq = Array.isArray(d.paquetes) ? d.paquetes.length : 0;
                        const detalle = `N° ${d.correlativo || 'S/N'} | Recibe: ${d.recibe || 'N/A'} | Entrega: ${d.entregado || 'N/A'} | Paquetes: ${totalPaq}`;
                        registrarEventoDoc(d.auditoria, 'Formato de Traslado', 'Registro de Traslado', d.recibe, detalle);
                        registrarEventoDoc(d.auditoriaEdicion, 'Formato de Traslado', 'Edición de Traslado', d.recibe, detalle);
                        registrarEventoDoc(d.auditoriaEliminacion, 'Formato de Traslado', 'Eliminación / Baja de Traslado', d.recibe, detalle);
                    });
                } catch(err) { console.warn(err); }

                try {
                    const snapMicroformas = await getDocs(collection(db, "control_microformas"));
                    snapMicroformas.forEach(docSnap => {
                        const d = docSnap.data();
                        const detalle = `Bloque N° ${d.bloque || 'N/A'} | Juzgado: ${d.juzgado || 'N/A'} | Rango: ${d.rango || 'N/A'}`;
                        registrarEventoDoc(d.auditoriaCreacion, 'Control de Microformas', 'Creación de Bloque', null, detalle);
                        registrarEventoDoc(d.auditoriaEdicion, 'Control de Microformas', 'Edición de Bloque', null, detalle);
                        registrarEventoDoc(d.auditoriaEliminacion, 'Control de Microformas', 'Eliminación / Baja de Bloque', null, detalle);
                    });
                } catch(err) { console.warn(err); }

                try {
                    const snapTarjetas = await getDocs(collection(db, "tarjetas_paquetes"));
                    snapTarjetas.forEach(docSnap => {
                        const d = docSnap.data();
                        const totalPaq = Array.isArray(d.paquetesData) ? d.paquetesData.length : 0;
                        const detalle = `Juzgado: ${d.juzgado || 'N/A'} | Juez: ${d.juez || 'N/A'} | Repositorio: ${d.repositorio || 'N/A'} | Paquetes: ${totalPaq}`;
                        registrarEventoDoc(d.auditoria, 'Tarjetas Recepción', 'Generación de Tarjetas', d.personal, detalle);
                        registrarEventoDoc(d.auditoriaEdicion, 'Tarjetas Recepción', 'Edición de Tarjetas', d.personal, detalle);
                        registrarEventoDoc(d.auditoriaEliminacion, 'Tarjetas Recepción', 'Eliminación / Baja de Bloque de Tarjetas', d.personal, detalle);
                    });
                } catch(err) { console.warn(err); }

                if(selectUsuario) {
                    setUsuariosUnicos.forEach(u => {
                        selectUsuario.innerHTML += `<option value="${u}">${u}</option>`;
                    });
                    selectUsuario.value = usuarioSeleccionadoPrevio;
                }

                listaLogsAuditoria.sort((a, b) => b.timestamp - a.timestamp);
                filtrarAuditoria();

            } catch (error) {
                console.error(error);
                document.getElementById('tabla-auditoria-global').innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Error al cargar el historial de cambios.</td></tr>`;
            }
        };

        window.filtrarAuditoria = function() {
            const fFecha = document.getElementById('filtro-aud-fecha')?.value || '';
            const fAccion = document.getElementById('filtro-aud-accion')?.value || '';
            const fUsuario = document.getElementById('filtro-aud-usuario')?.value || '';

            const logsFiltrados = listaLogsAuditoria.filter(l => {
                const matchFecha = fFecha === '' || l.fechaISO === fFecha;
                const matchAccion = fAccion === '' || l.accion.includes(fAccion);
                const matchUsuario = fUsuario === '' || l.usuario === fUsuario;
                return matchFecha && matchAccion && matchUsuario;
            });

            paginaActualAuditoria = 1; // Reiniciar a página 1 al filtrar
            renderTablaAuditoria(logsFiltrados);
        };

        window.limpiarFiltrosAuditoria = function() {
            document.getElementById('filtro-aud-fecha').value = '';
            document.getElementById('filtro-aud-accion').value = '';
            document.getElementById('filtro-aud-usuario').value = '';
            filtrarAuditoria();
        };

        let logsFiltradosCache = [];

        function renderTablaAuditoria(logs) {
            logsFiltradosCache = logs;
            const tbody = document.getElementById('tabla-auditoria-global');
            if(!tbody) return;
            tbody.innerHTML = '';
            
            if (logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No hay registros de auditoría que coincidan con los filtros.</td></tr>`;
                document.getElementById('info-paginacion-auditoria').innerText = 'Página 1 de 1';
                return;
            }

            const totalPaginas = Math.ceil(logs.length / registrosPorPagina) || 1;
            if (paginaActualAuditoria > totalPaginas) paginaActualAuditoria = totalPaginas;
            if (paginaActualAuditoria < 1) paginaActualAuditoria = 1;

            const inicio = (paginaActualAuditoria - 1) * registrosPorPagina;
            const fin = inicio + registrosPorPagina;
            const registrosPaginados = logs.slice(inicio, fin);

            document.getElementById('info-paginacion-auditoria').innerText = `Página ${paginaActualAuditoria} de ${totalPaginas} (Total: ${logs.length} registros)`;
            document.getElementById('btn-aud-prev').disabled = paginaActualAuditoria <= 1;
            document.getElementById('btn-aud-next').disabled = paginaActualAuditoria >= totalPaginas;

            registrosPaginados.forEach(l => {
                let badgeColor = 'bg-success';
                if (l.accion.includes('Eliminación')) badgeColor = 'bg-danger';
                if (l.accion.includes('Actualización') || l.accion.includes('Edición')) badgeColor = 'bg-warning text-dark';
                if (l.accion.includes('Inicio de Sesión')) badgeColor = 'bg-info text-dark';

                const tr = `<tr>
                    <td><small>${l.fecha}</small></td>
                    <td><span class="badge bg-secondary">${l.modulo}</span></td>
                    <td><span class="badge ${badgeColor}">${l.accion}</span></td>
                    <td class="fw-bold text-dark">${l.usuario}</td>
                    <td><small class="text-muted">${l.detalle}</small></td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', tr);
            });
        }

        window.cambiarPaginaAuditoria = function(direccion) {
            paginaActualAuditoria += direccion;
            renderTablaAuditoria(logsFiltradosCache);
        };

        window.imprimirReporteAuditoria = function() {
            const contenido = document.getElementById('tabla-auditoria-container');
            if (!contenido) return;

            const ventana = window.open('', '', 'height=700,width=900');
            ventana.document.write('<html><head><title>Reporte de Auditoría - SAAMIR</title>');
            ventana.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">');
            ventana.document.write('<style>body { padding: 20px; font-family: Inter, sans-serif; }</style>');
            ventana.document.write('</head><body>');
            ventana.document.write('<h4 class="mb-3">Reporte General de Trazabilidad y Auditoría - SAAMIR</h4>');
            ventana.document.write(contenido.outerHTML);
            ventana.document.write('</body></html>');
            ventana.document.close();
            ventana.focus();
            setTimeout(() => {
                ventana.print();
                ventana.close();
            }, 600);
        };

        function mostrarModalPreviewPDF(url, nombreArchivo) {
            document.getElementById('pdf-preview-iframe').src = url;
            document.getElementById('btn-descargar-pdf-preview').onclick = () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = nombreArchivo;
                a.click();
            };
            new bootstrap.Modal(document.getElementById('modal-pdf-preview')).show();
        }

        window.generarPDFInstitucional = async function(id) {
            const lote = baseDatosInventario.find(l => l.id === id);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold"); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
            doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", pageWidth / 2, 16, { align: "center" });
            doc.setFontSize(9.5); doc.setFont("Inter", "normal");
            doc.text("ARCHIVO DESCONCENTRADO DE LA CSJSA", pageWidth / 2, 21, { align: "center" });

            doc.setFont("Inter", "bold"); doc.setFontSize(11); doc.setTextColor(128, 0, 0); 
            doc.text("SAAMIR - Sistema de Administración de Archivos, Microformas, Inventario y Reportes", pageWidth / 2, 27, { align: "center" });
            doc.setLineWidth(0.4); doc.setDrawColor(128, 0, 0); doc.line(15, 31, pageWidth - 15, 31);
            
            doc.setFontSize(11); doc.setTextColor(0, 0, 0);
            doc.text("INFORME CONSOLIDADO DE INVENTARIO DE EXISTENCIAS", pageWidth / 2, 38, { align: "center" });

            doc.setFontSize(9.5);
            doc.setFont("Inter", "bold");
            doc.text("Repositorio / Sede:", 15, 45);
            doc.setFont("Inter", "normal");
            doc.text(String(lote.repositorio), 48, 45);

            doc.setFont("Inter", "bold");
            doc.text("Fecha de Ejecución:", 15, 50);
            doc.setFont("Inter", "normal");
            doc.text(String(lote.fecha), 48, 50);

            const filasTablaAutotable = lote.matrizRangos.map((r, idx) => [
                (idx + 1).toString(),
                r.inicial,
                r.final,
                r.archivamiento,
                r.teorico.toString(),
                r.faltantes.toString(),
                r.real.toString()
            ]);

            filasTablaAutotable.push([ 'Σ', 'TOTAL CONSOLIDADO', '-', '-', lote.totalTeorico.toString(), lote.totalFaltantes.toString(), lote.totalReal.toString() ]);

            doc.autoTable({
                startY: 55,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 9 },
                styles: { fontSize: 8.5, font: 'Inter', cellPadding: 2 },
                columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 33, halign: 'center' }, 2: { cellWidth: 33, halign: 'center' }, 3: { cellWidth: 30, halign: 'center' }, 4: { cellWidth: 24, halign: 'center' }, 5: { cellWidth: 24, halign: 'center' }, 6: { cellWidth: 24, halign: 'center' } },
                head: [['Item', 'Rango Inicial', 'Rango Final', 'Archivamiento', 'Teórico', 'Faltantes', 'Total Real Físico']],
                body: filasTablaAutotable
            });

            let currentY = doc.lastAutoTable.finalY + 6;
            doc.setFont("Inter", "bold"); doc.setFontSize(8.5);
            doc.text("DETALLE ESPECÍFICO DE EXPEDIENTES EXCLUIDOS:", 15, currentY);
            currentY += 2;

            const subFaltantesBody = [];
            lote.matrizRangos.forEach(r => {
                if(r.detalleFaltantes && r.detalleFaltantes.length > 0) {
                    r.detalleFaltantes.forEach(f => {
                        subFaltantesBody.push([`${r.inicial} - ${r.final}`, r.archivamiento, f.desde, f.hasta, `${f.cantidad} unidad(es)`]);
                    });
                }
            });

            if(subFaltantesBody.length === 0) {
                subFaltantesBody.push(['-', '-', 'El lote completo coincide con los rangos correlativos. Sin exclusiones.', '-', '-']);
            }

            doc.autoTable({
                startY: currentY,
                margin: { left: 15, right: 15 },
                theme: 'striped',
                headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], halign: 'center', fontSize: 8 },
                styles: { fontSize: 7.5, cellPadding: 1.5 },
                head: [['Rango', 'Archivamiento', 'Faltante Desde', 'Faltante Hasta', 'Cantidad']],
                body: subFaltantesBody
            });

            currentY = doc.lastAutoTable.finalY + 6;
            doc.setFont("Inter", "bold"); doc.setFontSize(8.5);
            doc.text("OBSERVACIONES GENERALES DEL INVENTARIO:", 15, currentY);
            currentY += 4;
            doc.setFont("Inter", "normal"); doc.setFontSize(8);
            const obsTexto = lote.observaciones && lote.observaciones !== 'Ninguna.' ? lote.observaciones : 'Ninguna.';
            const splitObs = doc.splitTextToSize(obsTexto, pageWidth - 30);
            doc.text(splitObs, 15, currentY);
            currentY += (splitObs.length * 4) + 12;

            if (currentY > 255) { doc.addPage(); currentY = 30; }
            doc.setLineWidth(0.3);
            doc.line(35, currentY, 95, currentY);
            doc.line(115, currentY, 175, currentY);

            currentY += 4;
            doc.setFont("Inter", "bold"); doc.setFontSize(8);
            doc.text("USUARIO QUE REGISTRA", 65, currentY, { align: "center" });
            doc.text("USUARIO QUE RECIBE", 145, currentY, { align: "center" });

            currentY += 4;
            doc.setFont("Inter", "normal"); doc.setFontSize(7.5);
            doc.text(String(lote.registra || 'N/A').toUpperCase(), 65, currentY, { align: "center" });
            doc.text(String(lote.recibe || 'N/A').toUpperCase(), 145, currentY, { align: "center" });

            currentY += 4;
            doc.text("Personal de Archivo", 65, currentY, { align: "center" });
            doc.text("Personal de Archivo", 145, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            const repoLimpio = (lote.repositorio || '').replace(/[^a-zA-Z0-9]/g, '_');
            mostrarModalPreviewPDF(blobUrl, `INVENTARIO_${repoLimpio}_${lote.fecha}.pdf`);
        };

        // Contador atómico transaccional: evita colisiones de correlativo cuando
        // dos personas guardan casi al mismo tiempo, y crea el documento del
        // reingreso dentro de la MISMA transacción, así el correlativo asignado
        // siempre corresponde a un registro que sí quedó grabado en Firestore.
        async function guardarReingresoConCorrelativoAtomico(datosBase) {
            const contadorRef = doc(db, "contadores", "reingresos");
            const nuevoDocRef = doc(collection(db, "reingresos"));

            const resultado = await runTransaction(db, async (transaction) => {
                const contadorSnap = await transaction.get(contadorRef);
                const nuevoValor = (contadorSnap.exists() ? Number(contadorSnap.data().valor) || 0 : 0) + 1;

                const datosCompletos = { ...datosBase, correlativo: nuevoValor };

                transaction.set(contadorRef, { valor: nuevoValor });
                transaction.set(nuevoDocRef, datosCompletos);

                return { id: nuevoDocRef.id, correlativo: nuevoValor, datos: datosCompletos };
            });

            return resultado;
        }

        // Función única para reingresos: guarda primero en Firestore (con
        // correlativo atómico si es un registro nuevo) y solo después genera
        // el PDF con los datos ya confirmados en la base de datos. Así se evita
        // el desfase entre "Generar PDF" y "Guardar Registro" que producía
        // correlativos fantasma cuando el guardado nunca se completaba.
        async function procesarYGuardarReingreso() {
            const expedientes = Array.from(document.querySelectorAll("#tabla-reingresos tbody tr")).map(tr => {
                const inputs = tr.querySelectorAll('input, select');
                return { paquete: inputs[0].value, exp: inputs[1].value, folios: inputs[2].value, juzgado: inputs[3].value, tipo: inputs[4].value, acomp: inputs[5].value };
            });

            if (expedientes.length === 0) {
                Swal.fire('Atención', 'Agregue al menos un expediente antes de guardar.', 'warning');
                return;
            }

            const btnGuardar = document.getElementById('btn-guardar-reingreso');
            const btnGenerarPDF = document.querySelector('button[onclick="generarReporteReingresoPDF()"]');
            [btnGuardar, btnGenerarPDF].forEach(b => b?.setAttribute('disabled', 'true'));

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

                const fecha = document.getElementById('re-fecha').value;
                const solicitante = document.getElementById('re-solicitante').value;
                const local = document.getElementById('re-local').value;
                const entregado = document.getElementById('re-entregado').value;

                let correlativoFinal, datosParaPDF;

                if (idReingresoEnEdicion) {
                    const datosActualizados = {
                        fecha, solicitante, local, entregado, expedientes,
                        auditoriaEdicion: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    };

                    await updateDoc(doc(db, "reingresos", idReingresoEnEdicion), datosActualizados);

                    correlativoFinal = baseDatosReingresos.find(r => r.id === idReingresoEnEdicion)?.correlativo;
                    datosParaPDF = { ...datosActualizados, correlativo: correlativoFinal };
                    Swal.fire({ icon: 'success', title: 'Reingreso Actualizado', text: 'Los cambios se guardaron correctamente.' });
                } else {
                    const datosBase = {
                        fecha, solicitante, local, entregado, expedientes,
                        createdAt: Date.now(),
                        activo: true,
                        auditoria: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    };

                    const resultado = await guardarReingresoConCorrelativoAtomico(datosBase);
                    correlativoFinal = resultado.correlativo;
                    datosParaPDF = resultado.datos;
                    Swal.fire({ icon: 'success', title: 'Registro guardado con éxito' });
                }

                // El PDF se genera SIEMPRE a partir de datos que ya están
                // confirmados en Firestore, nunca de un correlativo calculado
                // localmente antes de guardar.
                await construirPDFReingreso({
                    correlativo: correlativoFinal,
                    fecha: datosParaPDF.fecha,
                    solicitante: datosParaPDF.solicitante,
                    local: datosParaPDF.local,
                    entregado: datosParaPDF.entregado,
                    expedientes: datosParaPDF.expedientes
                });

                resetFormularioReingreso();
                await cargarHistorialReingresosParaDashboard();
                switchView('view-consultas-reingresos', 'Consultar Historial de Reingresos');
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            } finally {
                [btnGuardar, btnGenerarPDF].forEach(b => b?.removeAttribute('disabled'));
            }
        }

        // Ambos botones ("Guardar Registro" y "Generar PDF") ejecutan el mismo
        // flujo seguro: guardar en Firestore y luego mostrar el PDF ya confirmado.
        window.guardarReingreso = procesarYGuardarReingreso;

        // Igual que con reingresos: correlativo + creación del documento en una
        // sola transacción atómica, para que nunca exista un correlativo que no
        // corresponda a un registro realmente grabado en Firestore.
        async function guardarTrasladoConCorrelativoAtomico(datosBase) {
            const contadorRef = doc(db, "contadores", "traslados");
            const nuevoDocRef = doc(collection(db, "traslados"));

            const resultado = await runTransaction(db, async (transaction) => {
                const contadorSnap = await transaction.get(contadorRef);
                const nuevoValor = (contadorSnap.exists() ? Number(contadorSnap.data().valor) || 0 : 0) + 1;

                const datosCompletos = { ...datosBase, correlativo: nuevoValor };

                transaction.set(contadorRef, { valor: nuevoValor });
                transaction.set(nuevoDocRef, datosCompletos);

                return { id: nuevoDocRef.id, correlativo: nuevoValor, datos: datosCompletos };
            });

            return resultado;
        }

        // Fusiona "Guardar Traslado" y "Generar PDF": primero se guarda (con
        // correlativo atómico si es nuevo) y el PDF se arma con los datos ya
        // confirmados en Firestore, nunca antes de guardar.
        async function procesarYGuardarTraslado() {
            const fecha = document.getElementById('tr-fecha').value;
            const entregado = document.getElementById('tr-entregado').value;
            const recibe = document.getElementById('tr-recibe').value;

            if (!recibe) {
                Swal.fire('Atención', 'Debe seleccionar quién recibe el traslado.', 'warning');
                return;
            }

            const paquetes = Array.from(document.querySelectorAll("#tabla-traslados tbody tr")).map(tr => {
                const desde = tr.querySelector('.tr-desde').value.trim();
                const hasta = tr.querySelector('.tr-hasta').value.trim();
                const inputs = tr.querySelectorAll('input, select');
                return { 
                    paqueteDesde: desde,
                    paqueteHasta: hasta || desde,
                    rangoTexto: hasta && hasta !== desde ? `${desde} al ${hasta}` : desde,
                    cantidad: parseInt(tr.querySelector('.tr-cant').textContent, 10) || 1,
                    juzgado: inputs[2].value, 
                    repoSalida: inputs[3].value, 
                    repoIngreso: inputs[4].value, 
                    motivo: inputs[5].value 
                };
            });

            if (paquetes.length === 0) {
                Swal.fire('Atención', 'Agregue al menos un rango de paquetes antes de guardar el traslado.', 'warning');
                return;
            }

            const btnGuardar = document.getElementById('btn-guardar-traslado');
            const btnGenerarPDF = document.querySelector('button[onclick="generarReporteTrasladoPDF()"]');
            [btnGuardar, btnGenerarPDF].forEach(b => b?.setAttribute('disabled', 'true'));

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

                let correlativoFinal, datosParaPDF;

                if (idTrasladoEnEdicion) {
                    const datosActualizados = {
                        fecha, entregado, recibe, paquetes,
                        auditoriaEdicion: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    };

                    await updateDoc(doc(db, "traslados", idTrasladoEnEdicion), datosActualizados);

                    correlativoFinal = baseDatosTraslados.find(r => r.id === idTrasladoEnEdicion)?.correlativo;
                    datosParaPDF = { ...datosActualizados, correlativo: correlativoFinal };
                    Swal.fire({ icon: 'success', title: 'Traslado Actualizado', text: 'Los cambios se guardaron correctamente.' });
                } else {
                    const datosBase = {
                        fecha, entregado, recibe, paquetes,
                        createdAt: Date.now(),
                        activo: true,
                        auditoria: {
                            uid: currentUserObj?.uid || null,
                            nombre: currentUserName,
                            timestamp: Date.now()
                        }
                    };

                    const resultado = await guardarTrasladoConCorrelativoAtomico(datosBase);
                    correlativoFinal = resultado.correlativo;
                    datosParaPDF = resultado.datos;
                    Swal.fire({ icon: 'success', title: 'Formato de traslado guardado con éxito' });
                }

                await construirPDFTraslado({
                    correlativo: correlativoFinal,
                    fecha: datosParaPDF.fecha,
                    entregado: datosParaPDF.entregado,
                    recibe: datosParaPDF.recibe,
                    paquetes: datosParaPDF.paquetes
                });

                resetFormularioTraslado();
                await cargarHistorialTrasladosParaDashboard();
                switchView('view-consultas-traslados', 'Consultar Historial de Traslados');
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            } finally {
                [btnGuardar, btnGenerarPDF].forEach(b => b?.removeAttribute('disabled'));
            }
        }

        window.guardarTraslado = procesarYGuardarTraslado;

        window.editarReingreso = function(id) {
            const registro = baseDatosReingresos.find(r => r.id === id);
            if (!registro) return;

            idReingresoEnEdicion = id;
            document.getElementById('re-fecha').value = registro.fecha || '';
            document.getElementById('re-solicitante').value = registro.solicitante || '';
            document.getElementById('re-local').value = registro.local || '';
            document.getElementById('re-entregado').value = registro.entregado || '';

            const tbody = document.querySelector('#tabla-reingresos tbody');
            tbody.innerHTML = '';

            if (registro.expedientes && Array.isArray(registro.expedientes)) {
                registro.expedientes.forEach(e => {
                    const fila = `<tr>
                        <td><input type="text" class="form-control form-control-sm" placeholder="Paquete" value="${e.paquete || ''}"></td>
                        <td><input type="text" class="form-control form-control-sm" placeholder="Expediente" value="${e.exp || ''}"></td>
                        <td><input type="number" class="form-control form-control-sm" value="${e.folios || 0}"></td>
                        <td><input type="text" class="form-control form-control-sm" placeholder="Juzgado" value="${e.juzgado || ''}"></td>
                        <td>
                            <select class="form-select form-select-sm">
                                <option value="Transitorio" ${e.tipo === 'Transitorio' ? 'selected' : ''}>Transitorio</option>
                                <option value="Definitivo" ${e.tipo === 'Definitivo' ? 'selected' : ''}>Definitivo</option>
                            </select>
                        </td>
                        <td><input type="number" class="form-control form-control-sm" value="${e.acomp || 0}"></td>
                        <td class="text-center">
                            <button class="btn btn-outline-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                    tbody.insertAdjacentHTML('beforeend', fila);
                });
            }

            document.getElementById('btn-guardar-reingreso').innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Cambios';
            switchView('view-reingresos', `Editando Reingreso N° ${registro.correlativo}`);
        };

        window.editarTraslado = function(id) {
            const registro = baseDatosTraslados.find(r => r.id === id);
            if (!registro) return;

            idTrasladoEnEdicion = id;
            document.getElementById('tr-fecha').value = registro.fecha || '';
            document.getElementById('tr-entregado').value = registro.entregado || '';
            document.getElementById('tr-recibe').value = registro.recibe || '';

            const tbody = document.querySelector('#tabla-traslados tbody');
            tbody.innerHTML = '';

            if (registro.paquetes && Array.isArray(registro.paquetes)) {
                registro.paquetes.forEach((e, idx) => {
                    agregarFilaTraslado(e.paqueteDesde || e.paquete || '', e.paqueteHasta || e.paquete || '', e.juzgado || '', e.repoSalida || '', e.repoIngreso || '', e.motivo || '');
                });
            }

            document.getElementById('btn-guardar-traslado').innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Cambios';
            actualizarTotalTraslados();
            switchView('view-traslados', `Editando Traslado N° ${registro.correlativo}`);
        };

        // NOTA: las antiguas obtenerSiguienteCorrelativoReingreso() y
        // obtenerSiguienteCorrelativoTraslado() (contar documentos con getDocs
        // y sumar 1) fueron eliminadas. Esa lógica calculaba el correlativo
        // fuera de cualquier transacción y de forma desacoplada del guardado,
        // lo que producía los "correlativos fantasma" del bug original. Ahora
        // el correlativo se calcula y confirma atómicamente junto con la
        // creación del documento en guardarReingresoConCorrelativoAtomico() /
        // guardarTrasladoConCorrelativoAtomico().

        window.eliminarReingreso = async function(id) {
            const registro = baseDatosReingresos.find(r => r.id === id);
            const confirmacion = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar reingreso?',
                text: registro ? `Se eliminará el registro N° ${registro.correlativo}.` : '',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                confirmButtonColor: '#800000'
            });
            if (!confirmacion.isConfirmed) return;

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

                await updateDoc(doc(db, "reingresos", id), {
                    activo: false,
                    auditoriaEliminacion: {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    }
                });
                Swal.fire({ icon: 'success', title: 'Registro eliminado', timer: 1500, showConfirmButton: false });
                await window.cargarHistorialReingresos();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.eliminarTraslado = async function(id) {
            const registro = baseDatosTraslados.find(r => r.id === id);
            const confirmacion = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar traslado?',
                text: registro ? `Se eliminará el formato N° ${registro.correlativo}.` : '',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                confirmButtonColor: '#800000'
            });
            if (!confirmacion.isConfirmed) return;

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

                await updateDoc(doc(db, "traslados", id), {
                    activo: false,
                    auditoriaEliminacion: {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    }
                });
                Swal.fire({ icon: 'success', title: 'Registro eliminado', timer: 1500, showConfirmButton: false });
                await window.cargarHistorialTraslados();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.cargarHistorialReingresos = async function() {
            try {
                const querySnapshot = await getDocs(collection(db, "reingresos"));
                baseDatosReingresos = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosReingresos.push(data);
                });
                baseDatosReingresos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                filtrarHistorialReingresos();
            } catch (error) {
                console.error(error);
            }
        };

        window.cargarHistorialTraslados = async function() {
            try {
                const querySnapshot = await getDocs(collection(db, "traslados"));
                baseDatosTraslados = [];
                querySnapshot.forEach((doc) => {
                    const data = { id: doc.id, ...doc.data() };
                    if (data.activo !== false) baseDatosTraslados.push(data);
                });
                baseDatosTraslados.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                filtrarHistorialTraslados();
            } catch (error) {
                console.error(error);
            }
        };

        window.filtrarHistorialReingresos = function() {
            const fSolicitante = document.getElementById('filtro-re-solicitante')?.value || '';
            const fEntregado = document.getElementById('filtro-re-entregado')?.value || '';
            const fFecha = document.getElementById('filtro-re-fecha')?.value || '';
            const fTexto = (document.getElementById('busqueda-reingresos')?.value || '').toLowerCase().trim();

            const filtrados = baseDatosReingresos.filter(r => {
                const mSolicitante = fSolicitante === '' || r.solicitante === fSolicitante;
                const mEntregado = fEntregado === '' || r.entregado === fEntregado;
                const mFecha = fFecha === '' || r.fecha === fFecha;
                const mTexto = fTexto === '' || (r.local || '').toLowerCase().includes(fTexto) ||
                    (r.expedientes || []).some(e => (e.paquete || '').toLowerCase().includes(fTexto) || (e.exp || '').toLowerCase().includes(fTexto));
                return mSolicitante && mEntregado && mFecha && mTexto;
            });

            renderTablaHistorialReingresos(filtrados);
        };

        window.filtrarHistorialTraslados = function() {
            const fEntregado = document.getElementById('filtro-tr-entregado')?.value || '';
            const fFecha = document.getElementById('filtro-tr-fecha')?.value || '';
            const fTexto = (document.getElementById('busqueda-traslados')?.value || '').toLowerCase().trim();

            const filtrados = baseDatosTraslados.filter(r => {
                const mEntregado = fEntregado === '' || r.entregado === fEntregado;
                const mFecha = fFecha === '' || r.fecha === fFecha;
                const mTexto = fTexto === '' || (r.entregado || '').toLowerCase().includes(fTexto) ||
                    (r.paquetes || []).some(e => (e.paqueteDesde || '').toLowerCase().includes(fTexto) || (e.paqueteHasta || '').toLowerCase().includes(fTexto) || (e.motivo || '').toLowerCase().includes(fTexto) || (e.repoSalida || '').toLowerCase().includes(fTexto) || (e.repoIngreso || '').toLowerCase().includes(fTexto));
                return mEntregado && mFecha && mTexto;
            });

            renderTablaHistorialTraslados(filtrados);
        };

        function renderTablaHistorialReingresos(registros) {
            const tbody = document.getElementById('tabla-historial-reingresos');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (registros.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Sin reingresos registrados.</td></tr>`;
                return;
            }
            registros.forEach(data => {
                const fila = `<tr>
                    <td>${data.fecha || 'N/A'}</td>
                    <td>${data.solicitante || 'N/A'}</td>
                    <td>${data.local || 'N/A'}</td>
                    <td>${data.entregado || 'N/A'}</td>
                    <td>${data.expedientes ? data.expedientes.length : 0}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-danger py-1 px-2 me-1" onclick="window.generarPDFReingresoDesdeRegistro('${data.id}')" title="Ver PDF">
                            <i class="bi bi-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="window.editarReingreso('${data.id}')" title="Editar Registro">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="window.eliminarReingreso('${data.id}')" title="Eliminar Registro">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }

        function renderTablaHistorialTraslados(registros) {
            const tbody = document.getElementById('tabla-historial-traslados');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (registros.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Sin traslados registrados.</td></tr>`;
                return;
            }
            registros.forEach(data => {
                const totalPaqSuma = (data.paquetes || []).reduce((acc, p) => acc + (parseInt(p.cantidad, 10) || 1), 0);
                const fila = `<tr>
                    <td>${data.fecha || 'N/A'}</td>
                    <td>${data.entregado || 'N/A'}</td>
                    <td>${totalPaqSuma}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-danger py-1 px-2 me-1" onclick="window.generarPDFTrasladoDesdeRegistro('${data.id}')" title="Ver PDF">
                            <i class="bi bi-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="window.editarTraslado('${data.id}')" title="Editar Registro">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="window.eliminarTraslado('${data.id}')" title="Eliminar Registro">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }

        async function construirPDFReingreso({ correlativo, fecha, solicitante, local, entregado, expedientes }) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold"); doc.setTextColor(20, 20, 20); doc.setFontSize(11);
            doc.text("REPORTE DE EXPEDIENTES REINGRESADOS", pageWidth / 2, 16, { align: "center" });

            doc.setFont("Inter", "bold"); doc.setTextColor(128, 0, 0); doc.setFontSize(9.5);
            doc.text("SAAMIR - Sistema de Administración de Archivos, Microformas, Inventario y Reportes", pageWidth / 2, 22, { align: "center" });

            doc.setDrawColor(128, 0, 0); doc.setLineWidth(0.4);
            doc.line(15, 27, pageWidth - 15, 27);

            doc.setFont("Inter", "bold"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
            doc.text(`Correlativo (ID): ${String(correlativo).padStart(3, '0')}`, 15, 34);
            doc.text(`Fecha: ${fecha}`, pageWidth - 15, 34, { align: "right" });
            doc.text(`Solicitante: ${solicitante}`, 15, 40);
            doc.text(`Local de Reingreso: ${local}`, pageWidth - 15, 40, { align: "right" });
            doc.text(`Entregado por: ${entregado}`, 15, 46);

            let totalTransitorio = 0;
            let totalDefinitivo = 0;
            let totalAcompanados = 0;

            const filasTabla = expedientes.map((e, idx) => {
                if (e.tipo === 'Transitorio') totalTransitorio++;
                if (e.tipo === 'Definitivo') totalDefinitivo++;
                totalAcompanados += parseInt(e.acomp, 10) || 0;

                return [
                    (idx + 1).toString(), 
                    e.paquete || '-', 
                    e.exp || '-', 
                    e.folios || '0', 
                    e.juzgado || '-', 
                    e.tipo || 'Transitorio', 
                    e.acomp || '0', 
                    local
                ];
            });

            doc.autoTable({
                startY: 50,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                head: [['N°', 'N° Paquete', 'N° Expediente', 'Folios', 'Juzgado', 'Tipo', 'Acompañados', 'Repositorio']],
                body: filasTabla,
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontSize: 8.5, halign: 'center' },
                styles: { fontSize: 8, font: 'Inter', halign: 'center', cellPadding: 2 }
            });

            let currentY = doc.lastAutoTable.finalY + 8;
            doc.setFont("Inter", "bold"); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
            doc.text(`Total AT (Archivamiento Transitorio): ${totalTransitorio}`, 15, currentY);
            doc.text(`Total AD (Archivamiento Definitivo): ${totalDefinitivo}`, pageWidth / 2, currentY);
            
            currentY += 5;
            doc.text(`Total Expedientes: ${expedientes.length}`, 15, currentY);
            currentY += 5;
            doc.text(`Total Acompañados: ${totalAcompanados}`, 15, currentY);

            currentY += 20;
            if (currentY > 255) { doc.addPage(); currentY = 30; }

            doc.setLineWidth(0.3);
            doc.line(35, currentY, 95, currentY);
            doc.line(115, currentY, 175, currentY);

            currentY += 4;
            doc.setFont("Inter", "bold"); doc.setFontSize(8);
            doc.text(`Entregado por: ${entregado}`, 65, currentY, { align: "center" });
            doc.text(`Recibido por: ${solicitante}`, 145, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            mostrarModalPreviewPDF(blobUrl, `REINGRESOS_${String(correlativo).padStart(3, '0')}_${fecha}.pdf`);
        };

        async function construirPDFTraslado({ correlativo, fecha, entregado, recibe, paquetes }) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold"); doc.setTextColor(20, 20, 20); doc.setFontSize(11);
            doc.text("FORMATO DE TRASLADO DE PAQUETES", pageWidth / 2, 16, { align: "center" });

            doc.setFont("Inter", "bold"); doc.setTextColor(128, 0, 0); doc.setFontSize(9.5);
            doc.text("SAAMIR - Sistema de Administración de Archivos, Microformas, Inventario y Reportes", pageWidth / 2, 22, { align: "center" });

            doc.setDrawColor(128, 0, 0); doc.setLineWidth(0.4);
            doc.line(15, 27, pageWidth - 15, 27);

            doc.setFont("Inter", "bold"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
            doc.text(`Correlativo (ID): ${String(correlativo).padStart(3, '0')}`, 15, 34);
            doc.text(`Fecha: ${fecha}`, pageWidth - 15, 34, { align: "right" });
            doc.text(`Entregado por: ${entregado}`, 15, 40);
            doc.text(`Recibido por: ${recibe || 'N/A'}`, pageWidth - 15, 40, { align: "right" });

            let sumaTotalPaq = 0;
            const filasTabla = paquetes.map((e, idx) => {
                const rangoStr = e.rangoTexto || (e.paqueteDesde && e.paqueteHasta ? (e.paqueteDesde === e.paqueteHasta ? e.paqueteDesde : `${e.paqueteDesde} al ${e.paqueteHasta}`) : (e.paquete || '-'));
                const cant = parseInt(e.cantidad, 10) || 1;
                sumaTotalPaq += cant;

                return [
                    (idx + 1).toString(),
                    rangoStr,
                    cant.toString(),
                    e.juzgado || '-',
                    e.repoSalida || '-',
                    e.repoIngreso || '-',
                    e.motivo || '-'
                ];
            });

            doc.autoTable({
                startY: 45,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                head: [['Ítem', 'Rango Paquetes', 'Cant.', 'Juzgado', 'Repo. Salida', 'Repo. Ingreso', 'Motivo']],
                body: filasTabla,
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontSize: 8.5, halign: 'center' },
                styles: { fontSize: 8, font: 'Inter', halign: 'center', cellPadding: 2 }
            });

            let currentY = doc.lastAutoTable.finalY + 8;
            doc.setFont("Inter", "bold"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
            doc.text(`Total general de paquetes trasladados: ${sumaTotalPaq}`, 15, currentY);

            currentY += 25;
            if (currentY > 255) { doc.addPage(); currentY = 30; }

            doc.setLineWidth(0.3);
            doc.line(35, currentY, 95, currentY);
            doc.line(115, currentY, 175, currentY);

            currentY += 4;
            doc.setFont("Inter", "bold"); doc.setFontSize(8);
            doc.text(`Entregado por: ${entregado}`, 65, currentY, { align: "center" });
            doc.text(`Recibido por: ${recibe || 'N/A'}`, 145, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            mostrarModalPreviewPDF(blobUrl, `TRASLADO_${String(correlativo).padStart(3, '0')}_${fecha}.pdf`);
        }

        // IMPORTANTE: "Generar PDF" ya NO calcula un correlativo aparte ni arma
        // el PDF de forma independiente del guardado. Apunta al mismo flujo que
        // "Guardar Registro" (guardar en Firestore primero, PDF después) para
        // que sea imposible que exista un PDF con un correlativo que no llegó
        // a grabarse en la base de datos.
        window.generarReporteReingresoPDF = procesarYGuardarReingreso;
        window.generarReporteTrasladoPDF = procesarYGuardarTraslado;

        window.generarPDFReingresoDesdeRegistro = async function(id) {
            const registro = baseDatosReingresos.find(r => r.id === id);
            if (!registro) return;
            await construirPDFReingreso({
                correlativo: registro.correlativo ?? '-',
                fecha: registro.fecha,
                solicitante: registro.solicitante,
                local: registro.local,
                entregado: registro.entregado,
                expedientes: registro.expedientes || []
            });
        };

        window.generarPDFTrasladoDesdeRegistro = async function(id) {
            const registro = baseDatosTraslados.find(r => r.id === id);
            if (!registro) return;
            await construirPDFTraslado({
                correlativo: registro.correlativo ?? '-',
                fecha: registro.fecha,
                entregado: registro.entregado,
                recibe: registro.recibe,
                paquetes: registro.paquetes || []
            });
        };

        window.generarPDFMicroformasInstitucional = async function() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold");
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", pageWidth / 2, 16, { align: "center" });

            doc.setFontSize(9.5);
            doc.setFont("Inter", "normal");
            doc.text("Archivo Desconcentrado - Línea de Producción de Microformas Digitales", pageWidth / 2, 21, { align: "center" });

            doc.setFont("Inter", "bold");
            doc.setFontSize(11);
            doc.setTextColor(128, 0, 0);
            doc.text("CONTROL DE PRODUCCIÓN DE MICROFORMAS DIGITALES", pageWidth / 2, 27, { align: "center" });

            doc.setLineWidth(0.4);
            doc.setDrawColor(128, 0, 0);
            doc.line(15, 31, pageWidth - 15, 31);

            if (baseDatosMicroformas.length === 0) {
                Swal.fire('Atención', 'No hay registros de microformas para generar el PDF.', 'warning');
                return;
            }

            const aNumero = (valor) => {
                if (valor === null || valor === undefined || valor === '') return 0;
                if (typeof valor === 'number') return valor;
                const limpio = String(valor).replace(/[^\d-]/g, '');
                const n = parseInt(limpio, 10);
                return isNaN(n) ? 0 : n;
            };

            const normalizarRango = (texto) => {
                if (!texto) return texto;
                return String(texto).split(' y del ').map(parte => {
                    const m = parte.trim().match(/^(.+?)\s+al\s+(.+)$/i);
                    if (m) {
                        const desde = m[1].trim();
                        const hasta = m[2].trim();
                        return desde === hasta ? desde : `${desde} al ${hasta}`;
                    }
                    return parte.trim();
                }).join(' y del ');
            };

            let sumaPaquetes = 0;
            let sumaFolios = 0;
            let sumaImagenes = 0;
            let sumaRegistros = 0;
            let sumaExpedientes = 0;

            const filas = baseDatosMicroformas.map(item => {
                const fIni = item.fecInicio ? item.fecInicio.split('-').reverse().join('/') : '';
                const fFin = item.fecFin ? item.fecFin.split('-').reverse().join('/') : '';
                const fGrab = item.fecGrabacion ? item.fecGrabacion.split('-').reverse().join('/') : '';

                const textoRangoBase = item.rango || (
                    item.paqueteDesde && item.paqueteHasta
                        ? (item.paqueteDesde === item.paqueteHasta
                            ? `${item.paqueteDesde}`
                            : `${item.paqueteDesde} al ${item.paqueteHasta}`)
                        : 'N/A'
                );
                const textoRango = normalizarRango(textoRangoBase);

                const cantPaquetes = aNumero(item.cantPaquetes);
                const folios = aNumero(item.folios);
                const imagenes = aNumero(item.imagenes);
                const registros = aNumero(item.registros);
                const expedientes = aNumero(item.expedientes);

                sumaPaquetes += cantPaquetes;
                sumaFolios += folios;
                sumaImagenes += imagenes;
                sumaRegistros += registros;
                sumaExpedientes += expedientes;

                return [
                    item.bloque ?? 'N/A',
                    textoRango,
                    cantPaquetes,
                    item.juzgado || 'N/A',
                    folios,
                    imagenes,
                    registros,
                    expedientes,
                    item.mes || 'N/A',
                    fIni,
                    fFin,
                    fGrab
                ];
            });

            filas.push([
                'TOTAL',
                '-',
                sumaPaquetes,
                '-',
                sumaFolios,
                sumaImagenes,
                sumaRegistros,
                sumaExpedientes,
                '-',
                '-',
                '-',
                '-'
            ]);

            doc.autoTable({
                startY: 38,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                tableWidth: 267,
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
                styles: { fontSize: 7.5, font: 'Inter', cellPadding: 2, halign: 'center', overflow: 'linebreak', valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 18 },
                    1: { cellWidth: 32 },
                    2: { cellWidth: 16 },
                    3: { cellWidth: 51 },
                    4: { cellWidth: 18 },
                    5: { cellWidth: 18 },
                    6: { cellWidth: 18 },
                    7: { cellWidth: 16 },
                    8: { cellWidth: 20 },
                    9: { cellWidth: 20 },
                    10: { cellWidth: 20 },
                    11: { cellWidth: 20 }
                },
                head: [[
                    { content: 'BLOQUE', rowSpan: 2 },
                    { content: 'RANGO PAQUETES', rowSpan: 2 },
                    { content: 'CANT. PAQ.', rowSpan: 2 },
                    { content: 'JUZGADO', rowSpan: 2 },
                    { content: 'FOLIOS / IMÁGENES', colSpan: 2 },
                    { content: 'TOTAL REG.', rowSpan: 2 },
                    { content: 'CANT. EXP.', rowSpan: 2 },
                    { content: 'MES', rowSpan: 2 },
                    { content: 'FECHAS', colSpan: 2 },
                    { content: 'GRABACIÓN', rowSpan: 2 }
                ],
                [
                    'FOLIOS',
                    'IMÁGENES',
                    'INICIO',
                    'FIN'
                ]],
                body: filas
            });

            let currentY = doc.lastAutoTable.finalY + 28;
            if (currentY > 180) { doc.addPage(); currentY = 30; }

            doc.setLineWidth(0.3);
            doc.line(70, currentY, 140, currentY);
            doc.line(160, currentY, 230, currentY);

            currentY += 4;
            doc.setFont("Inter", "bold");
            doc.setFontSize(8);
            doc.text("VALIDADO POR JEFATURA", 195, currentY, { align: "center" });

            currentY += 4;
            doc.setFont("Inter", "bold");
            doc.setFontSize(7.5);
            doc.text(NOMBRE_SUPERVISOR_LPMD, 105, currentY, { align: "center" });
            doc.text("RESPONSABLE DE ARCHIVO DESCONCENTRADO", 195, currentY, { align: "center" });

            currentY += 3.5;
            doc.setFont("Inter", "normal");
            doc.setFontSize(7);
            doc.text("SUPERVISOR DE LA LÍNEA DE PRODUCCIÓN DE MICROFORMAS DIGITALES (LPMD)", 105, currentY, { align: "center" });

            currentY += 3.5;
            doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", 105, currentY, { align: "center" });

            currentY += 8;
            const fechaGeneracionMf = new Date().toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            doc.setFont("Inter", "italic");
            doc.setFontSize(7.5);
            doc.setTextColor(90, 90, 90);
            doc.text(`Fecha de creación / impresión: ${fechaGeneracionMf}`, pageWidth / 2, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            const fechaHoy = new Date().toISOString().split('T')[0];
            mostrarModalPreviewPDF(blobUrl, `CONTROL_MICROFORMAS_${fechaHoy}.pdf`);
        };

        window.generarPDFDashboardGlobal = async function() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();

            const logoData = await obtenerLogoArchivoBase64();
            if (logoData) {
                doc.addImage(logoData, 'PNG', 15, 10, 18, 18);
            }

            doc.setFont("Inter", "bold"); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
            doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", pageWidth / 2, 16, { align: "center" });
            doc.setFontSize(9.5); doc.setFont("Inter", "normal");
            doc.text("Archivo Desconcentrado - Dashboard Global Institucional", pageWidth / 2, 21, { align: "center" });

            doc.setFont("Inter", "bold"); doc.setFontSize(11); doc.setTextColor(128, 0, 0); 
            doc.text("SAAMIR - REPORTE EJECUTIVO GLOBAL", pageWidth / 2, 27, { align: "center" });
            doc.setLineWidth(0.4); doc.setDrawColor(128, 0, 0); doc.line(15, 31, pageWidth - 15, 31);

            let sT = document.getElementById('dash-total-teorico').innerText;
            let sF = document.getElementById('dash-total-faltantes').innerText;
            let sR = document.getElementById('dash-total-real').innerText;
            let pI = document.getElementById('dash-porcentaje').innerText;

            let mB = document.getElementById('dash-micro-bloques').innerText;
            let mP = document.getElementById('dash-micro-paquetes').innerText;
            let mE = document.getElementById('dash-micro-expedientes').innerText;
            let mIm = document.getElementById('dash-micro-imagenes').innerText;
            let mFo = document.getElementById('dash-micro-folios').innerText;

            let rM = document.getElementById('dash-reingresos-mes').innerText;
            let rH = document.getElementById('dash-reingresos-hoy').innerText;
            let tA = document.getElementById('dash-total-acompanados').innerText;

            doc.setFont("Inter", "bold"); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
            doc.text("1. RESUMEN DE INVENTARIO INSTITUCIONAL", 15, 39);

            doc.autoTable({
                startY: 42,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
                styles: { fontSize: 8, font: 'Inter', halign: 'center' },
                head: [['Total Teórico General', 'Total Faltantes Excluidos', 'Total Real en Custodia', 'Porcentaje de Integridad']],
                body: [[sT, sF, sR, pI]]
            });

            let currentY = doc.lastAutoTable.finalY + 10;
            doc.setFont("Inter", "bold"); doc.setFontSize(9.5);
            doc.text("2. PRODUCCIÓN DE MICROFORMAS DIGITALES (ACUMULADO)", 15, currentY);

            doc.autoTable({
                startY: currentY + 3,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
                styles: { fontSize: 8, font: 'Inter', halign: 'center' },
                head: [['Bloques', 'Paquetes', 'Expedientes', 'Imágenes', 'Folios']],
                body: [[mB, mP, mE, mIm, mFo]]
            });

            currentY = doc.lastAutoTable.finalY + 10;
            doc.setFont("Inter", "bold"); doc.setFontSize(9.5);
            doc.text("3. MÉTRICAS OPERATIVAS DE REINGRESOS", 15, currentY);

            doc.autoTable({
                startY: currentY + 3,
                margin: { left: 15, right: 15 },
                theme: 'grid',
                headStyles: { fillColor: [90, 90, 90], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
                styles: { fontSize: 8, font: 'Inter', halign: 'center' },
                head: [['Reingresos del Mes', 'Reingresos de Hoy', 'Total Acompañados']],
                body: [[rM, rH, tA]]
            });

            currentY = doc.lastAutoTable.finalY + 12;
            if (currentY > 270) { doc.addPage(); currentY = 30; }

            const fechaGeneracion = new Date().toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            doc.setFont("Inter", "italic"); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
            doc.text(`Fecha de creación / impresión: ${fechaGeneracion}`, pageWidth / 2, currentY, { align: "center" });

            const blobUrl = doc.output('bloburl');
            const fechaHoy = new Date().toISOString().split('T')[0];
            mostrarModalPreviewPDF(blobUrl, `REPORTE_GLOBAL_${fechaHoy}.pdf`);
        };

        // MOTOR DE GENERACIÓN DE TARJETAS DE PAQUETES (PDF HORIZONTAL 2x1)
        // Rediseñado para replicar el formato físico real: logo del Archivo
        // Desconcentrado en la esquina superior izquierda, logo oficial del
        // Poder Judicial del Perú en la esquina superior derecha, título
        // institucional centrado, y tipografía/tamaños alineados al modelo.
        async function construirPDFTarjetas({ anioIngreso, personal, tipoArchivo, repositorio, juzgado, juez, fechaRecepcion, oficio, paquetesData }) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' }); // Horizontal (landscape: 297 x 210 mm)

            const FUENTE = 'helvetica';

            const [logoArchivo, logoPJ] = await Promise.all([
                obtenerImagenBase64('LOGO_PJ-AD.png'),
                obtenerImagenBase64('LOGO_PJ.jpg')
            ]);

            // Formatea la fecha ISO (yyyy-mm-dd) que llega del <input type="date">
            // o que quedó guardada en la base de datos, al formato solicitado DD-MM-AA.
            const formatearFechaDDMMAA = (fechaISO) => {
                if (!fechaISO) return '';
                const partes = String(fechaISO).split('-');
                if (partes.length !== 3) return fechaISO;
                const [anio, mes, dia] = partes;
                return `${dia}-${mes}-${anio.slice(-2)}`;
            };
            const fechaRecepcionFormateada = formatearFechaDDMMAA(fechaRecepcion);

            const dibujarTarjeta = (x, y, dataPaquete) => {
                const w = 130;
                const h = 190;

                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.4);
                doc.setFillColor(255, 255, 255);
                doc.rect(x, y, w, h, 'FD');

                // Logo del Archivo Desconcentrado (esquina superior izquierda)
                if (logoArchivo) {
                    const lado = 20;
                    doc.addImage(logoArchivo.data, 'PNG', x + 4, y + 3, lado, lado * (logoArchivo.h / logoArchivo.w));
                }

                // Logo oficial del Poder Judicial del Perú (esquina superior derecha)
                if (logoPJ) {
                    const anchoLogo = 18;
                    const altoLogo = anchoLogo * (logoPJ.h / logoPJ.w);
                    doc.addImage(logoPJ.data, 'JPEG', x + w - 4 - anchoLogo, y + 4, anchoLogo, altoLogo);
                }

                doc.setFont(FUENTE, 'bold');
                doc.setFontSize(11.5);
                doc.setTextColor(0, 0, 0);
                doc.text("PODER JUDICIAL DEL PERÚ", x + w / 2, y + 9, { align: "center" });

                doc.setFontSize(7.5);
                doc.text("CORTE SUPERIOR DE JUSTICIA DEL SANTA", x + w / 2, y + 13.5, { align: "center" });
                doc.text("ARCHIVO DESCONCENTRADO", x + w / 2, y + 17.5, { align: "center" });

                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.3);
                doc.line(x + 4, y + 21, x + w - 4, y + 21);

                let cursorY = y + 24.5;
                const altoFila = 12.5;

                // Reduce progresivamente el tamaño de fuente hasta que el texto
                // quepa dentro del ancho disponible de la casilla (evita que un
                // Juzgado con nombre largo se salga de su recuadro).
                const ajustarFuenteAncho = (texto, fontSizeIdeal, anchoDisponible, fontMin = 7) => {
                    doc.setFont(FUENTE, 'bold');
                    let fs = fontSizeIdeal;
                    doc.setFontSize(fs);
                    const textoStr = String(texto || '');
                    while (fs > fontMin && doc.getTextWidth(textoStr) > anchoDisponible) {
                        fs -= 0.5;
                        doc.setFontSize(fs);
                    }
                    return fs;
                };

                const filaDato = (label, valor, fontSizeValor = 10) => {
                    doc.setFont(FUENTE, 'bold');
                    doc.setFontSize(8);
                    doc.setTextColor(0, 0, 0);
                    doc.text(label, x + 5, cursorY + 4.5);

                    doc.setDrawColor(0, 0, 0);
                    doc.setFillColor(248, 248, 248);
                    doc.rect(x + 42, cursorY, w - 47, altoFila, 'FD');

                    const textoValor = String(valor || '');
                    const anchoDisponible = (w - 47) - 4;
                    ajustarFuenteAncho(textoValor, fontSizeValor, anchoDisponible);
                    doc.setTextColor(0, 0, 0);
                    doc.text(textoValor, x + 42 + ((w - 47) / 2), cursorY + (altoFila / 2) + 1.3, { align: "center" });
                    cursorY += altoFila + 3;
                };

                filaDato("TIPO DE ARCHIVO", tipoArchivo);
                filaDato("JUZGADO", juzgado, 16);
                filaDato("JUEZ", juez);

                // Paquete N° (Doble caja año / número) - datos clave en letra
                // más grande, ya que son los campos de identificación rápida
                // del paquete físico.
                doc.setFont(FUENTE, 'bold');
                doc.setFontSize(8);
                doc.setTextColor(0, 0, 0);
                doc.text("PAQUETE N°", x + 5, cursorY + 4.5);

                const halfW = (w - 47) / 2;
                doc.setDrawColor(0, 0, 0);
                doc.setFillColor(248, 248, 248);
                doc.rect(x + 42, cursorY, halfW, altoFila, 'FD');
                doc.rect(x + 42 + halfW, cursorY, halfW, altoFila, 'FD');

                const anchoDisponibleDoble = halfW - 4;
                const fsAnio = ajustarFuenteAncho(anioIngreso, 18, anchoDisponibleDoble);
                const fsPaq = ajustarFuenteAncho(dataPaquete.nroPaq, 18, anchoDisponibleDoble);

                doc.setFont(FUENTE, 'bold');
                doc.setFontSize(fsAnio);
                doc.setTextColor(0, 0, 0);
                doc.text(String(anioIngreso || ''), x + 42 + (halfW / 2), cursorY + (altoFila / 2) + 1.3, { align: "center" });
                doc.setFontSize(fsPaq);
                doc.text(String(dataPaquete.nroPaq || ''), x + 42 + halfW + (halfW / 2), cursorY + (altoFila / 2) + 1.3, { align: "center" });

                doc.setFont(FUENTE, 'normal');
                doc.setFontSize(5.5);
                doc.setTextColor(0, 0, 0);
                doc.text("AÑO DE INGRESO", x + 42 + (halfW / 2), cursorY + altoFila + 3, { align: "center" });
                doc.text("NÚMERO PAQUETE", x + 42 + halfW + (halfW / 2), cursorY + altoFila + 3, { align: "center" });

                cursorY += altoFila + 5.5;

                filaDato("CANT. EXPEDIENTES", dataPaquete.cantExp);
                filaDato("AÑO EXPEDIENTES", dataPaquete.anioExp);
                filaDato("DOC. ING. ARCHIVO", oficio);
                filaDato("FECHA RECEPCIÓN", fechaRecepcionFormateada);
                filaDato("TRABAJADO POR", personal);
                filaDato("REPOSITORIO", repositorio);
            };

            for (let i = 0; i < paquetesData.length; i += 2) {
                if (i > 0) doc.addPage();

                const yPos = 9;
                dibujarTarjeta(14, yPos, paquetesData[i]);

                if (i + 1 < paquetesData.length) {
                    dibujarTarjeta(153, yPos, paquetesData[i + 1]);

                    // Línea punteada guía de corte, justo al centro entre
                    // ambas tarjetas, para cortar la hoja después de
                    // enmicarla (laminarla).
                    const pageHeight = doc.internal.pageSize.getHeight();
                    const xCentro = (14 + 130 + 153) / 2; // centro entre el borde derecho de la 1ra y el borde izquierdo de la 2da
                    doc.setDrawColor(0, 0, 0);
                    doc.setLineWidth(0.3);
                    doc.setLineDashPattern([2, 1.5], 0);
                    doc.line(xCentro, 0, xCentro, pageHeight);
                    doc.setLineDashPattern([], 0); // se restablece la línea sólida para el resto del PDF
                }
            }

            const blobUrl = doc.output('bloburl');
            return blobUrl;
        }

        window.guardarYGenerarPDFTarjetas = async function() {
            const anioIngreso = document.getElementById('tar-anio-ingreso').value;
            const personal = document.getElementById('tar-personal').value;
            const tipoArchivo = document.getElementById('tar-tipo-archivo').value;
            const repositorio = document.getElementById('tar-repositorio').value;
            const juzgado = document.getElementById('tar-juzgado').value.trim().toUpperCase();
            const juez = document.getElementById('tar-juez').value.trim().toUpperCase();
            const fechaRecepcionRaw = document.getElementById('tar-fecha-recepcion').value;
            const oficio = document.getElementById('tar-oficio').value.trim().toUpperCase();

            const filas = document.querySelectorAll('#tabla-tarjetas-detalles tbody tr:not(#tarjetas-fila-vacia)');
            if (filas.length === 0) {
                Swal.fire('Atención', 'Agregue al menos una fila de paquete en la tabla.', 'warning');
                return;
            }

            const paquetesData = [];
            filas.forEach(tr => {
                const nroPaq = tr.querySelector('.tar-nro-paq').value.trim();
                const cantExp = tr.querySelector('.tar-cant-exp').value.trim();
                const anioExp = tr.querySelector('.tar-anio-exp').value.trim();
                if (nroPaq) {
                    paquetesData.push({ nroPaq, cantExp: cantExp || '0', anioExp: anioExp || '-' });
                }
            });

            if (paquetesData.length === 0) {
                Swal.fire('Atención', 'Ingrese al menos un número de paquete válido en las filas.', 'warning');
                return;
            }

            const currentUserObj = auth.currentUser;
            const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

            const datosTarjeta = {
                anioIngreso,
                personal,
                tipoArchivo,
                repositorio,
                juzgado,
                juez,
                fechaRecepcion: fechaRecepcionRaw,
                oficio,
                paquetesData
            };

            try {
                let tarjetaLote;
                if (idTarjetaEnEdicion) {
                    datosTarjeta.auditoriaEdicion = { nombre: currentUserName, timestamp: Date.now() };
                    await updateDoc(doc(db, "tarjetas_paquetes", idTarjetaEnEdicion), datosTarjeta);
                    tarjetaLote = datosTarjeta;
                    Swal.fire({ icon: 'success', title: 'Bloque de Tarjetas Actualizado', text: 'Los cambios se guardaron correctamente.' });
                } else {
                    tarjetaLote = {
                        ...datosTarjeta,
                        createdAt: Date.now(),
                        activo: true,
                        auditoria: { nombre: currentUserName, timestamp: Date.now() }
                    };
                    await addDoc(collection(db, "tarjetas_paquetes"), tarjetaLote);
                }

                const blobUrl = await construirPDFTarjetas(tarjetaLote);
                const fechaHoy = new Date().toISOString().split('T')[0];
                mostrarModalPreviewPDF(blobUrl, `TARJETAS_PAQUETES_${fechaHoy}.pdf`);
                resetFormularioTarjetas();
                await cargarHistorialTarjetas();
                switchView('view-consultas-tarjetas', 'Consultar Historial de Tarjetas');
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        async function cargarHistorialTarjetas() {
            try {
                const querySnapshot = await getDocs(collection(db, "tarjetas_paquetes"));
                baseDatosTarjetas = [];
                querySnapshot.forEach((docSnap) => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    if (data.activo !== false) baseDatosTarjetas.push(data);
                });
                baseDatosTarjetas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                filtrarHistorialTarjetas();
            } catch (error) {
                console.error(error);
            }
        }

        window.filtrarHistorialTarjetas = function() {
            const fJuzgado = (document.getElementById('filtro-tar-juzgado')?.value || '').toLowerCase().trim();
            const fRepo = document.getElementById('filtro-tar-repositorio')?.value || '';
            const fTexto = (document.getElementById('busqueda-tarjetas')?.value || '').toLowerCase().trim();

            const filtrados = baseDatosTarjetas.filter(t => {
                const mJuzgado = fJuzgado === '' || (t.juzgado || '').toLowerCase().includes(fJuzgado);
                const mRepo = fRepo === '' || t.repositorio === fRepo;
                const mTexto = fTexto === '' || 
                    (t.juez || '').toLowerCase().includes(fTexto) ||
                    (t.oficio || '').toLowerCase().includes(fTexto) ||
                    (t.personal || '').toLowerCase().includes(fTexto);
                return mJuzgado && mRepo && mTexto;
            });

            renderTablaHistorialTarjetas(filtrados);
        };

        function renderTablaHistorialTarjetas(registros) {
            const tbody = document.getElementById('tabla-historial-tarjetas');
            if (!tbody) return;
            tbody.innerHTML = '';
            if (registros.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Sin bloques de tarjetas registrados.</td></tr>`;
                return;
            }
            registros.forEach(data => {
                const fechaStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A';
                const totalPaq = data.paquetesData ? data.paquetesData.length : 0;
                const fila = `<tr>
                    <td>${fechaStr}</td>
                    <td><strong>${data.juzgado || 'N/A'}</strong><br><small class="text-muted">${data.juez || ''}</small></td>
                    <td><span class="badge bg-secondary">${data.tipoArchivo || ''}</span><br><small>${data.repositorio || ''}</small></td>
                    <td class="text-center fw-bold">${totalPaq}</td>
                    <td>${data.personal || 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="window.editarTarjeta('${data.id}')" title="Editar Registro">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger py-1 px-2 me-1" onclick="window.reimprimirTarjetas('${data.id}')" title="Generar PDF">
                            <i class="bi bi-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="window.eliminarTarjetasLote('${data.id}')" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }

        window.reimprimirTarjetas = async function(id) {
            const lote = baseDatosTarjetas.find(t => t.id === id);
            if (!lote) return;
            const blobUrl = await construirPDFTarjetas(lote);
            mostrarModalPreviewPDF(blobUrl, `TARJETAS_${lote.juzgado || 'LOTE'}.pdf`);
        };

        window.editarTarjeta = function(id) {
            const registro = baseDatosTarjetas.find(t => t.id === id);
            if (!registro) return;

            idTarjetaEnEdicion = id;

            const chkRecepcion = document.getElementById('tar-es-recepcion');
            const selectAnio = document.getElementById('tar-anio-ingreso');
            if (chkRecepcion && selectAnio) {
                const tieneAnio = !!registro.anioIngreso;
                chkRecepcion.checked = tieneAnio;
                window.toggleAnioIngresoTarjetas(chkRecepcion);
                if (tieneAnio) selectAnio.value = registro.anioIngreso;
            }

            document.getElementById('tar-juzgado').value = registro.juzgado || '';
            document.getElementById('tar-juez').value = registro.juez || '';
            document.getElementById('tar-fecha-recepcion').value = registro.fechaRecepcion || '';
            document.getElementById('tar-oficio').value = registro.oficio || '';

            const tbody = document.querySelector('#tabla-tarjetas-detalles tbody');
            tbody.innerHTML = '';
            if (registro.paquetesData && Array.isArray(registro.paquetesData) && registro.paquetesData.length > 0) {
                registro.paquetesData.forEach((paq, idx) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="fw-bold tar-item-nro">${idx + 1}</td>
                        <td><input type="number" class="form-control form-control-sm text-center fw-bold tar-nro-paq" value="${paq.nroPaq || ''}" oninput="actualizarResumenTarjeta(this)"></td>
                        <td><input type="number" class="form-control form-control-sm text-center tar-cant-exp" value="${paq.cantExp || ''}" min="1" oninput="actualizarResumenTarjeta(this)"></td>
                        <td><input type="text" class="form-control form-control-sm text-center tar-anio-exp" value="${paq.anioExp || ''}" oninput="actualizarResumenTarjeta(this)"></td>
                        <td class="text-start small text-muted tar-resumen">Paquete N° ${paq.nroPaq || '...'} (${paq.cantExp || '...'} exp. - Año: ${paq.anioExp || '...'})</td>
                        <td class="text-center">
                            <button type="button" class="btn btn-outline-danger btn-sm py-0 px-1" onclick="this.closest('tr').remove(); reindexarTarjetas();">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr id="tarjetas-fila-vacia">
                    <td colspan="6" class="text-center text-muted py-3">
                        Aún no ha añadido paquetes. Use los botones "+ Añadir Fila" o "+ Añadir 5 Filas".
                    </td>
                </tr>`;
            }

            const btnGuardar = document.querySelector('button[onclick="window.guardarYGenerarPDFTarjetas()"]');
            if (btnGuardar) btnGuardar.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Guardar Cambios';

            switchView('view-tarjetas', `Editando Tarjetas de ${registro.juzgado || 'Bloque'}`);
        };

        window.eliminarTarjetasLote = async function(id) {
            const confirmacion = await Swal.fire({
                icon: 'warning',
                title: '¿Eliminar bloque de tarjetas?',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                confirmButtonColor: '#800000'
            });
            if (!confirmacion.isConfirmed) return;

            try {
                const currentUserObj = auth.currentUser;
                const currentUserName = currentUserObj ? (currentUserObj.displayName ? normalizarTexto(currentUserObj.displayName) : normalizarTexto(currentUserObj.email.split('@')[0])) : 'DESCONOCIDO';

                await updateDoc(doc(db, "tarjetas_paquetes", id), {
                    activo: false,
                    auditoriaEliminacion: {
                        uid: currentUserObj?.uid || null,
                        nombre: currentUserName,
                        timestamp: Date.now()
                    }
                });
                Swal.fire({ icon: 'success', title: 'Registro eliminado', timer: 1500, showConfirmButton: false });
                await cargarHistorialTarjetas();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };

        window.switchView = switchView;
        window.abrirModalRango = abrirModalRango;
        window.cerrarModalRango = cerrarModalRango;
        window.filtrarRegistros = filtrarRegistros;
