"""Marca/familia sin acordeón de productos en los perfiles personales."""
import functools
import json
from http.server import ThreadingHTTPServer
from threading import Thread

from playwright.sync_api import sync_playwright, expect
from verificar_diseno import ROOT, Handler, BASE


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='msedge', headless=True)
            for cargo in ['VENDEDOR', 'CALL CENTER', 'SUPERNUMERARIO']:
                page = browser.new_page()
                errores = []
                page.on('pageerror', lambda error: errores.append(str(error)))
                page.add_init_script("localStorage.setItem('access_token','prueba');localStorage.setItem('cargo_usuario',%s);" % json.dumps(cargo))
                dinamicas = [{**BASE, 'nombre': 'Concurso ' + tipo, 'producto': 'Nombre ' + tipo,
                    'alcance': {'tipo': tipo, 'nombre': 'Nombre ' + tipo, 'productos': [{'nombre':'Producto oculto'}]}}
                    for tipo in ['marca', 'familia', 'laboratorio']]
                if cargo != 'VENDEDOR':
                    for d in dinamicas:
                        d.update(sin_cuota_individual=True, meta=0, faltante=0, pdvs=[
                            {'nombre':'PDV A', 'mis_ventas':12, 'cumple':True},
                            {'nombre':'PDV B', 'mis_ventas':7, 'cumple':False}])

                def responder(route):
                    url = route.request.url
                    if url.startswith(base):
                        route.continue_(); return
                    if '/comisiones/mis-dinamicas' in url:
                        datos = {'dinamicas':dinamicas}
                    elif '/personal/mi-perfil' in url:
                        datos = {'sincronizado':False}
                    elif '/banners' in url:
                        datos = {'banners':[]}
                    elif '/notificaciones' in url:
                        datos = {'notificaciones':[]}
                    else:
                        route.abort(); return
                    route.fulfill(content_type='application/json', body=json.dumps(datos), headers={'Access-Control-Allow-Origin':'*'})

                page.route('**/*', responder)
                page.goto(base + '/dashboard.html')
                container = page.locator('#tableDinamicas')
                expect(container.locator('.accordion-item--directa')).to_have_count(3)
                expect(container.locator('.accordion-header[role="button"]')).to_have_count(0)
                expect(container).not_to_contain_text('Producto oculto')
                for tipo in ['marca', 'familia', 'laboratorio']:
                    expect(container.get_by_text('Nombre ' + tipo, exact=True)).to_be_visible()
                if cargo != 'VENDEDOR':
                    expect(container).to_contain_text('El PDV cumple la cuota.')
                    expect(container).to_contain_text('El PDV aún no cumple la cuota.')
                else:
                    expect(container).to_contain_text('19 / 70')
                for width in [1440, 390, 320]:
                    page.set_viewport_size({'width':width, 'height':1000})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert not errores, errores
                print(cargo + ': marca/familia acumuladas, sin desglose y con totales visibles.')
                page.close()
            browser.close()
    finally:
        server.shutdown(); server.server_close()


if __name__ == '__main__':
    main()
