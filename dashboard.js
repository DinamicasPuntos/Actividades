// Cambia la URL según donde estés probando
const API_URL = "https://vague-monika-preimportantly.ngrok-free.dev"; 
// const API_URL = "https://vague-monika-preimportantly.ngrok-free.dev";

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
    


    // Cambiamos para que arranque en la vista de dinámicas
    switchView('dinamicas');
};

async function switchView(view) {
    const tabs = { com: document.getElementById('tab-comisiones'), din: document.getElementById('tab-dinamicas') };
    const views = { com: document.getElementById('view-comisiones'), din: document.getElementById('view-dinamicas') };

    if (view === 'comisiones') {
        tabs.com.classList.add('active'); tabs.din.classList.remove('active');
        views.com.classList.remove('hidden'); views.din.classList.add('hidden');
        await cargarComisiones();
    } else {
        tabs.din.classList.add('active'); tabs.com.classList.remove('active');
        views.din.classList.remove('hidden'); views.com.classList.add('hidden');
        await cargarDinamicas();
    }
}

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
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-muted)">No hay dinámicas liquidadas en este periodo.</td></tr>`;
        } else {
            // 💡 MAGIA AQUÍ: Creamos un agrupador para sumar los montos del mismo laboratorio
            const comisionesAgrupadas = {};

            data.comisiones.forEach(item => {
                // Usamos el laboratorio y la unidad como "llave" 
                // (por si un laboratorio paga en Puntos y en Unidades, no se mezclen mal)
                const llave = `${item.laboratorio}_${item.unidad_label}`;

                if (!comisionesAgrupadas[llave]) {
                    // Si es la primera vez que vemos este laboratorio, lo creamos
                    comisionesAgrupadas[llave] = {
                        laboratorio: item.laboratorio,
                        monto: 0,
                        unidad_label: item.unidad_label
                    };
                }
                // Le sumamos el monto al total de ese laboratorio
                comisionesAgrupadas[llave].monto += item.monto;
            });

            // 💡 Ahora sí, pintamos los datos agrupados
            Object.values(comisionesAgrupadas).forEach(item => {
                total += item.monto;
                tbody.innerHTML += `<tr>
                    <td><i class="fas fa-flask" style="color:var(--primary); margin-right:8px;"></i> <span style="font-weight:600;">${item.laboratorio}</span></td>
                    <td class="text-right" style="font-weight:700;">${item.unidad_label} ${item.monto.toLocaleString()}</td>
                </tr>`;
            });
        }

        document.getElementById('mainLabel').innerText = "Total Liquidado";
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
            // Leemos si el grupo es de Unidades o Puntos
            const textoUnidadGrupo = productos[0].unidad === 'Unds' ? 'Unidades' : 'puntos';
            
            let htmlProductos = productos.map(d => {
                totalFaltanteGlobal += d.faltante;
                faltanteDinamica += d.faltante;
                
                const textoUnidad = d.unidad === 'Unds' ? 'Unidades' : 'puntos';
                
                // Colores para las barras (Verde si logra meta, Azul para personal, Naranja para PDV)
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
                        <div>
                            <i class="fas fa-chevron-down acc-icon"></i>
                            <strong style="font-size: 1.1rem; color: var(--text-main);">${nombreDinamica}</strong>
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

function cargarDinamicasConFiltro() {
    const vistaActiva = document.getElementById('tab-comisiones').classList.contains('active') ? 'comisiones' : 'dinamicas';
    if(vistaActiva === 'comisiones') {
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
        // Crear la diapositiva
        const slide = document.createElement('div');
        slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
        
        // Asignamos la imagen por defecto o la cruzada si alguna falta
        const urlDesktop = banner.desktop || banner.mobile;
        const urlMobile = banner.mobile || banner.desktop;

        slide.innerHTML = `
            <img src="${urlDesktop}" class="banner-img banner-desktop" alt="Banner ${index + 1}">
            <img src="${urlMobile}" class="banner-img banner-mobile" alt="Banner ${index + 1}">
        `;
        slidesContainer.appendChild(slide);

        // Crear el punto de navegación inferior
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

    // Lógica circular (Si pasa de la última, vuelve a la primera)
    if (index >= slides.length) currentSlide = 0;
    else if (index < 0) currentSlide = slides.length - 1;
    else currentSlide = index;

    // Actualizar clases CSS para el efecto visual
    slides.forEach((s, i) => s.classList.toggle('active', i === currentSlide));
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));

    // Reiniciar el temporizador para que no cambie de golpe si el usuario acaba de hacer clic
    reiniciarCarruselAuto();
}

function iniciarCarruselAuto() {
    slideInterval = setInterval(() => { moveSlide(1); }, 5000); // 5000ms = 5 Segundos
}

function reiniciarCarruselAuto() {
    clearInterval(slideInterval);
    iniciarCarruselAuto();
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}
