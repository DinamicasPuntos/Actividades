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

La API configurada en `script.js` y `dashboard.js` entrega los datos reales.
Para los detalles por producto debe incluir `alcance` y `rotacion_productos`;
para las alertas, el endpoint autenticado `/notificaciones`.

Las comprobaciones del navegador están en `tests/`. Requieren Python,
Playwright y Microsoft Edge. Utilizan respuestas simuladas para probar los
roles y no publican datos privados. La prueba de notificaciones también requiere
la copia del backend en el directorio superior.
