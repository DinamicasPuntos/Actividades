"""Las tres categorías se distinguen en todos los perfiles, con datos simulados."""
import functools
import json
from http.server import ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect
from verificar_diseno import ROOT, Handler, BASE


def main():
    servidor = ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    Thread(target=servidor.serve_forever,daemon=True).start()
    base = f'http://127.0.0.1:{servidor.server_port}'
    dinamicas = [{**BASE,'nombre':nombre,'dinamica':nombre,'entidad':'NACIONAL','producto':'Producto A',
        'categoria_label':nombre,'sin_cuota':sin_cuota,
        'alcance':{'tipo':'productos','productos':[{'nombre':'Producto A'}]},
        'rotacion_productos':[{'nombre':'Producto A','actual':19}]}
        for nombre,sin_cuota in [('Solo rotación',True),('Rotación nacional',False),('Rotación con cuota',False)]]
    dinamicas[0].update(meta=0, meta_pdv=0, faltante=0, faltante_pdv=0, progreso=None, progreso_pdv=None)
    dinamicas[1].update(meta=4000, faltante=3981, progreso=19/4000*100, cuota_nacional=4000)
    try:
        with sync_playwright() as p:
            navegador = p.chromium.launch(channel='msedge',headless=True)
            for cargo in ['ADMIN','SUPERVISOR','COORDINADOR','VENDEDOR','CALL CENTER','SUPERNUMERARIO']:
                pagina = navegador.new_page(viewport={'width':1440,'height':1000})
                errores = []
                pagina.on('pageerror',lambda e:errores.append(str(e)))
                pagina.add_init_script("localStorage.setItem('access_token','prueba');localStorage.setItem('cargo_usuario',%s);" % json.dumps(cargo))
                def responder(route):
                    url = route.request.url
                    if url.startswith(base):
                        route.continue_(); return
                    if '/admin/vision-global' in url:
                        datos = {f'por_{nivel}':dinamicas for nivel in ['nacional','supervisor','coordinador']}
                        datos['por_especial'] = [{**d,'actual_general':19,'actual_call':12,'actual_super':7} for d in dinamicas]
                    elif '/lideres/mis-equipos' in url:
                        datos = {'dinamicas_lider':[{**d,'sucursales':[{**d,'nombre_pdv':'Mi PDV'}]} for d in dinamicas]}
                    elif '/comisiones/mis-dinamicas' in url:
                        datos = {'dinamicas':dinamicas}
                    elif '/personal/mi-perfil' in url:
                        datos = {'sincronizado':False}
                    elif '/banners' in url:
                        datos = {'banners':[]}
                    elif '/notificaciones' in url:
                        datos = {'notificaciones':[]}
                    else:
                        route.abort(); return
                    route.fulfill(content_type='application/json',body=json.dumps(datos),headers={'Access-Control-Allow-Origin':'*'})
                pagina.route('**/*',responder)
                pagina.goto(base+'/dashboard.html')
                contenedor = pagina.locator('#containerAdmin' if cargo=='ADMIN' else '#containerLideres'
                    if cargo in ['SUPERVISOR','COORDINADOR'] else '#tableDinamicas')
                expect(contenedor.locator('.dynamic-card')).to_have_count(3)
                solo = contenedor.locator('.rotacion-sin-cuota')
                expect(solo).to_have_count(1)
                expect(solo).to_contain_text('19 unidades rotadas')
                expect(solo).not_to_contain_text('%')
                expect(solo).not_to_contain_text('Faltan')
                expect(contenedor).to_contain_text('ROTACIÓN NACIONAL')
                expect(contenedor).to_contain_text('ROTACIÓN CON CUOTA')
                for width in [1440,390,320]:
                    pagina.set_viewport_size({'width':width,'height':1000})
                    assert pagina.evaluate('document.documentElement.scrollWidth <= innerWidth')
                if cargo=='ADMIN':
                    pagina.locator('#subtab-especial').click()
                    expect(contenedor.locator('.rotacion-sin-cuota')).to_contain_text('Call center: 12')
                assert not errores, errores
                print(cargo+': tres categorías visibles; solo rotación sin metas, faltantes ni porcentajes.')
                pagina.close()
            navegador.close()
    finally:
        servidor.shutdown(); servidor.server_close()


if __name__=='__main__':
    main()
