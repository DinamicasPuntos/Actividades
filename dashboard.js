// Cambia la URL según donde estés probando
const API_URL = "https://vague-monika-preimportantly.ngrok-free.dev"; 
// const API_URL = "http://127.0.0.1:8000";

function showLoader() { document.getElementById('loader').classList.add('active'); }
function hideLoader() { document.getElementById('loader').classList.remove('active'); }

window.onload = async () => {
    if (globalThis.PrepararSesionLocal && !await globalThis.PrepararSesionLocal()) return;
    cargarBanners();

    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = 'index.html'; 
        return;
    }
    globalThis.BannersAdmin?.iniciar({apiUrl: API_URL, actualizar: cargarBanners});
    try { await globalThis.PersonalUI?.iniciar(API_URL); }
    catch(error) {
        console.error(error); hideLoader();
        const aviso=document.createElement('p');aviso.setAttribute('role','alert');
        aviso.textContent=error.message;
        document.querySelector('main').prepend(aviso);
        return;
    }

    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    document.getElementById('fechaFiltro').value = `${anio}-${mes}`;

    document.getElementById('userName').innerText = localStorage.getItem('nombre_usuario') || "Empleado";
    document.getElementById('userCedula').innerHTML = `<i class="fas fa-id-card"></i> C.C. ${localStorage.getItem('documento_usuario') || "Sin registro"}`;
    
    // --- LÓGICA DE PERMISOS JERÁRQUICOS (3 NIVELES) ---
    const cargo = (localStorage.getItem('cargo_usuario') || "").toUpperCase().trim();
    try { NotificacionesUI.iniciar({ apiUrl: API_URL, verDinamica: verDinamicaNotificada }); }
    catch (error) { console.error('No se pudieron iniciar las notificaciones:', error); }
    
    const tabAdmin = document.getElementById('tab-admin');
    const tabLideres = document.getElementById('tab-lideres');
    const tabDinamicas = document.getElementById('tab-dinamicas');
    const tabComisiones = document.getElementById('tab-comisiones');

    if (cargo === "ADMIN") {
        tabAdmin.classList.remove('hidden');
        tabLideres.classList.add('hidden');
        tabDinamicas.classList.add('hidden');
        tabComisiones.classList.add('hidden');
        switchView('admin');
    } 
    else if (cargo.includes("SUPERVISOR") || cargo.includes("COORDINADOR") || cargo === 'ADMINISTRADOR PDV') {
        tabAdmin.classList.add('hidden');
        tabLideres.classList.remove('hidden');
        tabDinamicas.classList.add('hidden');
        tabComisiones.classList.add('hidden');
        switchView('lideres');
    } 
    else {
        tabAdmin.classList.add('hidden');
        tabLideres.classList.add('hidden');
        tabDinamicas.classList.remove('hidden');
        tabComisiones.classList.remove('hidden');
        switchView('dinamicas');
    }
};

async function switchView(view) {
    showLoader();
    await new Promise(resolve => setTimeout(resolve, 50));

    const tabs = { 
        adm: document.getElementById('tab-admin'),
        lid: document.getElementById('tab-lideres'),
        din: document.getElementById('tab-dinamicas'),
        com: document.getElementById('tab-comisiones')
    };
    const views = { 
        adm: document.getElementById('view-admin'),
        lid: document.getElementById('view-lideres'),
        din: document.getElementById('view-dinamicas'),
        com: document.getElementById('view-comisiones')
    };

    Object.values(tabs).forEach(t => t && t.classList.remove('active'));
    Object.values(views).forEach(v => v && v.classList.add('hidden'));

    if (view === 'admin') {
        tabs.adm.classList.add('active');
        views.adm.classList.remove('hidden');
        document.getElementById('mainLabel').innerText = "Visión Gerencial";
        document.getElementById('totalGeneral').innerText = "Cargando...";
        await cargarVisionAdmin();
    } else if (view === 'lideres') {
        tabs.lid.classList.add('active');
        views.lid.classList.remove('hidden');
        document.getElementById('mainLabel').innerText = "Resumen de Zona";
        document.getElementById('totalGeneral').innerText = "Visualizando...";
        await cargarEquiposLider();
    } else if (view === 'comisiones') {
        tabs.com.classList.add('active');
        views.com.classList.remove('hidden');
        await cargarComisiones();
    } else {
        tabs.din.classList.add('active');
        views.din.classList.remove('hidden');
        await cargarDinamicas();
    }
}

// ========================================================
// --- MÓDULO ADMIN: VISIÓN GLOBAL Y FILTROS ---
// ========================================================
let adminDataMaster = {};
let adminSubVistaActual = 'nacional'; 

async function cargarVisionAdmin() {
    showLoader();
    const token = localStorage.getItem('access_token');
    const fecha = document.getElementById('fechaFiltro').value;
    
    try {
        const url = `${API_URL}/admin/vision-global?fecha=${fecha}&_cb=${new Date().getTime()}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': '69420' }
        });
        
        if (res.status === 401) return logout();
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.detail || 'No se pudo consultar la información real. Intenta actualizar la vista.');
        }

        adminDataMaster = await res.json();
        await cambiarSubVistaAdmin(adminSubVistaActual);
        const estado = document.getElementById('estadoConexion');
        if (estado) {
            estado.hidden = true;
            estado.textContent = '';
        }

    } catch (e) {
        console.error(e);
        const estado = document.getElementById('estadoConexion');
        if (estado) { estado.hidden = false; estado.textContent = e.message; }
        document.getElementById('containerAdmin').innerHTML = `<div style="text-align:center; color:#e11d48; padding: 2rem;">⚠️ ${e.message}</div>`;
        document.getElementById('totalGeneral').innerText = "Error";
        hideLoader();
    } 
}

function cambiarSubVistaAdmin(nivel) {
    showLoader();
    
    ['nacional', 'coordinador', 'supervisor', 'especial'].forEach(n => {
        const btn = document.getElementById(`subtab-${n}`);
        if(btn) {
            btn.classList.remove('active');
            btn.style.background = ""; 
            btn.style.color = "";
        }
    });
    
    const tabActiva = document.getElementById(`subtab-${nivel}`);
    if(tabActiva) {
        tabActiva.classList.add('active');
    }

    return new Promise(resolve => requestAnimationFrame(() => {
        setTimeout(() => {
            adminSubVistaActual = nivel;
            const dataActual = adminDataMaster[`por_${nivel}`] || [];

            const dinSet = new Set(dataActual.map(d => d.dinamica));
            const selectDin = document.getElementById('adminSelectDinamica');
            const seleccionAnterior = selectDin.value;
            selectDin.innerHTML = `<option value="TODAS">Todas las Dinámicas</option>` + 
                [...dinSet].map(d => `<option value="${d}">${d}</option>`).join('');

            const entSet = new Set(dataActual.map(d => d.entidad));
            const dataList = document.getElementById('adminEntidadesList');
            dataList.innerHTML = [...entSet].map(e => `<option value="${e}"></option>`).join('');

            selectDin.value = dinSet.has(seleccionAnterior) ? seleccionAnterior : 'TODAS';
            document.getElementById('adminSearchEntidad').value = '';
            document.getElementById('adminSearchEntidad').placeholder = nivel === 'coordinador' ? 'Buscar región...' : nivel === 'supervisor' ? 'Buscar zona...' : 'Buscar equipo...';
            aplicarFiltrosAdmin();
            hideLoader();
            resolve();
        }, 50);
    }));
}

function limpiarFiltrosAdmin() {
    document.getElementById('adminSearchEntidad').value = "";
    document.getElementById('adminSelectDinamica').value = "TODAS";
    aplicarFiltrosAdmin();
}

function aplicarFiltrosAdmin() {
    const searchVal = document.getElementById('adminSearchEntidad').value.toLowerCase().trim();
    const dinVal = document.getElementById('adminSelectDinamica').value;
    
    let filtrados = (adminDataMaster[`por_${adminSubVistaActual}`] || []).filter(item => {
        const matchNombre = (item.entidad || "").toLowerCase().includes(searchVal);
        const matchDin = (dinVal === "TODAS" || item.dinamica === dinVal);
        return matchNombre && matchDin;
    });

    const agrupado = filtrados.reduce((acc, curr) => {
        if (!acc[curr.entidad]) acc[curr.entidad] = [];
        acc[curr.entidad].push(curr);
        return acc;
    }, {});

    renderizarVistaAdmin(agrupado);
}

function renderizarVistaAdmin(agrupado) {
    const container = document.getElementById('containerAdmin');
    container.innerHTML = "";
    const dinamicaUnica = document.getElementById('adminSelectDinamica').value !== 'TODAS';
    const tarjetasDirectas = dinamicaUnica || adminSubVistaActual === 'nacional';
    container.classList.toggle('resultados-por-equipo', tarjetasDirectas);

    const keys = Object.keys(agrupado);
    if (keys.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron resultados para este filtro.</div>`;
        document.getElementById('totalGeneral').innerText = "0 Resultados";
        return;
    }

    let icon = "fa-users";
    if (adminSubVistaActual === 'coordinador') icon = "fa-user-tie";
    else if (adminSubVistaActual === 'nacional') icon = "fa-flag";
    else if (adminSubVistaActual === 'especial') icon = "fa-headset";

    keys.forEach(entidad => {
        const dinámicas = agrupado[entidad];
        
        let htmlDinamicas = dinámicas.map(d => {
            const badgeColor = d.unidad === 'Unds' ? '#087e8b' : '#10b981';
            const textoUnidad = d.unidad === 'Unds' ? 'Unidades' : 'Ingresos';
            const textoBadge = d.unidad === 'Unds' ? 'Unidades Rotadas' : 'Ingresos';
            
            let tipoStr = d.tipo_dinamica || "";
            if (!tipoStr || tipoStr.toUpperCase() === "DINÁMICA" || tipoStr.toUpperCase() === "N/A") {
                tipoStr = textoBadge;
            }
            
            if (adminSubVistaActual === 'especial') {
                const f_gen = d.faltante_general || 0;
                const msgGeneral = f_gen > 0 ? `Faltan ${f_gen.toLocaleString()} ${textoUnidad}` : '¡Logrado!';
                
                const f_call = d.faltante_call || 0;
                const msgCall = f_call > 0 ? `Faltan ${f_call.toLocaleString()}` : '¡Logrado!';
                
                const f_super = d.faltante_super || 0;
                const msgSuper = f_super > 0 ? `Faltan ${f_super.toLocaleString()}` : '¡Logrado!';
                
                const act_gen = d.actual_general || 0, met_gen = d.meta_general || 0, prog_gen = d.progreso_general || 0;
                const act_call = d.actual_call || 0, met_call = d.meta_call || 0, prog_call = d.progreso_call || 0;
                const act_super = d.actual_super || 0, met_super = d.meta_super || 0, prog_super = d.progreso_super || 0;

                // Conteo de Agentes
                const conteoCall = d.conteo_call || 0;
                const conteoSuper = d.conteo_super || 0;
                const conteoTotal = conteoCall + conteoSuper;

                return `
                <div class="dynamic-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                        <strong style="color: #1e293b; font-size: 1.1rem;">${d.dinamica || "Dinámica"}</strong>
                        <span style="background: ${badgeColor}20; color: ${badgeColor}; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 0.75rem;">${tipoStr.toUpperCase()}</span>
                    </div>
                    
                    ${ParticipantesDinamica.renderizar(d)}
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
                            <span style="font-weight: 700; color: #334155;"><i class="fas fa-chart-pie" style="color: var(--primary);"></i> General (${conteoTotal} Personas)</span>
                            <span style="color: ${f_gen > 0 ? '#e11d48' : '#10b981'}; font-weight:bold;">${msgGeneral}</span>
                        </div>
                        <div style="background: #f1f5f9; border-radius: 6px; height: 10px; overflow: hidden; width: 100%;">
                            <div style="width: ${prog_gen}%; background: ${prog_gen >= 100 ? '#10b981' : '#168e94'}; height: 100%; transition: width 0.8s ease;"></div>
                        </div>
                        <div style="text-align: right; font-size: 0.75rem; color: #64748b; margin-top: 4px; font-weight: 600;">
                            ${act_gen.toLocaleString()} / ${met_gen.toLocaleString()} (${prog_gen.toFixed(1)}%)
                        </div>
                    </div>

                    <div style="margin-bottom: 12px; padding-left: 12px; border-left: 2px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 5px;">
                            <span style="font-weight: 600; color: #475569;"><i class="fas fa-headset" style="color: #f59e0b;"></i> Call Centers (${conteoCall} Agentes)</span>
                            <span style="color: ${f_call > 0 ? '#e11d48' : '#10b981'}; font-weight:bold;">${msgCall}</span>
                        </div>
                        <div style="background: #f1f5f9; border-radius: 6px; height: 6px; overflow: hidden; width: 100%;">
                            <div style="width: ${prog_call}%; background: ${prog_call >= 100 ? '#10b981' : '#f59e0b'}; height: 100%; transition: width 0.8s ease;"></div>
                        </div>
                        <div style="text-align: right; font-size: 0.7rem; color: #64748b; margin-top: 4px; font-weight: 600;">
                            ${act_call.toLocaleString()} / ${met_call.toLocaleString()} (${prog_call.toFixed(1)}%)
                        </div>
                    </div>

                    <div style="padding-left: 12px; border-left: 2px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 5px;">
                            <span style="font-weight: 600; color: #475569;"><i class="fas fa-bolt" style="color: #8b5cf6;"></i> Supernumerarios (${conteoSuper} Agentes)</span>
                            <span style="color: ${f_super > 0 ? '#e11d48' : '#10b981'}; font-weight:bold;">${msgSuper}</span>
                        </div>
                        <div style="background: #f1f5f9; border-radius: 6px; height: 6px; overflow: hidden; width: 100%;">
                            <div style="width: ${prog_super}%; background: ${prog_super >= 100 ? '#10b981' : '#8b5cf6'}; height: 100%; transition: width 0.8s ease;"></div>
                        </div>
                        <div style="text-align: right; font-size: 0.7rem; color: #64748b; margin-top: 4px; font-weight: 600;">
                            ${act_super.toLocaleString()} / ${met_super.toLocaleString()} (${prog_super.toFixed(1)}%)
                        </div>
                    </div>
                </div>`;
            } 
            else {
                const f_norm = d.faltante || 0;
                const a_norm = d.actual || 0;
                const m_norm = d.meta || 0;
                const p_norm = d.progreso || 0;

                return `
                <div class="dynamic-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <strong style="color: #1e293b;">${d.dinamica || "Dinámica"}</strong>
                        <span style="color: ${f_norm > 0 ? '#e11d48' : '#10b981'}; font-weight: bold; font-size: 0.85rem;">
                            ${f_norm > 0 ? 'Faltan ' + f_norm.toLocaleString() + ' ' + textoUnidad : '¡Logrado!'}
                        </span>
                    </div>
                    ${ParticipantesDinamica.renderizar(d)}
                    <div style="background: #f1f5f9; border-radius: 8px; height: 10px; overflow: hidden; width: 100%;">
                        <div style="width: ${p_norm}%; background: ${p_norm >= 100 ? '#10b981' : '#168e94'}; height: 100%; transition: width 0.8s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-top: 8px;">
                        <span style="background: ${badgeColor}20; color: ${badgeColor}; padding: 2px 8px; border-radius: 8px; font-weight: 700;">${tipoStr.toUpperCase()}</span>
                        <span style="color: #64748b; font-weight: 600;">${a_norm.toLocaleString()} / ${m_norm.toLocaleString()} (${p_norm.toFixed(1)}%)</span>
                    </div>
                </div>`;
            }
        }).join('');

        if (adminSubVistaActual === 'nacional' && !dinamicaUnica) {
            container.insertAdjacentHTML('beforeend', htmlDinamicas);
            return;
        }
        if (dinamicaUnica) {
            const tarjeta = document.createElement('section');
            tarjeta.className = 'resultado-equipo';
            const encabezado = document.createElement('header');
            encabezado.className = 'resultado-equipo-titulo';
            const etiqueta = document.createElement('span');
            etiqueta.textContent = adminSubVistaActual === 'coordinador' ? 'Coordinación · Región' : adminSubVistaActual === 'supervisor' ? 'Supervisión · Zona' : 'Resultados';
            const nombre = document.createElement('h3');
            nombre.textContent = entidad;
            encabezado.append(etiqueta, nombre);
            tarjeta.append(encabezado);
            tarjeta.insertAdjacentHTML('beforeend', htmlDinamicas);
            container.append(tarjeta);
            return;
        }

        container.innerHTML += `
            <div class="accordion-item">
                <div class="accordion-header" role="button" tabindex="0" aria-expanded="false" onclick="alternarAcordeon(this)" onkeydown="tecladoAcordeon(event, this)">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="acc-icon" aria-hidden="true">&#8964;</span>
                        <strong style="font-size: 1.1rem; color: var(--text-main);"><i class="fas ${icon}" style="color: var(--primary); margin-right: 5px;"></i> ${entidad}</strong>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                        ${dinámicas.length} Dinámicas Activas
                    </div>
                </div>
                <div class="accordion-content" style="padding: 15px; background: #f8fafc;">
                    ${htmlDinamicas}
                </div>
            </div>`;
    });

    const totalDinamicas = new Set(Object.values(agrupado).flat().map(d => d.dinamica)).size;
    document.getElementById('totalGeneral').innerText = `${totalDinamicas} ${totalDinamicas === 1 ? 'dinámica' : 'dinámicas'}`;
}

// ========================================================
// --- MÓDULO LÍDERES (SUPERVISOR / COORDINADOR) ---
// ========================================================
async function cargarEquiposLider() {
    showLoader();
    const token = localStorage.getItem('access_token');
    const fecha = document.getElementById('fechaFiltro').value;
    
    try {
        const url = `${API_URL}/lideres/mis-equipos?fecha=${fecha}&_cb=${new Date().getTime()}`;
        const res = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': '69420' 
            }
        });
        
        if (res.status === 401) return logout();

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Error al cargar los datos del equipo");
        }

        const data = await res.json();
        const container = document.getElementById('containerLideres');
        container.innerHTML = "";

        if (!data.dinamicas_lider || data.dinamicas_lider.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted)">No hay equipos bajo tu supervisión en este periodo.</div>`;
            document.getElementById('totalGeneral').innerText = "Sin datos";
            return;
        }

        data.dinamicas_lider.forEach(din => {
            const productoUnico = ParticipantesDinamica.normalizar(din).productos.length === 1;
            const badgeColor = din.unidad === 'Unds' ? '#087e8b' : '#10b981';
            const textoUnidad = din.unidad === 'Unds' ? 'Unidades Rotadas' : 'Ingresos';
            
            // 💡 REGLA DE ORO PARA EL BADGE - VISTA LÍDERES
            let tipoStr = (din.tipo_dinamica || "").trim();
            if (!tipoStr || tipoStr.toUpperCase() === "DINÁMICA" || tipoStr.toUpperCase() === "N/A") {
                tipoStr = din.unidad === 'Unds' ? 'UNIDADES ROTADAS' : 'INGRESOS';
            }

            let htmlSucursales = din.sucursales.map(suc => {
                const s_falt = suc.faltante || 0;
                const s_act = suc.actual || 0;
                const s_met = suc.meta || 0;
                const s_prog = suc.progreso || 0;

                return `
                <div class="dynamic-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <strong style="color: #1e293b;">
                            <i class="fas fa-map-marker-alt" style="color: var(--text-muted); margin-right: 5px;"></i> 
                            ${suc.nombre_pdv} 
                        </strong>
                        <span style="color: ${s_falt > 0 ? '#e11d48' : '#10b981'}; font-weight: bold; font-size: 0.85rem;">
                            ${s_falt > 0 ? 'Faltan ' + s_falt.toLocaleString() + ' ' + textoUnidad : '¡Meta Cumplida!'}
                        </span>
                    </div>
                    <div style="background: #f1f5f9; border-radius: 8px; height: 10px; overflow: hidden; width: 100%;">
                        <div style="width: ${s_prog}%; background: ${s_prog >= 100 ? '#10b981' : '#168e94'}; height: 100%; transition: width 0.8s ease;"></div>
                    </div>
                    <div style="text-align: right; font-size: 0.75rem; color: #64748b; margin-top: 6px; font-weight: 600;">
                        ${s_act.toLocaleString()} / ${s_met.toLocaleString()} (${s_prog.toFixed(1)}%)
                    </div>
                    ${ParticipantesDinamica.renderizarRotacion({...suc, alcance: din.alcance, unidad: din.unidad})}
                </div>`;
            }).join('');

            container.innerHTML += `
                <div class="accordion-item ${productoUnico ? 'accordion-item--directa active' : ''}">
                    <div class="accordion-header" ${productoUnico ? '' : 'role="button" tabindex="0" onclick="alternarAcordeon(this)" onkeydown="tecladoAcordeon(event, this)" aria-expanded="false"'}>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="acc-icon" aria-hidden="true">&#8964;</span>
                            <strong style="font-size: 1.1rem; color: var(--text-main);">${din.nombre}</strong>
                            <span style="background: ${badgeColor}20; color: ${badgeColor}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">${tipoStr.toUpperCase()}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                            ${din.sucursales.length} Registros
                        </div>
                    </div>
                    <div class="accordion-content" style="padding: 15px; background: #f8fafc;">
                        ${ParticipantesDinamica.renderizarAlcance(din)}
                        ${htmlSucursales}
                    </div>
                </div>`;
        });

        document.getElementById('totalGeneral').innerText = "Zona Activa";

    } catch (e) {
        console.error(e);
        document.getElementById('containerLideres').innerHTML = `<div style="text-align:center; padding: 2rem; color:#e11d48; font-weight:bold;">⚠️ ${e.message}</div>`;
    } finally {
        hideLoader();
    }
}

// ========================================================
// --- MÓDULO VENDEDORES: COMISIONES Y DINÁMICAS ---
// ========================================================
async function cargarComisiones() {
    showLoader();
    const token = localStorage.getItem('access_token');
    const fecha = document.getElementById('fechaFiltro').value;
    
    try {
        const url = `${API_URL}/comisiones/mis-datos?fecha=${fecha}&_cb=${new Date().getTime()}`;
        const res = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': '69420' 
            }
        });
        
        if (res.status === 401) return logout();
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Error al cargar los datos del servidor");
        }

        const data = await res.json();
        
        let total = 0;
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = "";

        if(!data.comisiones || data.comisiones.length === 0){
            const fila = tbody.insertRow();
            const celda = fila.insertCell();
            celda.colSpan = 2;
            celda.className = 'puntos-vacios';
            const mensaje = document.createElement('p');
            mensaje.textContent = 'No hay puntos liquidados para tu cuenta en el período seleccionado.';
            celda.append(mensaje);
            const periodos = (data.periodos_disponibles || []).filter(p => /^\d{4}-(0[1-9]|1[0-2])$/.test(p));
            if (periodos.length) {
                const ayuda = document.createElement('p');
                ayuda.textContent = 'Tienes liquidaciones en estos períodos:';
                celda.append(ayuda);
                const botones = document.createElement('div');
                botones.className = 'puntos-periodos';
                for (const periodo of periodos) {
                    const boton = document.createElement('button');
                    boton.type = 'button';
                    boton.textContent = new Date(`${periodo}-01T12:00:00`).toLocaleDateString('es-CO', {month:'long', year:'numeric'});
                    boton.dataset.periodo = periodo;
                    boton.addEventListener('click', () => {
                        document.getElementById('fechaFiltro').value = periodo;
                        NotificacionesUI.actualizar();
                        cargarComisiones();
                    });
                    botones.append(boton);
                }
                celda.append(botones);
            }
        } else {
            const comisionesAgrupadas = {};

            data.comisiones.forEach(item => {
                const llave = `${item.laboratorio}_${item.unidad_label}`;

                if (!comisionesAgrupadas[llave]) {
                    comisionesAgrupadas[llave] = {
                        laboratorio: item.laboratorio,
                        monto: 0,
                        unidad_label: item.unidad_label
                    };
                }
                comisionesAgrupadas[llave].monto += (item.monto || 0);
            });

            Object.values(comisionesAgrupadas).forEach(item => {
                total += item.monto;
                tbody.innerHTML += `<tr>
                    <td><i class="fas fa-flask" style="color:var(--primary); margin-right:8px;"></i> <span style="font-weight:600;">${item.laboratorio}</span></td>
                    <td class="text-right" style="font-weight:700;">${item.unidad_label} ${item.monto.toLocaleString()}</td>
                </tr>`;
            });
        }

        document.getElementById('mainLabel').innerText = "Total Obtenido";
        document.getElementById('totalGeneral').innerText = `Total: ${total.toLocaleString()}`;
        
    } catch (e) { 
        console.error(e); 
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="2" style="text-align:center; color:#e11d48; padding: 20px;">⚠️ ${e.message}</td></tr>`;
    } finally {
        hideLoader();
    }
}

async function cargarDinamicas() {
    showLoader();
    const token = localStorage.getItem('access_token');
    const fecha = document.getElementById('fechaFiltro').value;
    // 💡 NUEVO: Verificamos si el usuario es de un canal especial (Call Center o Supernumerario)
    const cargo = (localStorage.getItem('cargo_usuario') || "Nada").toUpperCase().trim();
    
    console.log(cargo)
    const esCargoEspecial = cargo.includes("CALL CENTER") || cargo.includes("SUPERNUMERARIO");
    
    try {
        const url = `${API_URL}/comisiones/mis-dinamicas?fecha=${fecha}&_cb=${new Date().getTime()}`;
        const res = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': '69420'
            }
        });
        
        if (res.status === 401) return logout();

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Error al cargar las dinámicas");
        }

        const data = await res.json();
        
        const container = document.getElementById('tableDinamicas');
        container.innerHTML = "";
        let totalFaltanteGlobal = 0;

        if(!data.dinamicas || data.dinamicas.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-muted)">No hay dinámicas activas en este periodo.</div>`;
            document.getElementById('mainLabel').innerText = "Faltante Total Mes (Personal)";
            document.getElementById('totalGeneral').innerText = "¡COMPLETO!";
            return;
        }

        const agrupadas = data.dinamicas.reduce((acc, curr) => {
            if (!acc[curr.nombre]) acc[curr.nombre] = [];
            acc[curr.nombre].push(curr);
            return acc;
        }, {});

        for (const [nombreDinamica, productos] of Object.entries(agrupadas)) {
            const productoUnico = productos.length === 1;
            let faltanteDinamica = 0;
            
            const textoUnidadGrupo = productos[0].unidad === 'Unds' ? 'Unidades Rotadas' : 'Ingresos';
            const badgeColor = productos[0].unidad === 'Unds' ? '#087e8b' : '#10b981';
            
            let tipoStr = (productos[0].tipo_dinamica || "").trim();
            if (!tipoStr || tipoStr.toUpperCase() === "DINÁMICA" || tipoStr.toUpperCase() === "N/A") {
                tipoStr = productos[0].unidad === 'Unds' ? 'UNIDADES ROTADAS' : 'INGRESOS';
            }
            
            let htmlProductos = productos.map(d => {
                if (d.sin_cuota_individual) {
                    const escapar = valor => {const n=document.createElement('span');n.textContent=String(valor ?? '');return n.innerHTML;};
                    const pdvs=(d.pdvs || []).map(p=>`<li><strong>${escapar(p.nombre)}</strong>: vendiste ${Number(p.mis_ventas).toLocaleString()} ${escapar(d.unidad)}. ${p.cumple ? 'El PDV cumple la cuota.' : 'El PDV aún no cumple la cuota.'}</li>`).join('');
                    return `<div class="dynamic-card"><strong>${escapar(d.producto)}</strong><p>Tus ventas: ${Number(d.actual).toLocaleString()} ${escapar(d.unidad)} · Sin cuota individual.</p><p>Tu pago depende del cumplimiento del PDV donde vendiste.</p><ul>${pdvs}</ul></div>`;
                }
                const p_falt = d.faltante || 0;
                const pdv_falt = d.faltante_pdv || 0;
                const p_act = d.actual || 0;
                const p_met = d.meta || 0;
                const pdv_act = d.actual_pdv || 0;
                const pdv_met = d.meta_pdv || 0;
                
                totalFaltanteGlobal += p_falt;
                faltanteDinamica += p_falt;
                
                const textoUnidad = d.unidad === 'Unds' ? 'Unidades Rotadas' : 'Ingresos';
                const colorInd = (d.progreso || 0) >= 100 ? 'var(--success, #10b981)' : 'var(--primary, #087e8b)';
                const colorPdv = (d.progreso_pdv || 0) >= 100 ? 'var(--success, #10b981)' : '#f59e0b';
                
                // 💡 MAGIA: Si NO es cargo especial, fabricamos el HTML de la sucursal. Si lo es, lo dejamos vacío.
                let htmlEquipoSucursal = "";
                if (!esCargoEspecial) {
                    htmlEquipoSucursal = `
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
                            <span style="font-weight: 600; color: #475569;"><i class="fas fa-store"></i> Equipo Sucursal</span>
                            <span style="color: ${pdv_falt > 0 ? '#e11d48' : '#10b981'}; font-weight:bold;">
                                ${pdv_falt > 0 ? 'Faltan ' + pdv_falt.toLocaleString() + ' ' + textoUnidad : '¡Logrado!'}
                            </span>
                        </div>
                        <div style="background: #e2e8f0; border-radius: 6px; height: 10px; overflow: hidden; width: 100%;">
                            <div style="width: ${d.progreso_pdv || 0}%; background: ${colorPdv}; height: 100%; border-radius: 6px; transition: width 0.5s ease;"></div>
                        </div>
                        <div style="text-align: right; font-size: 0.75rem; color: #64748b; margin-top: 4px; font-weight: 600;">
                            ${pdv_act.toLocaleString()} / ${pdv_met.toLocaleString()} ${textoUnidad} (${(d.progreso_pdv || 0).toFixed(1)}%)
                        </div>
                    </div>`;
                }

                return `
                    <div class="dynamic-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <div style="font-weight: 700; font-size: 1.05rem; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                            ${d.producto}
                        </div>
                        
                        <div style="margin-bottom: ${esCargoEspecial ? '0' : '15px'};">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
                                <span style="font-weight: 600; color: #475569;"><i class="fas fa-user"></i> Mi Progreso</span>
                                <span style="color: ${p_falt > 0 ? '#e11d48' : '#10b981'}; font-weight:bold;">
                                    ${p_falt > 0 ? 'Faltan ' + p_falt.toLocaleString() + ' ' + textoUnidad : '¡Logrado!'}
                                </span>
                            </div>
                            <div style="background: #e2e8f0; border-radius: 6px; height: 10px; overflow: hidden; width: 100%;">
                                <div style="width: ${d.progreso || 0}%; background: ${colorInd}; height: 100%; border-radius: 6px; transition: width 0.5s ease;"></div>
                            </div>
                            <div style="text-align: right; font-size: 0.75rem; color: #64748b; margin-top: 4px; font-weight: 600;">
                                ${p_act.toLocaleString()} / ${p_met.toLocaleString()} ${textoUnidad} (${(d.progreso || 0).toFixed(1)}%)
                            </div>
                        </div>
                        
                        ${htmlEquipoSucursal}
                    </div>`;
            }).join('');

            container.innerHTML += `
                <div class="accordion-item ${productoUnico ? 'accordion-item--directa active' : ''}">
                    <div class="accordion-header" ${productoUnico ? '' : 'role="button" tabindex="0" onclick="alternarAcordeon(this)" onkeydown="tecladoAcordeon(event, this)" aria-expanded="false"'}>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <span class="acc-icon" aria-hidden="true">&#8964;</span>
                            <strong style="font-size: 1.1rem; color: var(--text-main);">${nombreDinamica}</strong>
                            <span style="background: ${badgeColor}20; color: ${badgeColor}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                                ${tipoStr.toUpperCase()}
                            </span>
                        </div>
                        <div class="text-right">
                            <span style="color: ${faltanteDinamica > 0 ? '#e11d48' : 'var(--success)'}; font-weight: bold; font-size: 0.95rem;">
                                ${productos[0].sin_cuota_individual ? 'Sin cuota individual' : `Mi Faltante: ${faltanteDinamica.toLocaleString()} ${textoUnidadGrupo}`}
                            </span>
                        </div>
                    </div>
                    <div class="accordion-content">
                        ${htmlProductos}
                    </div>
                </div>`;
        }

        document.getElementById('mainLabel').innerText = "Faltante Total Mes (Personal)";
        document.getElementById('totalGeneral').innerText = totalFaltanteGlobal > 0 ? `- ${totalFaltanteGlobal.toLocaleString()}` : "¡COMPLETO!";
        if(data.dinamicas.some(d=>d.sin_cuota_individual)){
            document.getElementById('mainLabel').innerText='Condición de pago';
            document.getElementById('totalGeneral').innerText='Cumplimiento por PDV';
        }
        
    } catch (e) {       
        console.error(e); 
        document.getElementById('tableDinamicas').innerHTML = `<div style="text-align:center; padding: 2rem; color:#e11d48; font-weight:bold;">⚠️ ${e.message}</div>`;
    } finally {
        hideLoader();
    }
}

// ========================================================
// --- HERRAMIENTAS GLOBALES ---
// ========================================================

function cargarDinamicasConFiltro() {
    NotificacionesUI.actualizar();
    const activeTab = document.querySelector('.tab-btn.active');
    if (!activeTab) return;
    
    const vistaActivaId = activeTab.id;
    
    if(vistaActivaId === 'tab-admin') {
        cargarVisionAdmin();
    } else if(vistaActivaId === 'tab-lideres') {
        cargarEquiposLider();
    } else if(vistaActivaId === 'tab-comisiones') {
        cargarComisiones();
    } else {
        cargarDinamicas();
    }
}

let currentSlide = 0;
let slideInterval;
let bannersData = [];

async function cargarBanners() {
    try {
        const url = `${API_URL}/banners?_cb=${new Date().getTime()}`;
        const res = await fetch(url, {
            headers: { 'ngrok-skip-browser-warning': '69420' }
        });
        if (!res.ok) return;
        
        const data = await res.json();
        bannersData = data.banners;
        clearInterval(slideInterval);
        currentSlide = 0;

        if (bannersData.length > 0) {
            document.getElementById('bannerCarousel').style.display = 'block';
            renderizarCarrusel();
            iniciarCarruselAuto();
        } else {
            document.getElementById('bannerCarousel').style.display = 'none';
            document.getElementById('carouselSlides').replaceChildren();
            document.getElementById('carouselDots').replaceChildren();
        }
    } catch (e) {
        console.error("Error cargando banners:", e);
    }
}

function renderizarCarrusel() {
    const slidesContainer = document.getElementById('carouselSlides');
    const dotsContainer = document.getElementById('carouselDots');
    slidesContainer.innerHTML = '';
    dotsContainer.innerHTML = '';

    bannersData.forEach((banner, index) => {
        const slide = document.createElement('div');
        slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
        
        const urlDesktop = banner.desktop || banner.mobile;
        const urlMobile = banner.mobile || banner.desktop;

        for (const [src, clase] of [[urlDesktop, 'banner-desktop'], [urlMobile, 'banner-mobile']]) {
            const img = document.createElement('img');
            img.className = `banner-img ${clase}`; img.alt = `Banner ${index + 1}`;
            BannerImagenes.asignar(img, src);
            slide.appendChild(img);
        }
        slidesContainer.appendChild(slide);

        const dot = document.createElement('div');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => irASlide(index);
        dotsContainer.appendChild(dot);
    });
}

function moveSlide(step) { irASlide(currentSlide + step); }

function irASlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    if(slides.length === 0) return;

    if (index >= slides.length) currentSlide = 0;
    else if (index < 0) currentSlide = slides.length - 1;
    else currentSlide = index;

    slides.forEach((s, i) => s.classList.toggle('active', i === currentSlide));
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));

    reiniciarCarruselAuto();
}

function iniciarCarruselAuto() {
    slideInterval = setInterval(() => { moveSlide(1); }, 5000); 
}

function reiniciarCarruselAuto() {
    clearInterval(slideInterval);
    iniciarCarruselAuto();
}

async function verDinamicaNotificada(aviso) {
    const cargo = (localStorage.getItem('cargo_usuario') || '').toUpperCase().trim();
    const vista = cargo === 'ADMIN' ? 'admin' : (cargo.includes('SUPERVISOR') || cargo.includes('COORDINADOR') || cargo === 'ADMINISTRADOR PDV') ? 'lideres' : 'dinamicas';
    if (vista === 'admin') adminSubVistaActual = 'nacional';
    await switchView(vista);
    if (vista === 'admin') {
        adminSubVistaActual = 'nacional';
        const selector = document.getElementById('adminSelectDinamica');
        selector.value = aviso.dinamica;
        document.getElementById('adminSearchEntidad').value = '';
        aplicarFiltrosAdmin();
    }
    const contenedor = document.getElementById(vista === 'admin' ? 'containerAdmin' : vista === 'lideres' ? 'containerLideres' : 'tableDinamicas');
    const acordeones = [...contenedor.querySelectorAll('.accordion-item')];
    const destino = vista === 'admin' ? (contenedor.querySelector('.resultado-equipo') || acordeones[0]) : acordeones.find(a => [...a.querySelectorAll('.accordion-header strong')].some(t => t.textContent.trim() === aviso.dinamica));
    if (destino) {
        destino.classList.add('active');
        destino.querySelector('[role="button"]')?.setAttribute('aria-expanded', 'true');
        destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function logout() {
    NotificacionesUI.detener();
    const lecturas = localStorage.getItem(NotificacionesUI.claveLecturas);
    localStorage.clear();
    if (lecturas) localStorage.setItem(NotificacionesUI.claveLecturas, lecturas);
    window.location.href = 'index.html';
}

function alternarAcordeon(cabecera) {
    const abierto = cabecera.parentElement.classList.toggle('active');
    cabecera.setAttribute('aria-expanded', String(abierto));
}
function tecladoAcordeon(evento, cabecera) {
    if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault(); alternarAcordeon(cabecera);
    }
}
