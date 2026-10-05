ASISTENTE REVISADO — 05/10/2026

Correcciones
- Las consultas por fecha concreta, rango, mes nombrado, próxima semana y próximo mes respetan el período solicitado.
- Rechaza fechas inexistentes y rangos invertidos.
- Una consulta de horarios libres con un rango sigue siendo una consulta de disponibilidad, no un listado de citas.
- Los espacios libres excluyen horas pasadas, cruces parciales con citas de una hora, feriados y bloqueos manuales. Permanece habilitada la creación manual de citas excepcionales en días bloqueados.
- Si citas, pacientes o bloqueos no han cargado, lo informa en lugar de responder con ceros o disponibilidad aparente.
- Proyección: suma citas activas cobradas y pendientes del período completo. Canceladas fuera del cálculo; soles y dólares separados.
- Los cobros se agrupan por fecha de cita porque esta versión no registra una fecha independiente del cobro. El asistente lo indica en sus respuestas.
- Las consultas de cancelaciones se limitan al período solicitado.
- Los pacientes atendidos se cuentan por citas completadas; los pacientes registrados se cuentan desde el directorio, incluso sin citas.
- Resumen de paciente y consulta de su horario requieren una coincidencia sin ambigüedad; prioriza identificadores de paciente.
- Preguntas de seguimiento conservan el período anterior cuando no se proporciona otro.
- Consultas reconocidas se resuelven localmente; Gemini se usa como respaldo de clasificación. No reemplaza una interpretación local ya reconocida.
- Se limita la espera de solicitudes a Gemini y se evitan consultas simultáneas por doble clic.
- El dictado administrativo reconstruye los resultados para evitar frases repetidas. Cerrar el chat detiene micrófono y lectura.
- La historia clínica mantiene revisión y guardado manual; si la extracción falla, conserva temporalmente el contenido para reintentar.

Alcance
El asistente consulta información administrativa y prepara campos de historia clínica. No crea, cancela ni modifica citas desde el chat; ahora lo informa expresamente ante esas órdenes. Para agendar, usa Nueva cita.

Verificación
29 pruebas automatizadas con datos ficticios: períodos, fechas inválidas, proyección, monedas, pagos, cancelaciones, feriados, carga de datos, solapamientos y pacientes ambiguos. Sintaxis de app.js y assistant.js validada.
No se realizaron solicitudes con una clave real de Gemini, cambios en Firebase ni pruebas de micrófono físico. Esas funciones deben comprobarse en el navegador del usuario.

Instalación
Reemplaza los archivos del sitio por esta carpeta y recarga con Ctrl+F5. Incluye la impresión de todos los pacientes y los colores de bloqueos solicitados. Las reglas Firebase ya ajustadas para scheduleBlocks se conservan.

Preguntas para probar
- ¿Qué horarios libres tengo el 08/10/2026?
- ¿Cuál es mi proyección del 07/09/2026 al 03/10/2026?
- ¿Y cuánto cobré?
- ¿Cuántos pacientes tengo en total?
- ¿Qué feriados y bloqueos tengo este mes?
- ¿Qué citas canceladas tengo este mes?
