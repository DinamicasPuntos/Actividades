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
            const dinamica = cargo === 'ADMIN' ? document.getElementById('adminSelectDinamica').value : '';
            if (dinamica && dinamica !== 'TODAS') params.set('dinamica', dinamica);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 120000);
            boton.disabled = true; estado.textContent = 'Preparando tu informe…';
            try {
                const response = await fetch(`${API_URL}/informes/dinamicas.xlsx?${params}`, {
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
                enlace.href = url; enlace.download = `Informe_dinamicas_${fecha}.xlsx`;
                document.body.append(enlace); enlace.click(); enlace.remove();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
                estado.textContent = 'Informe descargado: resumen, PDV y detalle de vendedores y productos.';
            } catch (error) {
                estado.textContent = error.name === 'AbortError'
                    ? 'La descarga tardó demasiado. Intenta nuevamente o selecciona una sola dinámica.'
                    : error.message;
            } finally {
                clearTimeout(timer); boton.disabled = false;
            }
        };
    }
    return {iniciar};
})();
