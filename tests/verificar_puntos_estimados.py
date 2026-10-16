import functools,json
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    servidor=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    Thread(target=servidor.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{servidor.server_port}'
    base={'dinamica':'PRUEBA','entidad':'NACIONAL','actual':6,'meta':10,'faltante':4,'progreso':60,'unidad':'Unds','tipo_dinamica':'Unidades Rotadas'}
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for rol in ['ADMIN','VENDEDOR']:
            page=browser.new_page(viewport={'width':1366,'height':1100})
            errores=[];solicitudes=[];fallar=[False]
            page.on('pageerror',lambda e:errores.append(str(e)))
            page.add_init_script(f"localStorage.setItem('access_token','prueba');localStorage.setItem('cargo_usuario','{rol}');localStorage.setItem('nombre_usuario','Prueba');")
            def responder(route):
                destino=route.request.url
                if destino.startswith(url) or 'cdnjs.cloudflare.com' in destino:route.continue_();return
                datos={}
                if '/puntos/estimados?' in destino:
                    solicitudes.append(destino)
                    if fallar[0]:route.fulfill(status=503,content_type='application/json',body=json.dumps({'detail':'Reintenta la consulta'}));return
                    datos={'total':2,'pagina':1,'paginas':1,'resultados':[
                        {'vendedor':'Persona <img src=x onerror=alert(1)>','codigos':['Uni · 123'],'pdvs':['Sucursal de prueba'],'dinamica':'PRUEBA','puntos_estimados':18000,'puntos_pendientes':6000,'disponible':True},
                        {'vendedor':'Segunda persona','codigos':['Uni · 456'],'pdvs':['Otra sucursal'],'dinamica':'PRUEBA','puntos_estimados':0,'puntos_pendientes':0,'disponible':True}]}
                elif '/admin/vision-global' in destino:datos={'por_nacional':[base],'por_supervisor':[],'por_coordinador':[],'por_especial':[]}
                elif '/comisiones/mis-dinamicas' in destino:datos={'dinamicas':[{**base,'nombre':'PRUEBA','producto':'Producto'}]}
                elif '/notificaciones' in destino:datos={'notificaciones':[]}
                elif '/banners' in destino:datos={'banners':[]}
                elif '/personal/mi-perfil' in destino:datos={'sincronizado':False}
                route.fulfill(content_type='application/json',body=json.dumps(datos),headers={'Access-Control-Allow-Origin':'*'})
            page.route('**/*',responder);page.goto(url+'/dashboard.html')
            expect(page.locator('#puntosEstimadosPanel')).to_be_visible()
            expect(page.locator('#informesPanel')).to_be_visible() if rol=='ADMIN' else expect(page.locator('#informesPanel')).to_be_hidden()
            assert not solicitudes
            page.locator('#puntosEstimadosPanel summary').click()
            expect(page.locator('#puntosResultados')).to_contain_text('18.000 pts')
            expect(page.locator('#puntosResultados img')).to_have_count(0)
            page.locator('#puntosBuscar').fill('Persona');page.locator('#puntosConsultar').click()
            expect(page.locator('#puntosResultados')).to_contain_text('6.000 pts')
            assert 'buscar=Persona' in solicitudes[-1]
            if rol=='ADMIN':
                page.select_option('#adminSelectDinamica','PRUEBA')
                expect(page.locator('#puntosResultados')).to_contain_text('18.000 pts')
                assert 'dinamica=PRUEBA' in solicitudes[-1]
            for width in [1366,390,320]:
                page.set_viewport_size({'width':width,'height':1100})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
            if rol=='ADMIN':
                stage=ROOT/'.preview'/'puntos-estimados-20261016';stage.mkdir(exist_ok=True)
                page.set_viewport_size({'width':1200,'height':1100})
                page.locator('#informesPanel').screenshot(path=str(stage/'panel-informe.png'))
                page.locator('#puntosEstimadosPanel').screenshot(path=str(stage/'panel-puntos.png'))
            fallar[0]=True;page.locator('#puntosConsultar').click()
            expect(page.locator('#puntosEstado')).to_have_text('Reintenta la consulta')
            expect(page.locator('#puntosResultados')).to_be_empty()
            if rol=='VENDEDOR':
                page.locator('#tab-comisiones').click();expect(page.locator('#puntosEstimadosPanel')).to_be_hidden()
            assert not errores,errores
            page.close()
        browser.close()
    servidor.shutdown();print('Puntos: consulta, filtros, ceros, permisos visuales, errores, seguridad de textos y móvil verificados.')
if __name__=='__main__':main()
