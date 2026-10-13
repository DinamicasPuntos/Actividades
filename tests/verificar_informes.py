"""Descargas, filtros y rechazos del navegador con datos ficticios."""
from io import BytesIO
from pathlib import Path
from openpyxl import Workbook
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
wb=Workbook();wb.active.append(['Informe de prueba']);archivo=BytesIO();wb.save(archivo);wb.close()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    for rol in ['ADMIN','SUPERVISOR','COORDINADOR','ADMINISTRADOR PDV','VENDEDOR','SUPERNUMERARIO','CALL CENTER']:
        page=browser.new_page(accept_downloads=True)
        page.route('https://prueba.local/',lambda r:r.fulfill(content_type='text/html',body='''
            <input id="fechaFiltro" value="2026-10"><select id="adminSelectDinamica"><option value="D">D</option></select>
            <section id="informesPanel" hidden><button id="descargarInforme">Excel</button><p id="informeEstado"></p></section>'''))
        solicitudes=[]
        def responder(route):
            solicitudes.append(route.request.url)
            route.fulfill(body=archivo.getvalue(),content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        page.route('https://api.prueba/informes/**',responder)
        page.goto('https://prueba.local/')
        page.evaluate("globalThis.API_URL='https://api.prueba'; localStorage.setItem('access_token','prueba')")
        page.add_script_tag(content=(ROOT/'informes.js').read_text(encoding='utf-8'))
        page.evaluate('(rol)=>InformesUI.iniciar(rol)',rol)
        if rol in ['VENDEDOR','SUPERNUMERARIO','CALL CENTER']:
            expect(page.locator('#informesPanel')).to_be_hidden()
        else:
            with page.expect_download() as descarga:page.locator('#descargarInforme').click()
            assert descarga.value.suggested_filename=='Informe_dinamicas_2026-10.xlsx'
            assert 'fecha=2026-10' in solicitudes[0]
            assert ('dinamica=D' in solicitudes[0])==(rol=='ADMIN')
            expect(page.locator('#descargarInforme')).to_be_enabled()
            page.unroute('https://api.prueba/informes/**')
            page.route('https://api.prueba/informes/**',lambda r:r.fulfill(status=403,content_type='application/json',body='{"detail":"Acceso restringido"}'))
            page.locator('#descargarInforme').click()
            expect(page.locator('#informeEstado')).to_have_text('Acceso restringido')
            expect(page.locator('#descargarInforme')).to_be_enabled()
        page.close()
    page=browser.new_page()
    script=(ROOT/'dashboard.js').read_text(encoding='utf-8')
    page.evaluate('(s)=>new Function(s)',script)
    funcion=script[script.index('async function fetchConTiempo'):script.index('window.onload')]
    page.add_script_tag(content=funcion)
    resultado=page.evaluate('''async () => {
        const timer=window.setTimeout;
        window.setTimeout=(fn,ms)=>timer(fn,ms===60000?10:ms);
        window.fetch=(_,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Abortado','AbortError'))));
        try {await fetchConTiempo('/prueba');return '';} catch(e){return e.message;}
    }''')
    assert 'tardó demasiado' in resultado
    browser.close()
print('Excel: perfiles, filtros, descarga, rechazo de permisos y límite de espera verificados.')
