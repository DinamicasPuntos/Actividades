globalThis.PersonalUI = (() => {
    let api, panel, estado, contenido, boton, ocupado=false;
    const el=(tag,texto)=>{const n=document.createElement(tag); if(texto!==undefined)n.textContent=texto; return n;};
    const headers=()=>({'Authorization':`Bearer ${localStorage.getItem('access_token') || ''}`,'ngrok-skip-browser-warning':'69420','Content-Type':'application/json'});
    async function pedir(ruta,method='GET',data){
        const r=await fetch(api+ruta,{method,headers:headers(),...(data?{body:JSON.stringify(data)}:{})});
        const d=await r.json();
        if(!r.ok)throw new Error(d.detail || 'No se pudo completar la operación.');
        return d;
    }
    async function accion(ruta,method,data){
        if(ocupado)return;
        ocupado=true; panel.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);
        estado.textContent='Guardando…';
        try {dibujar(await pedir(ruta,method,data));estado.textContent='Cambios guardados.';}
        catch(e){estado.textContent=e.message;}
        finally{ocupado=false;panel.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);}
    }
    function dibujar(datos){
        contenido.replaceChildren();
        const pendientes=datos.conflictos.filter(c=>!c.elegido).length;
        boton.textContent=`Personal y accesos${pendientes ? ' · '+pendientes+' avisos' : ''}`;
        contenido.append(el('p',`Última sincronización: ${datos.ultima_sincronizacion ? new Date(datos.ultima_sincronizacion*1000).toLocaleString('es-CO',{timeZone:'America/Bogota'}) : 'Pendiente'}. Automática cada 24 horas. ${datos.empleados} personas y ${datos.pdv} PDV.`));
        if(datos.error)contenido.append(el('p',datos.error.mensaje));
        if(datos.sincronizacion_solicitada)contenido.append(el('p','Actualización solicitada. El computador conectado a Uni y Dropo la procesará automáticamente. Vuelve a abrir este panel para comprobar el resultado.'));
        const sync=el('button','Sincronizar ahora');sync.onclick=()=>accion('/personal/sincronizar','POST');contenido.append(sync);
        contenido.append(el('h3','Responsables de supervisión'));
        if(!datos.conflictos.length)contenido.append(el('p','No hay zonas con varios supervisores.'));
        for(const c of datos.conflictos){
            const fila=el('div');fila.className='banners-formulario';
            fila.append(el('strong',`${c.nombre} · ${c.origen}`));
            const label=el('label','Supervisor responsable');const select=el('select');
            const vacio=el('option','Selecciona el responsable');vacio.value='';select.append(vacio);
            for(const p of c.candidatos){const o=el('option',`${p.nombre} · ${p.cedula}`);o.value=p.cedula;select.append(o);}
            select.value=c.elegido;label.append(select);fila.append(label);
            const guardar=el('button','Asignar supervisor');guardar.onclick=()=>{if(select.value)accion('/personal/supervisor','PUT',{zona:c.id,cedula:select.value});};fila.append(guardar);contenido.append(fila);
        }
        contenido.append(el('h3','Accesos nacionales externos'),el('p','Permiten consultar resultados nacionales. No conceden administración de personal ni banners.'));
        const form=el('form');form.className='banners-formulario';
        for(const [name,texto] of [['cedula','Cédula'],['codigo','Código de ingreso'],['nombre','Nombre']]){
            const label=el('label',texto),input=el('input');input.name=name;input.required=true;input.maxLength=name==='nombre'?150:80;
            if(name==='cedula'){input.inputMode='numeric';input.pattern='[0-9]+';}
            label.append(input);form.append(label);
        }
        const guardar=el('button','Habilitar acceso');guardar.type='submit';form.append(guardar);
        form.onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));accion('/personal/externos','PUT',{...data,activo:true});};contenido.append(form);
        for(const u of datos.externos){
            const fila=el('div');fila.className='banners-fila';fila.append(el('span',`${u.nombre} · ${u.cedula} · ${u.activo?'Habilitado':'Desactivado'}`));
            const toggle=el('button',u.activo?'Desactivar':'Activar');toggle.onclick=()=>accion('/personal/externos','PUT',{...u,activo:!u.activo});fila.append(toggle);contenido.append(fila);
        }
    }
    async function iniciar(apiUrl){
        api=apiUrl;
        const res=await fetch(api+'/personal/mi-perfil',{headers:headers()});
        if(res.status===401 || res.status===403){localStorage.removeItem('access_token');location.href='index.html?sesion=renovar';throw new Error('Acceso no habilitado.');}
        if(!res.ok)throw new Error('No se pudo comprobar tu perfil. Actualiza la página.');
        const perfil=await res.json();
        if(!perfil.sincronizado)return;
        localStorage.setItem('cargo_usuario',perfil.cargo);localStorage.setItem('nombre_usuario',perfil.nombre);localStorage.setItem('usuarioSucursal',perfil.punto_venta);
        const validar=async()=>{
            try{
                const r=await fetch(api+'/personal/mi-perfil',{headers:headers()});
                if(r.status===401 || r.status===403){localStorage.removeItem('access_token');location.href='index.html?sesion=renovar';return;}
                if(r.ok){const p=await r.json();if(p.cargo!==perfil.cargo || p.punto_venta!==perfil.punto_venta)location.reload();}
            }catch(_){/* El servidor valida nuevamente cada petición. */}
        };
        setInterval(validar,60000);window.addEventListener('focus',validar);
        if(!perfil.administrar_personal)return;
        boton=el('button','Personal y accesos');boton.className='banners-acceso';boton.id='personalAbrir';
        document.getElementById('bannersAbrir').before(boton);
        panel=el('dialog');panel.className='banners-panel';panel.id='personalPanel';panel.setAttribute('aria-label','Personal y accesos');
        const header=el('header');header.className='banners-cabecera';header.append(el('h2','Personal y accesos'));
        const cerrar=el('button','Cerrar');cerrar.onclick=()=>panel.close();header.append(cerrar);
        const cuerpo=el('div');cuerpo.className='banners-contenido';estado=el('p');estado.setAttribute('role','status');contenido=el('div');cuerpo.append(estado,contenido);panel.append(header,cuerpo);document.body.append(panel);
        boton.onclick=async()=>{panel.showModal();estado.textContent='Cargando…';try{dibujar(await pedir('/personal/administracion'));estado.textContent='';}catch(e){estado.textContent=e.message;}};
        try{dibujar(await pedir('/personal/administracion'));}catch(e){estado.textContent=e.message;}
    }
    return {iniciar};
})();
