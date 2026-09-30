"""Prueba del navegador con respuestas ficticias: no usa cuentas ni la API real.

Ejecutar: python tests/verificar_participantes.py
Requiere playwright y Microsoft Edge instalado.
"""
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
PRODUCTOS = [{"codigo": f"770000000000{i}", "nombre": f"Producto de ejemplo {i}"} for i in range(1, 7)]
BASE = {"unidad": "Unds", "faltante": 51, "actual": 19, "meta": 70, "progreso": 27.1,
        "rotacion_productos": [{**p, 'actual': actual} for p, actual in zip(PRODUCTOS, [12, 7, 0])]}
DINAMICAS = [
    {**BASE, "dinamica": "DINÁMICA CON PRODUCTOS", "alcance": {"tipo": "productos", "productos": PRODUCTOS}},
    {**BASE, "dinamica": "DINÁMICA POR MARCA", "alcance": {"tipo": "marca", "nombre": "Marca de ejemplo"}},
    {**BASE, "dinamica": "DINÁMICA POR FAMILIA", "alcance": {"tipo": "familia", "nombre": "Cuidado personal", "productos": PRODUCTOS[:2]}},
    {**BASE, "dinamica": "DINÁMICA SIN DETALLE", "rotacion_productos": []},
]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}"
    capturas = ROOT / "tests" / "artifacts"
    capturas.mkdir(exist_ok=True)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="msedge", headless=True)
            for cargo in ("ADMIN", "SUPERVISOR", "COORDINADOR"):
                context = browser.new_context(viewport={"width": 1200, "height": 1000})
                context.add_init_script("""
                    localStorage.setItem('access_token', 'token-ficticio-prueba');
                    localStorage.setItem('nombre_usuario', 'Usuario de prueba');
                    localStorage.setItem('cargo_usuario', %s);
                """ % json.dumps(cargo))

                def responder(route):
                    destino = route.request.url
                    if destino.startswith(url):
                        route.continue_()
                        return
                    if "/admin/vision-global" in destino:
                        datos = {f"por_{nivel}": [{**din, "entidad": "Equipo de ejemplo"} for din in DINAMICAS]
                                 for nivel in ("nacional", "coordinador", "supervisor")}
                    elif "/lideres/mis-equipos" in destino:
                        datos = {"dinamicas_lider": [{**din, "nombre": din["dinamica"], "sucursales": [{**din, "nombre_pdv": "PDV de ejemplo"}]} for din in DINAMICAS]}
                    elif "/banners" in destino:
                        datos = []
                    else:
                        route.abort()
                        return
                    route.fulfill(status=200, content_type="application/json", body=json.dumps(datos),
                                  headers={"Access-Control-Allow-Origin": "*"})

                context.route("**/*", responder)
                page = context.new_page()
                errores = []
                page.on("pageerror", lambda error: errores.append(str(error)))
                page.goto(url + "/dashboard.html")
                container = page.locator("#containerAdmin" if cargo == "ADMIN" else "#containerLideres")
                expect(container.locator(".dynamic-card")).to_have_count(4)
                if cargo == "ADMIN":
                    for nivel in ("nacional", "coordinador", "supervisor"):
                        page.locator(f"#subtab-{nivel}").click()
                        expect(page.locator(f"#subtab-{nivel}")).to_have_class("tab-btn active")
                        expect(container.locator(".dynamic-card")).to_have_count(4)
                        if nivel != 'nacional':
                            container.locator(".accordion-header").first.click()
                        expect(container.get_by_text("Marca de ejemplo")).to_be_visible()
                        expect(container.get_by_text("Cuidado personal")).to_be_visible()
                        expect(container.get_by_text("19 / 70 (27.1%)").first).to_be_visible()
                else:
                    for header in container.locator(".accordion-header").all():
                        header.click()
                detalles = container.locator(".productos-adicionales").first
                rotacion = container.locator('.rotacion-productos').first
                expect(rotacion.locator('tbody tr')).to_have_count(6)
                expect(rotacion.locator('tbody tr').nth(0).locator('td').nth(1)).to_have_text('12')
                expect(rotacion.locator('tbody tr').nth(1).locator('td').nth(1)).to_have_text('7')
                expect(rotacion.locator('tbody tr').nth(2).locator('td').nth(1)).to_have_text('0')
                expect(rotacion.locator('tbody tr').nth(3).locator('td').nth(1)).to_have_text('0')
                expect(container).not_to_contain_text('Sin dato')
                expect(detalles.locator("summary")).to_contain_text("Ver 1 producto más")
                detalles.locator("summary").click()
                expect(detalles.get_by_text("Producto de ejemplo 6")).to_be_visible()
                expect(container.get_by_text("Sin detalle de productos para esta vista.")).to_be_visible()
                expect(container.locator('.dynamic-card').first.get_by_text('Producto de ejemplo 1', exact=True)).to_have_count(1)
                expect(container).not_to_contain_text('Productos participantes')
                if cargo == "ADMIN":
                    container.screenshot(path=str(capturas / "participantes-escritorio.png"), style=".top-bar { visibility: hidden; }")
                    normalizado = page.evaluate("ParticipantesDinamica.normalizar({productos: [{codigo: '01', nombre: 'Uno'}, {codigo: '01', nombre: 'Uno'}]})")
                    assert len(normalizado["productos"]) == 1
                    assert not page.evaluate("ParticipantesDinamica.normalizar({producto: 'Todos los productos'}).productos.length")
                    seguro = page.evaluate("""() => {
                        const div = document.createElement('div');
                        div.innerHTML = ParticipantesDinamica.renderizar({productos: ['<img src=x onerror=alert(1)>']});
                        return div.querySelectorAll('img').length === 0 && div.textContent.includes('<img');
                    }""")
                    assert seguro
                    unidos = page.evaluate("""ParticipantesDinamica.productosConRotacion({
                        alcance: {productos: [{codigo: '01', nombre: 'Uno'}, {codigo: '02', nombre: 'Dos'}]},
                        rotacion_productos: [{nombre: 'Uno', actual: 0}]
                    })""")
                    assert len(unidos) == 2 and unidos[0]['actual'] == 0 and unidos[0]['codigo'] == '01'
                    assert unidos[1]['actual'] == 0
                    valores = page.evaluate("""ParticipantesDinamica.productosConRotacion({rotacion_productos: [
                        {nombre:'Venta', actual:'12.5'}, {nombre:'Sin venta', actual:null}, {nombre:'Devolucion', actual:-2}
                    ]}).map(p=>p.actual)""")
                    assert valores == [12.5, 0, -2]
                page.set_viewport_size({"width": 390, "height": 844})
                for componente in container.locator(".dinamica-participantes, .rotacion-productos").all():
                    assert componente.evaluate("elemento => elemento.scrollWidth <= elemento.clientWidth")
                if cargo == "ADMIN":
                    container.screenshot(path=str(capturas / "participantes-movil.png"), style=".top-bar { visibility: hidden; }")
                assert not errores, errores
                print(f"{cargo}: productos, alcance, desplegable y móvil correctos.")
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
