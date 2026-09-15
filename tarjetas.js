        function agregarFilaReingreso() {
            const tbody = document.querySelector('#tabla-reingresos tbody');
            const fila = `<tr>
                <td><input type="text" class="form-control form-control-sm" placeholder="Paquete"></td>
                <td><input type="text" class="form-control form-control-sm" placeholder="Expediente"></td>
                <td><input type="number" class="form-control form-control-sm" value="0"></td>
                <td><input type="text" class="form-control form-control-sm" placeholder="Juzgado"></td>
                <td>
                    <select class="form-select form-select-sm">
                        <option value="Transitorio">Transitorio</option>
                        <option value="Definitivo">Definitivo</option>
                    </select>
                </td>
                <td><input type="number" class="form-control form-control-sm" value="0"></td>
                <td class="text-center">
                    <button class="btn btn-outline-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
            tbody.insertAdjacentHTML('beforeend', fila);
        }

        function agregarFilaTraslado(paqueteDesde = '', paqueteHasta = '', juzgado = '', repoSalida = '', repoIngreso = '', motivo = '') {
            const tbody = document.querySelector('#tabla-traslados tbody');
            const totalActual = tbody.querySelectorAll('tr').length + 1;
            const repoOpts = ["SÓTANO NCPP", "SAENZ PEÑA", "PADILLA", "DUNAS", "DOMUS"].map(r => `<option value="${r}" ${repoSalida === r ? 'selected' : ''}>${r}</option>`).join('');
            const repoIngOpts = ["SÓTANO NCPP", "SAENZ PEÑA", "PADILLA", "DUNAS", "DOMUS"].map(r => `<option value="${r}" ${repoIngreso === r ? 'selected' : ''}>${r}</option>`).join('');
            
            const fila = `<tr>
                <td class="fw-bold item-nro">${totalActual}</td>
                <td><input type="text" class="form-control form-control-sm text-center tr-desde" placeholder="Ej: 23-001 o E26-48" value="${paqueteDesde}" oninput="recalcularFilaTraslado(this)"></td>
                <td><input type="text" class="form-control form-control-sm text-center tr-hasta" placeholder="Ej: 23-050 o E26-74" value="${paqueteHasta}" oninput="recalcularFilaTraslado(this)"></td>
                <td><span class="badge bg-light text-dark border tr-cant fs-6">0</span></td>
                <td><input type="text" class="form-control form-control-sm" placeholder="Juzgado" value="${juzgado}"></td>
                <td><select class="form-select form-select-sm"><option value="">Seleccione...</option>${repoOpts}</select></td>
                <td><select class="form-select form-select-sm"><option value="">Seleccione...</option>${repoIngOpts}</select></td>
                <td><input type="text" class="form-control form-control-sm" placeholder="Motivo" value="${motivo}"></td>
                <td class="text-center">
                    <button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="this.parentElement.parentElement.remove(); reindexarTraslados();">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
            tbody.insertAdjacentHTML('beforeend', fila);
            
            const nuevaFilaTr = tbody.lastElementChild;
            recalcularFilaTraslado(nuevaFilaTr.querySelector('.tr-desde'));
        }

        function extraerNumeroFlexible(cadena) {
            if (!cadena) return null;
            const matches = cadena.match(/\d+/g);
            if (!matches || matches.length === 0) return null;
            return parseInt(matches[matches.length - 1], 10);
        }

        function recalcularFilaTraslado(elementoInput) {
            const tr = elementoInput.closest('tr');
            const desdeInput = tr.querySelector('.tr-desde').value.trim();
            const hastaInput = tr.querySelector('.tr-hasta').value.trim();
            const badgeCant = tr.querySelector('.tr-cant');

            let cantidadCalculada = 0;

            if (desdeInput && hastaInput) {
                const numDesde = extraerNumeroFlexible(desdeInput);
                const numHasta = extraerNumeroFlexible(hastaInput);
                if (numDesde !== null && numHasta !== null && numHasta >= numDesde) {
                    cantidadCalculada = (numHasta - numDesde) + 1;
                }
            } else if (desdeInput && !hastaInput) {
                cantidadCalculada = 1;
            }

            badgeCant.textContent = cantidadCalculada;
            actualizarTotalTraslados();
        }

        function reindexarTraslados() {
            const filas = document.querySelectorAll('#tabla-traslados tbody tr');
            filas.forEach((tr, idx) => {
                const tdItem = tr.querySelector('.item-nro');
                if (tdItem) tdItem.textContent = idx + 1;
            });
            actualizarTotalTraslados();
        }

        function actualizarTotalTraslados() {
            let sumaTotalPaquetes = 0;
            document.querySelectorAll('#tabla-traslados tbody tr').forEach(tr => {
                const badge = tr.querySelector('.tr-cant');
                if (badge) {
                    sumaTotalPaquetes += parseInt(badge.textContent, 10) || 0;
                }
            });
            const lbl = document.getElementById('lbl-total-traslados');
            if (lbl) lbl.textContent = sumaTotalPaquetes;
        }

        // FUNCIONES PARA EL GENERADOR DE TARJETAS DE PAQUETES
        // La tabla NO inicia con filas precargadas: el usuario agrega
        // filas manualmente con los botones "+ Añadir Fila" / "+ Añadir 5 Filas".
        window.agregarFilaTarjeta = function(cantidad = 1) {
            const tbody = document.querySelector('#tabla-tarjetas-detalles tbody');
            if (!tbody) return;

            const filaVacia = document.getElementById('tarjetas-fila-vacia');
            if (filaVacia) filaVacia.remove();

            for (let i = 0; i < cantidad; i++) {
                const idx = tbody.querySelectorAll('tr').length + 1;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold tar-item-nro">${idx}</td>
                    <td><input type="number" class="form-control form-control-sm text-center fw-bold tar-nro-paq" value="" placeholder="" oninput="actualizarResumenTarjeta(this)"></td>
                    <td><input type="number" class="form-control form-control-sm text-center tar-cant-exp" value="" placeholder="" min="1" oninput="actualizarResumenTarjeta(this)"></td>
                    <td><input type="text" class="form-control form-control-sm text-center tar-anio-exp" value="" placeholder="" oninput="actualizarResumenTarjeta(this)"></td>
                    <td class="text-start small text-muted tar-resumen">Paquete sin definir</td>
                    <td class="text-center">
                        <button type="button" class="btn btn-outline-danger btn-sm py-0 px-1" onclick="this.closest('tr').remove(); reindexarTarjetas();">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        };

        function reindexarTarjetas() {
            const tbody = document.querySelector('#tabla-tarjetas-detalles tbody');
            const filas = document.querySelectorAll('#tabla-tarjetas-detalles tbody tr:not(#tarjetas-fila-vacia)');
            filas.forEach((tr, idx) => {
                const tdItem = tr.querySelector('.tar-item-nro');
                if (tdItem) tdItem.textContent = idx + 1;
            });

            // Si el usuario elimina todas las filas, se vuelve a mostrar el
            // mensaje de estado vacío en lugar de dejar la tabla en blanco.
            if (tbody && filas.length === 0 && !document.getElementById('tarjetas-fila-vacia')) {
                tbody.innerHTML = `<tr id="tarjetas-fila-vacia">
                    <td colspan="6" class="text-center text-muted py-3">
                        Aún no ha añadido paquetes. Use los botones "+ Añadir Fila" o "+ Añadir 5 Filas".
                    </td>
                </tr>`;
            }
        }

        window.actualizarResumenTarjeta = function(inputEl) {
            const tr = inputEl.closest('tr');
            const nroPaq = tr.querySelector('.tar-nro-paq').value || '...';
            const cantExp = tr.querySelector('.tar-cant-exp').value || '...';
            const anioExp = tr.querySelector('.tar-anio-exp').value || '...';
            const tdResumen = tr.querySelector('.tar-resumen');
            if (tdResumen) {
                tdResumen.textContent = `Paquete N° ${nroPaq} (${cantExp} exp. - Año: ${anioExp})`;
            }
        };
