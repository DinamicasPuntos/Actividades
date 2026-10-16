globalThis.InformesUI = (() => {
    function iniciar(cargo) {
        const panel = document.getElementById('informesPanel');
        if (!['ADMIN', 'SUPERVISOR', 'COORDINADOR', 'ADMINISTRADOR PDV'].includes(cargo)) return;
        panel.hidden = false;
        const boton = document.getElementById('descargarInforme');
        const estado = document.getElementById('informeEstado');
        boton.onclick = async () => {
            if (boton.disabled) return;
            const fecha = document.getElementById('fechaFiltro').value;
            if (!fecha) { estado.textContent = 'Selecciona el período del informe.'; return; }
            const params = new URLSearchParams({fecha});
            const porPdv = cargo === 'ADMIN' && typeof adminSubVistaActual !== 'undefined' && adminSubVistaActual === 'nacional_pdv';
            const dinamica = cargo === 'ADMIN' ? document.getElementById('adminSelectDinamica').value : '';
            if (dinamica && dinamica !== 'TODAS') params.set('dinamica', dinamica);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 120000);
            boton.disabled = true; estado.textContent = 'Preparando tu informe…';
            panel.dataset.estado = 'cargando'; panel.setAttribute('aria-busy', 'true');
            const etiqueta = boton.querySelector('span');
            const icono = boton.querySelector('i');
            if (etiqueta) etiqueta.textContent = 'Preparando Excel…';
            if (icono) icono.className = 'fas fa-spinner fa-spin';
            try {
                const response = await fetch(`${API_URL}${porPdv ? '/admin/vision-pdv.xlsx' : '/informes/dinamicas.xlsx'}?${params}`, {
                    headers: {Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`},
                    signal: controller.signal
                });
                if (response.status === 401) { logout(); return; }
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.detail || 'No se pudo generar el informe. Intenta nuevamente.');
                }
                const archivo = await response.blob();
                const url = URL.createObjectURL(archivo);
                const enlace = document.createElement('a');
                enlace.href = url; enlace.download = porPdv ? `Informe_nacional_PDV_${fecha}.xlsx` : `Informe_dinamicas_${fecha}.xlsx`;
                document.body.append(enlace); enlace.click(); enlace.remove();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
                estado.textContent = porPdv ? 'Informe descargado: resumen nacional por PDV y detalle por presentación.' : 'Informe descargado: resumen, PDV y detalle de vendedores y productos.';
                panel.dataset.estado = 'listo';
            } catch (error) {
                panel.dataset.estado = 'error';
                estado.textContent = error.name === 'AbortError'
                    ? 'La descarga tardó demasiado. Intenta nuevamente o selecciona una sola dinámica.'
                    : error.message;
            } finally {
                clearTimeout(timer); boton.disabled = false;
                panel.removeAttribute('aria-busy');
                if (etiqueta) etiqueta.textContent = 'Descargar Excel';
                if (icono) icono.className = 'fas fa-arrow-down';
            }
        };
    }
    return {iniciar};
})();
