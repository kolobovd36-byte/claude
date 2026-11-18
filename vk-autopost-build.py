#!/usr/bin/env python3
"""Generates vk_autopost_n8n.json — an n8n workflow (import via Workflows → Import from file)."""
import json, uuid, sys, pathlib

STYLE = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8") if len(sys.argv) > 1 else ""
OUT = sys.argv[2] if len(sys.argv) > 2 else "vk_autopost_n8n.json"

CFG = "$('Настройки').first().json.cfg"
TG = "https://api.telegram.org/bot{{ " + CFG + ".TG_TOKEN }}"

nodes, conns = [], {}


def node(name, typ, ver, params, pos, **extra):
    n = {"parameters": params, "id": str(uuid.uuid4()), "name": name, "type": typ,
         "typeVersion": ver, "position": pos}
    n.update(extra)
    nodes.append(n)
    return name


def link(a, b, out=0):
    conns.setdefault(a, {"main": []})
    while len(conns[a]["main"]) <= out:
        conns[a]["main"].append([])
    conns[a]["main"][out].append({"node": b, "type": "main", "index": 0})


def code(name, js, pos):
    return node(name, "n8n-nodes-base.code", 2, {"jsCode": js.strip()}, pos)


def http(name, pos, method="GET", url="", json_body=None, form=None, multipart=None,
         auth_expr=None, response=None, timeout=None, retry=False, continue_on_error=False):
    p = {"method": method, "url": url}
    if auth_expr:
        p["sendHeaders"] = True
        p["headerParameters"] = {"parameters": [{"name": "Authorization", "value": auth_expr}]}
    if json_body is not None:
        p.update({"sendBody": True, "specifyBody": "json", "jsonBody": json_body})
    if form is not None:
        p.update({"sendBody": True, "contentType": "form-urlencoded",
                  "bodyParameters": {"parameters": [{"name": k, "value": v} for k, v in form]}})
    if multipart is not None:
        params = []
        for k, v, is_bin in multipart:
            if is_bin:
                params.append({"parameterType": "formBinaryData", "name": k, "inputDataFieldName": v})
            else:
                params.append({"name": k, "value": v})
        p.update({"sendBody": True, "contentType": "multipart-form-data",
                  "bodyParameters": {"parameters": params}})
    opts = {}
    if response:
        opts["response"] = {"response": response}
    if timeout:
        opts["timeout"] = timeout
    p["options"] = opts
    extra = {}
    if retry:
        extra.update({"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000})
    if continue_on_error:
        extra["onError"] = "continueRegularOutput"
    return node(name, "n8n-nodes-base.httpRequest", 4.2, p, pos, **extra)


# ---------------------------------------------------------------- triggers + config
node("Каждый день 07:00", "n8n-nodes-base.scheduleTrigger", 1.2,
     {"rule": {"interval": [{"field": "cronExpression", "expression": "0 7 * * *"}]}}, [0, 0])
node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2,
     {"updates": ["message", "callback_query"], "additionalFields": {}}, [0, 300],
     webhookId=str(uuid.uuid4()))

CONFIG_JS = r"""
// ============ НАСТРОЙКИ — заполни перед запуском ============
const cfg = {
  // Telegram
  TG_TOKEN: 'ВСТАВЬ_ТОКЕН_БОТА',            // от @BotFather (тот же, что в credential Telegram Trigger)
  ADMIN_CHAT_ID: '',                        // твой chat_id — бот сам пришлёт его на /start

  // ВКонтакте
  VK_GROUP_ID: '243091521',                 // id сообщества (без минуса)
  VK_USER_TOKEN: 'ВСТАВЬ_VK_ТОКЕН',         // токен админа группы с правами wall, photos, groups, offline
  VK_API_VERSION: '5.199',

  // Текстовая нейросеть (любой OpenAI-совместимый API: OpenRouter, OpenAI, ProxyAPI и т.д.)
  LLM_BASE_URL: 'https://openrouter.ai/api/v1',
  LLM_API_KEY: 'ВСТАВЬ_КЛЮЧ',
  LLM_MODEL: 'google/gemini-2.5-flash',

  // Картинки
  // IMAGE_MODE: 'openrouter' — модели с картинками через chat/completions (напр. google/gemini-2.5-flash-image)
  //             'openai'     — /images/generations (gpt-image-1, dall-e-3, ProxyAPI)
  IMAGE_MODE: 'openrouter',
  IMAGE_BASE_URL: 'https://openrouter.ai/api/v1',
  IMAGE_API_KEY: 'ВСТАВЬ_КЛЮЧ',
  IMAGE_MODEL: 'google/gemini-2.5-flash-image',
  IMAGE_SIZE: '1024x1024',                  // только для IMAGE_MODE 'openai'

  POSTS_PER_DAY: 2,
  STYLE_GUIDE: __STYLE__,
};
// ============================================================
const ev = $input.first().json;
const isTg = !!(ev.message || ev.callback_query);
return [{ json: { cfg, source: isTg ? 'telegram' : 'schedule', update: isTg ? ev : null } }];
""".replace("__STYLE__", json.dumps(STYLE, ensure_ascii=False))
code("Настройки", CONFIG_JS, [240, 150])
link("Каждый день 07:00", "Настройки")
link("Telegram Trigger", "Настройки")

# shared JS helpers (inlined into nodes that need them)
HELPERS = r"""
function genBody(cfg, count, recent, avoid) {
  const sys = cfg.STYLE_GUIDE + `

ФОРМАТ ОТВЕТА: строго JSON без пояснений:
{"posts":[{"topic":"короткая тема","text":"готовый текст поста для ВК","image_prompt":"detailed English prompt for the photo"}]}
Правила:
- Каждый пост — отдельная тема, темы не пересекаются между собой.
- text — полностью готов к публикации: без заголовков вида "Пост 1", без markdown (**, #), без кавычек вокруг.
- image_prompt — на английском, подробно описывает фото по правилам визуального стиля выше. Никакого текста, букв и логотипов на изображении.`;
  const today = new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'long', day: 'numeric', month: 'long' });
  const user = `Сегодня ${today}. Напиши ${count} ${count === 1 ? 'пост' : 'поста'} на разные темы.`
    + (recent.length ? `\nНЕ повторяй недавние темы: ${recent.join('; ')}.` : '')
    + (avoid ? `\nЭта тема была отклонена, возьми совсем другую: ${avoid}.` : '');
  return { model: cfg.LLM_MODEL, temperature: 0.9, response_format: { type: 'json_object' },
           messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] };
}
"""

ROUTER_JS = HELPERS + r"""
const { cfg, source, update } = $input.first().json;
const s = $getWorkflowStaticData('global');
s.drafts = s.drafts || {};
s.topics = s.topics || [];
const now = Date.now();
for (const [k, d] of Object.entries(s.drafts)) if (now - d.created > 7 * 864e5) delete s.drafts[k];

const out = (o) => [{ json: { action: 'ignore', ...o } }];
const reply = (text, extra = {}) => out({ action: 'reply', reply: text, ...extra });
const generate = (count, avoid) =>
  out({ action: 'generate', count, llm_body: genBody(cfg, count, s.topics.slice(-30), avoid) });

if (source === 'schedule') return generate(cfg.POSTS_PER_DAY);

const cb = update.callback_query;
const msg = update.message;
const chatId = String(cb ? cb.message.chat.id : (msg && msg.chat && msg.chat.id) || '');
const cbId = cb ? cb.id : null;

if (!cfg.ADMIN_CHAT_ID) {
  return reply(`Твой chat_id: ${chatId}\nВставь его в ADMIN_CHAT_ID в узле «Настройки» и сохрани workflow.`, { chat_id: chatId, cb_id: cbId });
}
if (chatId !== String(cfg.ADMIN_CHAT_ID)) return out({ action: 'ignore', cb_id: cbId });

// ---------- кнопки
if (cb) {
  const [act, id] = String(cb.data || '').split(':');
  const d = s.drafts[id];
  const base = { cb_id: cbId, id };
  if (act === 'regen') return [{ json: { ...generate(1, d ? d.topic : '')[0].json, cb_id: cbId } }];
  if (!d) return reply('Этот черновик уже не найден (старше 7 дней?). /new — сделать новые посты.', base);
  if (act === 'ok') {
    if (d.status === 'published') return reply('Этот пост уже опубликован ✅', base);
    if (!d.file_id) return reply('У поста нет фото — нажми «🖼 Другое фото» или пришли своё через «✏️ Правка».', base);
    return out({ action: 'publish', ...base, text: d.text, file_id: d.file_id });
  }
  if (act === 'edit') {
    s.awaiting = id;
    return reply(`✏️ Правка поста «${d.topic}».\n\nНапиши, что изменить в тексте — перепишу.\nНачни с «фото:», чтобы перерисовать картинку (можно добавить пожелания).\nИли просто пришли своё фото.\n/cancel — отмена.`, base);
  }
  if (act === 'img') return out({ action: 'image', ...base, image_prompt: d.image_prompt });
  if (act === 'no') {
    d.status = 'rejected';
    if (s.awaiting === id) s.awaiting = null;
    return reply(`❌ Пост «${d.topic}» отклонён.`, { ...base,
      reply_markup: { inline_keyboard: [[{ text: '🔁 Сделать другой пост', callback_data: 'regen:' + id }]] } });
  }
  return out({ action: 'ignore', cb_id: cbId });
}

// ---------- сообщения
const text = (msg.text || msg.caption || '').trim();
if (/^\/(start|help)/.test(text)) {
  return reply('Привет! Каждый день в 07:00 по МСК я присылаю 2 готовых поста с фото.\n\n✅ Опубликовать — сразу в группу ВК\n✏️ Правка — переписать текст / заменить фото\n🖼 Другое фото — перерисовать картинку\n❌ Отклонить — можно попросить другой пост\n\n/new — сгенерировать посты прямо сейчас');
}
if (/^\/new/.test(text)) return generate(cfg.POSTS_PER_DAY);
if (/^\/cancel/.test(text)) { s.awaiting = null; return reply('Ок, правку отменил.'); }

const id = s.awaiting;
const d = id && s.drafts[id];
if (!d) return reply('Нажми кнопку под постом или отправь /new, чтобы сделать новые посты.');

if (msg.photo && msg.photo.length) {
  d.file_id = msg.photo[msg.photo.length - 1].file_id;
  s.awaiting = null;
  return out({ action: 'preview_text', id, text: d.text });
}
if (!text) return reply('Пришли текст правки или фото.');

const m = text.match(/^фото\s*[:\-—]?\s*(.*)$/is);
if (m) {
  s.awaiting = null;
  const wish = m[1].trim();
  if (wish) d.image_prompt = d.image_prompt + '. Additional wishes (translate to visuals): ' + wish;
  return out({ action: 'image', id, image_prompt: d.image_prompt });
}

s.awaiting = null;
const llm_body = { model: cfg.LLM_MODEL, temperature: 0.7, messages: [
  { role: 'system', content: cfg.STYLE_GUIDE + '\n\nТы редактируешь готовый пост. Верни ТОЛЬКО новый текст поста целиком, без пояснений, без кавычек и без markdown.' },
  { role: 'user', content: `Текущий пост:\n---\n${d.text}\n---\n\nПравка: ${text}` },
]};
return out({ action: 'rewrite', id, llm_body });
"""
code("Роутер", ROUTER_JS, [480, 150])
link("Настройки", "Роутер")

# answer callback (removes the spinner on buttons); harmless getMe otherwise
http("TG: ответ на кнопку", [720, -100],
     url="={{ $json.cb_id ? 'https://api.telegram.org/bot' + " + CFG + ".TG_TOKEN + '/answerCallbackQuery?callback_query_id=' + $json.cb_id : 'https://api.telegram.org/bot' + " + CFG + ".TG_TOKEN + '/getMe' }}",
     continue_on_error=True)
link("Роутер", "TG: ответ на кнопку")

ACTIONS = ["generate", "rewrite", "image", "publish", "preview_text", "reply"]
node("Что делаем?", "n8n-nodes-base.switch", 3.2,
     {"mode": "expression", "numberOutputs": len(ACTIONS) + 1,
      "output": "={{ " + json.dumps(ACTIONS) + ".indexOf($json.action) === -1 ? " + str(len(ACTIONS)) +
                " : " + json.dumps(ACTIONS) + ".indexOf($json.action) }}",
      "options": {}}, [720, 150])
link("Роутер", "Что делаем?")

LLM_URL = "={{ " + CFG + ".LLM_BASE_URL }}/chat/completions"
LLM_AUTH = "=Bearer {{ " + CFG + ".LLM_API_KEY }}"

# ---------------------------------------------------------------- 0: generate
http("LLM: написать посты", [960, -60], method="POST", url=LLM_URL, auth_expr=LLM_AUTH,
     json_body="={{ JSON.stringify($json.llm_body) }}", timeout=180000, retry=True)
link("Что делаем?", "LLM: написать посты", 0)

PARSE_JS = r"""
const s = $getWorkflowStaticData('global');
s.drafts = s.drafts || {}; s.topics = s.topics || [];
let raw = $input.first().json.choices?.[0]?.message?.content || '';
raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
let posts;
try { posts = JSON.parse(raw).posts; } catch (e) {
  const m = raw.match(/\{[\s\S]*\}/); posts = m ? JSON.parse(m[0]).posts : null;
}
if (!Array.isArray(posts) || !posts.length) throw new Error('Нейросеть вернула не JSON: ' + raw.slice(0, 300));
const want = $('Роутер').first().json.count || posts.length;
return posts.slice(0, want).map((p, i) => {
  const id = Date.now().toString(36) + i;
  s.drafts[id] = { topic: p.topic, text: p.text, image_prompt: p.image_prompt, file_id: null, status: 'draft', created: Date.now() };
  s.topics.push(p.topic); s.topics = s.topics.slice(-60);
  return { json: { id, image_prompt: p.image_prompt } };
});
"""
code("Разобрать посты", PARSE_JS, [1200, -60])
link("LLM: написать посты", "Разобрать посты")

# ---------------------------------------------------------------- image chain (shared)
IMGREQ_JS = r"""
const cfg = $('Настройки').first().json.cfg;
return $input.all().map(it => {
  const { id, image_prompt } = it.json;
  let img_url, img_body;
  if (cfg.IMAGE_MODE === 'openai') {
    img_url = cfg.IMAGE_BASE_URL + '/images/generations';
    img_body = { model: cfg.IMAGE_MODEL, prompt: image_prompt, size: cfg.IMAGE_SIZE, n: 1 };
    if (/^dall-e/.test(cfg.IMAGE_MODEL)) img_body.response_format = 'b64_json';
  } else {
    img_url = cfg.IMAGE_BASE_URL + '/chat/completions';
    img_body = { model: cfg.IMAGE_MODEL, modalities: ['image', 'text'],
      messages: [{ role: 'user', content: 'Generate a photo. No text, letters or logos in the image. ' + image_prompt }] };
  }
  return { json: { id, img_url, img_body } };
});
"""
code("Фото: запрос", IMGREQ_JS, [1440, 150])
link("Разобрать посты", "Фото: запрос")
link("Что делаем?", "Фото: запрос", 2)

http("Фото: генерация", [1680, 150], method="POST", url="={{ $json.img_url }}",
     auth_expr="=Bearer {{ " + CFG + ".IMAGE_API_KEY }}",
     json_body="={{ JSON.stringify($json.img_body) }}", timeout=180000, retry=True)
link("Фото: запрос", "Фото: генерация")

TOFILE_JS = r"""
const reqs = $('Фото: запрос').all();
const s = $getWorkflowStaticData('global');
return $input.all().map((it, i) => {
  const r = it.json;
  const id = reqs[i].json.id;
  let b64 = r.data?.[0]?.b64_json;
  if (!b64) {
    const msg = r.choices?.[0]?.message || {};
    const url = msg.images?.[0]?.image_url?.url || msg.images?.[0]?.url
      || (Array.isArray(msg.content) ? msg.content.find(c => c.type === 'image_url')?.image_url?.url : null);
    if (url && url.startsWith('data:')) b64 = url.split(',')[1];
  }
  if (!b64) throw new Error('Не получил картинку от API: ' + JSON.stringify(r).slice(0, 400));
  const topic = s.drafts?.[id]?.topic || '';
  return { json: { id, caption: '🖼 ' + topic },
           binary: { photo: { data: b64, mimeType: 'image/png', fileName: id + '.png', fileExtension: 'png' } } };
});
"""
code("Фото: в файл", TOFILE_JS, [1920, 150])
link("Фото: генерация", "Фото: в файл")

http("TG: отправить фото", [2160, 150], method="POST", url="=" + TG + "/sendPhoto",
     multipart=[("chat_id", "={{ " + CFG + ".ADMIN_CHAT_ID }}", False),
                ("caption", "={{ $json.caption }}", False),
                ("photo", "photo", True)], timeout=120000, retry=True)
link("Фото: в файл", "TG: отправить фото")

SAVE_JS = r"""
const s = $getWorkflowStaticData('global');
const src = $('Фото: в файл').all();
return $input.all().map((it, i) => {
  const id = src[i].json.id;
  const photos = it.json.result?.photo || [];
  const d = s.drafts[id];
  if (d && photos.length) d.file_id = photos[photos.length - 1].file_id;
  return { json: { id, text: d ? d.text : '(черновик не найден)' } };
});
"""
code("Сохранить фото в черновик", SAVE_JS, [2400, 150])
link("TG: отправить фото", "Сохранить фото в черновик")

KB = ("{ inline_keyboard: [[{ text: '✅ Опубликовать', callback_data: 'ok:' + $json.id }],"
      "[{ text: '✏️ Правка', callback_data: 'edit:' + $json.id }, { text: '🖼 Другое фото', callback_data: 'img:' + $json.id }],"
      "[{ text: '❌ Отклонить', callback_data: 'no:' + $json.id }]] }")
http("TG: текст + кнопки", [2640, 150], method="POST", url="=" + TG + "/sendMessage",
     json_body="={{ JSON.stringify({ chat_id: " + CFG + ".ADMIN_CHAT_ID, text: $json.text, reply_markup: " + KB + " }) }}",
     retry=True)
link("Сохранить фото в черновик", "TG: текст + кнопки")
link("Что делаем?", "TG: текст + кнопки", 4)

# ---------------------------------------------------------------- 1: rewrite
http("LLM: правка текста", [960, 360], method="POST", url=LLM_URL, auth_expr=LLM_AUTH,
     json_body="={{ JSON.stringify($json.llm_body) }}", timeout=180000, retry=True)
link("Что делаем?", "LLM: правка текста", 1)
APPLY_JS = r"""
const s = $getWorkflowStaticData('global');
const id = $('Роутер').first().json.id;
let t = ($input.first().json.choices?.[0]?.message?.content || '').trim();
t = t.replace(/^```\w*\s*/, '').replace(/```$/, '').trim();
if (!t) throw new Error('Пустой ответ нейросети');
s.drafts[id].text = t;
return [{ json: { id, text: t } }];
"""
code("Применить правку", APPLY_JS, [1200, 360])
link("LLM: правка текста", "Применить правку")
link("Применить правку", "TG: текст + кнопки")

# ---------------------------------------------------------------- 3: publish to VK
VK = "https://api.vk.com/method/"
R = "$('Роутер').first().json"
http("VK: сервер загрузки", [960, 600],
     url="=" + VK + "photos.getWallUploadServer?group_id={{ " + CFG + ".VK_GROUP_ID }}&v={{ " + CFG +
         ".VK_API_VERSION }}&access_token={{ " + CFG + ".VK_USER_TOKEN }}", continue_on_error=True)
link("Что делаем?", "VK: сервер загрузки", 3)
http("TG: getFile", [1200, 600], url="=" + TG + "/getFile?file_id={{ " + R + ".file_id }}", continue_on_error=True)
link("VK: сервер загрузки", "TG: getFile")
http("TG: скачать фото", [1440, 600],
     url="=https://api.telegram.org/file/bot{{ " + CFG + ".TG_TOKEN }}/{{ $json.result.file_path }}",
     response={"responseFormat": "file", "outputPropertyName": "photo"}, continue_on_error=True)
link("TG: getFile", "TG: скачать фото")
http("VK: загрузить фото", [1680, 600], method="POST",
     url="={{ $('VK: сервер загрузки').first().json.response.upload_url }}",
     multipart=[("photo", "photo", True)], response={"responseFormat": "json"},
     timeout=120000, continue_on_error=True)
link("TG: скачать фото", "VK: загрузить фото")
VKAUTH = [("access_token", "={{ " + CFG + ".VK_USER_TOKEN }}"), ("v", "={{ " + CFG + ".VK_API_VERSION }}")]
http("VK: сохранить фото", [1920, 600], method="POST", url=VK + "photos.saveWallPhoto",
     form=[("group_id", "={{ " + CFG + ".VK_GROUP_ID }}"), ("server", "={{ $json.server }}"),
           ("photo", "={{ $json.photo }}"), ("hash", "={{ $json.hash }}")] + VKAUTH, continue_on_error=True)
link("VK: загрузить фото", "VK: сохранить фото")
http("VK: опубликовать", [2160, 600], method="POST", url=VK + "wall.post",
     form=[("owner_id", "=-{{ " + CFG + ".VK_GROUP_ID }}"), ("from_group", "1"),
           ("message", "={{ " + R + ".text }}"),
           ("attachments", "=photo{{ $json.response[0].owner_id }}_{{ $json.response[0].id }}")] + VKAUTH,
     continue_on_error=True)
link("VK: сохранить фото", "VK: опубликовать")

DONE_JS = r"""
const cfg = $('Настройки').first().json.cfg;
const r = $('Роутер').first().json;
const s = $getWorkflowStaticData('global');
const steps = ['VK: сервер загрузки', 'TG: getFile', 'VK: загрузить фото', 'VK: сохранить фото', 'VK: опубликовать'];
let err = null;
for (const n of steps) {
  let j;
  try { j = $(n).first().json; } catch (e) { err = `${n}: шаг не выполнился`; break; }
  if (!j) { err = `${n}: пустой ответ`; break; }
  if (j.error) { err = `${n}: ` + (j.error.error_msg || j.error.message || JSON.stringify(j.error)); break; }
  if (j.ok === false) { err = `${n}: ` + (j.description || 'ошибка Telegram'); break; }
  if (n === 'VK: загрузить фото' && (!j.photo || j.photo === '[]')) { err = 'VK не принял фото при загрузке'; break; }
}
if (err) return [{ json: { reply: '⚠️ Не получилось опубликовать.\n' + err + '\n\nЧерновик сохранён — можно нажать «✅ Опубликовать» ещё раз.' } }];
const postId = $('VK: опубликовать').first().json.response.post_id;
if (s.drafts[r.id]) { s.drafts[r.id].status = 'published'; s.drafts[r.id].vk_post = postId; }
return [{ json: { reply: `✅ Опубликовано!\nhttps://vk.com/wall-${cfg.VK_GROUP_ID}_${postId}` } }];
"""
code("Итог публикации", DONE_JS, [2400, 600])
link("VK: опубликовать", "Итог публикации")

# ---------------------------------------------------------------- 5: plain reply
http("TG: ответ", [2640, 600], method="POST", url="=" + TG + "/sendMessage",
     json_body="={{ JSON.stringify(Object.assign({ chat_id: $json.chat_id || " + CFG +
               ".ADMIN_CHAT_ID, text: $json.reply }, $json.reply_markup ? { reply_markup: $json.reply_markup } : {})) }}",
     continue_on_error=True)
link("Что делаем?", "TG: ответ", 5)
link("Итог публикации", "TG: ответ")

wf = {"name": "VK автопостинг через Telegram", "nodes": nodes, "connections": conns,
      "settings": {"executionOrder": "v1", "timezone": "Europe/Moscow"}, "pinData": {}, "active": False}
pathlib.Path(OUT).write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding="utf-8")
print("ok", len(nodes), "nodes ->", OUT)
