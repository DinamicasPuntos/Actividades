// 1. CAMBIAMOS NGROK POR TU SERVIDOR LOCAL
const API_URL = "https://vague-monika-preimportantly.ngrok-free.dev";

if (localStorage.getItem('access_token')) {
    window.location.href = 'dashboard.html';
}
if (new URLSearchParams(location.search).get('sesion') === 'renovar') {
    const mensaje = document.getElementById('mensaje');
    mensaje.textContent = 'Tu sesión anterior venció. Ingresa nuevamente para cargar tus datos reales.';
    mensaje.style.display = 'block';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const codigo = document.getElementById('codigo').value;
    const documento = document.getElementById('documento').value;
    const mensajeDiv = document.getElementById('mensaje');
    const btn = document.getElementById('btnLogin');

    btn.innerText = "Validando...";
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
            body: JSON.stringify({ codigo: codigo, documento: documento })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('nombre_usuario', data.nombre);
            localStorage.setItem('cargo_usuario', data.cargo);
            localStorage.setItem('usuarioSucursal', data.punto_venta);
            
            // AGREGAMOS ESTA LÍNEA PARA GUARDAR LA CÉDULA
            localStorage.setItem('documento_usuario', documento); 
            
            window.location.href = 'dashboard.html';
        } else {
            // Mostramos el error del backend
            mensajeDiv.innerText = data.detail || "Credenciales incorrectas";
            mensajeDiv.style.display = "block";
        }
    } catch (error) {
        mensajeDiv.innerText = "Error de conexión con el servidor";
        mensajeDiv.style.display = "block";
    } finally {
        btn.innerText = "Ingresar al Portal";
        btn.disabled = false;
    }
});
