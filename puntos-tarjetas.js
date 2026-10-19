/* Reconocimiento dentro de cada dinámica. Importes calculados por la API. */
globalThis.PuntosDinamica = (() => {
    const escapar = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const formato = n => Number(n).toLocaleString('es-CO', {maximumFractionDigits:2});
    function renderizar(datos, personal = false) {
        if (!datos) return '';
        const tarifas = datos.tarifas || [];
        const valores = [...new Set(tarifas.map(t => `${t.tipo}|${t.valor}`))];
        const tarifa = t => t.tipo === 'Porcentaje venta' ? `${formato(t.valor)} % de las ventas` : `${formato(t.valor)} pts por unidad`;
        const detalle = valores.length === 1 ? escapar(tarifa(tarifas[0]))
            : tarifas.map(t => `<span>${escapar(t.producto)}: <b>${escapar(tarifa(t))}</b></span>`).join('');
        const porcentaje = tarifas.some(t => t.tipo === 'Porcentaje venta');
        const titulo = personal ? 'Puntos por tus ventas' : 'Puntos por ventas del equipo';
        if (!datos.disponible) return `<section class="dinamica-puntos"><div><span class="puntos-tarifa">${detalle}</span><p>El cálculo de puntos está pendiente de actualización.</p></div></section>`;
        const habilitados = Number(datos.puntos_estimados), pendientes = Number(datos.puntos_pendientes);
        return `<section class="dinamica-puntos" aria-label="Puntos de la dinámica">
            <div class="puntos-regla"><span class="puntos-tarifa">${detalle}</span>${porcentaje ? `<small>Ventas acumuladas: $ ${formato(datos.facturado)}</small>` : ''}</div>
            <div class="puntos-acumulado"><span>${titulo}</span><strong>${formato(habilitados + pendientes)} <small>pts</small></strong>
            ${pendientes ? `<small class="puntos-condicion">${formato(pendientes)} pts sujetos a cumplimiento${habilitados ? ` · ${formato(habilitados)} pts habilitados` : ''}</small>` : ''}</div>
        </section>`;
    }
    return {renderizar};
})();
