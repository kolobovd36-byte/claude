from playwright.sync_api import sync_playwright
import base64
icon='data:image/png;base64,'+base64.b64encode(open('/home/claude/icon.png','rb').read()).decode()
DB='<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="flex:none"><g fill="{c}"><rect x="5" y="7" width="3" height="10" rx="1"/><rect x="16" y="7" width="3" height="10" rx="1"/><rect x="2" y="9" width="2.5" height="6" rx=".8"/><rect x="19.5" y="9" width="2.5" height="6" rx=".8"/><rect x="8" y="11" width="8" height="2" rx=".5"/></g></svg>'
CH='<svg viewBox="0 0 24 24" width="{s}" height="{s}"><path d="M3 20h18M5 16l4-5 4 3 6-7" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
def ring(up,total,size=58,lw=7,fs=17):
    import math
    r=size/2-5; C=2*math.pi*r; L=C*up/total
    return f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}"><circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="#333338" stroke-width="{lw}"/>
    <circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="#30d158" stroke-width="{lw}" stroke-dasharray="{L} {C}" transform="rotate(-90 {size/2} {size/2})"/>
    <text x="50%" y="{size/2+6}" text-anchor="middle" fill="#30d158" font-size="{fs}" font-weight="700" font-family="Inter">{up}</text></svg>'''
base='''<html><head><style>*{margin:0;box-sizing:border-box}body{width:390px;height:844px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;position:relative}
.w{background:#1c1c1e;border-radius:22px;padding:14px 15px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.g{color:#8e8e93}.gr{color:#30d158}.b{font-weight:700}
.box{background:#2a2a2e;border-radius:10px;padding:6px 8px;flex:1;min-width:0}
.box div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.head{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#8e8e93}
.ic{text-align:center;font-size:11px}.ic div{width:62px;height:62px;border-radius:15px;margin:0 auto 6px;background:#2f2f35}
</style></head><body>{b}</body></html>'''
WALL='<div style="position:absolute;inset:0;background:radial-gradient(120% 70% at 30% 20%,#3b3d52 0%,#1d1e2b 45%,#0b0b10 100%)"></div><div style="position:absolute;inset:0;background:radial-gradient(60% 40% at 80% 85%,rgba(48,209,88,.18),transparent 70%)"></div>'
lock = base.replace('{b}', WALL + f'''
<div style="position:absolute;top:96px;width:100%;text-align:center;font-size:18px;font-weight:600;opacity:.85;display:flex;justify-content:center;align-items:center;gap:6px">Пн, 9 ноября&nbsp; {DB.format(s=20,c="#fff")} Anterior · 13 подх.</div>
<div style="position:absolute;top:116px;width:100%;text-align:center;font-size:104px;font-weight:600;letter-spacing:-3px;opacity:.95">9:41</div>
<div style="position:absolute;top:262px;left:0;right:0;display:flex;justify-content:center;gap:12px;align-items:center">
  <div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.16);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">{CH.format(s=18,c="#fff")}<div style="font-weight:700;font-size:16px">12/16</div></div>
  <div style="width:170px;height:72px;padding:6px 4px">
    <div style="display:flex;align-items:center;gap:5px;font-weight:700;font-size:16px">{DB.format(s=17,c="#fff")}Anterior</div>
    <div style="font-size:13.5px;opacity:.8;margin-top:2px">9 упр. · 13 подх.</div>
    <div style="font-size:12.5px;opacity:.6;margin-top:1px;white-space:nowrap">Жим: Тяжёлая 90 кг · 3×5</div>
  </div>
</div>
<div style="position:absolute;bottom:52px;left:46px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.14)"></div>
<div style="position:absolute;bottom:52px;right:46px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.14)"></div>
<div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:#fff"></div>''')

medium = f'''<div class="w" style="height:166px;display:flex;flex-direction:column">
  <div class="head">{DB.format(s=15,c="#fff")}Трекер<span style="margin-left:auto;font-weight:400;font-size:12px">за неделю: 3</span></div>
  <div style="display:flex;align-items:center;margin-top:8px">
    <div style="flex:1"><div class="g" style="font-size:11px">Сегодня</div><div class="b" style="font-size:22px">Anterior</div><div class="gr" style="font-size:13px">9 упр. · 13 подх.</div></div>
    <div style="text-align:center">{ring(12,16)}<div class="g" style="font-size:9px">из 16 растут</div></div>
  </div>
  <div style="display:flex;gap:8px;margin-top:auto">
    <div class="box"><div class="g" style="font-size:9px">Последняя</div><div class="b" style="font-size:12px">Posterior · 2 дня назад</div></div>
    <div class="box"><div class="g" style="font-size:9px">Жим лёжа</div><div class="b" style="font-size:12px">Тяжёлая 90 кг · 3×5</div></div>
  </div></div>'''
small = f'''<div class="w" style="width:166px;height:166px;display:flex;flex-direction:column">
  <div class="head">{DB.format(s=15,c="#fff")}Трекер</div><div style="flex:1"></div>
  <div class="b" style="font-size:20px">Anterior</div><div class="gr" style="font-size:12px">9 упр. · 13 подх.</div>
  <div class="g" style="font-size:10px;margin-top:6px">Последняя:</div><div style="font-size:11px">Posterior · 2 дня назад</div></div>'''
ex=[('Cable Lateral Raise (cuffed)','13,5 × 10/9'),('Close-Grip Seated Press, 80°','45 × 11'),('Smith Machine Incline Press','40 × 8'),('Cable Shoulder Flexion (cuffed)','9 × 8/8'),('Leg Press (quadriceps emphasis)','160 × 9'),('Unilateral Leg Extension','57,5 × 8/8'),('Reclined Biceps Curl','68 × 8'),('Dumbbell Hammer Curl','18 × 11/11')]
large = medium.replace('height:166px','height:350px').replace('</div></div></div>\n  </div></div>','X') 
large = f'''<div class="w" style="height:362px;display:flex;flex-direction:column">
  {medium[medium.index('<div class="head">'):medium.rindex('</div>')]}
  <div class="g" style="font-size:11px;margin-top:12px">План на сегодня</div>
  {''.join(f'<div style="display:flex;font-size:12px;margin-top:4px"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{a}</span><span class="g" style="margin-left:auto;padding-left:8px;white-space:nowrap">{b}</span></div>' for a,b in ex)}
  <div class="g" style="font-size:9px;margin-top:auto;padding-top:6px">данные обновлены сегодня</div></div>'''
large = large.replace('<div style="display:flex;gap:8px;margin-top:auto">','<div style="display:flex;gap:8px;margin-top:8px">')
apps=['Почта','Фото','Камера','Погода','Заметки','Музыка','Карты','Настройки']
home = base.replace('{b}', WALL.replace('30% 20%','70% 10%') + f'''
<div style="position:absolute;top:66px;left:20px;right:20px">{medium}</div>
<div style="position:absolute;top:258px;left:20px;right:20px;display:grid;grid-template-columns:166px 1fr;gap:18px">
  {small}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 6px">
    <div class="ic"><img src="{icon}" style="width:62px;height:62px;border-radius:15px;display:block;margin:0 auto 6px">Трекер</div>
    {''.join(f'<div class="ic"><div></div>{n}</div>' for n in apps[:3])}
  </div></div>
<div style="position:absolute;top:470px;left:20px;right:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px 0">{''.join(f'<div class="ic"><div></div>{n}</div>' for n in apps[3:]+['Часы','Файлы','Telegram'])}</div>
<div style="position:absolute;bottom:20px;left:14px;right:14px;height:92px;border-radius:30px;background:rgba(255,255,255,.12);display:flex;justify-content:space-around;align-items:center">{''.join('<div style="width:62px;height:62px;border-radius:15px;background:#2f2f35"></div>' for _ in range(4))}</div>''')
home2 = base.replace('{b}', WALL.replace('30% 20%','60% 15%') + f'''
<div style="position:absolute;top:66px;left:20px;right:20px">{large}</div>
<div style="position:absolute;top:446px;left:20px;right:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px 0">
 <div class="ic"><img src="{icon}" style="width:62px;height:62px;border-radius:15px;display:block;margin:0 auto 6px">Трекер</div>
 {''.join(f'<div class="ic"><div></div>{n}</div>' for n in apps[:7])}</div>
<div style="position:absolute;bottom:20px;left:14px;right:14px;height:92px;border-radius:30px;background:rgba(255,255,255,.12);display:flex;justify-content:space-around;align-items:center">{''.join('<div style="width:62px;height:62px;border-radius:15px;background:#2f2f35"></div>' for _ in range(4))}</div>''')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=3)
    for n,h in [('s_lock',lock),('s_home',home),('s_home2',home2)]:
        pg.set_content(h); pg.wait_for_timeout(200); pg.screenshot(path=f'/home/claude/shots/{n}.png')
    b.close()
