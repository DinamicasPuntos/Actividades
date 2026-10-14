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
    base={'dinamica':'PRUEBA','entidad':'NACIONAL','actual':6,'meta':10,'faltante':4,'progreso':60,'unidad':'Unds','tipo_dinamica':'Unidades Rotadas',
          'alcance':{'tipo':'familia','nombre':'PRUEBA','productos':[]},'rotacion_productos':[]}
    descargas=[];errores=[];fallar=[False]
    with sync_playwright() as p:
        b=p.chromium.launch(channel='msedge',headless=True);page=b.new_page(viewport={'width':1366,'height':900})
        page.on('pageerror',lambda e:errores.append(str(e)))
        page.add_init_script("localStorage.setItem('access_token','prueba');localStorage.setItem('cargo_usuario','ADMIN');localStorage.setItem('nombre_usuario','Prueba');")
        def responder(route):
            destino=route.request.url
            if destino.startswith(url):route.continue_();return
            datos={}
            if '/admin/vision-pdv.xlsx' in destino:
                descargas.append(destino);route.fulfill(status=200,content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body=b'archivo simulado');return
            if '/admin/vision-pdv?' in destino:
                if fallar[0]:route.fulfill(status=503,content_type='application/json',body=json.dumps({'detail':'Fallo de prueba'}));return
                datos={'por_nacional_pdv':[{**base,'actual':9,'faltante':1,'progreso':90,'disponible':True,'actualizacion':'2026-10-14T09:00:00-05:00'}]}
            elif '/admin/vision-global' in destino:datos={'por_nacional':[base],'por_supervisor':[],'por_coordinador':[],'por_especial':[]}
            elif '/notificaciones' in destino:datos={'notificaciones':[]}
            elif '/banners' in destino:datos={'banners':[]}
            elif '/personal/mi-perfil' in destino:datos={'sincronizado':False}
            route.fulfill(content_type='application/json',body=json.dumps(datos),headers={'Access-Control-Allow-Origin':'*'})
        page.route('**/*',responder);page.goto(url+'/dashboard.html')
        expect(page.locator('#containerAdmin')).to_contain_text('6 / 10')
        page.select_option('#adminSelectDinamica','PRUEBA')
        page.click('#subtab-nacional_pdv');expect(page.locator('#containerAdmin')).to_contain_text('9 / 10')
        expect(page.locator('#adminSelectDinamica')).to_have_value('PRUEBA')
        expect(page.locator('#criterioNacional')).to_contain_text('mismo PDV')
        expect(page.locator('#containerAdmin')).to_contain_text('Actualizado:')
        with page.expect_download():page.click('#descargarInforme')
        assert descargas and 'dinamica=PRUEBA' in descargas[0]
        page.click('#subtab-nacional');expect(page.locator('#containerAdmin')).to_contain_text('6 / 10')
        page.set_viewport_size({'width':390,'height':844});page.click('#subtab-nacional_pdv')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        fallar[0]=True;page.evaluate('delete adminDataMaster.por_nacional_pdv');page.click('#subtab-nacional_pdv')
        expect(page.locator('#estadoConexion')).to_contain_text('Fallo de prueba')
        expect(page.locator('#containerAdmin')).to_contain_text('No se pudo cargar')
        assert not errores,errores
        b.close()
    servidor.shutdown();print('Dos vistas, filtro, Excel, movil y fallo de conexion verificados.')
if __name__=='__main__':main()
