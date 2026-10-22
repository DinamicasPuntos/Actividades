"""Interacción de liquidaciones con API simulada; no confirma pagos reales."""
from pathlib import Path
import copy,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    for owner,width in [(False,1400),(True,1400),(True,390)]:
        page=browser.new_page(viewport={'width':width,'height':850},accept_downloads=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('https://prueba.local/',lambda r:r.fulfill(content_type='text/html',body='<button id="personalAbrir">Personal</button>'))
        catalogo={'dinamicas':[
            dict(dinamica='Familia',periodo='2026-09',fin='2026-09-30',disponible=True,vendedor_historico=False),
            dict(dinamica='Octubre',periodo='2026-10',fin='2026-10-31',disponible=False,motivo='Disponible después de finalizar la dinámica.',vendedor_historico=False)],
            'liquidaciones':[],'agente_visto':None}
        jobs={};confirmadas=[]
        def api(route):
            path=route.request.url.removeprefix('https://api.prueba');method=route.request.method
            if path=='/personal/mi-perfil':data={'administrar_personal':owner}
            elif path=='/liquidaciones' and method=='GET':data=catalogo
            elif path=='/liquidaciones' and method=='POST':
                req=route.request.post_data_json;modo=req['modo'];id=modo
                data=dict(id=id,dinamica=req['dinamica'],periodo=req['periodo'],modo=modo,estado='esperando')
                jobs[id]=dict(data,estado='preparada',huella='hash-'+modo,total_puntos=100,total_actual=1,registros=1,
                    filas=[dict(nombre='Vendedor',cedula='100',sucursal='PDV A',producto='Familia',actual=1,puntos=100,estado='Cumplió')],bloqueos=[])
                catalogo['liquidaciones']=[j for j in catalogo['liquidaciones'] if j['id']!=id]+[data]
            elif path.endswith('/confirmar'):
                id=path.split('/')[-2];assert route.request.post_data_json=={'huella':'hash-'+id}
                confirmadas.append(id);jobs[id]['estado']='confirmada';data=jobs[id]
                catalogo['liquidaciones']=[j for j in catalogo['liquidaciones'] if j['id']!=id]+[data]
            elif path.endswith('/excel'):
                route.fulfill(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body=b'excel');return
            else:data=copy.deepcopy(jobs[path.split('/')[-1]])
            route.fulfill(content_type='application/json',body=json.dumps(data))
        page.route('https://api.prueba/**',api)
        page.goto('https://prueba.local/')
        for css in ('dashboard-style.css','design.css','banners-admin.css'):
            page.add_style_tag(content=(ROOT/css).read_text(encoding='utf-8'))
        page.add_script_tag(content=(ROOT/'liquidaciones.js').read_text(encoding='utf-8'))
        page.evaluate("localStorage.setItem('access_token','simulado');LiquidacionesUI.iniciar('https://api.prueba')")
        if not owner:
            expect(page.locator('#liquidacionesAbrir')).to_have_count(0);page.close();continue
        page.click('#liquidacionesAbrir')
        page.select_option('#liquidacionDinamica','1');expect(page.locator('#liquidacionPreparar')).to_be_disabled()
        page.select_option('#liquidacionDinamica','0');page.click('#liquidacionPreparar')
        expect(page.locator('#liquidacionesPanel [role=status]')).to_have_text('Vista previa lista',timeout=12000)
        confirmar=page.get_by_role('button',name='Confirmar liquidación',exact=True)
        expect(confirmar).to_be_disabled()
        page.get_by_role('checkbox').check();expect(confirmar).to_be_enabled()
        with page.expect_download() as descarga:page.get_by_role('button',name='Descargar Excel completo').click()
        assert descarga.value.suggested_filename=='Liquidacion_vendedor_2026-09.xlsx'
        confirmar.click();expect(page.locator('#liquidacionesPanel [role=status]')).to_have_text('Liquidación confirmada')
        page.select_option('#liquidacionModo','pdv');expect(page.locator('#liquidacionPreparar')).to_be_enabled()
        page.click('#liquidacionPreparar')
        expect(page.locator('#liquidacionesPanel [role=status]')).to_have_text('Vista previa lista',timeout=12000)
        expect(page.locator('#liquidacionesPanel th')).to_have_count(5)
        assert confirmadas==['vendedor']
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        stage=ROOT/'.preview/liquidaciones-20261022';stage.mkdir(exist_ok=True,parents=True)
        page.screenshot(path=str(stage/('liquidacion-movil.png' if width==390 else 'liquidacion-pc.png')))
        page.select_option('#liquidacionModo','vendedor')
        expect(page.locator('#liquidacionesPanel [role=status]')).to_have_text('Liquidación confirmada')
        expect(page.locator('#liquidacionPreparar')).to_be_disabled()
        assert not errors,errors
        page.close()
    browser.close()
print('Liquidaciones: propietario, cierre, modalidades independientes, Excel, confirmación, historial y móvil verificados.')
