globalThis.PuntosEstimadosUI = (() => {
    let panel, cargo, pagina = 1, paginas = 1, controlador, secuencia = 0, ultimo = '';
    const elemento = id => document.getElementById(id);
    const texto = valor => { const n = document.createElement('span'); n.textContent = String(valor ?? ''); return n.innerHTML; };
    const formato = valor => Number(valor).toLocaleString('es-CO', {maximumFractionDigits: 2});
    function contexto() {
        const params = new URLSearchParams({fecha: elemento('fechaFiltro').value, buscar: elemento('puntosBuscar').value.trim(), pagina});
        const dinamica = cargo === 'ADMIN' ? elemento('adminSelectDinamica').value : '';
        if (dinamica && dinamica !== 'TODAS') params.set('dinamica', dinamica);
        return params;
    }
    async function cargar(forzar = false) {
        if (!panel?.open || panel.hidden) return;
        const params = contexto(), clave = params.toString();
        if (!forzar && clave === ultimo) return;
        controlador?.abort(); controlador = new AbortController();
        const actual = ++secuencia, conexion = controlador;
        const timer = setTimeout(() => conexion.abort(), 60000);
        const estado = elemento('puntosEstado'), resultados = elemento('puntosResultados');
        estado.textContent = 'Consultando puntos estimados…'; resultados.replaceChildren();
        elemento('puntosAnterior').disabled = elemento('puntosSiguiente').disabled = true;
        elemento('puntosPagina').textContent = '';
        panel.setAttribute('aria-busy', 'true');
        try {
            const r = await fetch(`${API_URL}/puntos/estimados?${params}`, {headers:{Authorization:`Bearer ${localStorage.getItem('access_token') || ''}`}, signal:conexion.signal});
            if (r.status === 401) { logout(); return; }
            const data = await r.json();
            if (!r.ok) throw new Error(data.detail || 'No se pudieron consultar los puntos.');
            if (actual !== secuencia) return;
            ultimo = clave; pagina = data.pagina; paginas = data.paginas;
            estado.textContent = data.total ? `${data.total.toLocaleString('es-CO')} resultados · Período ${params.get('fecha')}` : 'No hay resultados para esta selección.';
            if (data.resultados.length) {
                resultados.innerHTML = `<div class="puntos-tabla-scroll" tabindex="0" aria-label="Puntos por vendedor y dinámica"><table class="puntos-tabla"><thead><tr><th>Vendedor / PDV</th><th>Dinámica</th><th>Estimados</th><th>Pendientes de cumplimiento</th></tr></thead><tbody>${data.resultados.map(r => `<tr><td><strong>${texto(r.vendedor)}</strong><small>${r.codigos.map(texto).join(' / ')}</small><small>${r.pdvs.map(texto).join(' · ')}</small></td><td>${texto(r.dinamica)}</td><td class="puntos-valor">${r.disponible ? `${formato(r.puntos_estimados)} pts` : 'Por revisar'}</td><td class="puntos-pendientes">${r.disponible ? `${formato(r.puntos_pendientes)} pts` : 'Tarifa pendiente'}</td></tr>`).join('')}</tbody></table></div>`;
            }
            elemento('puntosPagina').textContent = `${pagina} de ${paginas}`;
            elemento('puntosAnterior').disabled = pagina <= 1;
            elemento('puntosSiguiente').disabled = pagina >= paginas;
        } catch (error) {
            if (actual !== secuencia) return;
            ultimo = '';
            estado.textContent = error.name === 'AbortError' ? 'La consulta tardó demasiado. Pulsa Consultar para reintentar.' : error.message;
        } finally {
            clearTimeout(timer);
            if (actual === secuencia) panel.removeAttribute('aria-busy');
        }
    }
    function actualizar() { pagina = 1; cargar(); }
    function iniciar(rol) {
        panel = elemento('puntosEstimadosPanel'); cargo = rol;
        if (!panel) return;
        panel.addEventListener('toggle', () => { if (panel.open) cargar(); });
        elemento('puntosConsultar').onclick = () => { pagina = 1; cargar(true); };
        elemento('puntosBuscar').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pagina = 1; cargar(true); } });
        elemento('fechaFiltro').addEventListener('change', () => { ultimo = ''; actualizar(); });
        elemento('puntosAnterior').onclick = () => { if (pagina > 1) { pagina--; cargar(); } };
        elemento('puntosSiguiente').onclick = () => { if (pagina < paginas) { pagina++; cargar(); } };
        elemento('puntosAnterior').disabled = elemento('puntosSiguiente').disabled = true;
    }
    function cambiarVista(vista) {
        if (!panel) return;
        panel.hidden = vista === 'comisiones';
        if (panel.hidden) { controlador?.abort(); ++secuencia; ultimo = ''; panel.removeAttribute('aria-busy'); }
        else cargar();
    }
    return {iniciar, actualizar, cambiarVista};
})();
