# Portal de dinámicas

Frontend publicado en https://dinamicaspuntos.github.io/Actividades/ desde la rama `main`.

El portal incluye vistas nacional, por coordinación, supervisión y vendedor;
productos con su rotación; filtros por período y dinámica; puntos liquidados;
y un panel lateral de notificaciones que se puede ocultar. El diseño se adapta
a escritorio y móvil. Con una sola dinámica seleccionada, las tarjetas de las
zonas y coordinaciones muestran sus resultados directamente.

Los archivos públicos son `index.html`, `dashboard.html`, `style.css`,
`dashboard-style.css`, `design.css`, `script.js`, `dashboard.js`,
`participantes.js` y `notificaciones.js`. Las hojas de estilo y scripts llevan
una versión en la URL para renovar la caché después de publicar.

`banners-admin.js` y `banners-admin.css` añaden la administración de banners en
la cuenta propietaria configurada en el servidor. Permiten subir imágenes de
PC y móvil, reemplazarlas, ordenar los banners, activarlos o desactivarlos y
eliminarlos con confirmación. Eliminar retira la fila de Google Sheets y actualiza
el carrusel; todas las operaciones requieren el permiso del propietario en la API.
La API verifica la identidad y el permiso en todas las operaciones. La opción
no está disponible para otros administradores. Las sesiones anteriores de la
cuenta propietaria deben renovarse con código de empleado y documento.

La API configurada en `script.js` y `dashboard.js` entrega los datos reales.
Para los detalles por producto debe incluir `alcance` y `rotacion_productos`;
para las alertas, el endpoint autenticado `/notificaciones`.

Las comprobaciones del navegador están en `tests/`. Requieren Python,
Playwright y Microsoft Edge. Utilizan respuestas simuladas para probar los
roles y no publican datos privados. La prueba de notificaciones también requiere
la copia del backend en el directorio superior.
