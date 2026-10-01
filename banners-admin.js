/* La autorización de todas las operaciones se verifica nuevamente en la API. */
globalThis.BannersAdmin = (() => {
    let api, alGuardar, panel, lista, estado, formulario, version, registros = [], editando = '', ocupado = false;
    const vistas = new Map();
    const nodo = (tag, clase, texto) => {
        const e = document.createElement(tag);
        if (clase) e.className = clase;
        if (texto !== undefined) e.textContent = texto;
        return e;
    };
    const informar = (mensaje, error = false) => { estado.textContent = mensaje; estado.classList.toggle('error', error); };
    const cabeceras = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`, 'ngrok-skip-browser-warning': '69420' });
    async function solicitar(ruta, opciones = {}) {
        const r = await fetch(api + ruta, {...opciones, headers: {...cabeceras(), ...opciones.headers}});
        const datos = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof datos.detail === 'string' ? datos.detail : 'No se pudo guardar. Revisa las imágenes y vuelve a intentarlo.');
        return datos;
    }
    function bloquear(valor) {
        ocupado = valor;
        panel.querySelectorAll('input,button:not([data-cerrar])').forEach(e => e.disabled = valor);
    }
    function limpiar() {
        editando = '';
        formulario.reset();
        formulario.querySelector('h3').textContent = 'Nuevo banner';
        formulario.querySelector('[type=submit]').textContent = 'Publicar banner';
        for (const tipo of ['desktop', 'mobile']) {
            const img = formulario.querySelector(`[data-preview=${tipo}]`);
            img.hidden = true; img.removeAttribute('src');
            if (vistas.has(tipo)) URL.revokeObjectURL(vistas.get(tipo));
        }
        vistas.clear();
    }
    function editar(banner) {
        limpiar(); editando = banner.id;
        formulario.elements.titulo.value = banner.titulo;
        formulario.querySelector('h3').textContent = 'Editar banner';
        formulario.querySelector('[type=submit]').textContent = 'Guardar cambios';
        for (const tipo of ['desktop', 'mobile']) {
            const img = formulario.querySelector(`[data-preview=${tipo}]`);
            img.src = banner[tipo] || banner.desktop || banner.mobile; img.hidden = false;
        }
        informar('Selecciona únicamente las imágenes que quieras reemplazar.');
        formulario.scrollIntoView({block:'start', behavior:'smooth'});
        formulario.elements.titulo.focus({preventScroll:true});
    }
    async function cargar() {
        const datos = await solicitar('/banners/administracion');
        version = datos.version; registros = datos.banners;
        dibujar();
    }
    async function ejecutar(accion, mensaje) {
        if (ocupado) return;
        bloquear(true); informar('Guardando cambios…');
        try {
            await accion();
            await cargar(); limpiar();
            await alGuardar();
            informar(mensaje);
        } catch (e) { informar(e.message, true); }
        finally { bloquear(false); }
    }
    function dibujar() {
        lista.replaceChildren();
        if (!registros.length) { lista.append(nodo('p', '', 'Todavía no hay banners.')); return; }
        registros.forEach((b, indice) => {
            const fila = nodo('article', 'banners-fila');
            const img = nodo('img'); img.src = b.desktop || b.mobile; img.alt = ''; img.loading = 'lazy';
            const texto = nodo('div', 'banners-fila-texto');
            texto.append(nodo('strong', '', b.titulo), nodo('small', '', `${indice + 1} · ${b.activo ? 'Visible' : 'Desactivado'}`));
            const acciones = nodo('div', 'banners-acciones');
            const boton = (texto, funcion) => { const e = nodo('button', '', texto); e.type = 'button'; e.onclick = funcion; acciones.append(e); return e; };
            boton('Editar', () => editar(b));
            boton(b.activo ? 'Desactivar' : 'Activar', () => ejecutar(() => solicitar(`/banners/administracion/${encodeURIComponent(b.id)}/activo`, {
                method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({version, activo:!b.activo})
            }), b.activo ? 'Banner desactivado.' : 'Banner activado.'));
            for (const [paso, etiqueta] of [[-1,'Subir'],[1,'Bajar']]) {
                if (indice + paso < 0 || indice + paso >= registros.length) continue;
                boton(etiqueta, () => ejecutar(() => {
                    const ids = registros.map(r => r.id);
                    [ids[indice], ids[indice + paso]] = [ids[indice + paso], ids[indice]];
                    return solicitar('/banners/administracion/orden', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({version, ids})});
                }, 'Orden actualizado.'));
            }
            fila.append(img, texto, acciones); lista.append(fila);
        });
    }
    function construir() {
        panel = nodo('dialog','banners-panel'); panel.id = 'bannersPanel'; panel.setAttribute('aria-labelledby','bannersTitulo');
        panel.innerHTML = `<header class="banners-cabecera"><h2 id="bannersTitulo">Administrar banners</h2><button type="button" data-cerrar aria-label="Cerrar administración de banners">✕</button></header>
          <div class="banners-contenido"><p class="banners-estado" role="status" aria-live="polite"></p>
          <form class="banners-formulario"><h3>Nuevo banner</h3>
          <label>Nombre del banner<input name="titulo" maxlength="120" required placeholder="Ejemplo: Campaña de octubre"></label>
          <div class="banners-archivos">
            <div class="banners-archivo"><label>Imagen para PC<small>1920 × 800 px · JPG, PNG o WebP · hasta 8 MB</small><input type="file" name="desktop" accept="image/jpeg,image/png,image/webp"></label><img data-preview="desktop" alt="Vista previa para PC" hidden></div>
            <div class="banners-archivo"><label>Imagen para móvil<small>1080 × 1350 px · JPG, PNG o WebP · hasta 8 MB</small><input type="file" name="mobile" accept="image/jpeg,image/png,image/webp"></label><img data-preview="mobile" alt="Vista previa para móvil" hidden></div>
          </div><div class="banners-acciones"><button type="submit" class="banners-primario">Publicar banner</button><button type="button" data-nuevo>Limpiar formulario</button></div></form>
          <div class="banners-lista-titulo"><h3>Banners de la página</h3><button type="button" data-actualizar>Actualizar lista</button></div><div class="banners-lista"></div></div>`;
        document.body.append(panel);
        estado = panel.querySelector('.banners-estado'); lista = panel.querySelector('.banners-lista'); formulario = panel.querySelector('form');
        panel.querySelector('[data-cerrar]').onclick = () => panel.close();
        panel.addEventListener('click', e => { if(e.target === panel) { const r=panel.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) panel.close(); } });
        panel.querySelector('[data-nuevo]').onclick = limpiar;
        panel.querySelector('[data-actualizar]').onclick = async () => {
            bloquear(true);
            try { await cargar(); informar('Lista actualizada.'); } catch(e) { informar(e.message,true); }
            finally { bloquear(false); }
        };
        for (const tipo of ['desktop','mobile']) formulario.elements[tipo].addEventListener('change', () => {
            const archivo = formulario.elements[tipo].files[0];
            if (!archivo) return;
            if (archivo.size > 8*1024*1024) { informar('Cada imagen debe pesar como máximo 8 MB.', true); formulario.elements[tipo].value = ''; return; }
            if (vistas.has(tipo)) URL.revokeObjectURL(vistas.get(tipo));
            const url = URL.createObjectURL(archivo); vistas.set(tipo,url);
            const img = formulario.querySelector(`[data-preview=${tipo}]`); img.src=url; img.hidden=false;
        });
        formulario.onsubmit = e => {
            e.preventDefault();
            if (!version) { informar('Actualiza la lista antes de guardar.',true); return; }
            const data = new FormData();
            data.set('version',version); data.set('titulo',formulario.elements.titulo.value.trim()); data.set('banner_id',editando);
            for (const tipo of ['desktop','mobile']) {
                const archivo = formulario.elements[tipo].files[0];
                if (archivo) data.set(tipo,archivo);
                else if (!editando) { informar('Selecciona las imágenes de PC y móvil.',true); return; }
            }
            ejecutar(() => solicitar('/banners/administracion',{method:'POST',body:data}), editando ? 'Banner actualizado.' : 'Banner publicado.');
        };
    }
    async function iniciar({apiUrl, actualizar}) {
        api = apiUrl; alGuardar = actualizar;
        const boton = document.getElementById('bannersAbrir');
        if (!boton || !localStorage.getItem('access_token')) return;
        try {
            const permiso = await solicitar('/banners/permisos');
            if (!permiso.propietario) return;
            boton.hidden = false;
            boton.onclick = async () => {
                if (!panel) construir();
                panel.showModal();
                if (!permiso.puede_administrar) {
                    bloquear(true);
                    informar('Cierra sesión e ingresa nuevamente con tu código de empleado y documento para habilitar esta sección.',true);
                    return;
                }
                bloquear(true); informar('Cargando banners…');
                try { await cargar(); informar('Sube tus imágenes o administra los banners actuales.'); }
                catch(e) { informar(e.message,true); }
                finally { bloquear(false); }
            };
        } catch (_) { /* Un error no concede permisos ni impide consultar las dinámicas. */ }
    }
    return {iniciar};
})();
