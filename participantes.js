/* Un producto, una fila: nombre y rotación en el contexto del equipo. */
(function (global) {
    'use strict';
    const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    const texto = valor => typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim() : '';
    const claveNombre = valor => texto(valor).toLocaleLowerCase('es');
    function cantidadReal(valor) {
        if (valor === null || valor === undefined || valor === '') return 0;
        const cantidad = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN;
        if (!Number.isFinite(cantidad)) throw new Error('La cifra de ventas recibida no es válida. Actualiza la consulta.');
        return cantidad;
    }

    function normalizar(datos = {}) {
        const alcance = datos.alcance && typeof datos.alcance === 'object' ? datos.alcance : {};
        const tipo = texto(alcance.tipo || datos.tipo_alcance).toLowerCase();
        const tipoExplicito = ['marca', 'familia', 'laboratorio'].includes(tipo) ? tipo : 'productos';
        const fuente = alcance.productos ?? datos.productos ?? datos.producto ?? [];
        const unicos = new Map();
        for (const registro of Array.isArray(fuente) ? fuente : [fuente]) {
            const objeto = registro && typeof registro === 'object';
            const nombre = texto(objeto ? registro.nombre ?? registro.producto : registro);
            const codigo = texto(objeto ? registro.codigo : '');
            if ((!nombre && !codigo) || /^(todos los productos|n\/a|null|nan)$/i.test(nombre)) continue;
            const clave = codigo ? `codigo:${codigo}` : `nombre:${claveNombre(nombre)}`;
            if (!unicos.has(clave)) unicos.set(clave, {nombre, codigo});
        }
        return {tipo: tipoExplicito, nombre: texto(alcance.nombre || datos[tipoExplicito]), productos: [...unicos.values()]};
    }

    function productosConRotacion(datos) {
        const configurados = normalizar(datos).productos;
        const filas = Array.isArray(datos.rotacion_productos) ? datos.rotacion_productos : [];
        const resultado = new Map();
        for (const fila of filas) {
            if (!fila || typeof fila !== 'object') continue;
            const nombre = texto(fila.nombre), codigo = texto(fila.codigo);
            if (!nombre && !codigo) continue;
            const clave = codigo ? `codigo:${codigo}` : `nombre:${claveNombre(nombre)}`;
            // La API entrega totales por producto: un duplicado no vuelve a sumarse.
            if (!resultado.has(clave)) resultado.set(clave, {nombre, codigo, actual: cantidadReal(fila.actual)});
        }
        for (const producto of configurados) {
            const nombreUnico = configurados.filter(p => claveNombre(p.nombre) === claveNombre(producto.nombre)).length === 1;
            const candidatos = [...resultado.values()].filter(p => producto.codigo && p.codigo
                ? producto.codigo === p.codigo : nombreUnico && claveNombre(producto.nombre) && claveNombre(producto.nombre) === claveNombre(p.nombre));
            if (candidatos.length === 1) {
                // Completa el código si la hoja de ventas solo conserva el nombre.
                if (!candidatos[0].codigo) candidatos[0].codigo = producto.codigo;
            } else if (!candidatos.length) {
                const clave = producto.codigo ? `codigo:${producto.codigo}` : `nombre:${claveNombre(producto.nombre)}`;
                resultado.set(clave, {...producto, actual: 0});
            }
        }
        return [...resultado.values()];
    }

    function renderizarAlcance(datos) {
        const alcance = normalizar(datos);
        const etiquetas = {marca: 'Marca', familia: 'Familia', laboratorio: 'Laboratorio'};
        if (!etiquetas[alcance.tipo]) return '';
        return `<div class="participantes-alcance"><span class="participantes-etiqueta participantes-etiqueta--${alcance.tipo}">${etiquetas[alcance.tipo]}</span><strong>${escapar(alcance.nombre || 'Nombre no disponible')}</strong></div>`;
    }

    function renderizarRotacion(datos) {
        if (normalizar(datos).tipo !== 'productos') return '';
        const productos = productosConRotacion(datos);
        if (!productos.length) return '<p class="participantes-pendientes">Sin detalle de productos para esta vista.</p>';
        const dinero = datos.unidad === '$';
        const formato = valor => cantidadReal(valor).toLocaleString('es-CO', dinero
            ? {style:'currency', currency:'COP', maximumFractionDigits:2} : {maximumFractionDigits:2});
        const nombre = p => `<span>${escapar(p.nombre || p.codigo)}</span>${p.nombre && p.codigo ? `<small>${escapar(p.codigo)}</small>` : ''}`;
        if (productos.length === 1) {
            const producto = productos[0];
            return `<div class="rotacion-directa"><div class="producto-identidad">${nombre(producto)}</div>
                <div class="producto-cifra"><strong>${escapar(formato(producto.actual))}</strong><span>${dinero ? 'Ingresos' : 'Unidades rotadas'}</span></div></div>`;
        }
        const tabla = lista => `<table><thead><tr><th scope="col">Producto</th><th scope="col">${dinero ? 'Ingresos' : 'Unidades rotadas'}</th></tr></thead>
            <tbody>${lista.map(p => `<tr><td>${nombre(p)}</td><td>${escapar(formato(p.actual))}</td></tr>`).join('')}</tbody></table>`;
        return `<section class="rotacion-productos" aria-label="Rotación por producto">${tabla(productos.slice(0, 5))}
            ${productos.length > 5 ? `<details class="productos-adicionales"><summary>Ver ${productos.length - 5} producto${productos.length === 6 ? '' : 's'} más</summary>${tabla(productos.slice(5))}</details>` : ''}</section>`;
    }

    function renderizar(datos) {
        return `<section class="dinamica-participantes" aria-label="Alcance y resultados">${renderizarAlcance(datos)}${renderizarRotacion(datos)}</section>`;
    }

    function renderizarSinCuota(datos, titulo, personal = false) {
        const formato = valor => cantidadReal(valor).toLocaleString('es-CO', {maximumFractionDigits:2});
        const actual = datos.actual ?? datos.actual_general ?? 0;
        const minimo = cantidadReal(datos.minimo_pdv || 0);
        const detalle = personal ? renderizarAlcance(datos) || `<strong>${escapar(datos.producto || '')}</strong>` : renderizar(datos);
        const equipos = personal && Array.isArray(datos.pdvs)
            ? `<ul>${datos.pdvs.map(p=>`<li>${escapar(p.nombre)}: ${formato(p.mis_ventas)} unidades${minimo ? ` · ${cantidadReal(p.actual) >= minimo ? 'El PDV alcanzó el mínimo.' : 'El PDV aún no alcanza el mínimo.'}` : ''}</li>`).join('')}</ul>` : '';
        const equipo = personal && !datos.pdvs && datos.actual_pdv !== undefined
            ? `<p>Ventas del PDV: <strong>${formato(datos.actual_pdv)}</strong> unidades</p>` : '';
        const especiales = datos.actual_call !== undefined
            ? `<p>Call center: ${formato(datos.actual_call)} · Supernumerarios: ${formato(datos.actual_super)}</p>` : '';
        const condicion = minimo ? `Pago cuando el PDV alcance al menos ${formato(minimo)} unidades en esta dinámica. Cada persona cobra por sus ventas, sin cuota individual.`
            : 'Pago según las ventas, sin exigir cumplimiento de cuota.';
        return `<article class="dynamic-card rotacion-sin-cuota">
            <div class="rotacion-cabecera"><strong>${escapar(titulo)}</strong><span class="participantes-etiqueta">Solo rotación · ${minimo ? 'Sin cuota individual' : 'Sin cuota'}</span></div>
            <p class="rotacion-acumulada"><strong>${formato(actual)}</strong> unidades rotadas</p>
            ${detalle}${equipo}${equipos}${especiales}
            <p class="rotacion-condicion">${condicion}</p>
        </article>`;
    }

    global.ParticipantesDinamica = {normalizar, productosConRotacion, renderizar, renderizarAlcance, renderizarRotacion, renderizarSinCuota};
})(window);
