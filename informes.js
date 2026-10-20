globalThis.InformesUI = (() => {
    let periodoOpciones = '';
    function actualizarDinamicas(nombres, fecha) {
        const select = document.getElementById('informeDinamica');
        if (!select) return;
        const anterior = periodoOpciones === fecha ? select.value : '';
        select.replaceChildren(new Option('Todas las dinámicas', ''));
        [...new Set(nombres)].filter(Boolean).sort((a,b)=>a.localeCompare(b,'es')).forEach(n=>select.add(new Option(n,n)));
        if ([...select.options].some(o=>o.value===anterior)) select.value=anterior;
        periodoOpciones=fecha;
    }
    function iniciar(cargo) {
        const panel = document.getElementById('informesPanel');
        if (!['ADMIN', 'SUPERVISOR', 'COORDINADOR', 'ADMINISTRADOR PDV'].includes(cargo)) return;
        panel.hidden = false;
        const boton = document.getElementById('descargarInforme');
        const estado = document.getElementById('informeEstado');
        const tipo = document.getElementById('informeTipo');
        const seleccion = document.getElementById('informeDinamica');
        function describir() {
            if (!tipo || !seleccion) return;
            seleccion.closest('label').hidden = tipo.value !== 'pdv';
            document.getElementById('informeDescripcion').textContent = tipo.value === 'pdv'
                ? 'Ventas por dinámica y sucursal. Desglose de productos solo en las dinámicas creadas por productos.'
                : 'Descarga el resumen y detalle correspondientes a la vista y los filtros actuales.';
        }
        if (tipo) tipo.addEventListener('change',describir);
        describir();
        document.getElementById('fechaFiltro').addEventListener('change',()=>actualizarDinamicas([],''));
        document.getElementById('adminSelectDinamica')?.addEventListener('change',e=>{
            if (seleccion) seleccion.value=e.target.value==='TODAS' ? '' : e.target.value;
        });
        boton.onclick = async () => {
            if (boton.disabled) return;
            const fecha = document.getElementById('fechaFiltro').value;
            if (!fecha) { estado.textContent = 'Selecciona el período del informe.'; return; }
            const params = new URLSearchParams({fecha});
            const dinamicaPdv = tipo?.value === 'pdv';
            const porPdv = !dinamicaPdv && cargo === 'ADMIN' && typeof adminSubVistaActual !== 'undefined' && adminSubVistaActual === 'nacional_pdv';
            const dinamica = dinamicaPdv ? seleccion.value : cargo === 'ADMIN' ? document.getElementById('adminSelectDinamica').value : '';
            if (dinamica && dinamica !== 'TODAS') params.set('dinamica', dinamica);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 120000);
            boton.disabled = true; estado.textContent = 'Preparando tu informe…';
            if (tipo) tipo.disabled = true;
            if (seleccion) seleccion.disabled = true;
            panel.dataset.estado = 'cargando'; panel.setAttribute('aria-busy', 'true');
            const etiqueta = boton.querySelector('span');
            const icono = boton.querySelector('i');
            if (etiqueta) etiqueta.textContent = 'Preparando Excel…';
            if (icono) icono.className = 'fas fa-spinner fa-spin';
            try {
                const response = await fetch(`${API_URL}${dinamicaPdv ? '/informes/pdv.xlsx' : porPdv ? '/admin/vision-pdv.xlsx' : '/informes/dinamicas.xlsx'}?${params}`, {
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
                enlace.href = url; enlace.download = dinamicaPdv ? `Informe_dinamica_PDV_${fecha}.xlsx` : porPdv ? `Informe_nacional_PDV_${fecha}.xlsx` : `Informe_dinamicas_${fecha}.xlsx`;
                document.body.append(enlace); enlace.click(); enlace.remove();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
                estado.textContent = dinamicaPdv ? 'Informe descargado: dinámica por PDV y productos cuando corresponde.' : porPdv ? 'Informe descargado: resumen nacional por PDV y detalle por presentación.' : 'Informe descargado: resumen, PDV y detalle de vendedores y productos.';
                panel.dataset.estado = 'listo';
            } catch (error) {
                panel.dataset.estado = 'error';
                estado.textContent = error.name === 'AbortError'
                    ? 'La descarga tardó demasiado. Intenta nuevamente o selecciona una sola dinámica.'
                    : error.message;
            } finally {
                clearTimeout(timer); boton.disabled = false;
                if (tipo) tipo.disabled = false;
                if (seleccion) seleccion.disabled = false;
                panel.removeAttribute('aria-busy');
                if (etiqueta) etiqueta.textContent = 'Descargar Excel';
                if (icono) icono.className = 'fas fa-arrow-down';
            }
        };
    }
    return {iniciar, actualizarDinamicas};
})();
