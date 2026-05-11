// Cambia la URL según donde estés probando
const API_URL = "https://vague-monika-preimportantly.ngrok-free.dev"; 
// const API_URL = "http://127.0.0.1:8000";

function showLoader() { document.getElementById('loader').classList.add('active'); }
function hideLoader() { document.getElementById('loader').classList.remove('active'); }

window.onload = () => {
    cargarBanners();

    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = 'index.html'; 
        return;
    }

    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    document.getElementById('fechaFiltro').value = `${anio}-${mes}`;

    // Mostramos Nombre y Cédula
    document.getElementById('userName').innerText = localStorage.getItem('nombre_usuario') || "Empleado";
    document.getElementById('userCedula').innerHTML = `<i class="fas fa-id-card"></i> C.C. ${localStorage.getItem('documento_usuario') || "Sin registro"}`;
    
    // --- MAGIA DE LIDERAZGO CON IMPRESIÓN EN CONSOLA ---
    const cargoBruto = localStorage.getItem('cargo_usuario');
    const cargo = (cargoBruto || "").toUpperCase();
    
    // 🕵️‍♂️ NUESTROS ESPÍAS:
    console.log("=== REPORTE DE SESIÓN ===");
    console.log("1. Cargo exacto guardado en memoria:", cargoBruto);
    console.log("2. Cargo convertido a mayúsculas:", cargo);
    console.log("3. ¿Tiene permiso de líder?:", cargo.includes("SUPERVISOR") || cargo.includes("COORDINADOR"));
    console.log("=========================");
    
    if (cargo.includes("SUPERVISOR") || cargo.includes("COORDINADOR")) {
        document.getElementById('tab-lideres').classList.remove('hidden');
        switchView('lideres'); 
    } else {
        switchView('dinamicas'); 
    }
};

async function switchView(view) {
    const tabs = { 
        com: document.getElementById('tab-comisiones'), 
        din: document.getElementById('tab-dinamicas'),
        lid: document.getElementById('tab-lideres') // Nuevo
    };
    const views = { 
        com: document.getElementById('view-comisiones'), 
        din: document.getElementById('view-dinamicas'),
        lid: document.getElementById('view-lideres') // Nuevo
    };

    // Reseteamos todas las clases
    Object.values(tabs).forEach(t => t && t.classList.remove('active'));
    Object.values(views).forEach(v => v && v.classList.add('hidden'));

    // Activamos la vista solicitada
    if (view === 'lideres') {
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

// --- NUEVA FUNCIÓN: CARGAR EQUIPOS DE LÍDERES ---
async function cargarEquiposLider() {
    showLoader();
    const token = localStorage.getItem('access_token');
    const fecha = document.getElementById('fechaFiltro').value;
    
    try {
        const res = await fetch(`${API_URL}/lideres/mis-equipos?fecha=${fecha}`, {
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

        let sucursalesMostradas = 0;

        data.dinamicas_lider.forEach(din => {
            const badgeColor = din.unidad === 'Unds' ? '#3b82f6' : '#10b981';
            const textoUnidad = din.unidad === 'Unds' ? 'Unidades Rotadas' : 'Ingresos';

            let htmlSucursales = din.sucursales.map(suc => {
                sucursalesMostradas++;
                return `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <strong style="color: #1e293b;"><i class="fas fa-store-alt" style="color: var(--text-muted); margin-right: 5px;"></i> ${suc.nombre_pdv}</strong>
                        <span style="color: ${suc.faltante > 0 ? '#e11d48' : '#10b981'}; font-weight: bold; font-size: 0.85rem;">
                            ${suc.faltante > 0 ? 'Faltan ' + suc.faltante.toLocaleString() + ' ' + textoUnidad : '¡Meta Cumplida!'}
                        </span>
                    </div>
                    <div style="background: #f1f5f9; border-radius: 8px; height: 10px; overflow: hidden; width: 100%;">
                        <div style="width: ${suc.progreso}%; background: ${suc.progreso >= 100 ? '#10b981' : '#00acec'}; height: 100%; transition: width 0.8s ease;"></div>
                    </div>
                    <div style="text-align: right; font-size: 0.75rem; color: #64748b; margin-top: 6px; font-weight: 600;">
                        ${suc.actual.toLocaleString()} / ${suc.meta.toLocaleString()} (${suc.progreso.toFixed(1)}%)
                    </div>
                </div>`;
            }).join('');

            container.innerHTML += `
                <div class="accordion-item">
                    <div class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-chevron-down acc-icon"></i>
                            <strong style="font-size: 1.1rem; color: var(--text-main);">${din.nombre}</strong>
                            <span style="background: ${badgeColor}20; color: ${badgeColor}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">${din.tipo_dinamica}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                            ${din.sucursales.length} Sucursales
                        </div>
                    </div>
                    <div class="accordion-content" style="padding: 15px; background: #f8fafc;">
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
// --------------------------------------------------------

async function cargarComisiones() {
    showLoader();
    const token = localStorage.getItem('access_token');
    const fecha = document.getElementById('fechaFiltro').value;
    
    try {
        const res = await fetch(`${API_URL}/comisiones/mis-datos?fecha=${fecha}`, {
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
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-muted)">No obtuviste puntos en este periodo.</td></tr>`;
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
                comisionesAgrupadas[llave].monto += item.monto;
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
    
    try {
        const res = await fetch(`${API_URL}/comisiones/mis-dinamicas?fecha=${fecha}`, {
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
            let faltanteDinamica = 0;
            
            const textoUnidadGrupo = productos[0].unidad === 'Unds' ? 'Unidades Rotadas' : 'Ingresos';
            const tipoDinamica = productos[0].tipo_dinamica || 'Dinámica';
            const badgeColor = productos[0].unidad === 'Unds' ? '#3b82f6' : '#10b981';
            
            let htmlProductos = productos.map(d => {
                totalFaltanteGlobal += d.faltante;
                faltanteDinamica += d.faltante;
                
                const textoUnidad = d.unidad === 'Unds' ? 'Unidades Rotadas' : 'Ingresos';
                
                const colorInd = d.progreso >= 100 ? 'var(--success, #10b981)' : 'var(--primary, #3b82f6)';
                const colorPdv = d.progreso_pdv >= 100 ? 'var(--success, #10b981)' : '#f59e0b';
                
                return `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <div style="font-weight: 700; font-size: 1.05rem; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                            ${d.producto}
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
                                <span style="font-weight: 600; color: #475569;"><i class="fas fa-user"></i> Mi Progreso</span>
                                <span style="color: ${d.faltante > 0 ? '#e11d48' : '#10b981'}; font-weight:bold;">
                                    ${d.faltante > 0 ? 'Faltan ' + d.faltante.toLocaleString() + ' ' + textoUnidad : '¡Logrado!'}
                                </span>
                            </div>
                            <div style="background: #e2e8f0; border-radius: 6px; height: 10px; overflow: hidden; width: 100%;">
                                <div style="width: ${d.progreso}%; background: ${colorInd}; height: 100%; border-radius: 6px; transition: width 0.5s ease;"></div>
                            </div>
                            <div style="text-align: right; font-size: 0.75rem; color: #64748b; margin-top: 4px; font-weight: 600;">
                                ${d.actual.toLocaleString()} / ${d.meta.toLocaleString()} ${textoUnidad} (${d.progreso.toFixed(1)}%)
                            </div>
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
                                <span style="font-weight: 600; color: #475569;"><i class="fas fa-store"></i> Equipo Sucursal</span>
                                <span style="color: ${d.faltante_pdv > 0 ? '#e11d48' : '#10b981'}; font-weight:bold;">
                                    ${d.faltante_pdv > 0 ? 'Faltan ' + d.faltante_pdv.toLocaleString() + ' ' + textoUnidad : '¡Logrado!'}
                                </span>
                            </div>
                            <div style="background: #e2e8f0; border-radius: 6px; height: 10px; overflow: hidden; width: 100%;">
                                <div style="width: ${d.progreso_pdv}%; background: ${colorPdv}; height: 100%; border-radius: 6px; transition: width 0.5s ease;"></div>
                            </div>
                            <div style="text-align: right; font-size: 0.75rem; color: #64748b; margin-top: 4px; font-weight: 600;">
                                ${d.actual_pdv.toLocaleString()} / ${d.meta_pdv.toLocaleString()} ${textoUnidad} (${d.progreso_pdv.toFixed(1)}%)
                            </div>
                        </div>
                    </div>`;
            }).join('');

            container.innerHTML += `
                <div class="accordion-item">
                    <div class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <i class="fas fa-chevron-down acc-icon"></i>
                            <strong style="font-size: 1.1rem; color: var(--text-main);">${nombreDinamica}</strong>
                            <span style="background: ${badgeColor}20; color: ${badgeColor}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                                ${tipoDinamica}
                            </span>
                        </div>
                        <div class="text-right">
                            <span style="color: ${faltanteDinamica > 0 ? '#e11d48' : 'var(--success)'}; font-weight: bold; font-size: 0.95rem;">
                                Mi Faltante: ${faltanteDinamica.toLocaleString()} ${textoUnidadGrupo}
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
        
    } catch (e) {       
        console.error(e); 
        document.getElementById('tableDinamicas').innerHTML = `<div style="text-align:center; padding: 2rem; color:#e11d48; font-weight:bold;">⚠️ ${e.message}</div>`;
    } finally {
        hideLoader();
    }
}

// Actualizamos el filtro para que también funcione con la pestaña de líderes
function cargarDinamicasConFiltro() {
    const vistaActivaId = document.querySelector('.tab-btn.active').id;
    if(vistaActivaId === 'tab-lideres') {
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
        const res = await fetch(`${API_URL}/banners`, {
            headers: { 'ngrok-skip-browser-warning': '69420' }
        });
        if (!res.ok) return;
        
        const data = await res.json();
        bannersData = data.banners;

        if (bannersData.length > 0) {
            document.getElementById('bannerCarousel').style.display = 'block';
            renderizarCarrusel();
            iniciarCarruselAuto();
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

        slide.innerHTML = `
            <img src="${urlDesktop}" class="banner-img banner-desktop" alt="Banner ${index + 1}">
            <img src="${urlMobile}" class="banner-img banner-mobile" alt="Banner ${index + 1}">
        `;
        slidesContainer.appendChild(slide);

        const dot = document.createElement('div');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => irASlide(index);
        dotsContainer.appendChild(dot);
    });
}

function moveSlide(step) {
    irASlide(currentSlide + step);
}

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

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}
