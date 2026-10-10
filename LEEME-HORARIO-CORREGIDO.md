CORRECCIÓN DE CARGA DEL HORARIO — 10/10/2026

Instalación
Reemplaza app.js e index.html en tu sitio con los de este ZIP y recarga con Ctrl+F5. Los demás archivos mantienen su contenido original. Esto no borra ni modifica citas, pacientes o pagos.

Fallo corregido
El error de lectura de scheduleBlocks dejaba blocksReady en false; cada casilla seguía mostrando Cargando y al abrir la ventana se sustituía el mensaje real por Cargando bloqueos. Además, la disponibilidad no esperaba la lectura de las citas.

Ahora los errores permanecen visibles, hay un botón Reintentar carga y una espera de más de 15 segundos muestra un aviso. Si posteriormente llegan los datos, el horario se actualiza automáticamente. Las citas y bloqueos conocidos siguen visibles; las franjas cuya disponibilidad no puede confirmarse dicen Sin verificar. Solo se muestran libres cuando han cargado citas y bloqueos. La imagen no se descarga con disponibilidad incompleta.

Si aparece «Firebase no permite leer los bloqueos»
En Firebase Console, abre Firestore Database > Reglas. Dentro del bloque match /databases/{database}/documents, agrega la siguiente regla si todavía no tienes una regla equivalente. No reemplaces el resto de tus reglas:

match /artifacts/psicologia-agenda-default-v2/users/{userId}/scheduleBlocks/{blockId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

Publica las reglas y pulsa Reintentar carga. La regla permite acceso únicamente al usuario propietario autenticado. Si sigue denegado, verifica la cuenta autenticada y la configuración de App Check; no desactives protecciones ni habilites acceso público a los datos.

Validación realizada
Sintaxis JavaScript y pruebas locales simuladas de error de permisos, tiempo de espera, recuperación, carga incompleta de citas, disponibilidad y cancelación del listener. No se accedió a la base de datos real ni se modificó la configuración de Firebase.
