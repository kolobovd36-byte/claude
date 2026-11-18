// «О! Пригодится» — бот-автопостер для сообщества ВК (vk.com/club243091521)
// Работает бесплатно на Cloudflare Workers:
//   - каждый день в 07:00 МСК (Cron Trigger "0 4 * * *" — это 04:00 UTC) присылает 2 готовых поста с фото;
//   - под постом кнопки: ✅ Опубликовать / ✏️ Правка / 🖼 Другое фото / ❌ Отклонить;
//   - «Опубликовать» сразу выкладывает пост в группу ВК от имени сообщества.
// Тексты — бесплатный Google Gemini, картинки — бесплатный Cloudflare Workers AI (FLUX).
//
// Переменные (Settings → Variables and Secrets):
//   BOT_TOKEN       — токен бота от @BotFather (secret)
//   WEBHOOK_SECRET  — 8–256 символов: латиница, цифры, _ и - (secret)
//   ADMIN_ID        — твой числовой Telegram ID (бот покажет его на /start)
//   GEMINI_API_KEY  — ключ Gemini API (secret)
//   GEMINI_MODEL    — необязательно, по умолчанию gemini-flash-latest
//   VK_CLIENT_ID    — ID приложения VK ID (id.vk.com → «Для бизнеса»), Redirect URL: https://<worker>/vk-callback
//   VK_TOKEN        — необязательно: готовый токен ВК вместо входа через VK ID (secret)
//   VK_GROUP_ID     — id группы без минуса, по умолчанию 243091521
//   POSTS_PER_DAY   — необязательно, по умолчанию 2
// Привязки (Settings → Bindings):
//   KV namespace с именем DB, Workers AI с именем AI.
// Триггер: Settings → Triggers → Cron Triggers → "0 4 * * *".
// После деплоя один раз открыть: https://<worker>/setup?key=<WEBHOOK_SECRET>
// и войти в ВК: https://<worker>/vk-login?key=<WEBHOOK_SECRET> (или командой /vk в боте)

const STYLE_GUIDE = `Ты — автор постов для сообщества ВКонтакте «О! Пригодится» — копилка полезных хитростей и находок для повседневной жизни. Слоган: полезное может быть ещё и интересным. Аудитория — в основном женщины 25–55, которые ведут дом, любят уют и разумную экономию.

РУБРИКИ (каждый пост — одна рубрика, два поста в день — всегда разные рубрики, чередуй):
1. Дом и уют — маленькие бытовые хитрости: уборка, кухня, хранение, стирка, уход за растениями.
2. Полезные находки — необычные недорогие вещи для дома, о которых мало кто знает (описывай тип вещи и чем полезна, без брендов, ссылок и цен в рублях).
3. Разумная экономия — как тратить меньше без потери удобства: продукты, коммуналка, покупки.
4. Секреты техники — полезные скрытые функции смартфона, бытовой техники, мессенджеров (только реально существующие функции, без выдумок).
5. А вы знали? — неожиданные факты из быта и простые решения, которые хочется сразу попробовать.

ПОДАЧА (как в постах сообщества):
- Первая строка — цепляющий заголовок ЗАГЛАВНЫМИ буквами с эмодзи, часто с «О!» или вопросом («О! А ВЫ ЗНАЛИ, ЧТО…», «ХИТРОСТЬ, КОТОРАЯ СЭКОНОМИТ ВАМ 10 МИНУТ»).
- Дальше — узнаваемая жизненная ситуация («Бывало у вас такое: …»), потом сама польза.
- Обращение на «вы», тёплый дружеский тон, лёгкая эмоциональность, никаких скучных лекций и канцелярита.
- Способы и шаги — короткими пунктами, каждый пункт начинается с эмодзи (✅ 🏠 💡 🛒 🧺 🌿 📱 и т.п.).
- Короткие абзацы по 1–3 предложения, между абзацами пустая строка.
- Длина 600–1100 символов.
- Ближе к концу — призыв сохранить пост или отправить близким («Сохраняйте, чтобы не потерять!»).
- Последняя строка — вопрос к подписчикам, чтобы писали в комментариях.
- Без markdown (никаких ** и #), без хэштегов. Советы только безопасные и проверенные, без медицинских рекомендаций.

ВИЗУАЛЬНЫЙ СТИЛЬ ФОТО (как обложка и посты группы):
- Уютная реалистичная фотосцена дома: тёплый мягкий дневной свет, светлое дерево, плетёные корзинки, комнатные растения в зелени, вязаный плед, белая керамика.
- Палитра бренда: тёплый оранжевый, сочный зелёный, солнечно-жёлтый, кремовый.
- В кадре — предмет или ситуация из поста, крупно и понятно, композиция чистая.
- Стиль: яркий, позитивный, «как с обложки журнала о доме», без людей с лицами крупным планом.`;

const PHOTO_SUFFIX =
  ", cozy realistic home photography, warm soft daylight, light wood, wicker baskets, green houseplants, knitted blanket, white ceramics, warm orange, fresh green and sunny yellow accents, magazine quality, sharp focus, no text, no letters, no logos, no watermark";

const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const DRAFT_TTL = 60 * 60 * 24 * 7; // черновики живут 7 дней
const VK_V = "5.199";

const HELP_TEXT = `Привет! Я бот сообщества «О! Пригодится» 💡

Каждый день в 07:00 по МСК присылаю 2 готовых поста с фото. Под каждым кнопки:
✅ Опубликовать — сразу выложу в группу ВК
✏️ Правка — перепишу текст по твоему комментарию или заменю фото
🖼 Другое фото — нарисую новую картинку
❌ Отклонить — можно попросить другой пост

/new — сделать посты прямо сейчас
/cancel — отменить правку
/vk — подключить ВКонтакте`;

const seenUpdates = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!isValidSecret(env.WEBHOOK_SECRET)) {
      return new Response("Бот не настроен: задай WEBHOOK_SECRET (8–256 символов: латиница, цифры, _ и -)", { status: 500 });
    }

    if (request.method === "GET" && url.pathname === "/setup") {
      if (!safeEqual(url.searchParams.get("key"), env.WEBHOOK_SECRET)) return new Response("forbidden", { status: 403 });
      await env.DB.put("origin", url.origin);
      const webhook = await tg(env, "setWebhook", {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"],
        max_connections: 5,
      });
      await tg(env, "setMyCommands", {
        commands: [
          { command: "new", description: "Сделать посты сейчас" },
          { command: "cancel", description: "Отменить правку" },
          { command: "vk", description: "Подключить ВКонтакте" },
          { command: "start", description: "Помощь" },
        ],
      });
      return Response.json({ webhook, checks: selfCheck(env) });
    }

    if (request.method === "GET" && url.pathname === "/vk-login") {
      if (!safeEqual(url.searchParams.get("key"), env.WEBHOOK_SECRET)) return new Response("forbidden", { status: 403 });
      if (!env.VK_CLIENT_ID) return new Response("Не задан VK_CLIENT_ID", { status: 500 });
      return Response.redirect(await vkLoginUrl(env, url.origin), 302);
    }

    if (request.method === "GET" && url.pathname === "/vk-callback") {
      try {
        await vkFinishLogin(env, url);
        if (env.ADMIN_ID) await send(env, env.ADMIN_ID, "✅ ВКонтакте подключён — теперь посты публикуются в группу.");
        return htmlPage("✅ ВКонтакте подключён", "Можно закрыть эту вкладку и вернуться в Telegram.");
      } catch (e) {
        return htmlPage("⚠️ Не получилось", short(e.message, 300), 400);
      }
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      if (!safeEqual(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), env.WEBHOOK_SECRET)) {
        return new Response("forbidden", { status: 403 });
      }
      let update;
      try {
        update = await request.json();
      } catch {
        return new Response("ok");
      }
      if (isDuplicate(update.update_id)) return new Response("ok");
      ctx.waitUntil(safeHandle(update, env));
      return new Response("ok");
    }

    return new Response("О! Пригодится — бот работает ✅");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      generate(env, postsPerDay(env)).catch((e) => notifyError(env, "Утренняя генерация не удалась", e))
    );
  },
};

function selfCheck(env) {
  return {
    BOT_TOKEN: Boolean(env.BOT_TOKEN),
    ADMIN_ID: Boolean(env.ADMIN_ID),
    GEMINI_API_KEY: Boolean(env.GEMINI_API_KEY),
    VK_CLIENT_ID: Boolean(env.VK_CLIENT_ID),
    VK_TOKEN: Boolean(env.VK_TOKEN),
    KV_DB: Boolean(env.DB),
    WORKERS_AI: Boolean(env.AI),
  };
}

// ---------- Telegram ----------

async function safeHandle(update, env) {
  try {
    await handleUpdate(update, env);
  } catch (e) {
    await notifyError(env, "Ошибка", e);
  }
}

async function handleUpdate(update, env) {
  const cq = update.callback_query;
  const m = update.message;
  const chatId = cq ? cq.message && cq.message.chat.id : m && m.chat && m.chat.id;
  if (cq) tg(env, "answerCallbackQuery", { callback_query_id: cq.id }); // убираем «часики» на кнопке

  if (!env.ADMIN_ID) {
    if (chatId) await send(env, chatId, `Твой Telegram ID: ${chatId}\nВпиши его в переменную ADMIN_ID воркера.`);
    return;
  }
  if (String(chatId) !== String(env.ADMIN_ID).trim()) return; // бот только для владельца

  if (cq) return onButton(cq, env);
  if (!m) return;

  const text = (m.text || m.caption || "").trim();
  if (/^\/(start|help)\b/.test(text)) return send(env, chatId, HELP_TEXT);
  if (/^\/new\b/.test(text)) {
    await send(env, chatId, "⏳ Пишу посты и рисую фото, это займёт около минуты…");
    return generate(env, postsPerDay(env));
  }
  if (/^\/vk\b/.test(text)) {
    if (!env.VK_CLIENT_ID) return send(env, chatId, "Сначала нужно задать VK_CLIENT_ID в настройках воркера.");
    const origin = await env.DB.get("origin");
    if (!origin) return send(env, chatId, "Сначала открой /setup воркера.");
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "Нажми, чтобы подключить ВКонтакте (войди под аккаунтом-админом группы):",
      reply_markup: { inline_keyboard: [[{ text: "🔑 Войти через VK ID", url: `${origin}/vk-login?key=${env.WEBHOOK_SECRET}` }]] },
    });
  }
  if (/^\/cancel\b/.test(text)) {
    await env.DB.delete("awaiting");
    return send(env, chatId, "Ок, правку отменил.");
  }

  const id = await env.DB.get("awaiting");
  const d = id && (await getDraft(env, id));
  if (!d) return send(env, chatId, "Нажми кнопку под постом или отправь /new, чтобы сделать новые посты.");

  if (m.photo && m.photo.length) {
    d.file_id = m.photo[m.photo.length - 1].file_id;
    await saveDraft(env, d);
    await env.DB.delete("awaiting");
    return sendDraftText(env, d, "📷 Фото заменил на твоё. Вот пост:");
  }
  if (!text) return send(env, chatId, "Пришли текст правки или фото.");
  await env.DB.delete("awaiting");

  const photoWish = /^фото\s*[:\-—]?\s*([\s\S]*)$/i.exec(text);
  if (photoWish) {
    const wish = photoWish[1].trim();
    if (wish) d.image_prompt = await translatePrompt(env, d.image_prompt, wish);
    await send(env, chatId, "🎨 Рисую новое фото…");
    return redrawPhoto(env, d);
  }

  await send(env, chatId, "✍️ Переписываю…");
  const newText = await gemini(env, {
    system: STYLE_GUIDE + "\n\nТы редактируешь готовый пост. Верни ТОЛЬКО новый текст поста целиком, без пояснений, без кавычек и без markdown.",
    user: `Текущий пост:\n---\n${d.text}\n---\n\nПравка: ${text}`,
    temperature: 0.7,
  });
  if (!newText) throw new Error("Gemini вернул пустой ответ");
  d.text = cleanText(newText);
  await saveDraft(env, d);
  return sendDraftText(env, d);
}

async function onButton(cq, env) {
  const chatId = cq.message.chat.id;
  const [act, id] = String(cq.data || "").split(":");

  if (act === "regen") {
    const old = await getDraft(env, id);
    await send(env, chatId, "⏳ Делаю другой пост…");
    return generate(env, 1, old && old.topic);
  }

  const d = await getDraft(env, id);
  if (!d) return send(env, chatId, "Этот черновик уже не найден (старше 7 дней?). /new — сделать новые посты.");

  if (act === "ok") {
    if (d.status === "published") return send(env, chatId, "Этот пост уже опубликован ✅");
    if (d.status === "publishing") return send(env, chatId, "Уже публикую, подожди пару секунд…");
    if (!d.file_id) return send(env, chatId, "У поста нет фото — нажми «🖼 Другое фото» или пришли своё через «✏️ Правка».");
    d.status = "publishing";
    await saveDraft(env, d);
    try {
      const postId = await publishToVk(env, d);
      d.status = "published";
      d.vk_post = postId;
      await saveDraft(env, d);
      return send(env, chatId, `✅ Опубликовано!\nhttps://vk.com/wall-${groupId(env)}_${postId}`);
    } catch (e) {
      d.status = "draft";
      await saveDraft(env, d);
      return send(env, chatId, `⚠️ Не получилось опубликовать: ${short(e.message, 300)}\n\nЧерновик сохранён — можно нажать «✅ Опубликовать» ещё раз.`);
    }
  }

  if (act === "edit") {
    await env.DB.put("awaiting", id, { expirationTtl: DRAFT_TTL });
    return send(
      env,
      chatId,
      `✏️ Правка поста «${d.topic}».\n\nНапиши, что изменить в тексте — перепишу.\nНачни с «фото:», чтобы перерисовать картинку (можно с пожеланиями, например «фото: больше растений»).\nИли просто пришли своё фото.\n/cancel — отмена.`
    );
  }

  if (act === "img") {
    await send(env, chatId, "🎨 Рисую другое фото…");
    return redrawPhoto(env, d);
  }

  if (act === "no") {
    d.status = "rejected";
    await saveDraft(env, d);
    if ((await env.DB.get("awaiting")) === id) await env.DB.delete("awaiting");
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: `❌ Пост «${d.topic}» отклонён.`,
      reply_markup: { inline_keyboard: [[{ text: "🔁 Сделать другой пост", callback_data: "regen:" + id }]] },
    });
  }
}

// ---------- Генерация ----------

async function generate(env, count, avoidTopic) {
  const topics = await getJSON(env, "topics", []);
  const today = new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", weekday: "long", day: "numeric", month: "long" });
  const raw = await gemini(env, {
    system:
      STYLE_GUIDE +
      `\n\nФОРМАТ ОТВЕТА — строго JSON:
{"posts":[{"topic":"короткая тема (рубрика: тема)","text":"готовый текст поста","image_prompt":"English prompt for the photo"}]}
- text полностью готов к публикации, без markdown и хэштегов.
- image_prompt — на английском, 1–2 предложения: что именно в кадре (предмет или сцена из поста). Без текста и надписей в кадре.`,
    user:
      `Сегодня ${today}. Напиши ${count} ${count === 1 ? "пост" : "поста"} на разные темы из разных рубрик.` +
      (topics.length ? `\nНЕ повторяй недавние темы: ${topics.slice(-30).join("; ")}.` : "") +
      (avoidTopic ? `\nТема «${avoidTopic}» была отклонена — возьми совсем другую.` : ""),
    json: true,
    temperature: 0.95,
  });
  const posts = parsePosts(raw).slice(0, count);
  if (!posts.length) throw new Error("Gemini вернул не JSON: " + short(raw, 200));

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const d = {
      id: Date.now().toString(36) + i,
      topic: short(String(p.topic || "Пост"), 80),
      text: cleanText(String(p.text || "")),
      image_prompt: String(p.image_prompt || p.topic || "cozy home"),
      file_id: null,
      status: "draft",
    };
    topics.push(d.topic);
    await saveDraft(env, d);
    await sendPhotoForDraft(env, d, `🖼 Пост ${i + 1}/${posts.length} · ${d.topic}`);
    await sendDraftText(env, d);
  }
  await env.DB.put("topics", JSON.stringify(topics.slice(-60)));
}

async function redrawPhoto(env, d) {
  await sendPhotoForDraft(env, d, `🖼 Новое фото · ${d.topic}`);
  return sendDraftText(env, d);
}

async function sendPhotoForDraft(env, d, caption) {
  let bytes;
  try {
    bytes = await makeImage(env, d.image_prompt);
  } catch (e) {
    console.log("image error:", e && e.message);
    await send(env, env.ADMIN_ID, `⚠️ Не получилось нарисовать фото (${short(e.message, 150)}). Нажми «🖼 Другое фото» или пришли своё через «✏️ Правка».`);
    return;
  }
  const form = new FormData();
  form.append("chat_id", String(env.ADMIN_ID));
  form.append("caption", caption);
  form.append("photo", new Blob([bytes], { type: "image/jpeg" }), "photo.jpg");
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`, { method: "POST", body: form });
  const j = await r.json().catch(() => ({}));
  const photos = (j.result && j.result.photo) || [];
  if (photos.length) {
    d.file_id = photos[photos.length - 1].file_id;
    await saveDraft(env, d);
  } else {
    console.log("sendPhoto failed:", j.description);
  }
}

function sendDraftText(env, d, header) {
  return tg(env, "sendMessage", {
    chat_id: env.ADMIN_ID,
    text: short((header ? header + "\n\n" : "") + d.text, 4000),
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Опубликовать", callback_data: "ok:" + d.id }],
        [
          { text: "✏️ Правка", callback_data: "edit:" + d.id },
          { text: "🖼 Другое фото", callback_data: "img:" + d.id },
        ],
        [{ text: "❌ Отклонить", callback_data: "no:" + d.id }],
      ],
    },
  });
}

async function makeImage(env, prompt) {
  if (!env.AI) throw new Error("нет привязки Workers AI (AI)");
  const res = await env.AI.run(IMAGE_MODEL, { prompt: short(prompt, 1500) + PHOTO_SUFFIX, steps: 8 });
  if (!res || !res.image) throw new Error("Workers AI не вернул картинку");
  const bin = atob(res.image);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function translatePrompt(env, oldPrompt, wish) {
  const out = await gemini(env, {
    system: "You edit image-generation prompts. Reply with ONLY the new English prompt, 1–2 sentences, no quotes.",
    user: `Current prompt: ${oldPrompt}\nUser wishes (Russian): ${wish}`,
    temperature: 0.4,
  }).catch(() => null);
  return out ? short(out.replace(/^["']|["']$/g, ""), 1000) : `${oldPrompt}. ${wish}`;
}

function parsePosts(raw) {
  if (!raw) return [];
  let s = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    const j = JSON.parse(s);
    return Array.isArray(j) ? j : j.posts || [];
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    try {
      return m ? JSON.parse(m[0]).posts || [] : [];
    } catch {
      return [];
    }
  }
}

async function gemini(env, { system, user, json = false, temperature = 0.8 }) {
  if (!env.GEMINI_API_KEY) throw new Error("не задан GEMINI_API_KEY");
  const model = /^[\w.-]{1,64}$/.test(env.GEMINI_MODEL || "") ? env.GEMINI_MODEL : "gemini-flash-latest";
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature, maxOutputTokens: 8192 },
  };
  if (json) body.generationConfig.responseMimeType = "application/json";
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${short(await res.text(), 200)}`);
      const data = await res.json();
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      const out = parts.filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
      if (out) return out;
      lastErr = new Error("Gemini вернул пустой ответ");
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw lastErr;
}

// ---------- ВКонтакте ----------

async function vk(env, method, params) {
  const body = new URLSearchParams({ ...params, access_token: await vkToken(env), v: VK_V });
  const r = await fetch(`https://api.vk.com/method/${method}`, { method: "POST", body });
  const j = await r.json();
  if (j.error) throw new Error(`ВК ${method}: ${j.error.error_msg} (код ${j.error.error_code})`);
  return j.response;
}

async function publishToVk(env, d) {
  const gid = groupId(env);

  // 1) скачиваем фото из Telegram
  const f = await tg(env, "getFile", { file_id: d.file_id });
  if (!f.ok) throw new Error("Telegram getFile: " + (f.description || "ошибка"));
  const imgRes = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`);
  if (!imgRes.ok) throw new Error("не скачалось фото из Telegram");
  const img = await imgRes.arrayBuffer();

  // 2) загружаем на сервер ВК
  const server = await vk(env, "photos.getWallUploadServer", { group_id: gid });
  const form = new FormData();
  form.append("photo", new Blob([img], { type: "image/jpeg" }), "photo.jpg");
  const up = await (await fetch(server.upload_url, { method: "POST", body: form })).json();
  if (!up.photo || up.photo === "[]") throw new Error("ВК не принял фото при загрузке");
  const saved = await vk(env, "photos.saveWallPhoto", { group_id: gid, server: up.server, photo: up.photo, hash: up.hash });
  const ph = saved[0];

  // 3) публикуем
  const post = await vk(env, "wall.post", {
    owner_id: `-${gid}`,
    from_group: 1,
    message: d.text,
    attachments: `photo${ph.owner_id}_${ph.id}`,
  });
  return post.post_id;
}

// ---------- Вход через VK ID (OAuth 2.1 + PKCE), токен продлевается сам ----------

const VK_ID = "https://id.vk.com";
const VK_SCOPE = "wall photos groups";

async function vkLoginUrl(env, origin) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  await env.DB.put("vk_pkce:" + state, verifier, { expirationTtl: 900 });
  const q = new URLSearchParams({
    response_type: "code",
    client_id: String(env.VK_CLIENT_ID),
    scope: VK_SCOPE,
    redirect_uri: origin + "/vk-callback",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${VK_ID}/authorize?${q}`;
}

async function vkFinishLogin(env, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const deviceId = url.searchParams.get("device_id");
  if (!code || !deviceId) throw new Error("ВК не вернул код входа. Попробуй ещё раз: /vk в боте.");
  if (!/^[\w-]{10,100}$/.test(state)) throw new Error("Неверный state");
  const verifier = await env.DB.get("vk_pkce:" + state);
  if (!verifier) throw new Error("Ссылка входа устарела. Нажми /vk в боте ещё раз.");
  await env.DB.delete("vk_pkce:" + state);
  const tok = await vkIdToken(env, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    device_id: deviceId,
    redirect_uri: url.origin + "/vk-callback",
    state,
  });
  await saveVkAuth(env, tok, deviceId);
}

async function vkIdToken(env, params) {
  const r = await fetch(`${VK_ID}/oauth2/auth`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: String(env.VK_CLIENT_ID), ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error("VK ID: " + (j.error_description || j.error || `HTTP ${r.status}`));
  return j;
}

function saveVkAuth(env, tok, deviceId) {
  return env.DB.put(
    "vk_auth",
    JSON.stringify({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      device_id: deviceId,
      expires_at: Date.now() + (Number(tok.expires_in) || 3600) * 1000,
      user_id: tok.user_id,
    })
  );
}

async function vkToken(env) {
  const a = await getJSON(env, "vk_auth", null);
  if (!a) {
    if (env.VK_TOKEN) return env.VK_TOKEN;
    throw new Error("ВКонтакте не подключён — отправь боту /vk и войди через VK ID");
  }
  if (Date.now() < a.expires_at - 120000) return a.access_token;
  if (!a.refresh_token) throw new Error("токен ВК истёк — отправь боту /vk и войди заново");
  try {
    const tok = await vkIdToken(env, {
      grant_type: "refresh_token",
      refresh_token: a.refresh_token,
      device_id: a.device_id,
      state: b64url(crypto.getRandomValues(new Uint8Array(16))),
    });
    await saveVkAuth(env, { ...tok, refresh_token: tok.refresh_token || a.refresh_token }, a.device_id);
    return tok.access_token;
  } catch (e) {
    throw new Error(`не удалось продлить вход в ВК (${e.message}) — отправь боту /vk и войди заново`);
  }
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function htmlPage(title, text, status = 200) {
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>` +
      `<body style="font-family:system-ui;background:#fffaf0;display:grid;place-items:center;min-height:90vh;margin:0">` +
      `<div style="text-align:center;padding:24px"><h1 style="color:#e8711a">${esc(title)}</h1><p style="font-size:18px">${esc(text)}</p></div>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

// ---------- Утилиты ----------

async function getDraft(env, id) {
  if (!id || !/^[\w]{1,40}$/.test(id)) return null;
  return getJSON(env, "d:" + id, null);
}

function saveDraft(env, d) {
  return env.DB.put("d:" + d.id, JSON.stringify(d), { expirationTtl: DRAFT_TTL });
}

async function getJSON(env, key, fallback) {
  try {
    const v = JSON.parse((await env.DB.get(key)) || "null");
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

async function tg(env, method, body) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    console.log(`telegram ${method} failed:`, (e && e.message) || e);
    return { ok: false, description: "network error" };
  }
}

function send(env, chatId, text) {
  return tg(env, "sendMessage", { chat_id: chatId, text: short(text, 4000), disable_web_page_preview: true });
}

async function notifyError(env, title, e) {
  console.log(title, (e && e.stack) || e);
  if (env.ADMIN_ID) await send(env, env.ADMIN_ID, `⚠️ ${title}: ${short((e && e.message) || String(e), 300)}`).catch(() => {});
}

function groupId(env) {
  return String(env.VK_GROUP_ID || "243091521").replace(/\D/g, "");
}

function postsPerDay(env) {
  const n = parseInt(env.POSTS_PER_DAY || "2", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 5) : 2;
}

function isValidSecret(s) {
  return typeof s === "string" && /^[A-Za-z0-9_-]{8,256}$/.test(s);
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < eb.length; i++) diff |= (ea[i] || 0) ^ eb[i];
  return diff === 0;
}

function isDuplicate(updateId) {
  if (typeof updateId !== "number") return false;
  if (seenUpdates.has(updateId)) return true;
  seenUpdates.set(updateId, Date.now());
  while (seenUpdates.size > 500) seenUpdates.delete(seenUpdates.keys().next().value);
  return false;
}

function short(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function cleanText(s) {
  return short(String(s).replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/#[\wа-яё]+/gi, "").trim(), 3800);
}
