"""Prueba del muro y aviso emergente con reglas reales y datos ficticios."""
from datetime import date
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from threading import Thread
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'Backend_api_copia'))
from notificaciones import crear_alertas


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
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='msedge', headless=True)
            for cargo in ['ADMIN', 'SUPERVISOR', 'COORDINADOR', 'VENDEDOR', 'CALL CENTER', 'SUPERNUMERARIO']:
                context = browser.new_context(viewport={'width':1200, 'height':1100})
                context.add_init_script("""
                    const FechaReal = Date;
                    const instantePrueba = FechaReal.parse('2026-09-24T15:00:00Z');
                    window.Date = class extends FechaReal {
                        constructor(...args) { super(...(args.length ? args : [instantePrueba])); }
                        static now() { return instantePrueba; }
                    };
                    localStorage.setItem('access_token','token-prueba');
                    localStorage.setItem('cargo_usuario', %s);
                    localStorage.setItem('nombre_usuario','Perfil de prueba');
                    const intervaloOriginal=window.setInterval;
                    window.setInterval=(funcion,ms,...args)=>{
                        if(ms===300000) window.revisarMuroEnPrueba=funcion;
                        return intervaloOriginal(funcion,ms,...args);
                    };
                """ % json.dumps(cargo))
                estado = {'dia':24, 'error':False, 'peticiones':0}
                entidad = 'NACIONAL' if cargo == 'ADMIN' else 'PDV de prueba' if cargo in ['SUPERVISOR','COORDINADOR'] else 'Tu meta personal'
                indicadores = [{'dinamica':f'DINÁMICA {i}', 'entidad':entidad, 'actual':20+i, 'meta':100, 'unidad':'Unds'} for i in range(7)]
                dinamicas = [{**d, 'nombre':d['dinamica'], 'faltante':100-d['actual'], 'progreso':d['actual'], 'producto':'Producto de prueba',
                              'meta_pdv':100, 'actual_pdv':20, 'progreso_pdv':20, 'faltante_pdv':80} for d in indicadores]

                def responder(route):
                    destino = route.request.url
                    if destino.startswith(url):
                        route.continue_(); return
                    if '/notificaciones?' in destino:
                        estado['peticiones']+=1
                        if estado['error']:
                            route.fulfill(status=503, body='No disponible', headers={'Access-Control-Allow-Origin':'*'}); return
                        periodo=parse_qs(urlparse(destino).query)['fecha'][0]
                        datos={'periodo':periodo, 'perfil':cargo, 'generado_en':'2026-09-24T10:00:00-05:00', 'dinamicas_evaluadas':7,
                               'notificaciones':crear_alertas(indicadores,{},periodo,cargo,date(2026,9,estado['dia']))}
                    elif '/admin/vision-global' in destino:
                        datos={f'por_{vista}':dinamicas for vista in ['nacional','coordinador','supervisor']}
                    elif '/lideres/mis-equipos' in destino:
                        datos={'dinamicas_lider':[{**d, 'sucursales':[{'nombre_pdv':entidad, 'meta':100, 'actual':d['actual'], 'progreso':d['actual'], 'faltante':d['faltante']}]} for d in dinamicas]}
                    elif '/comisiones/mis-dinamicas' in destino:
                        datos={'dinamicas':dinamicas}
                    elif '/personal/mi-perfil' in destino:
                        datos={'sincronizado':False}
                    elif '/banners' in destino:
                        datos={'banners':[]}
                    else:
                        route.abort(); return
                    route.fulfill(status=200, content_type='application/json', body=json.dumps(datos), headers={'Access-Control-Allow-Origin':'*'})

                context.route('**/*', responder)
                page=context.new_page()
                errores=[]
                page.on('pageerror', lambda error: errores.append(str(error)))
                page.goto(url+'/dashboard.html')
                # El período del ejemplo no depende del reloj del equipo de pruebas.
                page.locator('#fechaFiltro').fill('2026-09')
                page.evaluate('NotificacionesUI.actualizar()')
                expect(page.locator('#notificacionesContador')).to_have_text('7 sin leer')
                expect(page.locator('#notificacionesAviso')).to_be_visible()
                expect(page.locator('#notificacionesContenido')).to_be_hidden()
                page.locator('#notificacionesAbrirMuro').click()
                expect(page.locator('#notificacionesContenido')).to_be_visible()
                expect(page.locator('#notificacionesLista')).not_to_contain_text('%')
                expect(page.locator('#notificacionesLista')).to_contain_text('para cumplir la meta')
                page.locator('#notificacionesCerrarPanel').click()
                expect(page.locator('#notificacionesContenido')).to_be_hidden()
                expect(page.locator('#notificacionesContador')).to_have_text('7 sin leer')
                page.locator('#notificacionesDesplegar').click()
                caja = page.locator('#muroNotificaciones').bounding_box()
                assert caja['x'] > 0 and abs(caja['x'] + caja['width'] - 1200) < 2
                page.mouse.click(10, 300)
                expect(page.locator('#muroNotificaciones')).not_to_be_visible()
                page.locator('#notificacionesDesplegar').click()
                page.locator('#notificacionesCerrarPanel').focus()
                page.keyboard.press('Shift+Tab')
                assert page.evaluate("document.getElementById('muroNotificaciones').contains(document.activeElement)")
                expect(page.locator('.notificacion')).to_have_count(5)
                page.locator('#notificacionesVerTodas').click()
                expect(page.locator('.notificacion')).to_have_count(7)
                if cargo == 'ADMIN':
                    page.locator('#muroNotificaciones').evaluate('e => e.scrollTop = 0')
                    page.locator('#muroNotificaciones').screenshot(path=str(capturas/'muro-notificaciones.png'), style='.top-bar{visibility:hidden}')
                page.locator('button[data-notificacion-accion="leer"]').first.click()
                expect(page.locator('#notificacionesContador')).to_have_text('6 sin leer')
                page.locator('#notificacionesLeerTodas').click()
                expect(page.locator('#notificacionesContador')).to_have_text('0 sin leer')
                page.locator('#notificacionesFiltro').click()
                expect(page.locator('#notificacionesLista')).to_contain_text('Estás al día')
                page.keyboard.press('Escape')
                expect(page.locator('#muroNotificaciones')).not_to_be_visible()
                page.reload()
                page.locator('#fechaFiltro').fill('2026-09')
                page.evaluate('NotificacionesUI.actualizar()')
                expect(page.locator('#notificacionesContador')).to_have_text('0 sin leer')
                expect(page.locator('#notificacionesAviso')).to_be_hidden()
                # La revisión automática vuelve a señalar un problema que continúa al día siguiente.
                estado['dia']=25
                page.evaluate('window.revisarMuroEnPrueba()')
                expect(page.locator('#notificacionesContador')).to_have_text('7 sin leer')
                expect(page.locator('#notificacionesAviso')).to_be_hidden()
                page.locator('#notificacionesDesplegar').click()
                page.locator('button[data-notificacion-accion="ver"]').first.click()
                contenedor = '#containerAdmin' if cargo=='ADMIN' else '#containerLideres' if cargo in ['SUPERVISOR','COORDINADOR'] else '#tableDinamicas'
                if cargo == 'ADMIN':
                    expect(page.locator(contenedor+' .resultado-equipo')).to_be_visible()
                    expect(page.locator(contenedor+' .accordion-header')).to_have_count(0)
                else:
                    expect(page.locator(contenedor+' .accordion-item').first).to_have_class(__import__('re').compile(r'\bactive\b'))
                estado['error']=True
                page.evaluate('NotificacionesUI.actualizar()')
                expect(page.locator('#notificacionesEstado')).to_contain_text('Se conserva la última revisión')
                expect(page.locator('.notificacion')).to_have_count(5)
                estado['error']=False
                page.locator('#fechaFiltro').fill('2026-10')
                page.evaluate('NotificacionesUI.actualizar()')
                expect(page.locator('#notificacionesContador')).to_have_text('0 sin leer')
                expect(page.locator('.notificacion')).to_have_count(0)
                page.locator('#fechaFiltro').fill('2026-09')
                page.evaluate('NotificacionesUI.actualizar()')
                expect(page.locator('.notificacion')).to_have_count(5)
                page.set_viewport_size({'width':390,'height':844})
                if not page.locator('#notificacionesContenido').is_visible():
                    page.locator('#notificacionesDesplegar').click()
                for tarjeta in page.locator('.notificacion').all():
                    assert tarjeta.evaluate('elemento=>elemento.scrollWidth<=elemento.clientWidth')
                if cargo=='ADMIN':
                    page.locator('#muroNotificaciones').screenshot(path=str(capturas/'muro-notificaciones-movil.png'), style='.top-bar{visibility:hidden}')
                assert not errores, errores
                print(cargo+': muro, aviso, lectura, revisión automática, enlace, errores y móvil correctos.')
                context.close()
            browser.close()
    finally:
        server.shutdown(); server.server_close()


if __name__=='__main__':
    main()
