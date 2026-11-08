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
N = 9
def card(kick, title, text, body, n):
    return f'<html><head><style>{CSS2}</style></head><body><div class="tag">{n}/{N}</div><div class="top"><div class="kick">{kick}</div><h1>{title}</h1><p>{text}</p></div>{body}</body></html>'
one = lambda shot, full=False: f'<div class="ph">{phone(shot,1.25,full=full)}</div>'
two = lambda a, b, fa=False, fb=False: f'<div style="position:absolute;top:440px;left:50%;transform:translateX(-50%);display:flex;gap:36px">{phone(a,1.0,full=fa)}{phone(b,1.0,full=fb)}</div>'
cards = {
 '1_cover': card('Сделал себе приложение','Трекер<br>тренировок','Минимализм, тёмная тема, только то, что нужно в зале.',
   f'''<div style="position:absolute;top:430px;left:50%;transform:translateX(-50%);display:flex;align-items:flex-start">
     <div style="transform:translate(80px,90px);opacity:.75">{phone('s_progress',.95)}</div>
     <div style="position:relative;z-index:3">{phone('s_workout',1.18)}</div>
     <div style="transform:translate(-80px,90px);opacity:.75">{phone('s_lock',.95,full=True)}</div></div>''','1'),
 '2_workout': card('Тренировка','Плюсик —<br>и вес записан','Веса из моего зала, повторы отдельно на каждую сторону.', one('s_workout'),'2'),
 '3_progress': card('Прогресс','Расту или нет —<br>видно сразу','Зелёное растёт, серое стоит, красное просело.', one('s_progress'),'3'),
 '4_trends': card('Динамика','Было → стало','По каждому упражнению: первая тренировка, прошлая, сейчас и график.', one('s_progress2'),'4'),
 '5_bench': card('Жим лёжа','Программа<br>по неделям','Лёгкие, тяжёлые и проходки — отмечаю одним тапом.', one('s_bench'),'5'),
 '6_history': card('История и настройка','Подстраивается<br>под меня','Все тренировки сохраняются, упражнения и веса легко поменять.', two('s_history','s_edit'),'6'),
 '7_lock': card('Виджет','Тренировка<br>на экране блокировки','Какой сегодня день, сколько подходов, следующий жим и сколько упражнений растёт.', one('s_lock',True),'7'),
 '8_home': card('Виджет','И на домашнем<br>экране','Средний и маленький виджеты: план на сегодня, последняя тренировка, прогресс.', one('s_home',True),'8'),
 '9_large': card('Виджет','Весь план —<br>одним взглядом','Большой виджет показывает все упражнения дня с весами и повторами.', one('s_home2',True),'9'),
}
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(viewport={'width':1080,'height':1350},device_scale_factor=2)
    import os
    [os.remove('/home/claude/tg/'+f) for f in os.listdir('/home/claude/tg')]
    for k,h in cards.items():
        open('/tmp/t.html','w').write(h); pg.goto('file:///tmp/t.html'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'/home/claude/tg/{k}.jpg', type='jpeg', quality=92)
    br.close()
