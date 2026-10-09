Cambios de historia clínica

- Impresión A4 con el diseño original: logo, encabezado con onda turquesa y pie turquesa en cada página. El contenido se mide antes de imprimir y se crean páginas de continuación cuando es necesario, reservando el espacio del pie.
- Se conserva el texto completo y se elimina la repetición de historia personal.
- Código automático correlativo HC-0101 a HC-9999, guardado en Firebase mediante transacción para evitar duplicados entre dispositivos. Los códigos anteriores de otro formato se sustituyen al abrir, guardar o imprimir cada historia. Se requiere conexión para asignarlos.
- Nombre propuesto al guardar como PDF: Nombre del paciente_AAAA-MM-DD.pdf. La fecha corresponde a America/Lima.

Reemplaza los archivos del proyecto por esta versión. Abre la historia clínica y pulsa Imprimir; selecciona Guardar como PDF. El navegador controla el diálogo, la carpeta y permite modificar el nombre.

Validación: sintaxis JavaScript comprobada. La impresión final debe revisarse en Chrome o Edge; el entorno de revisión no dispone de un ejecutable de navegador para generar una prueba visual.

Corrección de preparación de impresión: se usa la ventana principal y la hoja de estilos ya cargada. Se actualizan los identificadores de versión de app.js y style.css para evitar archivos anteriores en caché. Actualiza index.html, app.js y style.css juntos y recarga con Ctrl+F5.

Encabezado compacto: logo de 42 mm, título de 16 puntos y menor espacio superior. Se aplica también a las páginas de continuación.
