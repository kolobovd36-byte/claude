from playwright.sync_api import sync_playwright
import base64
icon='data:image/png;base64,'+base64.b64encode(open('/home/claude/icon.png','rb').read()).decode()
DB='<svg viewBox="0 0 24 24" width="{s}" height="{s}"><g fill="{c}"><rect x="5" y="7" width="3" height="10" rx="1"/><rect x="16" y="7" width="3" height="10" rx="1"/><rect x="2" y="9" width="2.5" height="6" rx=".8"/><rect x="19.5" y="9" width="2.5" height="6" rx=".8"/><rect x="8" y="11" width="8" height="2" rx=".5"/></g></svg>'
base='''<html><head><style>*{margin:0;box-sizing:border-box}body{width:390px;height:844px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;position:relative}</style></head><body>{b}</body></html>'''
lock = base.replace('{b}', f'''
<div style="position:absolute;inset:0;background:radial-gradient(120% 70% at 30% 20%,#3b3d52 0%,#1d1e2b 45%,#0b0b10 100%)"></div>
<div style="position:absolute;inset:0;background:radial-gradient(60% 40% at 80% 85%,rgba(48,209,88,.18),transparent 70%)"></div>
<div style="position:absolute;top:96px;width:100%;text-align:center;font-size:19px;font-weight:600;opacity:.85">Пн, 9 ноября&nbsp;&nbsp;<span style="display:inline-flex;vertical-align:-4px">{DB.format(s=22,c="#fff")}</span> Anterior</div>
<div style="position:absolute;top:116px;width:100%;text-align:center;font-size:104px;font-weight:600;letter-spacing:-3px;opacity:.95">9:41</div>
<div style="position:absolute;top:262px;left:0;right:0;display:flex;justify-content:center;gap:12px">
  <div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.16);backdrop-filter:blur(10px);display:grid;place-items:center">{DB.format(s=34,c="#fff")}</div>
  <div style="width:158px;height:72px;border-radius:18px;padding:12px 14px;background:rgba(255,255,255,.0)">
    <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:16px">{DB.format(s=20,c="#fff")}Трекер</div>
    <div style="font-size:14px;opacity:.75;margin-top:4px">Сегодня: Anterior</div>
  </div>
</div>
<div style="position:absolute;bottom:52px;left:46px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.14)"></div>
<div style="position:absolute;bottom:52px;right:46px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.14)"></div>
<div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:#fff"></div>
''')
apps=[('#3a3a3f','Почта'),('#2c2c31','Фото'),('#34343a','Камера'),('#2f2f35','Погода'),('#3a3a3f','Заметки'),('#2c2c31','Музыка'),('#34343a','Карты'),('#2f2f35','Настройки'),('#3a3a3f','Часы'),('#2c2c31','Файлы'),('#34343a','Telegram'),('#2f2f35','TikTok')]
icons=''.join(f'<div style="text-align:center"><div style="width:62px;height:62px;border-radius:15px;background:{c};margin:0 auto"></div><div style="font-size:11px;margin-top:6px;opacity:.85">{n}</div></div>' for c,n in apps)
home = base.replace('{b}', f'''
<div style="position:absolute;inset:0;background:radial-gradient(120% 70% at 70% 10%,#33354a 0%,#1a1b26 50%,#0a0a0e 100%)"></div>
<div style="position:absolute;top:70px;left:24px;right:24px;display:grid;grid-template-columns:1fr 1fr;gap:22px">
  <div style="aspect-ratio:1;border-radius:22px;background:#1c1c1e;padding:16px;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,.4)">
    {DB.format(s=34,c="#fff")}<div style="flex:1"></div>
    <div style="font-weight:700;font-size:19px">Трекер</div><div style="font-size:14px;color:#30d158;margin-top:2px">Anterior</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 10px">
    <div style="text-align:center"><img src="{icon}" style="width:62px;height:62px;border-radius:15px"><div style="font-size:11px;margin-top:6px">Трекер</div></div>
    {icons[:icons.index('</div></div>',0)+12]}
    {''.join(f'<div style="text-align:center"><div style="width:62px;height:62px;border-radius:15px;background:{c};margin:0 auto"></div><div style="font-size:11px;margin-top:6px;opacity:.85">{n}</div></div>' for c,n in apps[1:3])}
  </div>
</div>
<div style="position:absolute;top:290px;left:24px;right:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:22px 0">{''.join(f'<div style="text-align:center"><div style="width:62px;height:62px;border-radius:15px;background:{c};margin:0 auto"></div><div style="font-size:11px;margin-top:6px;opacity:.85">{n}</div></div>' for c,n in apps[3:11])}</div>
<div style="position:absolute;bottom:20px;left:14px;right:14px;height:92px;border-radius:30px;background:rgba(255,255,255,.12);display:flex;justify-content:space-around;align-items:center">
  {''.join('<div style="width:62px;height:62px;border-radius:15px;background:#2f2f35"></div>' for _ in range(4))}
</div>
''')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=3)
    for n,h in [('s_lock',lock),('s_home',home)]:
        pg.set_content(h); pg.wait_for_timeout(200); pg.screenshot(path=f'/home/claude/shots/{n}.png')
    b.close()
