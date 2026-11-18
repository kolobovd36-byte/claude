// «О! Пригодится» — бот-автопостер для сообщества ВК (vk.com/club243091521)
// Работает бесплатно и круглосуточно на Cloudflare Workers (компьютер не нужен):
//   - каждый день в 07:00 МСК присылает в Telegram готовые посты с фото;
//   - кнопки: ✅ Опубликовать / 🕒 Отложить / ✏️ Правка / 🖼 Другое фото / ❌ Отклонить;
//   - публикует в группу ВК от имени сообщества (текст + фото), сразу или в выбранное время.
// Тексты — Google Gemini (при перегрузке — запасные модели и нейросеть Cloudflare),
// картинки — Cloudflare Workers AI (FLUX). Всё на бесплатных тарифах.
//
// Переменные (Settings → Variables and Secrets):
//   BOT_TOKEN       — токен бота от @BotFather (secret)
//   WEBHOOK_SECRET  — 8–256 символов: латиница, цифры, _ и - (secret)
//   ADMIN_ID        — Telegram ID владельцев через запятую (бот покажет ID на /start), напр. 111,222
//   GEMINI_API_KEY  — ключ Gemini API (secret)
//   GEMINI_MODEL    — необязательно, по умолчанию gemini-flash-latest
//   VK_CLIENT_ID    — ID приложения VK ID; Redirect URL в нём: https://<worker>/vk-callback
//   VK_GROUP_TOKEN  — ключ доступа сообщества (права: стена, фотографии, сообщения) — основной способ публикации (secret)
//   VK_TOKEN        — необязательно: готовый токен ВК вместо входа через VK ID (secret)
//   VK_GROUP_ID     — id группы без минуса, по умолчанию 243091521
//   POSTS_PER_DAY   — необязательно, по умолчанию 2
// Привязки (Settings → Bindings):
//   KV namespace DB, Workers AI с именем AI,
//   Queue (producer) с именем JOBS; этот же воркер — consumer очереди (batch_size 1, max_retries 0, max_concurrency 1).
// Триггер: Cron "0 4 * * *" (= 07:00 МСК).
// После деплоя: открыть https://<worker>/setup?key=<WEBHOOK_SECRET>, затем /vk в боте.

const STYLE_GUIDE = `Ты — автор постов для сообщества ВКонтакте «О! Пригодится» — копилка полезных хитростей и находок для повседневной жизни. Слоган: полезное может быть ещё и интересным. Аудитория — в основном женщины 25–55, которые ведут дом, любят уют и разумную экономию.

РУБРИКИ (каждый пост — одна рубрика; если постов несколько — из разных рубрик):
1. Дом и уют — маленькие бытовые хитрости: уборка, кухня, хранение, стирка, уход за растениями.
2. Полезные находки — необычные недорогие вещи для дома, о которых мало кто знает (описывай тип вещи и чем полезна, без брендов, ссылок и цен).
3. Разумная экономия — как тратить меньше без потери удобства: продукты, коммуналка, покупки.
4. Секреты техники — полезные функции смартфона, бытовой техники, мессенджеров (только реально существующие функции, без выдумок; если не уверен — выбери другую тему).
5. А вы знали? — неожиданные факты из быта и простые решения, которые хочется сразу попробовать.

ПОДАЧА:
- Первая строка — цепляющий заголовок ЗАГЛАВНЫМИ буквами с эмодзи, часто с «О!» или вопросом.
- Дальше — узнаваемая жизненная ситуация («Бывало у вас такое: …»), потом сама польза.
- Обращение на «вы», тёплый дружеский тон, лёгкая эмоциональность, без лекций и канцелярита.
- Способы и шаги — короткими пунктами, каждый пункт с новой строки и начинается с эмодзи (✅ 🏠 💡 🛒 🧺 🌿 📱 и т.п.).
- Короткие абзацы по 1–3 предложения. Между абзацами ОБЯЗАТЕЛЬНО пустая строка.
- Длина строго 600–1100 символов.
- Ближе к концу — призыв сохранить пост или отправить близким.
- Последняя строка — вопрос к подписчикам, чтобы писали в комментариях.
- Без markdown (никаких ** и #), без хэштегов, без ссылок. Советы только безопасные и проверенные: никаких опасных смесей бытовой химии, медицинских и финансовых рекомендаций.

ПРИМЕР ПОДАЧИ (тему не повторяй, бери только стиль):
О! А ВЫ ЗНАЛИ, ЧТО ГУБКУ ДЛЯ ПОСУДЫ МОЖНО «ОБНОВИТЬ» ЗА МИНУТУ? 🧽

Бывало у вас такое: губка ещё целая, а запах уже не радует, и рука сама тянется за новой?

Есть простой способ продлить ей жизнь:

✅ Промойте губку и хорошо отожмите
✅ Положите во влажном виде в микроволновку на 1 минуту
✅ Дайте остыть 5 минут — и можно снова пользоваться

💡 А раз в 2–3 недели губку всё же лучше менять — так на кухне будет чище, а покупок меньше.

Сохраняйте, чтобы не потерять, и отправьте тем, кто тоже вечно покупает губки пачками!

А как часто вы меняете губку для посуды? 👇

ВИЗУАЛЬНЫЙ СТИЛЬ ФОТО:
- Уютная реалистичная фотосцена дома: тёплый мягкий дневной свет, светлое дерево, плетёные корзинки, комнатные растения, вязаный плед, белая керамика.
- Палитра бренда: тёплый оранжевый, сочный зелёный, солнечно-жёлтый, кремовый.
- В кадре — предмет или ситуация из поста, крупно и понятно, чистая композиция, без людей с лицами крупным планом.`;

const PHOTO_SUFFIX =
  ", cozy realistic home photography, warm soft daylight, light wood, wicker baskets, green houseplants, knitted blanket, white ceramics, warm orange, fresh green and sunny yellow accents, magazine quality, sharp focus, no text, no letters, no logos, no watermark";

const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const FALLBACK_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DRAFT_TTL = 60 * 60 * 24 * 7; // черновики живут 7 дней
const VK_V = "5.199";
const MIN_LEN = 450;
const MAX_LEN = 1400;
const SLOT_HOURS = [9, 12, 15, 18, 20]; // время для отложенной публикации (МСК)
const MSK_OFFSET = 3 * 3600 * 1000;

const HELP_TEXT = `Привет! Я бот сообщества «О! Пригодится» 💡

Каждый день в 07:00 по МСК присылаю готовые посты с фото. Под каждым кнопки:
✅ Опубликовать — сразу выложу в группу ВК (текст + фото)
🕒 Отложить — выложу в выбранное время
✏️ Правка — перепишу текст по твоему комментарию или заменю фото
🖼 Другое фото — нарисую новую картинку
❌ Отклонить — можно попросить другой пост

Команды:
/new — сделать посты прямо сейчас
/new тема — пост на свою тему (например: /new как хранить зелень)
/cancel — отменить правку
/vk — подключить или переподключить ВКонтакте
/status — проверить, всё ли работает`;

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
        drop_pending_updates: false,
      });
      await tg(env, "setMyCommands", {
        commands: [
          { command: "new", description: "Сделать посты сейчас (можно с темой)" },
          { command: "status", description: "Проверить, всё ли работает" },
          { command: "cancel", description: "Отменить правку" },
          { command: "vk", description: "Подключить ВКонтакте" },
          { command: "start", description: "Помощь" },
        ],
      });
      return Response.json({ webhook, checks: selfCheck(env) });
    }

    if (request.method === "GET" && url.pathname === "/vk-test") {
      if (!safeEqual(url.searchParams.get("key"), env.WEBHOOK_SECRET)) return new Response("forbidden", { status: 403 });
      return Response.json(await vkSelfTest(env));
    }

    // Картинка поста и страница-карточка (для вложения-ссылки в ВК)
    const pm = /^\/(img|p)\/(\w{1,40})(?:\.jpg)?$/.exec(url.pathname);
    if (request.method === "GET" && pm) {
      const d = await getDraft(env, pm[2]);
      if (!d || !d.file_id) return new Response("not found", { status: 404 });
      if (pm[1] === "img") {
        const f = await tg(env, "getFile", { file_id: d.file_id });
        if (!f.ok) return new Response("not found", { status: 404 });
        const r = await fetchT(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`, {}, 30000);
        return new Response(r.body, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=604800" } });
      }
      const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const title = esc(String(d.text || "").split("\n")[0].slice(0, 120));
      const img = `${url.origin}/img/${d.id}.jpg`;
      return new Response(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<title>${title}</title><meta property="og:title" content="${title}"><meta property="og:image" content="${img}">` +
          `<meta property="og:image:width" content="1024"><meta property="og:image:height" content="1024"><meta property="og:type" content="article">` +
          `<meta http-equiv="refresh" content="0;url=https://vk.com/club${groupId(env)}">` +
          `<body style="margin:0;background:#fffaf0"><img src="${img}" style="max-width:100%"></body>`,
        { headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    if (request.method === "GET" && url.pathname === "/vk-photo-test") {
      if (!safeEqual(url.searchParams.get("key"), env.WEBHOOK_SECRET)) return new Response("forbidden", { status: 403 });
      return Response.json(await photoAttachTest(env, url.searchParams));
    }

    if (request.method === "GET" && url.pathname === "/vk-login") {
      if (!safeEqual(url.searchParams.get("key"), env.WEBHOOK_SECRET)) return new Response("forbidden", { status: 403 });
      if (!env.VK_CLIENT_ID) return new Response("Не задан VK_CLIENT_ID", { status: 500 });
      const flow = url.searchParams.get("flow") || env.VK_FLOW || "vkid";
      return Response.redirect(flow === "vkid" ? await vkLoginUrl(env, url.origin) : await vkClassicUrl(env, url.origin), 302);
    }

    // Классический вход: токен приходит в #фрагменте адреса — страница сама передаёт его боту
    if (request.method === "POST" && url.pathname === "/vk-callback") {
      try {
        const body = await request.json();
        await vkFinishClassic(env, body);
        await broadcast(env, "✅ ВКонтакте подключён — теперь посты публикуются в группу.");
        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ ok: false, error: short(e.message, 300) }, { status: 400 });
      }
    }

    if (request.method === "GET" && url.pathname === "/vk-callback" && !url.searchParams.get("code")) {
      if (url.searchParams.get("error")) return htmlPage("⚠️ Вход отменён", url.searchParams.get("error_description") || "Попробуй ещё раз: /vk", 400);
      return classicCallbackPage();
    }

    if (request.method === "GET" && url.pathname === "/vk-callback") {
      try {
        await vkFinishLogin(env, url);
        await broadcast(env, "✅ ВКонтакте подключён — теперь посты публикуются в группу.");
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
      // Чужие апдейты отбрасываем сразу, не тратя очередь
      const chatId = updateChatId(update);
      if (admins(env).length && !isAdmin(env, chatId)) {
        if (update.callback_query) ctx.waitUntil(tg(env, "answerCallbackQuery", { callback_query_id: update.callback_query.id }));
        return new Response("ok");
      }
      if (update.callback_query) ctx.waitUntil(tg(env, "answerCallbackQuery", { callback_query_id: update.callback_query.id }));
      if (env.JOBS) {
        // Долгая работа (нейросеть, картинки, ВК) — в очереди: там до 15 минут вместо 30 секунд.
        try {
          await env.JOBS.send({ update });
          return new Response("ok");
        } catch (e) {
          console.log("queue send failed:", e && e.message);
        }
      }
      ctx.waitUntil(safeHandle(update, env));
      return new Response("ok");
    }

    return new Response("О! Пригодится — бот работает ✅");
  },

  async queue(batch, env) {
    for (const msg of batch.messages) {
      const update = msg.body && msg.body.update;
      try {
        if (update && !(await alreadyHandled(env, update.update_id))) await safeHandle(update, env);
      } finally {
        msg.ack(); // без повторов, чтобы пост не опубликовался дважды
      }
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(morningRun(env));
  },
};

async function morningRun(env) {
  // Держим вход в ВК «живым», чтобы токен не протух без публикаций
  const auth = env.VK_GROUP_TOKEN ? null : await getJSON(env, "vk_auth", null);
  if (auth) {
    try {
      if (auth.classic) await vk(env, "groups.getById", { group_id: groupId(env) });
      else await vkToken(env, true);
    } catch (e) {
      await broadcast(env, `⚠️ Вход в ВК слетел: ${short(e.message, 200)}\nОтправь /vk и войди заново, иначе публикация не сработает.`);
    }
  }
  // До 3 попыток с паузой, если нейросети перегружены
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await generate(env, postsPerDay(env));
      return;
    } catch (e) {
      if (attempt === 3) return notifyError(env, "Утренние посты не получились (3 попытки). Попробуй /new позже", e);
      await sleep(3 * 60 * 1000);
    }
  }
}

function selfCheck(env) {
  return {
    BOT_TOKEN: Boolean(env.BOT_TOKEN),
    ADMIN_ID: Boolean(env.ADMIN_ID),
    GEMINI_API_KEY: Boolean(env.GEMINI_API_KEY),
    VK_CLIENT_ID: Boolean(env.VK_CLIENT_ID),
    KV_DB: Boolean(env.DB),
    WORKERS_AI: Boolean(env.AI),
    QUEUE: Boolean(env.JOBS),
  };
}

// ---------- Telegram ----------

function updateChatId(update) {
  const cq = update.callback_query;
  const m = update.message;
  return cq ? cq.message && cq.message.chat && cq.message.chat.id : m && m.chat && m.chat.id;
}

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
  const chatId = updateChatId(update);

  if (!admins(env).length) {
    if (chatId) await send(env, chatId, `Твой Telegram ID: ${chatId}\nВпиши его в переменную ADMIN_ID воркера.`);
    return;
  }
  if (!isAdmin(env, chatId)) return; // бот только для владельцев
  const AW = "awaiting:" + chatId; // у каждого владельца своя правка

  if (cq) return onButton(cq, env);
  if (!m) return;

  const text = (m.text || m.caption || "").trim();
  const cmd = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text);
  if (cmd) {
    const name = cmd[1].toLowerCase();
    const args = (cmd[2] || "").trim();
    if (name === "start" || name === "help") return send(env, chatId, HELP_TEXT);
    if (name === "new") {
      await env.DB.delete(AW);
      await send(env, chatId, args ? `⏳ Пишу пост на тему «${short(args, 100)}»…` : "⏳ Пишу посты и рисую фото, это займёт около минуты…");
      return generate(env, args ? 1 : postsPerDay(env), null, short(args, 300));
    }
    if (name === "cancel") {
      await env.DB.delete(AW);
      return send(env, chatId, "Ок, правку отменил.");
    }
    if (name === "status") return sendStatus(env, chatId);
    if (name === "vk") return sendVkLogin(env, chatId);
    return send(env, chatId, "Не знаю такую команду. /start — список команд.");
  }

  const id = await env.DB.get(AW);
  const d = id && (await getDraft(env, id));
  if (!d) return send(env, chatId, "Нажми кнопку под постом или отправь /new, чтобы сделать новые посты.");

  if (m.photo && m.photo.length) {
    d.file_id = m.photo[m.photo.length - 1].file_id;
    await saveDraft(env, d);
    await env.DB.delete(AW);
    return sendDraftText(env, d, "📷 Фото заменил на твоё. Вот пост:");
  }
  if (!text) return send(env, chatId, "Пришли текст правки или фото.");
  await env.DB.delete(AW);

  const photoWish = /^фото\s*[:\-—]?\s*([\s\S]*)$/i.exec(text);
  if (photoWish) {
    const wish = photoWish[1].trim();
    if (wish) d.image_prompt = await translatePrompt(env, d.image_prompt, wish);
    await saveDraft(env, d);
    await send(env, chatId, "🎨 Рисую новое фото…");
    return redrawPhoto(env, d);
  }

  await send(env, chatId, "✍️ Переписываю…");
  const newText = await llm(env, {
    system:
      STYLE_GUIDE +
      "\n\nТы редактируешь готовый пост. Выполни правку пользователя, сохрани стиль и правила оформления. Верни ТОЛЬКО новый текст поста целиком, без пояснений, без кавычек и без markdown.",
    user: `Текущий пост:\n---\n${d.text}\n---\n\nПравка: ${short(text, 1500)}`,
    temperature: 0.7,
  });
  d.text = formatPost(newText);
  await saveDraft(env, d);
  return sendDraftText(env, d);
}

async function onButton(cq, env) {
  const chatId = cq.message.chat.id;
  const msgId = cq.message.message_id;
  const [act, id, arg] = String(cq.data || "").split(":");

  if (act === "regen") {
    const old = await getDraft(env, id);
    await setKeyboard(env, chatId, msgId, null);
    await send(env, chatId, "⏳ Делаю другой пост…");
    return generate(env, 1, old && old.topic);
  }

  const d = await getDraft(env, id);
  if (!d) return send(env, chatId, "Этот черновик уже не найден (старше 7 дней). /new — сделать новые посты.");

  if (act === "ok" || act === "at") {
    if (d.status === "published" || d.status === "scheduled") {
      return send(env, chatId, d.status === "published" ? "Этот пост уже опубликован ✅" : "Этот пост уже запланирован 🕒");
    }
    if (!d.file_id) return send(env, chatId, "У поста нет фото — нажми «🖼 Другое фото» или пришли своё через «✏️ Правка».");
    let when = null;
    if (act === "at") {
      when = parseInt(arg, 10);
      if (!Number.isFinite(when) || when * 1000 < Date.now() + 5 * 60 * 1000) {
        return send(env, chatId, "Это время уже прошло — нажми «🕒 Отложить» ещё раз и выбери другое.");
      }
    }
    try {
      const postId = await publishToVk(env, d, when);
      d.status = when ? "scheduled" : "published";
      d.vk_post = postId;
      d.publish_at = when;
      await saveDraft(env, d);
      const others = admins(env).filter((x) => x !== String(chatId));
      const who = (cq.from && cq.from.first_name) || "Другой владелец";
      for (const o of others) {
        await send(env, o, when ? `🕒 ${who} запланировал пост «${d.topic}» на ${fmtSlot(when)} (МСК).` : `✅ ${who} опубликовал пост «${d.topic}»:\nhttps://vk.com/wall-${groupId(env)}_${postId}`);
      }
      if (when) {
        await setKeyboard(env, chatId, msgId, null);
        return send(env, chatId, `🕒 Запланировано на ${fmtSlot(when)} (МСК). Пост появится в группе сам.\nОтложенные записи видно в группе: Записи → Отложенные.`);
      }
      const link = `https://vk.com/wall-${groupId(env)}_${postId}`;
      await setKeyboard(env, chatId, msgId, { inline_keyboard: [[{ text: "👀 Открыть пост в ВК", url: link }]] });
      return send(env, chatId, `✅ Опубликовано (текст + фото)!\n${link}`);
    } catch (e) {
      return send(env, chatId, `⚠️ Не получилось опубликовать: ${short(e.message, 300)}\n\nЧерновик сохранён — можно попробовать ещё раз.`);
    }
  }

  if (act === "when") {
    const slots = nextSlots(4);
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: `🕒 Когда опубликовать «${d.topic}»?`,
      reply_markup: {
        inline_keyboard: [
          ...slots.map((t) => [{ text: fmtSlot(t), callback_data: `at:${d.id}:${t}` }]),
        ],
      },
    });
  }

  if (act === "edit") {
    await env.DB.put("awaiting:" + chatId, id, { expirationTtl: 60 * 60 * 24 });
    return send(
      env,
      chatId,
      `✏️ Правка поста «${d.topic}».\n\nНапиши, что изменить в тексте — перепишу.\nНачни с «фото:», чтобы перерисовать картинку (например «фото: больше растений»).\nИли просто пришли своё фото.\n/cancel — отмена.`
    );
  }

  if (act === "img") {
    await send(env, chatId, "🎨 Рисую другое фото…");
    return redrawPhoto(env, d);
  }

  if (act === "no") {
    d.status = "rejected";
    await saveDraft(env, d);
    for (const a of admins(env)) if ((await env.DB.get("awaiting:" + a)) === id) await env.DB.delete("awaiting:" + a);
    await setKeyboard(env, chatId, msgId, null);
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: `❌ Пост «${d.topic}» отклонён.`,
      reply_markup: { inline_keyboard: [[{ text: "🔁 Сделать другой пост", callback_data: "regen:" + id }]] },
    });
  }
}

// Для входа VK ID: свежий токен прямо перед серией запросов (он привязан к IP, с которого получен)
async function freshVkToken(env) {
  const a = await getJSON(env, "vk_auth", null);
  if (a && !a.classic && a.refresh_token) await vkToken(env, true);
}

async function vkSelfTest(env) {
  const steps = [];
  if (env.VK_GROUP_TOKEN) {
    try {
      const perms = await vkg(env, "groups.getTokenPermissions", {});
      steps.push("group token perms: " + ((perms.permissions || []).map((p) => p.name).join(",") || perms.mask));
      const srv = await vkg(env, "photos.getMessagesUploadServer", {});
      steps.push("messages upload server ok: " + Boolean(srv.upload_url));
      return { ok: true, mode: "group", steps };
    } catch (e) {
      steps.push("ERROR: " + e.message);
      return { ok: false, mode: "group", steps };
    }
  }
  try {
    await freshVkToken(env);
    steps.push("refresh ok, scope: " + ((await getJSON(env, "vk_auth", {})).scope || "?"));
    const g = await vk(env, "groups.getById", { group_id: groupId(env) });
    steps.push("group ok: " + (((g.groups || g)[0] || {}).name || "?"));
    const srv = await vk(env, "photos.getWallUploadServer", { group_id: groupId(env) });
    steps.push("upload server ok: " + Boolean(srv.upload_url));
    return { ok: true, steps };
  } catch (e) {
    steps.push("ERROR: " + e.message);
    return { ok: false, steps };
  }
}

async function sendStatus(env, chatId) {
  const lines = ["🔎 Проверка:"];
  lines.push(env.GEMINI_API_KEY ? "✅ Ключ Gemini задан" : "❌ Нет ключа Gemini");
  lines.push(env.AI ? "✅ Генерация картинок подключена" : "❌ Нет Workers AI");
  lines.push(env.JOBS ? "✅ Очередь задач подключена" : "⚠️ Нет очереди — длинные задачи могут обрываться");
  if (env.VK_GROUP_TOKEN) {
    const t = await vkSelfTest(env);
    lines.push(t.ok ? "✅ ВКонтакте: ключ сообщества работает, публикация доступна" : `❌ ВКонтакте: ${short(t.steps[t.steps.length - 1], 200)}`);
    lines.push("⏰ Утренние посты: каждый день в 07:00 МСК");
    return send(env, chatId, lines.join("\n"));
  }
  try {
    await freshVkToken(env);
    const g = await vk(env, "groups.getById", { group_id: groupId(env) });
    const grp = (g.groups || g)[0] || {};
    await vk(env, "photos.getWallUploadServer", { group_id: groupId(env) }); // проверяем право загружать фото
    lines.push(`✅ ВКонтакте подключён, публикация доступна. Группа: ${grp.name || groupId(env)}`);
  } catch (e) {
    lines.push(`❌ ВКонтакте: ${short(e.message, 150)}`);
  }
  lines.push("⏰ Утренние посты: каждый день в 07:00 МСК");
  return send(env, chatId, lines.join("\n"));
}

async function sendVkLogin(env, chatId) {
  if (!env.VK_CLIENT_ID) return send(env, chatId, "Сначала нужно задать VK_CLIENT_ID в настройках воркера.");
  const origin = await env.DB.get("origin");
  if (!origin) return send(env, chatId, "Сначала открой /setup воркера.");
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: "Нажми, чтобы подключить ВКонтакте. Войди аккаунтом, который является руководителем группы:",
    reply_markup: { inline_keyboard: [[{ text: "🔑 Войти в ВКонтакте", url: `${origin}/vk-login?key=${env.WEBHOOK_SECRET}` }]] },
  });
}

// ---------- Генерация ----------

async function generate(env, count, avoidTopic, theme) {
  const topics = await getJSON(env, "topics", []);
  const today = new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", weekday: "long", day: "numeric", month: "long" });
  const raw = await llm(env, {
    system:
      STYLE_GUIDE +
      `\n\nФОРМАТ ОТВЕТА — строго JSON:
{"posts":[{"topic":"Рубрика: короткая тема","text":"готовый текст поста","image_prompt":"English prompt for the photo"}]}
- text полностью готов к публикации, переносы строк — через \\n, между абзацами пустая строка (\\n\\n).
- image_prompt — на английском, 1–2 предложения: что именно в кадре (предмет или сцена из поста). Без текста и надписей в кадре.`,
    user:
      `Сегодня ${today}. Учитывай сезон. Напиши ${count} ${count === 1 ? "пост" : "поста"}` +
      (theme ? ` на тему: «${theme}».` : " на разные темы из разных рубрик.") +
      (topics.length ? `\nНЕ повторяй недавние темы: ${topics.slice(-40).join("; ")}.` : "") +
      (avoidTopic ? `\nТема «${avoidTopic}» была отклонена — возьми совсем другую.` : ""),
    json: true,
    temperature: 0.95,
  });
  const posts = parsePosts(raw).filter((p) => p && p.text).slice(0, count);
  if (!posts.length) throw new Error("нейросеть вернула пустой ответ: " + short(raw, 150));

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    try {
      let text = formatPost(String(p.text));
      if (text.length < MIN_LEN || text.length > MAX_LEN) {
        // Автоматически подгоняем длину под стиль группы
        const fixed = await llm(env, {
          system: STYLE_GUIDE + "\n\nВерни ТОЛЬКО исправленный текст поста, без пояснений.",
          user: `Этот пост ${text.length < MIN_LEN ? "слишком короткий" : "слишком длинный"} (${text.length} символов). Перепиши его на 700–1000 символов, сохрани тему и стиль:\n---\n${text}`,
          temperature: 0.6,
        }).catch(() => null);
        if (fixed) text = formatPost(fixed);
      }
      const d = {
        id: Date.now().toString(36) + i,
        topic: short(String(p.topic || "Пост").replace(/\s+/g, " "), 80),
        text,
        image_prompt: short(String(p.image_prompt || p.topic || "cozy home interior"), 800),
        file_id: null,
        status: "draft",
      };
      topics.push(d.topic);
      await saveDraft(env, d);
      await sendPhotoForDraft(env, d, `🖼 ${posts.length > 1 ? `Пост ${i + 1}/${posts.length} · ` : ""}${d.topic}`);
      await sendDraftText(env, d);
    } catch (e) {
      await notifyError(env, `Пост ${i + 1} не получился`, e);
    }
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
    await broadcast(env, `⚠️ Не получилось нарисовать фото (${short(e.message, 150)}). Нажми «🖼 Другое фото» или пришли своё через «✏️ Правка».`);
    return;
  }
  const [first, ...others] = admins(env);
  const form = new FormData();
  form.append("chat_id", String(first));
  form.append("caption", short(caption, 1000));
  form.append("photo", new Blob([bytes], { type: "image/jpeg" }), "photo.jpg");
  const r = await fetchT(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`, { method: "POST", body: form }, 60000);
  const j = await r.json().catch(() => ({}));
  const photos = (j.result && j.result.photo) || [];
  if (photos.length) {
    d.file_id = photos[photos.length - 1].file_id;
    await saveDraft(env, d);
    for (const a of others) await tg(env, "sendPhoto", { chat_id: a, photo: d.file_id, caption: short(caption, 1000) });
  } else {
    await broadcast(env, `⚠️ Telegram не принял фото (${short(j.description || "ошибка", 100)}). Нажми «🖼 Другое фото».`);
  }
}

function draftKeyboard(d) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Опубликовать", callback_data: "ok:" + d.id },
        { text: "🕒 Отложить", callback_data: "when:" + d.id },
      ],
      [
        { text: "✏️ Правка", callback_data: "edit:" + d.id },
        { text: "🖼 Другое фото", callback_data: "img:" + d.id },
      ],
      [{ text: "❌ Отклонить", callback_data: "no:" + d.id }],
    ],
  };
}

async function sendDraftText(env, d, header) {
  for (const a of admins(env)) {
    await tg(env, "sendMessage", {
      chat_id: a,
      text: short((header ? header + "\n\n" : "") + d.text, 4000),
      disable_web_page_preview: true,
      reply_markup: draftKeyboard(d),
    });
  }
}

function setKeyboard(env, chatId, messageId, markup) {
  if (!messageId) return null;
  return tg(env, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: markup || { inline_keyboard: [] },
  });
}

async function makeImage(env, prompt) {
  if (!env.AI) throw new Error("нет привязки Workers AI (AI)");
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await env.AI.run(IMAGE_MODEL, { prompt: short(prompt, 1500) + PHOTO_SUFFIX, steps: 8 });
      if (!res || !res.image) throw new Error("Workers AI не вернул картинку");
      const bin = atob(res.image);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch (e) {
      lastErr = e;
      await sleep(2000);
    }
  }
  throw lastErr;
}

async function translatePrompt(env, oldPrompt, wish) {
  const out = await llm(env, {
    system: "You edit image-generation prompts. Reply with ONLY the new English prompt, 1–2 sentences, no quotes.",
    user: `Current prompt: ${oldPrompt}\nUser wishes (Russian): ${short(wish, 500)}`,
    temperature: 0.4,
  }).catch(() => null);
  return out ? short(out.replace(/^["']|["']$/g, ""), 800) : short(`${oldPrompt}. ${wish}`, 800);
}

function parsePosts(raw) {
  if (!raw) return [];
  const s = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const pick = (j) => (Array.isArray(j) ? j : j && Array.isArray(j.posts) ? j.posts : j && j.text ? [j] : []);
  try {
    return pick(JSON.parse(s));
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    try {
      return m ? pick(JSON.parse(m[0])) : [];
    } catch {
      return [];
    }
  }
}

// Приводим текст к стилю группы: без markdown и хэштегов, абзацы через пустую строку, пункты списка — подряд.
function formatPost(s) {
  let t = String(s || "")
    .replace(/\r/g, "")
    .replace(/^```\w*\s*|```$/g, "")
    .replace(/^\s*---\s*$/gm, "")
    .replace(/\*\*|__/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/(^|\s)#[\wа-яё_]+/gi, "$1")
    .replace(/^["«]|["»]$/g, "")
    .trim();
  const isItem = (l) => /^(\p{Extended_Pictographic}|[•\-–]|\d+[.)])/u.test(l) && l.length < 220;
  const lines = t.split("\n").map((l) => l.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, "").replace(/^\*\s+/, "• "));
  const out = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    const prev = out[out.length - 1];
    if (prev !== undefined && prev !== "" && !(isItem(prev) && isItem(line))) out.push("");
    out.push(line);
  }
  return short(out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), 3800);
}

// ---------- Нейросети ----------

async function llm(env, { system, user, json = false, temperature = 0.8 }) {
  // Gemini (несколько моделей по очереди) → нейросеть Cloudflare как запасной вариант
  const primary = /^[\w.-]{1,64}$/.test(env.GEMINI_MODEL || "") ? env.GEMINI_MODEL : "gemini-flash-latest";
  const models = [...new Set([primary, "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"])];
  const errors = [];
  if (env.GEMINI_API_KEY) {
    for (const model of models) {
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: 8192 },
      };
      if (json) body.generationConfig.responseMimeType = "application/json";
      try {
        const res = await fetchT(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
            body: JSON.stringify(body),
          },
          90000
        );
        if (!res.ok) {
          errors.push(`${model}: ${res.status}`);
          if (res.status === 400 || res.status === 401 || res.status === 403) break; // ключ неверный — дальше бесполезно
          continue;
        }
        const data = await res.json();
        const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
        const out = parts.filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
        if (out) return out;
        errors.push(`${model}: пустой ответ`);
      } catch (e) {
        errors.push(`${model}: ${e.message}`);
      }
    }
  }
  if (env.AI) {
    try {
      const r = await env.AI.run(FALLBACK_TEXT_MODEL, {
        messages: [
          { role: "system", content: system + (json ? "\n\nОтвечай только JSON-объектом, без пояснений." : "") },
          { role: "user", content: user },
        ],
        max_tokens: 4096,
        temperature,
      });
      const out = typeof r.response === "string" ? r.response.trim() : r.response ? JSON.stringify(r.response) : "";
      if (out) return out;
      errors.push("Cloudflare AI: пустой ответ");
    } catch (e) {
      errors.push(`Cloudflare AI: ${e.message}`);
    }
  }
  throw new Error("нейросети сейчас недоступны, попробуй через пару минут (" + errors.join("; ") + ")");
}

// ---------- ВКонтакте ----------

async function vk(env, method, params, retried = 0) {
  const body = new URLSearchParams({ ...params, access_token: await vkToken(env), v: VK_V });
  const r = await fetchT(`https://api.vk.com/method/${method}`, { method: "POST", body }, 30000);
  const j = await r.json();
  if (j.error) {
    const code = j.error.error_code;
    // 5 — токен недействителен: один раз пробуем обновить вход и повторить
    // 5 — токен недействителен или выдан на другой IP (Cloudflare ходит с разных адресов):
    // обновляем вход прямо сейчас — новый токен выдаётся текущему адресу — и повторяем
    if (code === 5 && retried < 3 && (await getJSON(env, "vk_auth", {})).refresh_token) {
      await vkToken(env, true);
      return vk(env, method, params, retried + 1);
    }
    // 6/9/10 — слишком часто / временная ошибка ВК: короткая пауза и повтор
    if ((code === 6 || code === 10) && retried < 2) {
      await sleep(1500);
      return vk(env, method, params, retried + 1);
    }
    const hints = {
      5: " — войди заново: /vk",
      ip: " — войди заново: /vk (вход должен быть с разрешением offline)",
      15: " — у аккаунта нет прав в группе (нужен редактор или администратор)",
      214: " — публикация в группе запрещена для этого аккаунта",
      219: " — ВК посчитал пост рекламным/спамом",
    };
    const hint = /another ip/i.test(j.error.error_msg || "") ? hints.ip : hints[code] || "";
    throw new Error(`ВК ${method}: ${j.error.error_msg} (код ${code})${hint}`);
  }
  return j.response;
}

async function publishToVk(env, d, publishAt) {
  if (env.VK_GROUP_TOKEN) return publishWithGroupToken(env, d, publishAt);
  const gid = groupId(env);
  await freshVkToken(env);

  // 1) скачиваем фото из Telegram
  const f = await tg(env, "getFile", { file_id: d.file_id });
  if (!f.ok) throw new Error("Telegram getFile: " + (f.description || "ошибка"));
  const imgRes = await fetchT(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`, {}, 30000);
  if (!imgRes.ok) throw new Error("не скачалось фото из Telegram");
  const img = await imgRes.arrayBuffer();

  // 2) загружаем на сервер ВК
  const server = await vk(env, "photos.getWallUploadServer", { group_id: gid });
  const form = new FormData();
  form.append("photo", new Blob([img], { type: "image/jpeg" }), "photo.jpg");
  const upRes = await fetchT(server.upload_url, { method: "POST", body: form }, 60000);
  const up = await upRes.json().catch(() => ({}));
  if (!up.photo || up.photo === "[]") throw new Error("ВК не принял фото при загрузке");
  const saved = await vk(env, "photos.saveWallPhoto", { group_id: gid, server: up.server, photo: up.photo, hash: up.hash });
  const ph = saved[0];

  // 3) публикуем (или откладываем) — текст + фото от имени группы
  const params = {
    owner_id: `-${gid}`,
    from_group: 1,
    message: d.text,
    attachments: `photo${ph.owner_id}_${ph.id}`,
    guid: d.id + (publishAt ? "_" + publishAt : ""), // защита ВК от дублей при повторном нажатии
  };
  if (publishAt) params.publish_date = publishAt;
  const post = await vk(env, "wall.post", params);
  return post.post_id;
}

// ---------- Публикация ключом сообщества (бессрочный, не привязан к IP) ----------

async function vkg(env, method, params, retried = 0) {
  const body = new URLSearchParams({ ...params, access_token: env.VK_GROUP_TOKEN, v: VK_V });
  const r = await fetchT(`https://api.vk.com/method/${method}`, { method: "POST", body }, 30000);
  const j = await r.json();
  if (j.error) {
    const code = j.error.error_code;
    if ((code === 6 || code === 10) && retried < 2) {
      await sleep(1500);
      return vkg(env, method, params, retried + 1);
    }
    const hints = {
      5: " — ключ сообщества недействителен, создай новый в настройках группы",
      15: " — у ключа сообщества нет нужного права (нужны: стена, фотографии, сообщения)",
      27: " — этот метод недоступен с ключом сообщества",
    };
    throw new Error(`ВК ${method}: ${j.error.error_msg} (код ${code})${hints[code] || ""}`);
  }
  return j.response;
}

async function publishWithGroupToken(env, d, publishAt) {
  const gid = groupId(env);
  const f = await tg(env, "getFile", { file_id: d.file_id });
  if (!f.ok) throw new Error("Telegram getFile: " + (f.description || "ошибка"));
  const imgRes = await fetchT(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`, {}, 30000);
  if (!imgRes.ok) throw new Error("не скачалось фото из Telegram");
  const img = await imgRes.arrayBuffer();

  // Ключ сообщества не может грузить фото на стену напрямую — грузим как фото сообщества для сообщений
  const server = await vkg(env, "photos.getMessagesUploadServer", {});
  const form = new FormData();
  form.append("photo", new Blob([img], { type: "image/jpeg" }), "photo.jpg");
  const up = await (await fetchT(server.upload_url, { method: "POST", body: form }, 60000)).json().catch(() => ({}));
  if (!up.photo || up.photo === "[]") throw new Error("ВК не принял фото при загрузке");
  const saved = await vkg(env, "photos.saveMessagesPhoto", { server: up.server, photo: up.photo, hash: up.hash });
  const ph = saved[0];
  const attach = `photo${ph.owner_id}_${ph.id}` + (ph.access_key ? `_${ph.access_key}` : "");

  const params = {
    owner_id: `-${gid}`,
    from_group: 1,
    message: d.text,
    attachments: attach,
    guid: d.id + (publishAt ? "_" + publishAt : ""),
  };
  if (publishAt) params.publish_date = publishAt;
  const post = await vkg(env, "wall.post", params);
  return post.post_id;
}

// Диагностика: отложенные (невидимые подписчикам) тестовые посты с разными способами прикрепить фото
async function photoAttachTest(env, q) {
  const out = {};
  const gid = groupId(env);
  if (q.get("delete")) {
    for (const id of q.get("delete").split(",")) {
      try {
        out[id] = await vkg(env, "wall.delete", { owner_id: `-${gid}`, post_id: id });
      } catch (e) {
        out[id] = e.message;
      }
    }
    return out;
  }
  const list = await env.DB.list({ prefix: "d:" });
  let d = null;
  for (const k of list.keys) {
    const x = await getJSON(env, k.name, null);
    if (x && x.file_id) { d = x; break; }
  }
  if (!d) return { error: "нет черновика с фото" };
  const f = await tg(env, "getFile", { file_id: d.file_id });
  const img = await (await fetchT(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`, {}, 30000)).arrayBuffer();
  const upload = async (params) => {
    const server = await vkg(env, "photos.getMessagesUploadServer", params);
    const form = new FormData();
    form.append("photo", new Blob([img], { type: "image/jpeg" }), "photo.jpg");
    const up = await (await fetchT(server.upload_url, { method: "POST", body: form }, 60000)).json();
    const saved = await vkg(env, "photos.saveMessagesPhoto", { server: up.server, photo: up.photo, hash: up.hash });
    return saved[0];
  };
  const when = Math.floor(Date.now() / 1000) + 20 * 86400;
  const variants = (q.get("v") || "a,b,c").split(",");
  const origin = (await env.DB.get("origin")) || "";
  for (const v of variants) {
    try {
      let ph, attach;
      if (v === "a") { ph = await upload({}); attach = `photo${ph.owner_id}_${ph.id}`; }
      if (v === "b") { ph = await upload({}); attach = `photo${ph.owner_id}_${ph.id}_${ph.access_key}`; }
      if (v === "c") { ph = await upload({ peer_id: admins(env)[0] }); attach = `photo${ph.owner_id}_${ph.id}`; }
      if (v === "d") {
        const server = await vkg(env, "docs.getMessagesUploadServer", { type: "doc" });
        const form = new FormData();
        form.append("file", new Blob([img], { type: "image/jpeg" }), "photo.jpg");
        const up = await (await fetchT(server.upload_url, { method: "POST", body: form }, 60000)).json();
        const saved = await vkg(env, "docs.save", { file: up.file, title: "photo.jpg" });
        const doc = saved.doc || saved[0] || saved;
        ph = { owner_id: doc.owner_id };
        attach = `doc${doc.owner_id}_${doc.id}`;
      }
      if (v === "e") { ph = { owner_id: "-" }; attach = `${origin}/p/${d.id}`; }
      const post = await vkg(env, "wall.post", { owner_id: `-${gid}`, from_group: 1, message: "ТЕСТ " + v.toUpperCase() + " (будет удалён)", attachments: attach, publish_date: when });
      let check = null;
      try {
        const r = await vkg(env, "wall.getById", { posts: `-${gid}_${post.post_id}` });
        const item = (r.items || r)[0] || {};
        check = (item.attachments || []).map((a) => a.type);
      } catch (e) {
        check = "не прочитать: " + e.message.slice(0, 80);
      }
      out[v] = { attach, owner: ph.owner_id, post_id: post.post_id, check };
    } catch (e) {
      out[v] = "ERROR " + e.message;
    }
  }
  return out;
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
  const r = await fetchT(
    `${VK_ID}/oauth2/auth`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: String(env.VK_CLIENT_ID), ...params }),
    },
    30000
  );
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
      scope: tok.scope,
    })
  );
}

async function vkToken(env, force) {
  const a = await getJSON(env, "vk_auth", null);
  if (!a) {
    if (env.VK_TOKEN) return env.VK_TOKEN;
    throw new Error("ВКонтакте не подключён — отправь боту /vk и войди");
  }
  if (a.classic) {
    // классический offline-токен: бессрочный, обновлять нечего
    if (!a.expires_at || Date.now() < a.expires_at - 60000) return a.access_token;
    throw new Error("вход в ВК истёк — отправь боту /vk и войди заново");
  }
  if (!force && Date.now() < a.expires_at - 120000) return a.access_token;
  if (!a.refresh_token) throw new Error("вход в ВК истёк — отправь боту /vk и войди заново");
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

// ---------- Классический вход ВК (implicit flow, scope offline — без привязки к IP) ----------

async function vkClassicUrl(env, origin) {
  const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
  await env.DB.put("vk_state:" + state, "1", { expirationTtl: 900 });
  const q = new URLSearchParams({
    client_id: String(env.VK_CLIENT_ID),
    display: "page",
    redirect_uri: origin + "/vk-callback",
    scope: "wall,photos,groups,offline",
    response_type: "token",
    v: VK_V,
    state,
    revoke: "1",
  });
  return `https://oauth.vk.com/authorize?${q}`;
}

async function vkFinishClassic(env, body) {
  const state = String((body && body.state) || "");
  if (!/^[\w-]{10,100}$/.test(state) || !(await env.DB.get("vk_state:" + state))) {
    throw new Error("Ссылка входа устарела. Отправь /vk в боте ещё раз.");
  }
  await env.DB.delete("vk_state:" + state);
  if (body.error) throw new Error(body.error_description || body.error);
  const token = String(body.access_token || "");
  if (!/^[\w.-]{20,400}$/.test(token)) throw new Error("ВК не вернул токен. Попробуй ещё раз: /vk");
  const exp = parseInt(body.expires_in || "0", 10);
  await env.DB.put(
    "vk_auth",
    JSON.stringify({ classic: true, access_token: token, expires_at: exp > 0 ? Date.now() + exp * 1000 : 0, user_id: body.user_id })
  );
  // сразу проверяем, что токен работает с серверов бота
  await vk(env, "photos.getWallUploadServer", { group_id: groupId(env) });
}

function classicCallbackPage() {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Подключение ВК</title>
<body style="font-family:system-ui;background:#fffaf0;display:grid;place-items:center;min-height:90vh;margin:0">
<div style="text-align:center;padding:24px"><h1 id="t" style="color:#e8711a">Подключаю ВКонтакте…</h1><p id="p" style="font-size:18px"></p></div>
<script>
(async () => {
  const h = new URLSearchParams(location.hash.slice(1));
  const body = Object.fromEntries(h.entries());
  history.replaceState(null, "", location.pathname);
  const t = document.getElementById("t"), p = document.getElementById("p");
  try {
    const r = await fetch(location.pathname, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.ok) { t.textContent = "✅ ВКонтакте подключён"; p.textContent = "Можно закрыть эту вкладку и вернуться в Telegram."; }
    else { t.textContent = "⚠️ Не получилось"; p.textContent = j.error || "Попробуй ещё раз: /vk"; }
  } catch (e) { t.textContent = "⚠️ Не получилось"; p.textContent = "Нет связи с ботом, попробуй ещё раз."; }
})();
</script>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } }
  );
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

// ---------- Время для отложенных постов ----------

// Ближайшие слоты (unix-секунды) по МСК, не раньше чем через 20 минут
function nextSlots(n) {
  const out = [];
  const now = Date.now();
  const msk = new Date(now + MSK_OFFSET);
  for (let day = 0; day < 3 && out.length < n; day++) {
    for (const h of SLOT_HOURS) {
      const t = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() + day, h, 0, 0) - MSK_OFFSET;
      if (t > now + 20 * 60 * 1000) out.push(Math.floor(t / 1000));
      if (out.length >= n) break;
    }
  }
  return out;
}

function fmtSlot(unix) {
  const d = new Date(unix * 1000 + MSK_OFFSET);
  const today = new Date(Date.now() + MSK_OFFSET);
  const dayDiff = Math.round(
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 864e5
  );
  const day = dayDiff === 0 ? "Сегодня" : dayDiff === 1 ? "Завтра" : `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${day} в ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// ---------- Утилиты ----------

async function getDraft(env, id) {
  if (!id || !/^\w{1,40}$/.test(id)) return null;
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

// Защита от повторной обработки одного и того же апдейта (Telegram иногда присылает повторно)
async function alreadyHandled(env, updateId) {
  if (typeof updateId !== "number") return false;
  const key = "u:" + updateId;
  if (await env.DB.get(key)) return true;
  await env.DB.put(key, "1", { expirationTtl: 3600 });
  return false;
}

async function fetchT(url, opt = {}, ms = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opt, signal: controller.signal });
  } catch (e) {
    throw new Error(controller.signal.aborted ? `таймаут ${Math.round(ms / 1000)} с` : e.message);
  } finally {
    clearTimeout(timer);
  }
}

async function tg(env, method, body) {
  try {
    const r = await fetchT(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      30000
    );
    const j = await r.json();
    if (!j.ok && j.error_code === 429 && j.parameters && j.parameters.retry_after && !body.__retried) {
      await sleep(Math.min(j.parameters.retry_after, 10) * 1000);
      return tg(env, method, { ...body, __retried: true });
    }
    return j;
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
  await broadcast(env, `⚠️ ${title}: ${short((e && e.message) || String(e), 300)}`).catch(() => {});
}

function admins(env) {
  return String(env.ADMIN_ID || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^-?\d+$/.test(x));
}

function isAdmin(env, chatId) {
  return chatId != null && admins(env).includes(String(chatId));
}

async function broadcast(env, text) {
  for (const a of admins(env)) await send(env, a, text);
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function short(s, n) {
  s = String(s == null ? "" : s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
