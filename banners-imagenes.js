/* Carga los archivos del servidor evitando la página intermedia de ngrok. */
globalThis.BannerImagenes = (() => {
    const solicitudes = new WeakMap();
    async function asignar(img, src) {
        const solicitud = {};
        solicitudes.set(img, solicitud);
        let temporal;
        try {
            const url = new URL(src, location.href);
            if (!/^\/media\/banners\/[a-f0-9]{32}\.webp$/.test(url.pathname)) {
                img.src = url.href;
                return true;
            }
            const respuesta = await fetch(url.href, {
                headers: {'ngrok-skip-browser-warning': '69420'}, credentials: 'omit'
            });
            if (!respuesta.ok || !respuesta.headers.get('content-type')?.startsWith('image/')) {
                throw new Error('El servidor no devolvió una imagen.');
            }
            const archivo = await respuesta.blob();
            if (solicitudes.get(img) !== solicitud) return false;
            temporal = URL.createObjectURL(archivo);
            img.src = temporal;
            await img.decode();
            return true;
        } catch (error) {
            if (solicitudes.get(img) === solicitud) {
                img.removeAttribute('src');
                img.alt = 'No se pudo cargar el banner. Actualiza la página para reintentar.';
            }
            console.error('Error cargando imagen del banner:', error);
            return false;
        } finally {
            if (temporal) URL.revokeObjectURL(temporal);
        }
    }
    function limpiar(img) {
        solicitudes.delete(img);
        img.removeAttribute('src');
    }
    return {asignar, limpiar};
})();
