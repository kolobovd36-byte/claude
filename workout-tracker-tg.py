import re
src = open('compose.py').read()
exec(src.split("slides = {")[0])  # phone(), img(), CSS
CSS2 = CSS.replace("body{width:1920px;height:1080px","body{width:1080px;height:1350px").replace(
 "radial-gradient(1200px 700px at 72% 50%","radial-gradient(900px 800px at 50% 75%")
CSS2 += '''
.top{position:absolute;top:96px;left:90px;right:90px}
.top h1{font-size:72px;letter-spacing:-2.5px}
.top p{font-size:26px;margin-top:20px;max-width:none}
.ph{position:absolute;left:50%;transform:translateX(-50%);top:440px}
.tag{position:absolute;top:96px;right:90px;font-size:18px;color:#5a5a60;letter-spacing:1px}
'''
def card(kick, title, text, body, n):
    return f'<html><head><style>{CSS2}</style></head><body><div class="tag">{n}/4</div><div class="top"><div class="kick">{kick}</div><h1>{title}</h1><p>{text}</p></div>{body}</body></html>'
cards = {
 '1_cover': card('Сделал себе приложение','Трекер<br>тренировок','Минимализм, тёмная тема, только то, что нужно в зале.',
   f'''<div style="position:absolute;top:430px;left:50%;transform:translateX(-50%);display:flex;align-items:flex-start">
     <div style="transform:translate(80px,90px);opacity:.75">{phone("s_progress",.95)}</div>
     <div style="position:relative;z-index:3">{phone("s_workout",1.18)}</div>
     <div style="transform:translate(-80px,90px);opacity:.75">{phone("s_bench",.95)}</div></div>''','1'),
 '2_workout': card('Тренировка','Плюсик —<br>и вес записан','Веса из моего зала, повторы отдельно на каждую сторону.',
   f'<div class="ph">{phone("s_workout",1.25)}</div>','2'),
 '3_progress': card('Прогресс','Расту или нет —<br>видно сразу','Зелёное растёт, серое стоит, красное просело.',
   f'<div class="ph">{phone("s_progress",1.25)}</div>','3'),
 '4_bench': card('Жим лёжа','Программа<br>по неделям','Лёгкие, тяжёлые и проходки — отмечаю одним тапом.',
   f'<div class="ph">{phone("s_bench",1.25)}</div>','4'),
}
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(viewport={'width':1080,'height':1350},device_scale_factor=2)
    for k,h in cards.items():
        open('/tmp/t.html','w').write(h); pg.goto('file:///tmp/t.html'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'/home/claude/tg/{k}.jpg', type='jpeg', quality=92)
    br.close()
