import functools,json
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}'
    puntos={'disponible':True,'puntos_estimados':18000,'puntos_pendientes':6000,'facturado':240000,
        'tarifas':[{'producto':'P','tipo':'Porcentaje venta','valor':10}]}
    base={'dinamica':'PRUEBA','entidad':'NACIONAL','actual':6,'meta':10,'faltante':4,'progreso':60,'unidad':'Unds','tipo_dinamica':'Unidades Rotadas','puntos':puntos}
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for rol in ['ADMIN','VENDEDOR','SUPERVISOR']:
            page=browser.new_page(viewport={'width':1366,'height':1100});errores=[]
            page.on('pageerror',lambda e:errores.append(str(e)))
            page.add_init_script(f"localStorage.setItem('access_token','prueba');localStorage.setItem('cargo_usuario','{rol}');localStorage.setItem('nombre_usuario','Prueba');")
            def responder(route):
                destino=route.request.url
                if destino.startswith(url) or 'cdnjs.cloudflare.com' in destino:route.continue_();return
                datos={}
                if '/admin/vision-global' in destino:datos={'por_nacional':[base],'por_supervisor':[],'por_coordinador':[],'por_especial':[]}
                elif '/comisiones/mis-dinamicas' in destino:datos={'dinamicas':[{**base,'nombre':'PRUEBA','producto':'Producto'}],'puntos_por_dinamica':{'PRUEBA':puntos}}
                elif '/lideres/mis-equipos' in destino:datos={'dinamicas_lider':[{'nombre':'PRUEBA','unidad':'Unds','sucursales':[{**base,'nombre_pdv':'PDV PRUEBA'}]}]}
                elif '/notificaciones' in destino:datos={'notificaciones':[]}
                elif '/banners' in destino:datos={'banners':[]}
                elif '/personal/mi-perfil' in destino:datos={'sincronizado':False}
                route.fulfill(content_type='application/json',body=json.dumps(datos),headers={'Access-Control-Allow-Origin':'*'})
            page.route('**/*',responder);page.goto(url+'/dashboard.html')
            expect(page.locator('#puntosEstimadosPanel')).to_have_count(0)
            if rol=='SUPERVISOR':page.locator('#tab-lideres').click()
            if rol=='SUPERVISOR':page.locator('#containerLideres .accordion-header').click()
            tarjeta=page.locator('.view-section:not(.hidden) .dinamica-puntos').first
            expect(tarjeta).to_be_visible();expect(tarjeta).to_contain_text('24.000')
            expect(tarjeta).to_contain_text('10 % de las ventas');expect(tarjeta).to_contain_text('240.000')
            expect(tarjeta).to_contain_text('6.000 pts sujetos a cumplimiento')
            assert 'iva' not in tarjeta.inner_text().lower()
            for width in [1366,390,320]:
                page.set_viewport_size({'width':width,'height':1100})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(rol,width)
            stage=ROOT/'.preview'/'puntos-tarjetas-20261019';stage.mkdir(exist_ok=True)
            tarjeta.screenshot(path=str(stage/f'tarjeta-{rol}.png'))
            html=page.evaluate("""() => PuntosDinamica.renderizar({disponible:true,puntos_estimados:0,puntos_pendientes:0,facturado:0,tarifas:[{producto:'<img src=x onerror=alert(1)>',tipo:'Pago por unidad',valor:6000},{producto:'B',tipo:'Pago por unidad',valor:1000}]},true)""")
            assert '<img' not in html and '0 <small>pts' in html and '6.000 pts por unidad' in html
            assert not errores,errores
            page.close()
        browser.close()
    server.shutdown();print('Tarjetas: perfiles, porcentajes, condiciones, ceros, textos y movil verificados.')
if __name__=='__main__':main()
