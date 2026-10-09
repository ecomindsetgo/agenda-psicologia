# Corrección de compatibilidad con citas en Firestore

- Se evita que una cita sin campo `time` interrumpa el listado diario, mensual o los reportes.
- Los cálculos de recaudación convierten `cost` a número finito, incluso cuando llega como texto, sin modificar los documentos almacenados.
- Los filtros admiten nombres, notas y fechas faltantes.
- No se modificaron reglas, credenciales, colecciones ni datos de Firebase.

## Validación pendiente

Comprobar con datos reales los listados y la recaudación en la interfaz. Un importe inválido se mostrará como 0 para evitar que toda la suma produzca NaN; será necesario corregir su valor verdadero en el origen. Esta corrección no resuelve la discrepancia de pagos de la versión nueva, que requiere conciliación separada.

Antes de publicar, guardar respaldo de la versión anterior.
