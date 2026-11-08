from playwright.sync_api import sync_playwright
import base64
def img(n): return 'data:image/png;base64,'+base64.b64encode(open(f'/home/claude/shots/{n}.png','rb').read()).decode()

def phone(n, scale=1.0, cls=''):
    return f'''<div class="phone {cls}" style="--s:{scale}"><div class="scr">
      <div class="sb"><span>9:41</span><div class="isl"></div><span class="ic">
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#fff"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#fff"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff"/></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="#fff"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="#fff" fill-opacity=".45"/></svg>
      </span></div>
      <img src="{img(n)}"></div></div>'''

CSS = '''
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;
  background:radial-gradient(1200px 700px at 72% 50%, #26262b 0%, #141416 55%, #0c0c0d 100%)}
.phone{width:calc(418px*var(--s));height:calc(872px*var(--s));border-radius:calc(64px*var(--s));
  background:linear-gradient(145deg,#4a4a4f,#202023 40%,#3a3a3e);padding:calc(14px*var(--s));
  box-shadow:0 60px 120px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.06) inset;flex:none}
.scr{width:100%;height:100%;border-radius:calc(50px*var(--s));overflow:hidden;background:#1c1c1e;position:relative}
.scr img{position:absolute;top:calc(50px*var(--s));left:0;width:100%}
.sb{position:absolute;z-index:2;top:0;left:0;right:0;height:calc(50px*var(--s));display:flex;align-items:center;justify-content:space-between;
  padding:0 calc(34px*var(--s)) 0 calc(44px*var(--s));font-weight:600;font-size:calc(16px*var(--s));background:#1c1c1e}
.sb .ic{display:flex;gap:6px;align-items:center;transform:scale(var(--s));transform-origin:right center}
.isl{position:absolute;left:50%;top:calc(11px*var(--s));transform:translateX(-50%);width:calc(120px*var(--s));height:calc(34px*var(--s));border-radius:20px;background:#000}
.kick{font-size:20px;letter-spacing:3px;text-transform:uppercase;color:#30d158;font-weight:600;margin-bottom:26px}
h1{font-size:84px;line-height:1.02;letter-spacing:-3px;font-weight:700}
p{font-size:28px;line-height:1.45;color:#9a9aa0;margin-top:30px;max-width:640px}
.row{display:flex;align-items:center;height:100%;padding:0 150px;gap:120px}
.text{flex:1}
ul{list-style:none;padding:0;margin-top:40px;display:grid;gap:18px}
li{font-size:24px;color:#d8d8dc;display:flex;gap:14px;align-items:center}
li:before{content:"";width:8px;height:8px;border-radius:50%;background:#30d158;flex:none}
.pg{position:absolute;bottom:56px;left:150px;font-size:18px;color:#5a5a60;letter-spacing:1px}
'''
def slide(body, num=None):
    return f'<html><head><style>{CSS}</style></head><body>{body}{f"<div class=pg>ТРЕКЕР · {num:02d}</div>" if num else ""}</body></html>'

def single(kick, title, text, bullets, shot, num):
    lis = ''.join(f'<li>{b}</li>' for b in bullets)
    return slide(f'''<div class="row"><div class="text"><div class="kick">{kick}</div><h1>{title}</h1><p>{text}</p><ul>{lis}</ul></div>
      {phone(shot,1.12)}</div>''', num)

slides = {
 '01_hero': slide(f'''<div style="position:absolute;left:150px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:560px">
     <div class="kick">Личное приложение</div><h1 style="font-size:76px">Трекер<br>тренировок</h1>
     <p style="font-size:24px;max-width:520px">Минималистичный дневник зала для iPhone: веса, повторы, программа жима и наглядный прогресс.</p></div>
   <div style="position:absolute;right:70px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:0">
     <div style="transform:translateX(90px);opacity:.75">{phone('s_progress',.86)}</div>
     <div style="position:relative;z-index:3">{phone('s_workout',1.06)}</div>
     <div style="transform:translateX(-90px);opacity:.75">{phone('s_bench',.86)}</div>
   </div>'''),
 '02_workout': single('Тренировка','Всё под рукой<br>в зале','Каждое упражнение — карточка: научное название крупно, русское мелко.',
     ['Вес — плюсиками по весам твоего зала','Повторы — плюсиками, отдельно право/лево','Подходы — цифрами с клавиатуры','Прошлый результат прямо под упражнением'],'s_workout',2),
 '03_progress': single('Прогресс','Сразу видно,<br>двигаюсь ли я','Круговая диаграмма показывает, какие упражнения растут, стоят на месте или проседают.',
     ['Учитывает и вес, и повторы','Лучшая проходка в жиме','Проблемные упражнения — первыми'],'s_progress',3),
 '04_trends': single('Динамика','Было → стало','По каждому упражнению — сравнение с первой и прошлой тренировкой и график за всё время.',
     ['Зелёный — растёт','Серый — на месте','Красный — просел'],'s_progress2',4),
 '05_bench': single('Жимовая программа','Неделя<br>за неделей','Лёгкие и тяжёлые тренировки, проходки с датами и отметки о выполнении одним тапом.',
     ['Подсветка следующей тренировки','Шкала прохождения программы','Редактирование недель и весов'],'s_bench',5),
 '06_history': slide(f'''<div class="row"><div class="text"><div class="kick">История и настройка</div><h1>Подстраивается<br>под меня</h1>
     <p>Все тренировки сохраняются в истории, а упражнения, дни и веса тренажёров легко поменять.</p></div>
     <div style="display:flex;gap:40px">{phone('s_history',1)}{phone('s_edit',1)}</div></div>''',6),
}
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width':1920,'height':1080}, device_scale_factor=2)
    for name, html in slides.items():
        open('/tmp/s.html','w').write(html); pg.goto('file:///tmp/s.html'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'/home/claude/slides/{name}.png')
    br.close()
