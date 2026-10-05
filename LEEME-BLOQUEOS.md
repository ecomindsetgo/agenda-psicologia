BLOQUEOS DE HORARIOS Y FERIADOS

1. En Citas, abre «Revisar Horario».
2. En «Bloquear horarios y feriados», elige una fecha y mostrar como «Feriado» u «Ocupado».
3. Marca «Todo el día» o desmárcalo y establece «Desde» y «Hasta».
4. Guarda. En «Bloqueos guardados», selecciona el mes para editar o desbloquear.

Los feriados se registran manualmente, no se precargan automáticamente.
Los bloqueos se muestran en el horario semanal, su imagen y las vistas de citas del día y del mes. El asistente los excluye de sus consultas de espacios libres. Las franjas de la vista semanal y las consultas de disponibilidad consideran sesiones de una hora, incluyendo solapamientos parciales.
Se permite crear o editar citas en fechas y horarios marcados, también virtuales. Las citas existentes no se cancelan ni modifican. Los bloqueos no suman pacientes, sesiones, ingresos ni pagos.

INSTALACIÓN
Reemplaza los archivos del sitio con los de esta carpeta. Recarga la página con Ctrl+F5; en móvil, cierra la pestaña y vuelve a abrirla.
Los bloqueos se sincronizan en Firebase por cuenta, igual que las citas. La colección es artifacts/psicologia-agenda-default-v2/users/{uid}/scheduleBlocks. Si tus reglas solo autorizan colecciones concretas, añade scheduleBlocks con los mismos permisos de lectura y escritura del propietario que appointments. Si ya autorizan las subcolecciones de cada usuario, no necesitas cambiarlas. Se muestra un error si no se pueden cargar o guardar los bloqueos.

LISTADO DE TODOS LOS PACIENTES
En «Directorio de Pacientes», pulsa «Imprimir todos los pacientes». Incluye a todos los registrados, incluso si hay una búsqueda activa, ordenados alfabéticamente. Muestra nombre, DNI, teléfono, nacimiento, edad registrada y total. El formato A4 repite los encabezados de tabla en cada página. En la ventana de impresión puedes elegir una impresora o «Guardar como PDF».
