import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import sys,json
from threading import Thread
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'Backend_api_copia'))
from test_personal_api import PersonalAPITests

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    caso=PersonalAPITests();caso.setUp()
    servidor=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    Thread(target=servidor.serve_forever,daemon=True).start()
    local=f'http://127.0.0.1:{servidor.server_port}'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='msedge',headless=True)
            def responder(route):
                req=route.request
                if req.url.startswith(local):route.continue_();return
                path=urlsplit(req.url).path
                if path.startswith('/personal/'):
                    r=caso.client.request(req.method,path,headers=dict(req.headers),content=req.post_data_buffer)
                    route.fulfill(status=r.status_code,body=r.content,content_type='application/json');return
                if path=='/banners':data={'banners':[]}
                elif path=='/banners/permisos':data={'propietario':False,'puede_administrar':False}
                elif path=='/admin/vision-global':data={'por_nacional':[],'por_supervisor':[],'por_coordinador':[],'por_especial':[]}
                elif path=='/lideres/mis-equipos':data={'dinamicas_lider':[]}
                elif path=='/notificaciones':data={'notificaciones':[]}
                else:data={}
                route.fulfill(content_type='application/json',body=json.dumps(data))
            def abrir():
                context=browser.new_context(viewport={'width':1440,'height':1000})
                context.add_init_script("localStorage.setItem('access_token','prueba');localStorage.setItem('cargo_usuario','ADMIN');")
                context.route('**/*',responder)
                page=context.new_page();page.goto(local+'/dashboard.html');return context,page
            context,page=abrir()
            expect(page.locator('#personalAbrir')).to_contain_text('1 avisos')
            page.locator('#personalAbrir').click()
            page.locator('#personalPanel select').select_option('202')
            page.get_by_role('button',name='Asignar supervisor',exact=True).click()
            expect(page.locator('#personalAbrir')).to_have_text('Personal y accesos')
            for campo,valor in [('cedula','800'),('codigo','88'),('nombre','Invitado de prueba')]:
                page.locator(f'#personalPanel input[name={campo}]').fill(valor)
            page.get_by_role('button',name='Habilitar acceso').click()
            expect(page.locator('#personalPanel')).to_contain_text('Invitado de prueba · 800 · Habilitado')
            page.get_by_role('button',name='Desactivar',exact=True).click()
            expect(page.locator('#personalPanel')).to_contain_text('Invitado de prueba · 800 · Desactivado')
            page.get_by_role('button',name='Sincronizar ahora',exact=True).click()
            expect(page.locator('#personalPanel [role=status]')).to_have_text('Cambios guardados.')
            for ancho in [1440,390,320]:
                page.set_viewport_size({'width':ancho,'height':1000})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                assert page.locator('#personalPanel').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
            page.keyboard.press('Escape');expect(page.locator('#personalPanel')).not_to_be_visible()
            context.close()
            caso.d.externo('800','88','Invitado',True);caso.como('800')
            context,page=abrir();expect(page.locator('#tab-admin')).to_be_visible();expect(page.locator('#personalAbrir')).to_have_count(0);context.close()
            browser.close()
        print('Panel propietario, supervisor, acceso externo limitado, desactivacion y movil: OK.')
    finally:
        servidor.shutdown();servidor.server_close();caso.doCleanups()

if __name__=='__main__':main()
