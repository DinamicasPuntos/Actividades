"""Selección y descarga por PDV para cada perfil autorizado."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    for rol in ['ADMIN','SUPERVISOR','COORDINADOR','ADMINISTRADOR PDV','VENDEDOR']:
        page=browser.new_page(accept_downloads=True)
        page.route('https://prueba.local/',lambda r:r.fulfill(content_type='text/html',body='''
            <input id="fechaFiltro" value="2026-10"><select id="adminSelectDinamica"><option value="TODAS">Todas</option><option>D</option></select>
            <section id="informesPanel" hidden><p id="informeDescripcion"></p>
            <select id="informeTipo"><option value="pdv">Dinámica por PDV</option><option value="actual">Vista actual</option></select>
            <label>Dinámica<select id="informeDinamica"><option value="">Todas</option></select></label>
            <button id="descargarInforme">Excel</button><p id="informeEstado"></p></section>'''))
        llamadas=[]
        def responder(r):
            llamadas.append(r.request.url)
            r.fulfill(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body=b'prueba')
        page.route('https://api.prueba/informes/**',responder)
        page.goto('https://prueba.local/')
        page.evaluate("globalThis.API_URL='https://api.prueba';localStorage.setItem('access_token','prueba')")
        page.add_script_tag(content=(ROOT/'informes.js').read_text(encoding='utf-8'))
        page.evaluate('(rol)=>InformesUI.iniciar(rol)',rol)
        if rol=='VENDEDOR':
            expect(page.locator('#informesPanel')).to_be_hidden();page.close();continue
        page.evaluate("InformesUI.actualizarDinamicas(['D','Familia','D','<img>'],'2026-10')")
        expect(page.locator('#informeDinamica option')).to_have_count(4)
        expect(page.locator('#informeDinamica img')).to_have_count(0)
        for valor in ['', 'D']:
            page.select_option('#informeDinamica',valor)
            with page.expect_download() as descarga:page.click('#descargarInforme')
            assert descarga.value.suggested_filename=='Informe_dinamica_PDV_2026-10.xlsx'
            assert '/informes/pdv.xlsx?' in llamadas[-1]
            assert ('dinamica=D' in llamadas[-1])==bool(valor)
        if rol=='ADMIN':
            page.select_option('#adminSelectDinamica','TODAS');expect(page.locator('#informeDinamica')).to_have_value('')
            page.select_option('#adminSelectDinamica','D');expect(page.locator('#informeDinamica')).to_have_value('D')
        page.evaluate("InformesUI.actualizarDinamicas(['Nueva'],'2026-11')")
        expect(page.locator('#informeDinamica')).to_have_value('')
        page.select_option('#informeTipo','actual')
        expect(page.locator('#informeDinamica')).to_be_hidden()
        with page.expect_download():page.click('#descargarInforme')
        assert '/informes/dinamicas.xlsx?' in llamadas[-1]
        page.select_option('#informeTipo','pdv')
        page.unroute('https://api.prueba/informes/**')
        page.route('https://api.prueba/informes/**',lambda r:r.fulfill(status=409,content_type='application/json',body='{"detail":"Actualiza la rotacion por PDV"}'))
        page.click('#descargarInforme');expect(page.locator('#informeEstado')).to_have_text('Actualiza la rotacion por PDV')
        expect(page.locator('#descargarInforme')).to_be_enabled();expect(page.locator('#informeTipo')).to_be_enabled()
        page.close()
    browser.close()
print('Informe PDV: perfiles, filtros, seleccion unica/todas, periodo, texto seguro y errores verificados.')
