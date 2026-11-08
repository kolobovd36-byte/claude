from playwright.sync_api import sync_playwright
import json
U='file:///home/claude/repo/workout-tracker.html'
res=[]
def ok(name, cond): res.append(('PASS' if cond else 'FAIL')+' '+name)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844}); ctx.grant_permissions(['clipboard-read','clipboard-write'])
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog', lambda d: (errs.append('DIALOG '+d.message), d.dismiss()))
    pg.goto(U)
    ok('loads 3 tabs', len(pg.query_selector_all('.tab'))==3)
    # double finish → one record
    pg.click('[data-a=finish]'); pg.click('[data-a=finish]')
    ok('no duplicate finish', pg.evaluate('S.history.length')==1)
    # weight bounds
    for _ in range(300): pg.evaluate("document.querySelector('[data-a=w][data-d=\"-1\"]').click()")
    ok('weight min stays in list', pg.evaluate('S.days[0].items[0].weight')==pg.evaluate('S.days[0].items[0].w[0]'))
    for _ in range(120): pg.evaluate("document.querySelector('[data-a=r][data-d=\"-1\"]').click()")
    ok('reps >=0', pg.evaluate('S.days[0].items[0].reps')==0)
    # sets input junk
    pg.fill('.sets','a9b9c9'); ok('sets digits only', pg.evaluate('S.days[0].items[0].sets') in ('99','9'))
    # export / import
    pg.click('[data-v=edit]'); pg.click('[data-a=export]'); pg.wait_for_timeout(200)
    clip=pg.evaluate('navigator.clipboard.readText()'); ok('export valid JSON', json.loads(clip)['days'][0]['name']=='Anterior')
    # malicious import
    evil={"days":[{"id":'"><img src=x onerror=alert(1)>',"name":"<script>alert(1)</script>","items":[{"id":"x\" onclick=alert(1) a=\"","sci":"<img src=x onerror=alert(2)>","ru":"ok","weight":"<b>","w":["1","abc",-5,1e9],"reps":"<svg onload=alert(3)>","sets":"<i>12</i>"}]}],
          "history":[{"date":"bad","day":"<img onerror=alert(4) src=x>","items":[{"sci":"x","weight":"NaN","reps":"<script>","sets":"<img src=x onerror=alert(5)>"}]}],"cur":99,"__proto__":{"polluted":1}}
    pg.fill('#imp', json.dumps(evil)); pg.click('[data-a=import]'); pg.click('[data-a=import]')
    pg.wait_for_timeout(200)
    for v in ['main','history','progress','edit']:
        pg.evaluate(f"view='{v}';render()"); pg.wait_for_timeout(100)
    ok('no injected elements', pg.evaluate("document.querySelectorAll('#app img, #app script, #app b, #app i').length")==0)
    ok('no polluted proto', pg.evaluate("({}).polluted")==None)
    ok('ids sanitized', pg.evaluate("S.days.every(d=>/^[a-z0-9]+$/.test(d.id))"))
    ok('cur clamped', pg.evaluate('S.cur')<pg.evaluate('S.days.length'))
    # corrupted storage
    pg.evaluate("localStorage.setItem('workout-tracker-v2','{broken json')"); pg.reload()
    ok('survives broken storage', len(pg.query_selector_all('.tab'))==3)
    pg.evaluate("localStorage.setItem('workout-tracker-v2', JSON.stringify({days:[], history:'x'}))"); pg.reload()
    ok('survives empty days', len(pg.query_selector_all('.tab'))==3)
    pg.evaluate("localStorage.setItem('workout-tracker-v2', JSON.stringify({days:[{name:'A',items:[{sci:'Pull-up',weight:0,w:[0,5,10],reps:8,sets:'3'}]}]}))"); pg.reload()
    ok('old/partial data + bench added', pg.evaluate("S.days.length")==2)
    # bodyweight progress
    pg.click('[data-a=finish]'); pg.evaluate("S.history[0].date-=3*864e5;save()")
    pg.click('[data-a=r][data-d=\"1\"]'); pg.click('[data-a=finish]')
    pg.click('[data-v=progress]'); ok('bodyweight growth detected', 'растёт' in pg.inner_text('#app') and 'NaN' not in pg.inner_text('#app'))
    # delete flows
    pg.click('.back'); pg.click('[data-v=edit]'); pg.click('[data-a=delex]'); ok('delete needs 2nd tap', pg.evaluate('S.days[0].items.length')==1)
    pg.click('[data-a=delex]'); ok('delete works', pg.evaluate('S.days[0].items.length')==0)
    pg.click('.back'); ok('empty day message', 'Нет упражнений' in pg.inner_text('#app'))
    # bench ops
    pg.click('[data-a=day][data-i="1"]'); n=pg.evaluate("allBench(day()).filter(x=>x.done).length")
    pg.click('.bline.next'); ok('bench toggle', pg.evaluate("allBench(day()).filter(x=>x.done).length")==n+1)
    # weight list junk
    pg.evaluate("S.cur=0;S.days[0].items.push(normEx({sci:'T',weight:20},new Set()));view='edit';render()")
    pg.fill('[data-f=wlist]','abc; ;'); pg.dispatch_event('[data-f=wlist]','change')
    ok('bad weight list rejected', len(pg.evaluate('S.days[0].items[0].w'))>0)
    pg.fill('[data-f=wlist]','10; 12,5; 15'); pg.dispatch_event('[data-f=wlist]','change')
    ok('weight list parsed', pg.evaluate('S.days[0].items[0].w')==[10,12.5,15])
    # storage quota failure
    pg.evaluate("Storage.prototype.setItem=()=>{throw new Error('quota')}; save()")
    ok('quota warning toast', 'резервную' in pg.inner_text('#toast'))
    ok('no JS errors / dialogs', not errs); print(errs)
    b.close()
print('\n'.join(res))
