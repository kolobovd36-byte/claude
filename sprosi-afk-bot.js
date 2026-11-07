// «Спроси AFK» — Telegram-бот «Вопрос-ответ» для канала PC_AFK (t.me/pc_afk)
// Работает бесплатно на Cloudflare Workers. ИИ-ответы — бесплатный тариф Google Gemini.
//
// Переменные (Settings → Variables and Secrets):
//   BOT_TOKEN       — токен бота от @BotFather (secret)
//   WEBHOOK_SECRET  — любая строка из латиницы, цифр, _ и - (secret)
//   ADMIN_ID        — числовой Telegram ID автора канала (ему приходят вопросы)
//   GEMINI_API_KEY  — ключ Gemini API (secret, необязательно: без него бот просто собирает вопросы)
//   GEMINI_MODEL    — модель Gemini (необязательно, по умолчанию gemini-flash-latest; быстрее — gemini-flash-lite-latest)
//   DAILY_LIMIT     — сколько вопросов в день можно одному человеку (необязательно, по умолчанию 5)
//   WEB_SEARCH      — off, чтобы отключить поиск Google при ответах (необязательно, по умолчанию включён)
// KV-хранилище: привязка с именем DB (Settings → Bindings → KV namespace).

const SYSTEM_PROMPT = `Ты — помощник Telegram-канала PC_AFK про компьютеры, железо и гаджеты.
Отвечай по-русски, дружелюбно и по делу, можно немного юмора.
Пиши коротко: 4–8 предложений, без воды.
Если спрашивают, что выбрать (видеокарту, процессор, мышку и т. п.), дай конкретную рекомендацию и коротко объясни почему.
Цены называй только как примерные и предупреждай, что они быстро меняются.
Если не уверен или не знаешь модель — честно так и скажи, не выдумывай характеристики.
Не используй markdown-разметку: никаких звёздочек, решёток и таблиц. Списки — через дефис.
Если вопрос не про компьютеры, комплектующие, игры на ПК или технику — вежливо скажи, что ты отвечаешь только на такие вопросы.
В самом конце ответа, отдельной строкой после пустой строки, всегда пиши короткий вердикт — одно предложение до 15 слов, начиная с «🏁 Вердикт:». Например: «🏁 Вердикт: бери RTX 5060 — она новее и тянет DLSS 4.» Если вопрос не по теме, вердикт не пиши.`;

const START_TEXT = `Привет! Я «Спроси AFK» — бот канала PC_AFK 🖥

Задай любой вопрос про ПК: что выбрать, как собрать, почему греется, стоит ли апгрейдиться.
Я сразу отвечу с помощью ИИ, а вопрос передам автору канала — самые интересные разберём в рубрике «Вопрос-ответ» в видео 🎬

Просто напиши вопрос одним сообщением 👇`;

const HELP_TEXT = `Как задать вопрос:
- пиши одним сообщением;
- укажи бюджет и для чего ПК (игры, монтаж, учёба), если речь о выборе железа;
- можно до {LIMIT} вопросов в день.

Ответ ИИ может ошибаться — автор канала тоже увидит твой вопрос.
Канал: https://t.me/pc_afk`;

const ADMIN_HELP = `Команды автора:
/list — последние вопросы
/rubric — вопросы, отмеченные ⭐ для рубрики
/stats — сколько всего вопросов
/facts — твои актуальные заметки для ИИ (цены, советы, новинки). /facts текст — сохранить, /facts_clear — удалить

Чтобы ответить человеку лично — ответь (Reply) на уведомление о его вопросе.`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Разовая настройка вебхука: открыть в браузере https://<worker>/setup?key=<WEBHOOK_SECRET>
    if (request.method === "GET" && url.pathname === "/setup") {
      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const webhook = await tg(env, "setWebhook", {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"],
      });
      await tg(env, "setMyCommands", {
        commands: [
          { command: "start", description: "Начать" },
          { command: "help", description: "Как задать вопрос" },
        ],
      });
      return Response.json({ webhook });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const update = await request.json();
      ctx.waitUntil(
        handleUpdate(update, env).catch((e) => console.log("error:", (e && e.stack) || e))
      );
      return new Response("ok");
    }

    return new Response("Спроси AFK работает ✅");
  },
};

// ---------- Обработка сообщений ----------

async function handleUpdate(update, env) {
  if (update.callback_query) return onCallback(update.callback_query, env);

  const m = update.message;
  if (!m || m.chat.type !== "private") return;

  const chatId = m.chat.id;
  const isAdmin = String(m.from.id) === String(env.ADMIN_ID);
  const text = (m.text || "").trim();

  if (isAdmin && m.reply_to_message) return onAdminReply(m, env);

  if (text.startsWith("/start")) {
    await send(env, chatId, START_TEXT);
    if (isAdmin) await send(env, chatId, ADMIN_HELP);
    return;
  }
  if (text.startsWith("/help")) {
    await send(env, chatId, HELP_TEXT.replace("{LIMIT}", String(dailyLimit(env))));
    if (isAdmin) await send(env, chatId, ADMIN_HELP);
    return;
  }
  if (isAdmin && text.startsWith("/list")) return listQuestions(env, chatId, false);
  if (isAdmin && text.startsWith("/rubric")) return listQuestions(env, chatId, true);
  if (isAdmin && text.startsWith("/facts_clear")) {
    await env.DB.delete("facts");
    return send(env, chatId, "🗑 Заметки для ИИ удалены.");
  }
  if (isAdmin && text.startsWith("/facts")) {
    const newFacts = text.replace(/^\/facts(@\w+)?/, "").trim();
    if (!newFacts) {
      const current = await env.DB.get("facts");
      return send(
        env,
        chatId,
        current
          ? `📝 Текущие заметки для ИИ:\n\n${current}\n\nЧтобы заменить — отправь /facts и новый текст. Удалить — /facts_clear`
          : "Заметок пока нет. Отправь /facts и текст, например:\n/facts Сейчас лучшая карта за свои деньги — RTX 5060 Ti 16GB. 4060 Ti уже не советуем."
      );
    }
    if (newFacts.length > 3000) return send(env, chatId, "Слишком длинно — уложись в 3000 символов.");
    await env.DB.put("facts", newFacts);
    return send(env, chatId, "✅ Заметки сохранены. ИИ будет учитывать их в каждом ответе.");
  }
  if (isAdmin && text.startsWith("/stats")) {
    const total = parseInt((await env.DB.get("total")) || "0", 10);
    return send(env, chatId, `Всего вопросов: ${total}`);
  }

  if (!text) return send(env, chatId, "Пока я понимаю только текст — напиши вопрос словами 🙂");
  if (text.startsWith("/")) return send(env, chatId, "Не знаю такой команды. Просто напиши свой вопрос 👇");

  return onQuestion(m, text, isAdmin, env);
}

async function onQuestion(m, text, isAdmin, env) {
  const chatId = m.chat.id;

  if (text.length < 5) return send(env, chatId, "Опиши вопрос чуть подробнее 🙂");
  if (text.length > 1500) return send(env, chatId, "Слишком длинно 😅 Уложись, пожалуйста, в 1500 символов.");

  // Лимит вопросов в день — бережём бесплатный тариф ИИ
  const limit = dailyLimit(env);
  const limKey = `lim:${m.from.id}:${new Date().toISOString().slice(0, 10)}`;
  const used = parseInt((await env.DB.get(limKey)) || "0", 10);
  if (!isAdmin && used >= limit) {
    return send(env, chatId, `На сегодня лимит — ${limit} вопросов. Возвращайся завтра! 👋`);
  }
  await env.DB.put(limKey, String(used + 1), { expirationTtl: 60 * 60 * 26 });

  // Сразу показываем, что бот работает, а потом заменяем это сообщение готовым ответом
  const thinking = await tg(env, "sendMessage", { chat_id: chatId, text: "🤔 Думаю над ответом… (до 20 секунд)" });
  const thinkingId = thinking && thinking.ok ? thinking.result.message_id : null;

  let answer = null;
  try {
    answer = await askGemini(text, env);
  } catch (e) {
    console.log("gemini error:", (e && e.message) || e);
  }

  const q = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: m.from.id,
    chatId,
    name: [m.from.first_name, m.from.last_name].filter(Boolean).join(" "),
    username: m.from.username || null,
    text,
    answer,
    date: new Date().toISOString(),
    starred: false,
  };
  await env.DB.put(`q:${q.id}`, JSON.stringify(q));
  await pushRecent(env, q.id);
  const total = parseInt((await env.DB.get("total")) || "0", 10);
  await env.DB.put("total", String(total + 1));

  const reply = answer
    ? `${answer}\n\n— — —\n🤖 Это ответ ИИ, он может ошибаться. Твой вопрос передан автору канала — лучшие разберём в рубрике «Вопрос-ответ».`
    : "Принял вопрос! ✅ ИИ сейчас отдыхает, но автор канала увидит вопрос и может ответить лично или в рубрике «Вопрос-ответ».";
  const edited = thinkingId
    ? await tg(env, "editMessageText", {
        chat_id: chatId,
        message_id: thinkingId,
        text: short(reply, 4000),
        disable_web_page_preview: true,
      })
    : null;
  if (!edited || !edited.ok) await send(env, chatId, reply);

  await notifyAdmin(env, q);
}

async function notifyAdmin(env, q) {
  if (!env.ADMIN_ID) return;
  const who = q.username ? `@${q.username}` : q.name || `id ${q.userId}`;
  const aiPart = q.answer ? `\n\n🤖 ИИ ответил:\n${short(q.answer, 1200)}` : "\n\n🤖 ИИ не ответил.";
  const res = await tg(env, "sendMessage", {
    chat_id: env.ADMIN_ID,
    text: `❓ Новый вопрос от ${who}:\n${q.text}${aiPart}\n\n↩️ Ответь на это сообщение, чтобы написать человеку лично.`,
    reply_markup: starKeyboard(q),
  });
  if (res && res.ok) {
    await env.DB.put(`msg:${res.result.message_id}`, q.id, { expirationTtl: 60 * 60 * 24 * 60 });
  }
}

async function onAdminReply(m, env) {
  const adminChat = m.chat.id;
  const qid = await env.DB.get(`msg:${m.reply_to_message.message_id}`);
  if (!qid) {
    return send(env, adminChat, "Не понял, к какому вопросу это ответ. Отвечай (Reply) именно на уведомление о вопросе.");
  }
  const q = JSON.parse((await env.DB.get(`q:${qid}`)) || "null");
  if (!q) return send(env, adminChat, "Этот вопрос не найден — возможно, он устарел.");
  if (!m.text) return send(env, adminChat, "Пока можно отвечать только текстом.");

  const res = await tg(env, "sendMessage", {
    chat_id: q.chatId,
    text: `📩 Ответ от автора канала PC_AFK на твой вопрос «${short(q.text, 200)}»:\n\n${m.text}`,
  });
  return send(
    env,
    adminChat,
    res && res.ok ? "✅ Ответ отправлен." : "⚠️ Не получилось отправить — возможно, человек заблокировал бота."
  );
}

async function onCallback(cq, env) {
  const [action, id] = (cq.data || "").split(":");
  if (String(cq.from.id) !== String(env.ADMIN_ID) || action !== "star") {
    return tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
  }
  const q = JSON.parse((await env.DB.get(`q:${id}`)) || "null");
  if (!q) return tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Вопрос не найден" });

  q.starred = !q.starred;
  await env.DB.put(`q:${id}`, JSON.stringify(q));
  await tg(env, "answerCallbackQuery", {
    callback_query_id: cq.id,
    text: q.starred ? "⭐ Добавлено в рубрику" : "Убрано из рубрики",
  });
  if (cq.message) {
    await tg(env, "editMessageReplyMarkup", {
      chat_id: cq.message.chat.id,
      message_id: cq.message.message_id,
      reply_markup: starKeyboard(q),
    });
  }
}

async function listQuestions(env, chatId, onlyStarred) {
  const ids = JSON.parse((await env.DB.get("recent")) || "[]");
  const lines = [];
  for (const id of ids) {
    const q = JSON.parse((await env.DB.get(`q:${id}`)) || "null");
    if (!q || (onlyStarred && !q.starred)) continue;
    const who = q.username ? `@${q.username}` : q.name || "аноним";
    lines.push(`${lines.length + 1}. ${q.starred ? "⭐ " : ""}${who}: ${short(q.text, 160)}`);
    if (lines.length >= 20) break;
  }
  if (!lines.length) {
    return send(env, chatId, onlyStarred ? "В рубрике пока пусто. Отмечай вопросы кнопкой ⭐." : "Вопросов пока нет.");
  }
  const title = onlyStarred ? "⭐ Вопросы для рубрики:" : "Последние вопросы:";
  return send(env, chatId, `${title}\n\n${lines.join("\n\n")}`);
}

// ---------- ИИ ----------

async function askGemini(question, env) {
  if (!env.GEMINI_API_KEY) return null;

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  });
  let system =
    SYSTEM_PROMPT +
    `\nСегодня ${today}. Твои собственные знания могут быть устаревшими. ` +
    `Если вопрос про актуальные модели, цены, новинки или «что сейчас лучше» — опирайся на свежие результаты поиска, а не на память.`;
  const facts = await env.DB.get("facts");
  if (facts) system += `\n\nАктуальные заметки автора канала (они важнее твоих знаний и результатов поиска):\n${facts}`;

  // Общий лимит ожидания — 22 секунды, иначе Cloudflare может оборвать обработку и бот промолчит
  const deadline = Date.now() + 22000;
  const useSearch = env.WEB_SEARCH !== "off";
  try {
    return await callGemini(question, system, useSearch, env, deadline);
  } catch (e) {
    // Если поиск недоступен (лимит, неподдерживаемая модель) — пробуем без него, пока есть время
    if (useSearch && !e.timeout && deadline - Date.now() > 6000) {
      console.log("search failed, retry without search:", e.message);
      return callGemini(question, system, false, env, deadline);
    }
    throw e;
  }
}

async function callGemini(question, system, useSearch, env, deadline) {
  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, deadline - Date.now()));
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: question }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  };
  if (useSearch) body.tools = [{ google_search: {} }];

  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = new Error(`Gemini fetch failed: ${e.message}`);
    err.timeout = controller.signal.aborted;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const out = parts.map((p) => p.text || "").join("").trim();
  return out ? cleanText(out) : null;
}

// ---------- Утилиты ----------

function tg(env, method, body) {
  return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

function send(env, chatId, text) {
  return tg(env, "sendMessage", { chat_id: chatId, text: short(text, 4000), disable_web_page_preview: true });
}

function starKeyboard(q) {
  return {
    inline_keyboard: [[{ text: q.starred ? "✅ В рубрике (убрать)" : "⭐ В рубрику", callback_data: `star:${q.id}` }]],
  };
}

async function pushRecent(env, id) {
  const ids = JSON.parse((await env.DB.get("recent")) || "[]");
  ids.unshift(id);
  await env.DB.put("recent", JSON.stringify(ids.slice(0, 100)));
}

function dailyLimit(env) {
  return parseInt(env.DAILY_LIMIT || "5", 10);
}

function short(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function cleanText(s) {
  return short(s.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/^\*\s+/gm, "- "), 3500);
}
