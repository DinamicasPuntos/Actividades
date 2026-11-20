"""La revisión aprobada permite confirmar, pero no reemplazar el cálculo."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    for width in [1400,390]:
        page=browser.new_page(viewport={'width':width,'height':850})
        errores=[];page.on('pageerror',lambda e:errores.append(str(e)))
        job=dict(id='prueba',dinamica='PROCILUS OCTUBRE',periodo='2026-10',modo='vendedor',
                 estado='preparada',total_puntos=310000,total_actual=62,registros=1,
                 revision_aprobada=True,corregida_excel=False,bloqueos=[],huella='revision',
                 filas=[dict(nombre='Vendedor de prueba',cedula='1',sucursal='PDV',producto='P',actual=62,puntos=310000,estado='Cumplió')])
        catalogo=dict(dinamicas=[dict(dinamica=job['dinamica'],periodo=job['periodo'],
            fin='2026-10-31',disponible=True,vendedor_historico=False)],liquidaciones=[job])
        def responder(route):
            assert route.request.method=='GET', 'La prueba no debe preparar ni confirmar.'
            url=route.request.url
            datos={'administrar_personal':True} if '/personal/' in url else catalogo if url.endswith('/liquidaciones') else job
            route.fulfill(content_type='application/json',body=json.dumps(datos))
        page.route('https://api.prueba/**',responder)
        page.route('https://prueba.local/',lambda r:r.fulfill(content_type='text/html',body='<button id="personalAbrir">Personal</button>'))
        page.goto('https://prueba.local/')
        page.add_script_tag(content=(ROOT/'liquidaciones.js').read_text(encoding='utf-8'))
        page.evaluate("LiquidacionesUI.iniciar('https://api.prueba')")
        page.click('#liquidacionesAbrir')
        preparar=page.locator('#liquidacionPreparar')
        expect(preparar).to_have_text('Revisión aprobada');expect(preparar).to_be_disabled()
        confirmar=page.get_by_role('button',name='Confirmar liquidación',exact=True)
        expect(confirmar).to_be_disabled()
        page.get_by_role('checkbox').check();expect(confirmar).to_be_enabled()
        page.select_option('#liquidacionModo','pdv');expect(preparar).to_be_enabled()
        page.select_option('#liquidacionModo','vendedor')
        expect(preparar).to_have_text('Revisión aprobada');expect(preparar).to_be_disabled()
        expect(confirmar).to_be_disabled()
        page.get_by_role('checkbox').check();expect(confirmar).to_be_enabled()
        assert not errores,errores
        print('Revision protegida y confirmacion habilitada:',width)
        page.close()
    browser.close()
