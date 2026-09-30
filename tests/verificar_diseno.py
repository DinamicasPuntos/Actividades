"""Comportamiento de producto único y presentación responsive con datos ficticios."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
BASE = {'unidad': 'Unds', 'meta': 70, 'actual': 19, 'faltante': 51, 'progreso': 27.1,
        'tipo_dinamica': 'Unidades Rotadas', 'meta_pdv': 70, 'actual_pdv': 19, 'progreso_pdv': 27.1, 'faltante_pdv': 51}
PRODUCTOS = [{'nombre': 'Producto de ejemplo A', 'codigo': '001', 'actual': 12},
             {'nombre': 'Producto de ejemplo B', 'codigo': '002', 'actual': 7}]
DINAMICAS = [{**BASE, 'dinamica': nombre, 'nombre': nombre, 'entidad': 'NACIONAL',
              'alcance': {'tipo': 'productos', 'productos': PRODUCTOS[:cantidad]},
              'rotacion_productos': PRODUCTOS[:cantidad]}
             for nombre, cantidad in [('UN SOLO PRODUCTO', 1), ('VARIOS PRODUCTOS', 2)]]
for dinamica in DINAMICAS:
    actual = sum(p['actual'] for p in dinamica['rotacion_productos'])
    dinamica.update(actual=actual, faltante=70-actual, progreso=actual/70*100)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}'
    capturas = ROOT / 'tests' / 'artifacts'
    capturas.mkdir(exist_ok=True)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='msedge', headless=True)
            for cargo in ['ADMIN', 'SUPERVISOR', 'COORDINADOR', 'VENDEDOR', 'CALL CENTER', 'SUPERNUMERARIO']:
                page = browser.new_page(viewport={'width': 1440, 'height': 1100})
                errores = []
                page.on('pageerror', lambda e: errores.append(str(e)))
                page.add_init_script("localStorage.setItem('access_token','prueba'); localStorage.setItem('nombre_usuario','Perfil de prueba'); localStorage.setItem('cargo_usuario',%s);" % json.dumps(cargo))

                def responder(route):
                    destino = route.request.url
                    if destino.startswith(url):
                        route.continue_(); return
                    if '/admin/vision-global' in destino:
                        datos = {'por_nacional': DINAMICAS,
                                 'por_coordinador': [{**d, 'entidad': region} for region in ['REGION NORTE','REGION SUR'] for d in DINAMICAS],
                                 'por_supervisor': [{**d, 'entidad': zona} for zona in ['ZONA NORTE','ZONA SUR'] for d in DINAMICAS]}
                    elif '/lideres/mis-equipos' in destino:
                        datos = {'dinamicas_lider': [{**d, 'sucursales': [{**d, 'nombre_pdv': 'Equipo de prueba'}]} for d in DINAMICAS]}
                    elif '/comisiones/mis-dinamicas' in destino:
                        datos = {'dinamicas': [{**d, 'producto': producto['nombre']} for d in DINAMICAS for producto in d['rotacion_productos']]}
                    elif '/comisiones/mis-datos' in destino:
                        datos = {'comisiones': [{'laboratorio':'Laboratorio de ejemplo','monto':35000,'unidad_label':'Puntos'}] if 'fecha=2026-05' in destino else [], 'periodos_disponibles':['2026-05']}
                    elif '/notificaciones' in destino:
                        datos = {'notificaciones': [], 'dinamicas_evaluadas': 2, 'periodo': '2026-09', 'generado_en': '2026-09-24T12:00:00-05:00'}
                    elif '/banners' in destino:
                        datos = {'banners': []}
                    else:
                        route.abort(); return
                    route.fulfill(content_type='application/json', body=json.dumps(datos), headers={'Access-Control-Allow-Origin':'*'})

                page.route('**/*', responder)
                page.goto(url+'/dashboard.html')
                container = page.locator('#containerAdmin' if cargo=='ADMIN' else '#containerLideres' if cargo in ['SUPERVISOR','COORDINADOR'] else '#tableDinamicas')
                if cargo == 'ADMIN':
                    expect(page.locator('#subtab-nacional')).to_be_visible()
                    expect(container.locator('.dynamic-card').first).to_be_visible()
                    expect(container.locator('.accordion-header')).to_have_count(0)
                else:
                    expect(container.locator('.accordion-item').first).to_be_visible()
                    directa = container.locator('.accordion-item--directa')
                    expect(directa).to_have_count(1)
                    expect(directa.locator('.dynamic-card').first).to_be_visible()
                    assert directa.locator('.accordion-header').get_attribute('onclick') is None
                    header = container.locator('.accordion-header[role="button"]')
                    header.focus(); header.press('Enter')
                    expect(header).to_have_attribute('aria-expanded', 'true')
                if cargo in ['ADMIN','SUPERVISOR','COORDINADOR']:
                    expect(container.locator('.rotacion-directa')).to_have_count(1)
                    expect(container.locator('.rotacion-directa strong')).to_have_text('12')
                    expect(container.locator('.rotacion-productos')).to_have_count(1)
                    expect(container.locator('.rotacion-productos tbody tr')).to_have_count(2)
                    expect(container.locator('.dynamic-card').first.get_by_text('Producto de ejemplo A', exact=True)).to_have_count(1)
                    expect(container).not_to_contain_text('Productos participantes')
                for ancho in [1440, 768, 390, 320]:
                    page.set_viewport_size({'width': ancho, 'height': 1100})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (cargo, ancho)
                    if cargo == 'ADMIN' and ancho in [1440, 390]:
                        page.screenshot(path=str(capturas/f'diseno-{ancho}.png'), full_page=True)
                if cargo not in ['ADMIN','SUPERVISOR','COORDINADOR']:
                    page.locator('#tab-comisiones').click()
                    expect(page.locator('#tableBody')).to_contain_text('Tienes liquidaciones en estos períodos')
                    page.locator('button[data-periodo="2026-05"]').click()
                    expect(page.locator('#fechaFiltro')).to_have_value('2026-05')
                    expect(page.locator('#tableBody')).to_contain_text('35')
                if cargo == 'ADMIN':
                    page.locator('#subtab-coordinador').click()
                    expect(container.locator('.accordion-item')).to_have_count(2)
                    page.locator('#adminSelectDinamica').select_option('VARIOS PRODUCTOS')
                    expect(container.locator('.resultado-equipo')).to_have_count(2)
                    expect(container.locator('.accordion-header')).to_have_count(0)
                    expect(container.locator('.resultado-equipo h3').first).to_have_text('REGION NORTE')
                    expect(container.locator('.rotacion-productos').first).to_be_visible()
                    page.locator('#subtab-supervisor').click()
                    expect(page.locator('#adminSelectDinamica')).to_have_value('VARIOS PRODUCTOS')
                    expect(container.locator('.resultado-equipo')).to_have_count(2)
                    expect(container.locator('.resultado-equipo h3').first).to_have_text('ZONA NORTE')
                    page.set_viewport_size({'width':1200, 'height':1000})
                    page.screenshot(path=str(capturas/'resultados-por-zona.png'), full_page=True)
                    page.locator('#adminSelectDinamica').select_option('TODAS')
                    expect(container.locator('.accordion-item')).to_have_count(2)
                assert not errores, errores
                print(cargo+': producto unico visible, multiples desplegables y sin desbordamiento.')
                page.close()
            page = browser.new_page()
            page.goto(url+'/index.html')
            for ancho in [1440, 768, 390, 320]:
                page.set_viewport_size({'width': ancho, 'height': 1000})
                expect(page.locator('#loginForm')).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), ancho
                if ancho in [1440,390]:
                    page.screenshot(path=str(capturas/f'acceso-{ancho}.png'), full_page=True)
            browser.close()
    finally:
        server.shutdown(); server.server_close()


if __name__ == '__main__':
    main()
