globalThis.LiquidacionesUI = (() => {
    let api, panel, estado, contenido, catalogo, seleccion, modo, preparar, actual, ocupado=false, timer;
    const el=(tag,texto)=>{const n=document.createElement(tag);if(texto!==undefined)n.textContent=texto;return n;};
    const headers=()=>({Authorization:`Bearer ${localStorage.getItem('access_token') || ''}`,'Content-Type':'application/json'});
    const numero=n=>Number(n || 0).toLocaleString('es-CO',{maximumFractionDigits:2});
    async function pedir(ruta,method='GET',body) {
        const r=await fetch(api+'/liquidaciones'+ruta,{method,headers:headers(),...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
        const d=await r.json();if(!r.ok)throw new Error(d.detail || 'No se pudo completar la operación.');return d;
    }
    function actualizarOpciones() {
        if(!catalogo)return;
        for(const opcion of seleccion.options) {
            const c=catalogo.dinamicas[Number(opcion.value)];
            const confirmada=catalogo.liquidaciones.some(l=>l.dinamica===c.dinamica && l.periodo===c.periodo && l.modo===modo.value && l.estado==='confirmada');
            opcion.textContent=`${confirmada?'✓ ':''}${c.periodo} · ${c.dinamica}${confirmada?' · Confirmada':''}${c.disponible?'':' · Aún no disponible'}`;
        }
    }
    function elegir() {
        actualizarOpciones();
        actual=null;contenido.replaceChildren();clearTimeout(timer);
        const c=catalogo?.dinamicas[Number(seleccion.value)];
        const previa=c && catalogo.liquidaciones.find(l=>l.dinamica===c.dinamica && l.periodo===c.periodo && l.modo===modo.value);
        preparar.disabled=ocupado || !c || !c.disponible || (modo.value==='vendedor' && c.vendedor_historico) || previa?.estado==='confirmada';
        estado.textContent=!c?'No hay dinámicas configuradas.':!c.disponible?c.motivo:modo.value==='vendedor' && c.vendedor_historico?'La liquidación de vendedores ya existe en el histórico.':`Finalizó el ${c.fin}. Prepara el cálculo para revisarlo.`;
        preparar.textContent=previa?.estado==='preparada' || previa?.estado==='error'?'Volver a preparar':'Preparar liquidación';
        if(previa)cargar(previa.id);
    }
    async function cargar(id) {
        try {const d=await pedir('/'+id);const c=catalogo?.dinamicas[Number(seleccion.value)];
            if(!panel.open || !c || d.dinamica!==c.dinamica || d.periodo!==c.periodo || d.modo!==modo.value)return;dibujar(d);}
        catch(e){estado.textContent=e.message;}
    }
    function dibujar(d) {
        actual=d;contenido.replaceChildren();clearTimeout(timer);
        const previo=catalogo.liquidaciones.findIndex(r=>r.id===d.id);
        if(previo>=0)catalogo.liquidaciones[previo]=d;else catalogo.liquidaciones.push(d);
        actualizarOpciones();
        const estadoNombre={esperando:'Esperando al computador conectado a Uni y Dropo',procesando:'Consultando y calculando',preparada:'Vista previa lista',confirmada:'Liquidación confirmada',error:'No se pudo preparar'};
        estado.textContent=estadoNombre[d.estado] || d.estado;
        preparar.disabled=ocupado || ['esperando','procesando','confirmada'].includes(d.estado);
        if(d.error)contenido.append(el('p',d.error));
        if(['esperando','procesando'].includes(d.estado)) {
            contenido.append(el('p','Mantén encendido y conectado el computador del generador. Puedes cerrar este panel y regresar después.'));
            timer=setTimeout(()=>cargar(d.id),5000);return;
        }
        if(!d.filas)return;
        const resumen=el('div');resumen.className='liquidacion-resumen';
        resumen.append(el('strong',`${numero(d.total_puntos)} puntos`),el('span',`${numero(d.total_actual)} de rotación · ${numero(d.registros)} registros`));contenido.append(resumen);
        for(const b of d.bloqueos || []){const aviso=el('p',b);aviso.className='liquidacion-pendiente';contenido.append(aviso);}
        const acciones=el('div');acciones.className='liquidacion-acciones';
        const excel=el('button','Descargar Excel completo');excel.onclick=async()=>{
            excel.disabled=true;
            try{
                const r=await fetch(api+'/liquidaciones/'+d.id+'/excel',{headers:headers(),signal:AbortSignal.timeout(120000)});
                if(!r.ok){const e=await r.json();throw new Error(e.detail || 'No se pudo descargar.');}
                const url=URL.createObjectURL(await r.blob()),a=el('a');a.href=url;a.download=`Liquidacion_${d.modo}_${d.periodo}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
            }catch(e){estado.textContent=e.message;}finally{excel.disabled=false;}
        };acciones.append(excel);
        if(d.estado==='preparada') {
            const label=el('label'),check=el('input');check.type='checkbox';
            label.append(check,document.createTextNode(` Revisé la liquidación por ${d.modo==='pdv'?'PDV':'vendedor'} y quiero confirmarla.`));contenido.append(label);
            const confirmar=el('button','Confirmar liquidación');confirmar.className='liquidacion-confirmar';confirmar.disabled=true;
            check.onchange=()=>confirmar.disabled=!check.checked || Boolean(d.bloqueos?.length);
            confirmar.onclick=async()=>{
                ocupado=true;confirmar.disabled=true;preparar.disabled=true;seleccion.disabled=true;modo.disabled=true;
                try {dibujar(await pedir('/'+d.id+'/confirmar','POST',{huella:d.huella}));catalogo=await pedir('');actualizarOpciones();}
                catch(e){estado.textContent=e.message;confirmar.disabled=!check.checked;}
                finally{ocupado=false;seleccion.disabled=false;modo.disabled=false;preparar.disabled=actual?.estado==='confirmada';}
            };acciones.append(confirmar);
        }
        contenido.append(acciones,el('p',`Se muestran hasta 100 registros. El Excel contiene los ${numero(d.registros)} registros.`));
        const scroll=el('div');scroll.className='liquidacion-tabla';const tabla=el('table'),head=el('thead'),fila=el('tr');
        const cols=d.modo==='vendedor'?[['nombre','Vendedor'],['cedula','Cédula']]:[];
        cols.push(['sucursal','PDV'],['producto','Producto o grupo'],['actual','Rotación'],['puntos','Puntos'],['estado','Estado']);
        cols.forEach(([,t])=>fila.append(el('th',t)));head.append(fila);tabla.append(head);const body=el('tbody');
        d.filas.forEach(r=>{const tr=el('tr');cols.forEach(([k])=>tr.append(el('td',['actual','puntos'].includes(k)?numero(r[k]):r[k] || '')));body.append(tr);});
        tabla.append(body);scroll.append(tabla);contenido.append(scroll);
    }
    async function abrir() {
        panel.showModal();estado.textContent='Cargando dinámicas…';contenido.replaceChildren();preparar.disabled=true;
        try{
            catalogo=await pedir('');seleccion.replaceChildren();
            catalogo.dinamicas.forEach((c,i)=>{const o=el('option',`${c.periodo} · ${c.dinamica}${c.disponible?'':' · Aún no disponible'}`);o.value=i;seleccion.append(o);});
            const i=catalogo.dinamicas.findIndex(c=>c.disponible);if(i>=0)seleccion.value=String(i);
            elegir();
        }catch(e){estado.textContent=e.message;}
    }
    async function iniciar(apiUrl) {
        api=apiUrl;
        const r=await fetch(api+'/personal/mi-perfil',{headers:headers(),signal:AbortSignal.timeout(30000)});if(!r.ok)return;
        const perfil=await r.json();if(!perfil.administrar_personal)return;
        const boton=el('button','Liquidar dinámicas');boton.id='liquidacionesAbrir';boton.className='banners-acceso';
        document.getElementById('personalAbrir')?.after(boton);
        panel=el('dialog');panel.id='liquidacionesPanel';panel.className='banners-panel liquidaciones-panel';panel.setAttribute('aria-label','Liquidar dinámicas');
        const cabecera=el('header');cabecera.className='banners-cabecera';cabecera.append(el('h2','Liquidar dinámicas'));
        const cerrar=el('button','Cerrar');cerrar.onclick=()=>panel.close();cabecera.append(cerrar);
        const cuerpo=el('div');cuerpo.className='banners-contenido';
        cuerpo.append(el('p','Prepara y confirma cada modalidad por separado, una vez terminada la dinámica.'));
        const filtros=el('div');filtros.className='banners-formulario';
        const dl=el('label','Dinámica y período');seleccion=el('select');seleccion.id='liquidacionDinamica';dl.append(seleccion);
        const ml=el('label','Cálculo');modo=el('select');modo.id='liquidacionModo';
        for(const [v,t] of [['vendedor','Por vendedor'],['pdv','Por PDV']]){const o=el('option',t);o.value=v;modo.append(o);}ml.append(modo);
        preparar=el('button','Preparar liquidación');preparar.id='liquidacionPreparar';filtros.append(dl,ml,preparar);
        estado=el('p');estado.setAttribute('role','status');contenido=el('div');cuerpo.append(filtros,estado,contenido);panel.append(cabecera,cuerpo);document.body.append(panel);
        seleccion.onchange=modo.onchange=elegir;boton.onclick=abrir;panel.addEventListener('close',()=>clearTimeout(timer));
        preparar.onclick=async()=>{
            const c=catalogo.dinamicas[Number(seleccion.value)];if(!c || ocupado)return;
            ocupado=true;preparar.disabled=true;seleccion.disabled=true;modo.disabled=true;estado.textContent='Solicitando cálculo…';
            try{dibujar(await pedir('','POST',{dinamica:c.dinamica,periodo:c.periodo,modo:modo.value}));}
            catch(e){estado.textContent=e.message;preparar.disabled=false;}
            finally{ocupado=false;seleccion.disabled=false;modo.disabled=false;preparar.disabled=['esperando','procesando','confirmada'].includes(actual?.estado);}
        };
    }
    return {iniciar};
})();
