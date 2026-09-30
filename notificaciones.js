(function (global) {
    'use strict';
    const CLAVE_LECTURAS = 'dinamicas:lecturas:v1';
    let opciones, datos = null, lecturas = {}, soloPendientes = false, verTodas = false;
    let intervalo, controlador, secuencia = 0, avisoMostrado = false, temporizadorAviso;

    const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
    const elemento = id => document.getElementById(id);
    const leida = aviso => lecturas[aviso.id]?.revision === aviso.revision;
    const formato = (valor, unidad) => Number(valor).toLocaleString('es-CO', unidad === '$'
        ? { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }
        : { maximumFractionDigits: 2 }) + (unidad === '$' ? '' : ' unidades');

    function mensaje(aviso) {
        const faltante = formato(aviso.faltante, aviso.unidad);
        if (aviso.periodo_cerrado) return `En este período faltaron ${faltante} para alcanzar la meta. ¡Cada aprendizaje cuenta para tu próximo reto!`;
        const equipo = aviso.ambito && aviso.ambito !== 'personal';
        return `${equipo ? 'Al equipo le faltan' : 'Te faltan'} ${faltante} para cumplir la meta. ${aviso.unidad === '$' ? '¡Cada venta suma, vamos por ese objetivo!' : '¡Cada unidad cuenta, vamos por esa meta!'}`;
    }

    function desplegar(abierto) {
        const panel = elemento('muroNotificaciones');
        elemento('notificacionesContenido').hidden = !abierto;
        elemento('notificacionesDesplegar').setAttribute('aria-expanded', String(abierto));
        if (abierto && !panel.open) { cerrarAviso(); panel.showModal(); }
        if (!abierto && panel.open) panel.close();
        document.body.classList.toggle('notificaciones-abiertas', abierto);
        try { sessionStorage.setItem(`notificaciones:abierto:${localStorage.getItem('documento_usuario') || ''}`, String(abierto)); } catch (_) {}
    }

    function renderizar() {
        if (!datos) return;
        const avisos = datos.notificaciones;
        const pendientes = avisos.filter(a => !leida(a));
        elemento('notificacionesContador').textContent = `${pendientes.length} sin leer`;
        elemento('notificacionesContador').classList.toggle('sin-alertas', !pendientes.length);
        elemento('notificacionesFiltro').textContent = soloPendientes ? 'Mostrar todas' : 'Solo sin leer';
        elemento('notificacionesLeerTodas').disabled = !pendientes.length;
        const hora = new Date(datos.generado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
        elemento('notificacionesEstado').textContent = `Período ${datos.periodo} · Revisado a las ${hora} (Colombia) · Revisión cada 5 minutos`;
        const filtradas = soloPendientes ? pendientes : avisos;
        if (!filtradas.length) {
            elemento('notificacionesLista').innerHTML = `<p class="notificaciones-vacio">${!avisos.length
                ? (datos.dinamicas_evaluadas ? '¡Sigue así! Hoy no tienes recordatorios pendientes para estas dinámicas.' : 'Cuando tengas dinámicas en este período, aquí encontrarás mensajes para acompañarte hacia la meta.')
                : 'Estás al día: no tienes alertas sin leer.'}</p>`;
            elemento('notificacionesVerTodas').hidden = true;
            return;
        }
        const visibles = verTodas ? filtradas : filtradas.slice(0, 5);
        elemento('notificacionesLista').innerHTML = visibles.map(aviso => {
            const fecha = aviso.fecha_fin.split('-').reverse().join('/');
            const cierre = aviso.periodo_cerrado ? `El período cerró el ${fecha}.` : aviso.dias_restantes === 0
                ? 'La dinámica cierra hoy.' : `Cierra el ${fecha} · Quedan ${aviso.dias_restantes} días.`;
            return `<article class="notificacion notificacion--${aviso.nivel === 'critica' ? 'critica' : 'atencion'} ${leida(aviso) ? 'notificacion--leida' : ''}">
                <div class="notificacion-cabecera"><span class="notificacion-nivel">${aviso.periodo_cerrado ? 'Tu próximo reto' : '¡Vamos por la meta!'}</span>
                    <span class="notificacion-lectura">${leida(aviso) ? 'Leída' : 'Nueva'}</span></div>
                <h3>${escapar(aviso.dinamica)}</h3>
                <p class="notificacion-entidad">${escapar(aviso.entidad)}</p>
                <p>${escapar(mensaje(aviso))}</p>
                <p class="notificacion-cierre">${escapar(cierre)}${aviso.origen_calendario === 'mes' ? ' Se toma el mes completo como referencia.' : ''}</p>
                <div class="notificacion-acciones">
                    <button type="button" data-notificacion-accion="ver" data-id="${escapar(aviso.id)}">Ver dinámica</button>
                    <button type="button" data-notificacion-accion="leer" data-id="${escapar(aviso.id)}" ${leida(aviso) ? 'disabled' : ''}>${leida(aviso) ? 'Leída' : 'Marcar como leída'}</button>
                </div>
            </article>`;
        }).join('');
        elemento('notificacionesVerTodas').hidden = filtradas.length <= 5;
        elemento('notificacionesVerTodas').textContent = verTodas ? 'Mostrar menos' : `Ver los ${filtradas.length} mensajes`;
    }

    function guardarLecturas(avisos) {
        avisos.forEach(aviso => { lecturas[aviso.id] = { revision: aviso.revision, fecha: Date.now() }; });
        lecturas = Object.fromEntries(Object.entries(lecturas).sort((a, b) => b[1].fecha - a[1].fecha).slice(0, 500));
        try { localStorage.setItem(CLAVE_LECTURAS, JSON.stringify(lecturas)); } catch (_) { /* La sesión sigue funcionando sin almacenamiento. */ }
        renderizar();
        if (!datos.notificaciones.some(aviso => !leida(aviso))) cerrarAviso();
    }

    function cerrarAviso() {
        clearTimeout(temporizadorAviso);
        elemento('notificacionesAviso').hidden = true;
    }

    function mostrarAviso() {
        if (avisoMostrado || !datos) return;
        avisoMostrado = true;
        const cantidad = datos.notificaciones.filter(a => !leida(a)).length;
        if (!cantidad || elemento('muroNotificaciones').open) return;
        const primero = datos.notificaciones.find(a => !leida(a));
        elemento('notificacionesAvisoTexto').textContent = `${primero.dinamica}: ${mensaje(primero)}${cantidad > 1 ? ` Tienes ${cantidad} mensajes para revisar.` : ''}`;
        elemento('notificacionesAviso').hidden = false;
        temporizadorAviso = setTimeout(cerrarAviso, 15000);
    }

    async function actualizar() {
        if (!opciones) return;
        const token = localStorage.getItem('access_token');
        if (!token) return;
        controlador?.abort();
        controlador = new AbortController();
        const peticion = ++secuencia;
        const periodo = elemento('fechaFiltro').value;
        if (datos && datos.periodo !== periodo) {
            datos = null;
            elemento('notificacionesLista').innerHTML = '';
            elemento('notificacionesContador').textContent = 'Revisando';
            cerrarAviso();
        }
        elemento('notificacionesActualizar').disabled = true;
        elemento('notificacionesEstado').textContent = 'Revisando tus dinámicas…';
        const timeout = setTimeout(() => { if (peticion === secuencia) controlador.abort(); }, 45000);
        try {
            const respuesta = await fetch(`${opciones.apiUrl}/notificaciones?fecha=${encodeURIComponent(periodo)}`, {
                signal: controlador.signal, cache: 'no-store',
                headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '69420' }
            });
            if (respuesta.status === 401) { global.logout(); return; }
            if (!respuesta.ok) throw new Error('No se pudo consultar el muro.');
            const resultado = await respuesta.json();
            if (peticion !== secuencia || elemento('fechaFiltro').value !== periodo) return;
            if (!Array.isArray(resultado.notificaciones)) throw new Error('Respuesta incompleta.');
            datos = resultado;
            renderizar();
            mostrarAviso();
        } catch (error) {
            if (peticion !== secuencia) return;
            if (!datos) elemento('notificacionesContador').textContent = 'Sin conexión';
            elemento('notificacionesEstado').textContent = datos
                ? 'No se pudo actualizar. Se conserva la última revisión; puedes volver a intentarlo.'
                : 'No se pudo cargar el muro. Pulsa Actualizar para volver a intentarlo.';
        } finally {
            clearTimeout(timeout);
            if (peticion === secuencia) elemento('notificacionesActualizar').disabled = false;
        }
    }

    function iniciar(config) {
        if (opciones) return;
        opciones = config;
        try {
            const guardadas = JSON.parse(localStorage.getItem(CLAVE_LECTURAS) || '{}');
            if (guardadas && typeof guardadas === 'object' && !Array.isArray(guardadas)) lecturas = guardadas;
        } catch (_) { lecturas = {}; }
        let abierto = false;
        try { abierto = sessionStorage.getItem(`notificaciones:abierto:${localStorage.getItem('documento_usuario') || ''}`) === 'true'; } catch (_) {}
        desplegar(abierto);
        elemento('notificacionesDesplegar').addEventListener('click', () => desplegar(elemento('notificacionesContenido').hidden));
        elemento('notificacionesCerrarPanel').addEventListener('click', () => desplegar(false));
        elemento('muroNotificaciones').addEventListener('cancel', evento => {
            evento.preventDefault(); desplegar(false);
        });
        elemento('muroNotificaciones').addEventListener('click', evento => {
            if (evento.target !== elemento('muroNotificaciones')) return;
            const limites = evento.currentTarget.getBoundingClientRect();
            if (evento.clientX < limites.left || evento.clientX > limites.right || evento.clientY < limites.top || evento.clientY > limites.bottom) desplegar(false);
        });
        elemento('notificacionesActualizar').addEventListener('click', actualizar);
        elemento('notificacionesFiltro').addEventListener('click', () => { soloPendientes = !soloPendientes; renderizar(); });
        elemento('notificacionesLeerTodas').addEventListener('click', () => { if (datos) guardarLecturas(datos.notificaciones); });
        elemento('notificacionesVerTodas').addEventListener('click', () => { verTodas = !verTodas; renderizar(); });
        elemento('notificacionesLista').addEventListener('click', evento => {
            const boton = evento.target.closest('button[data-notificacion-accion]');
            if (!boton || !datos) return;
            const aviso = datos.notificaciones.find(a => a.id === boton.dataset.id);
            if (!aviso) return;
            if (boton.dataset.notificacionAccion === 'leer') guardarLecturas([aviso]);
            else { desplegar(false); opciones.verDinamica(aviso); }
        });
        elemento('notificacionesCerrarAviso').addEventListener('click', cerrarAviso);
        elemento('notificacionesAbrirMuro').addEventListener('click', () => {
            cerrarAviso(); desplegar(true);
        });
        document.addEventListener('visibilitychange', () => { if (!document.hidden) actualizar(); });
        intervalo = setInterval(() => { if (!document.hidden) actualizar(); }, 300000);
        actualizar();
    }

    function detener() {
        clearInterval(intervalo); clearTimeout(temporizadorAviso); controlador?.abort(); ++secuencia;
    }

    global.NotificacionesUI = { iniciar, actualizar, detener, claveLecturas: CLAVE_LECTURAS };
})(window);
