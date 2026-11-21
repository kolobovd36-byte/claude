# Слайды для Telegram-поста про бота «О! Пригодится» — в стиле workout-tracker-tg, акцент оранжевый.
# Размер 1080×1350 @2x = 2160×2700 JPEG. Запуск: python3 vk-autopost-tg.py
import os, html
from playwright.sync_api import sync_playwright

OUT = os.environ.get("OUT", "/home/claude/vktg")
os.makedirs(OUT, exist_ok=True)
ACC = "#ff9f0a"   # акцент (оранжевый)

CSS = f'''
*{{box-sizing:border-box;margin:0}}
body{{width:1080px;height:1350px;overflow:hidden;font-family:Inter,"Noto Color Emoji",sans-serif;color:#fff;
  background:radial-gradient(900px 800px at 50% 75%, #26262b 0%, #141416 55%, #0c0c0d 100%);position:relative}}
.glow{{position:absolute;left:50%;top:880px;width:900px;height:700px;transform:translateX(-50%);
  background:radial-gradient(closest-side, rgba(255,159,10,.16), rgba(255,159,10,0));pointer-events:none}}
.kick{{font-size:20px;letter-spacing:3px;text-transform:uppercase;color:{ACC};font-weight:600;margin-bottom:26px}}
h1{{font-weight:700;line-height:1.02}}
.top{{position:absolute;top:96px;left:90px;right:90px}}
.top h1{{font-size:72px;letter-spacing:-2.5px}}
.top p{{font-size:26px;line-height:1.45;color:#9a9aa0;margin-top:20px}}
.tag{{position:absolute;top:96px;right:90px;font-size:18px;color:#5a5a60;letter-spacing:1px}}
.phone{{width:calc(418px*var(--s));height:calc(872px*var(--s));border-radius:calc(64px*var(--s));
  background:linear-gradient(145deg,#4a4a4f,#202023 40%,#3a3a3e);padding:calc(14px*var(--s));
  box-shadow:0 60px 120px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.06) inset;flex:none}}
.scr{{width:100%;height:100%;border-radius:calc(50px*var(--s));overflow:hidden;background:#0f0f11;position:relative}}
.zoom{{position:absolute;top:0;left:0;width:390px;height:844px;transform:scale(var(--s));transform-origin:0 0}}
.sb{{position:absolute;z-index:3;top:0;left:0;right:0;height:50px;display:flex;align-items:center;justify-content:space-between;
  padding:0 30px 0 40px;font-weight:600;font-size:16px}}
.isl{{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:120px;height:34px;border-radius:20px;background:#000}}
.hd{{position:absolute;z-index:2;top:50px;left:0;right:0;height:62px;background:rgba(28,28,30,.96);display:flex;align-items:center;
  gap:12px;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.06)}}
.hd .back{{color:{ACC};font-size:26px;width:18px}}
.av{{width:40px;height:40px;border-radius:50%;background:linear-gradient(145deg,#ffb340,#f07a12);display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:15px;color:#fff;flex:none}}
.hd b{{font-size:16px;font-weight:600;display:block}} .hd small{{font-size:13px;color:#8e8e93}}
.chat{{position:absolute;top:112px;left:0;right:0;bottom:0;padding:14px 10px;display:flex;flex-direction:column;gap:8px;
  background:radial-gradient(500px 500px at 80% 20%, rgba(255,159,10,.05), transparent), #0f0f11;overflow:hidden}}
.chat.bottom{{justify-content:flex-end}}
.m{{max-width:84%;background:#212124;border-radius:16px 16px 16px 6px;padding:8px 11px;font-size:14px;line-height:1.38;white-space:pre-wrap;align-self:flex-start;position:relative}}
.m.me{{align-self:flex-end;background:#7a3d08;border-radius:16px 16px 6px 16px}}
.m .t{{font-size:11px;color:rgba(255,255,255,.45);float:right;margin:6px 0 -4px 10px}}
.m.ph{{padding:3px}} .m.ph .cap{{padding:5px 8px 3px;font-size:14px}}
.m.ph svg{{display:block;width:100%;height:auto;border-radius:13px}}
.kb{{display:grid;gap:4px;max-width:84%;width:84%;align-self:flex-start;margin-top:-4px}}
.kb .r{{display:flex;gap:4px}}
.kb span{{flex:1;background:rgba(255,255,255,.09);border-radius:10px;padding:8px 6px;text-align:center;font-size:13px;font-weight:500}}
.sys{{align-self:center;font-size:12px;color:#8e8e93;background:rgba(255,255,255,.06);padding:3px 10px;border-radius:10px}}
.ph-wrap{{position:absolute;left:50%;transform:translateX(-50%);top:440px}}
.tiles{{position:absolute;top:470px;left:90px;right:90px;display:grid;grid-template-columns:1fr 1fr;gap:22px}}
.tile{{background:linear-gradient(160deg,#1f1f23,#161618);border:1px solid rgba(255,255,255,.07);border-radius:28px;padding:30px 30px 32px}}
.tile .ic{{font-size:38px}} .tile b{{display:block;font-size:30px;font-weight:700;letter-spacing:-.5px;margin-top:18px}}
.tile p{{font-size:20px;line-height:1.4;color:#9a9aa0;margin-top:10px}}
.tile .acc{{color:{ACC}}}
'''

def esc(s): return html.escape(s)

def illus(kind="mug"):
    # Пример «фото» для поста: уютная сцена в стиле группы (векторная заглушка вместо нейросетевого фото)
    common = '''<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf3e1"/><stop offset="1" stop-color="#f6e2c2"/></linearGradient>
      <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a066"/><stop offset="1" stop-color="#b97a42"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#w)"/><rect x="0" y="215" width="400" height="85" fill="url(#t)"/>
      <rect x="0" y="215" width="400" height="4" fill="#e8b884"/>'''
    plant = '''<g transform="translate(300,120)"><path d="M0 95 L-38 95 L-30 40 L30 40 L38 95 Z" fill="#c9924f"/>
      <path d="M-34 52 H34 M-36 66 H36 M-37 80 H37" stroke="#a87436" stroke-width="3"/>
      <path d="M0 42 C-10 0 -40 -10 -55 -30 C-20 -25 -5 -5 0 42Z" fill="#3f9e4d"/><path d="M0 42 C5 -10 30 -30 50 -45 C40 -5 20 15 0 42Z" fill="#2f8a3e"/>
      <path d="M0 42 C-2 0 2 -40 -5 -70 C15 -40 12 0 0 42Z" fill="#4cb35a"/></g>'''
    bulb = f'''<g transform="translate(62,62)"><circle r="34" fill="#fff"/><circle r="27" fill="{ACC}"/><path d="M-8 6 a12 12 0 1 1 16 0 v6 h-16z" fill="#fff"/><rect x="-7" y="14" width="14" height="4" rx="2" fill="#fff"/></g>'''
    if kind == "mug":
        obj = '''<g transform="translate(150,135)"><rect x="0" y="0" width="90" height="88" rx="14" fill="#fff"/><path d="M90 20 a24 24 0 0 1 0 48" fill="none" stroke="#fff" stroke-width="12"/>
          <path d="M45 58 C25 42 28 25 40 26 C44 26 45 30 45 32 C45 30 46 26 50 26 C62 25 65 42 45 58Z" fill="#2f8a3e"/>
          <ellipse cx="45" cy="90" rx="58" ry="8" fill="#000" opacity=".12"/></g>
          <path d="M30 230 q60 -16 120 0 q40 10 70 -2" stroke="#2f7d6a" stroke-width="22" fill="none" stroke-linecap="round" opacity=".9"/>'''
    else:  # губка и тарелка
        obj = '''<ellipse cx="170" cy="222" rx="95" ry="22" fill="#000" opacity=".1"/><ellipse cx="170" cy="210" rx="92" ry="24" fill="#fff"/>
          <ellipse cx="170" cy="207" rx="64" ry="15" fill="#f1ede6"/>
          <g transform="translate(120,160) rotate(-8)"><rect width="96" height="30" rx="7" fill="#ffd23f"/><rect y="22" width="96" height="16" rx="6" fill="#3f9e4d"/>
          <circle cx="20" cy="12" r="3" fill="#e9b820"/><circle cx="48" cy="9" r="3" fill="#e9b820"/><circle cx="74" cy="14" r="3" fill="#e9b820"/></g>
          <g fill="#fff" opacity=".9"><circle cx="232" cy="150" r="9"/><circle cx="248" cy="132" r="6"/><circle cx="222" cy="126" r="4"/></g>'''
    return f'<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">{common}{plant}{obj}{bulb}</svg>'

def phone(chat_html, s=1.25, bottom=False):
    return f'''<div class="phone" style="--s:{s}"><div class="scr"><div class="zoom">
      <div class="sb"><span>7:00</span><div class="isl"></div><span>
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#fff"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#fff"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff"/></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="#fff"/></svg></span></div>
      <div class="hd"><span class="back">‹</span><div class="av">О!</div><div><b>О! Пригодится · бот</b><small>бот</small></div></div>
      <div class="chat {'bottom' if bottom else ''}">{chat_html}</div></div></div></div>'''

def msg(text, me=False, t="7:00"): return f'<div class="m {"me" if me else ""}">{esc(text)}<span class="t">{t}</span></div>'
def photo(cap, kind="mug"): return f'<div class="m ph">{illus(kind)}<div class="cap">{esc(cap)}</div></div>'
def kb(rows): return '<div class="kb">' + ''.join('<div class="r">' + ''.join(f'<span>{esc(b)}</span>' for b in r) + '</div>' for r in rows) + '</div>'
DRAFT_KB = [["✅ Опубликовать", "🕒 Отложить"], ["✏️ Правка", "🖼 Другое фото"], ["❌ Отклонить"]]

POST1 = """О! А ВЫ ЗНАЛИ, ЧТО ГУБКУ ДЛЯ ПОСУДЫ МОЖНО «ОБНОВИТЬ» ЗА МИНУТУ? 🧽

Бывало у вас такое: губка ещё целая, а запах уже не радует?

✅ Промойте и отожмите губку
✅ Положите во влажном виде в микроволновку на 1 минуту
✅ Дайте остыть 5 минут

Сохраняйте, чтобы не потерять!
А как часто вы меняете губку? 👇"""

POST2 = """ХИТРОСТЬ, КОТОРАЯ СЭКОНОМИТ ВАМ 10 МИНУТ УТРОМ ☕️

Бывало у вас такое: кофе ещё не готов, а вы уже опаздываете?

💡 С вечера насыпьте кофе в турку
💡 Поставьте кружку рядом с плитой
💡 Утром останется только включить огонь

Отправьте тем, кто вечно спешит по утрам!"""

N = 6
def card(kick, title, text, body, n):
    return f'''<html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="glow"></div>
      <div class="tag">{n}/{N}</div><div class="top"><div class="kick">{kick}</div><h1>{title}</h1><p>{text}</p></div>{body}</body></html>'''
one = lambda chat, bottom=False: f'<div class="ph-wrap">{phone(chat, 1.25, bottom)}</div>'

cards = {
 "1_cover": card("Сделал бота для сообщества ВК", "Контент-завод<br>«О! Пригодится»",
   "Каждое утро бот сам пишет посты с фото — остаётся только одобрить.",
   one('<div class="sys">Сегодня</div>' + photo("🖼 Пост 1/2 · Дом и уют: губка для посуды", "kitchen") + msg(POST1) + kb(DRAFT_KB)), "1"),
 "2_morning": card("Каждый день в 07:00", "Два готовых поста<br>к утреннему кофе",
   "Текст в стиле группы, разные рубрики, без повторов тем.",
   one(photo("🖼 Пост 2/2 · Разумная экономия: утро без спешки", "mug") + msg(POST2) + kb(DRAFT_KB)), "2"),
 "3_edit": card("Правка", "Пишу, что поменять —<br>бот переписывает",
   "Короче, теплее, другой заголовок — обычным сообщением.",
   one(msg("✏️ Правка поста «Утро без спешки».\n\nНапиши, что изменить в тексте — перепишу.") +
       msg("сделай заголовок с «О!» и добавь пункт про будильник", me=True, t="7:04") +
       msg("О! ТРИ МИНУТЫ ВЕЧЕРОМ — И УТРО БЕЗ СПЕШКИ ☕️\n\n💡 Насыпьте кофе в турку\n💡 Поставьте кружку у плиты\n⏰ Заведите будильник на 10 минут раньше\n\nОтправьте тем, кто вечно спешит!", t="7:04") +
       kb(DRAFT_KB)), "3"),
 "4_photo": card("Фото", "Не зашла картинка?<br>Одна кнопка",
   "Или пишу пожелание: «фото: больше растений» — бот перерисует.",
   one(msg("фото: больше зелени и тёплый свет", me=True, t="7:06") + msg("🎨 Рисую новое фото…", t="7:06") +
       photo("🖼 Новое фото · Утро без спешки", "mug") + kb(DRAFT_KB)), "4"),
 "5_publish": card("Публикация", "Сейчас или<br>в нужное время",
   "Бот присылает готовые фото и текст — пост в группе за полминуты.",
   one(msg("🕒 Когда напомнить опубликовать «Губка для посуды»?", t="7:08") +
       kb([["Сегодня в 12:00"], ["Сегодня в 15:00"], ["Сегодня в 18:00"]]) +
       msg("⏰ Напомню сегодня в 18:00 и пришлю готовые фото и текст.", t="7:08") +
       msg("✅ Папа опубликовал пост «Утро без спешки».", t="7:12") +
       kb([["📲 Открыть группу в ВК"]])), "5"),
 "6_tech": card("Под капотом", "Работает сам,<br>24/7 и бесплатно",
   "Компьютер не нужен — бот живёт в облаке.",
   f'''<div class="tiles">
     <div class="tile"><div class="ic">☁️</div><b>Cloudflare Workers</b><p>Бот в облаке: расписание, очередь задач, хранилище. <span class="acc">0 ₽</span> в месяц.</p></div>
     <div class="tile"><div class="ic">✍️</div><b>Тексты — Gemini</b><p>Пишет в стиле группы. Если сервис перегружен — <span class="acc">3 запасные модели</span>.</p></div>
     <div class="tile"><div class="ic">🎨</div><b>Фото — FLUX</b><p>Уютные сцены в цветах бренда, под тему каждого поста.</p></div>
     <div class="tile"><div class="ic">👥</div><b>Для двоих</b><p>Посты приходят мне и папе, кто первый одобрил — тот и выложил.</p></div>
     <div class="tile"><div class="ic">🛡</div><b>Надёжность</b><p>Автоповторы, защита от дублей, сообщения об ошибках.</p></div>
     <div class="tile"><div class="ic">⚡️</div><b>Команды</b><p><span class="acc">/new</span> — посты сейчас, <span class="acc">/new тема</span> — на свою тему.</p></div>
   </div>''', "6"),
}

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=2)
    for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
    for k, h in cards.items():
        open("/tmp/vk_t.html", "w").write(h)
        pg.goto("file:///tmp/vk_t.html"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/{k}.jpg", type="jpeg", quality=92)
    br.close()
print("ok", sorted(os.listdir(OUT)))
