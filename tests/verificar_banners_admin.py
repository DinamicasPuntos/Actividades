"""Navegador y API juntos con hoja e imágenes temporales; no publica banners reales."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from threading import Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent/'Backend_api_copia'))
from test_banners_admin import BannersTests, imagen, banners
from test_participantes import api, usuario_prueba


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    caso=BannersTests(); caso.setUp()
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    local=f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='msedge',headless=True)
            def responder(route):
                req=route.request
                if req.url.startswith(local): route.continue_(); return
                partes=urlsplit(req.url)
                ruta=partes.path
                if ruta.startswith('/media/banners/') and 'ngrok-skip-browser-warning' not in req.headers:
                    route.fulfill(status=200, content_type='text/html', body='<p>Aviso del túnel</p>')
                    return
                if ruta.startswith('/banners/') or ruta.startswith('/media/banners/'):
                    respuesta=caso.client.request(req.method,ruta,headers=dict(req.headers),content=req.post_data_buffer)
                    route.fulfill(status=respuesta.status_code,body=respuesta.content,headers={'Content-Type':respuesta.headers.get('content-type','application/json'),'Access-Control-Allow-Origin':'*'})
                    return
                if ruta=='/banners':
                    filas=[dict(zip(caso.hoja.valores[0],f)) for f in caso.hoja.valores[1:]]
                    datos={'banners':banners.publicos(filas)}
                elif ruta=='/admin/vision-global':
                    datos={'por_nacional':[],'por_supervisor':[],'por_coordinador':[],'por_especial':[]}
                elif ruta=='/notificaciones': datos={'notificaciones':[]}
                else: route.fulfill(status=200,body=''); return
                route.fulfill(content_type='application/json',body=json.dumps(datos))

            def abrir(token='privilegiado'):
                context=browser.new_context(viewport={'width':1440,'height':1050})
                context.add_init_script("localStorage.setItem('access_token',%s);localStorage.setItem('cargo_usuario','ADMIN');localStorage.setItem('nombre_usuario','Perfil de prueba');"%json.dumps(token))
                context.route('**/*',responder)
                page=context.new_page(); page.goto(local+'/dashboard.html')
                return context,page

            context,page=abrir()
            errores=[]; page.on('pageerror',lambda e:errores.append(str(e)))
            expect(page.locator('#bannersAbrir')).to_be_visible()
            page.locator('#bannersAbrir').click()
            expect(page.locator('.banners-fila')).to_have_count(2)
            page.locator('[name=titulo]').fill('Campaña verificada')
            for tipo in ('desktop','mobile'):
                page.locator(f'[name={tipo}]').set_input_files({'name':tipo+'.png','mimeType':'image/png','buffer':imagen()})
            expect(page.locator('[data-preview=desktop]')).to_be_visible()
            page.get_by_role('button',name='Publicar banner',exact=True).click()
            expect(page.locator('.banners-estado')).to_have_text('Banner publicado.')
            expect(page.locator('.banners-fila')).to_have_count(3)
            expect(page.locator('.carousel-slide')).to_have_count(3)
            page.wait_for_function("Array.from(document.querySelectorAll('.carousel-slide:last-child img')).every(img => img.complete && img.naturalWidth > 0)")
            page.wait_for_function("document.querySelector('.banners-fila:last-child img').naturalWidth > 0")
            page.locator('.banners-fila').first.get_by_role('button',name='Desactivar',exact=True).click()
            expect(page.locator('.banners-estado')).to_have_text('Banner desactivado.')
            expect(page.locator('.carousel-slide')).to_have_count(2)
            page.locator('.banners-fila').last.get_by_role('button',name='Subir',exact=True).click()
            expect(page.locator('.banners-estado')).to_have_text('Orden actualizado.')
            page.locator('.banners-fila').nth(1).get_by_role('button',name='Editar',exact=True).click()
            page.wait_for_function("['desktop','mobile'].every(tipo => document.querySelector('[data-preview='+tipo+']').naturalWidth > 0)")
            page.locator('[name=titulo]').fill('Banner editado')
            page.get_by_role('button',name='Guardar cambios',exact=True).click()
            expect(page.locator('.banners-estado')).to_have_text('Banner actualizado.')
            for ancho in [1440,390,320]:
                page.set_viewport_size({'width':ancho,'height':1000})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),ancho
                assert page.locator('#bannersPanel').evaluate('(e)=>e.scrollWidth<=e.clientWidth'),ancho
            page.once('dialog', lambda dialog: dialog.dismiss())
            page.locator('.banners-fila').nth(1).get_by_role('button', name='Eliminar', exact=True).click()
            expect(page.locator('.banners-fila')).to_have_count(3)
            expect(page.locator('.carousel-slide')).to_have_count(2)
            confirmaciones = []
            def confirmar(dialog):
                confirmaciones.append(dialog.message)
                dialog.accept()
            page.once('dialog', confirmar)
            page.locator('.banners-fila').nth(1).get_by_role('button', name='Eliminar', exact=True).click()
            expect(page.locator('.banners-estado')).to_have_text('Banner eliminado.')
            expect(page.locator('.banners-fila')).to_have_count(2)
            expect(page.locator('.carousel-slide')).to_have_count(1)
            assert 'Banner editado' in confirmaciones[0]
            for restantes in [1, 0]:
                page.once('dialog', lambda dialog: dialog.accept())
                page.locator('.banners-fila').first.get_by_role('button', name='Eliminar', exact=True).click()
                expect(page.locator('.banners-estado')).to_have_text('Banner eliminado.')
                expect(page.locator('.banners-fila')).to_have_count(restantes)
            expect(page.locator('#bannerCarousel')).to_be_hidden()
            expect(page.locator('.banners-lista')).to_have_text('Todavía no hay banners.')
            page.keyboard.press('Escape'); expect(page.locator('#bannersPanel')).not_to_be_visible()
            assert not errores,errores
            context.close()
            api.app.dependency_overrides[usuario_prueba]=lambda:'200'
            context,page=abrir()
            page.wait_for_timeout(300)
            expect(page.locator('#bannersAbrir')).to_be_hidden()
            context.close()
            api.app.dependency_overrides[usuario_prueba]=lambda:'100'
            context,page=abrir('anterior')
            page.locator('#bannersAbrir').click()
            expect(page.locator('.banners-estado')).to_contain_text('ingresa nuevamente')
            expect(page.locator('[type=submit]')).to_be_disabled()
            context.close(); browser.close()
            print('Propietario, otro administrador, sesión anterior, publicación, edición, orden, desactivación y móvil: OK.')
    finally:
        server.shutdown(); server.server_close(); caso.doCleanups()


if __name__=='__main__':
    main()
