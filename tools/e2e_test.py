from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':1440,'height':900})
    pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e.stack)))
    pg.goto('file://'+__import__('os').path.abspath('dist/prism-simulate.html')+'')
    pg.wait_for_timeout(500); pg.screenshot(path='s0.png')
    pg.click('[data-act=login][data-id=u-rm]'); pg.wait_for_timeout(300); pg.screenshot(path='s1.png',full_page=True)
    pg.goto('file://'+__import__('os').path.abspath('dist/prism-simulate.html')+'#/customer/CORP000184'); pg.wait_for_timeout(300); pg.screenshot(path='s2.png',full_page=True)
    pg.click('[data-act=new-sim]'); pg.click('[data-act=modal-ok]'); pg.wait_for_timeout(300)
    pg.click('.schip:nth-child(4)'); pg.wait_for_timeout(200); pg.screenshot(path='s3.png',full_page=True)
    # edit a field
    inp=pg.locator('input.num[data-field=wcRate]'); inp.fill('8.80'); inp.dispatch_event('input'); inp.dispatch_event('change'); pg.wait_for_timeout(200)
    pg.fill('#nl','Reduce lending rate by 5 basis points, increase deposits by INR 5 Cr and transactions by 10%'); pg.click('[data-act=nl-parse]'); pg.wait_for_timeout(200); pg.screenshot(path='s4.png'); pg.click('[data-act=modal-ok]')
    pg.click('[data-act=trace][data-k=profit]'); pg.wait_for_timeout(200); pg.screenshot(path='s5.png'); pg.click('[data-act=modal-close]')
    url=pg.url.rsplit('/',1)[0]
    for t in ['compare','sens','drivers','stress','ai','decision','audit']:
        pg.goto(url+'/'+t); pg.wait_for_timeout(250); pg.screenshot(path=f't_{t}.png',full_page=True)
    pg.goto(url+'/ai')
    for k in ['gen','best','explain','suggest','summary']:
        pg.click(f'[data-act=ai-prompt][data-k={k}]'); pg.wait_for_timeout(200)
    pg.click('[data-act=ai-add][data-i="2"]'); pg.click('[data-act=modal-ok]'); pg.wait_for_timeout(200)
    pg.fill('#ai-q','cut rate by 20 bps and add 10 Cr deposits'); pg.click('[data-act=ai-ask]'); pg.wait_for_timeout(200); pg.click('[data-act=nl-confirm]'); pg.wait_for_timeout(200)
    pg.screenshot(path='t_ai2.png',full_page=True)
    pg.goto(url+'/decision'); pg.wait_for_timeout(200)
    pg.locator('.pick-i').nth(2).click(); pg.wait_for_timeout(200)
    pg.fill('#rationale','Customer agreed to move operating account and route payables; commitments in sanction letter.'); pg.click('[data-act=submit]'); pg.wait_for_timeout(200); pg.screenshot(path='t_submit.png'); pg.click('[data-act=modal-ok]'); pg.wait_for_timeout(200)
    pg.screenshot(path='t_dec2.png',full_page=True)
    pg.click('[data-act=persona-menu]'); pg.click('[data-act=switch-user][data-id=u-pm]'); pg.wait_for_timeout(200)
    pg.fill('#appr-comment','Concession funded by deposits; approve.'); pg.click('[data-act=approve][data-d=approve]'); pg.wait_for_timeout(200)
    pg.screenshot(path='t_dec3.png',full_page=True)
    sid=url.split('/')[-1]
    pg.goto(f'file://'+__import__('os').path.abspath('dist/prism-simulate.html')+'#/package/{sid}'); pg.wait_for_timeout(300); pg.screenshot(path='t_pkg.png',full_page=True)
    for r in ['home','customers','prospects','product','portfolio','campaign','enterprise','library','approvals','outcomes','audit','pricing','admin']:
        pg.goto('file://'+__import__('os').path.abspath('dist/prism-simulate.html')+'#/'+r); pg.wait_for_timeout(250); pg.screenshot(path=f'r_{r}.png',full_page=True)
        if pg.locator('.error-state').count(): errs.append('ERRSTATE '+r)
    pg.goto('file://'+__import__('os').path.abspath('dist/prism-simulate.html')+'#/prospects'); pg.click('[data-act=persona-menu]'); pg.click('[data-act=switch-user][data-id=u-rm]'); pg.click('[data-act=pros-create]'); pg.wait_for_timeout(300); pg.screenshot(path='r_pros2.png',full_page=True)
    pg.set_viewport_size({'width':390,'height':844}); pg.goto('file://'+__import__('os').path.abspath('dist/prism-simulate.html')+'#/home'); pg.wait_for_timeout(300); pg.screenshot(path='m_home.png')
    b.close()
print('ERRORS:',errs)
