// Виджет расписания 10Б для Scriptable (iPhone)
// Показывает текущий/следующие уроки, кабинет и учителя.
// Изменения из "changes" действуют только на указанную неделю.

// ===== НАСТРОЙКИ =====
// Твои группы: en — английский, project — индивидуальный проект ("1" или "2")
const GROUPS = { en: "2", project: "1" };
// Расписание берётся с GitHub — туда Claude вносит замены, которые ты присылаешь.
// Пусто = брать файл schedule.json из папки Scriptable в iCloud.
// Берём через GitHub API: он отдаёт свежую версию сразу, без 5-минутного кэша
const DATA_URL = "https://api.github.com/repos/kolobovd36-byte/claude/contents/schedule.json?ref=main";
const LOCAL_NAME = "schedule.json";
// =====================

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_RU = { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Вс" };

let FROM_CACHE = false; // true, если интернета не было и взята старая копия

async function loadData() {
  const lfm = FileManager.local();
  const cache = lfm.joinPath(lfm.documentsDirectory(), "schedule-cache.json");
  if (DATA_URL) {
    try {
      const req = new Request(DATA_URL + "&t=" + Date.now());
      req.headers = { "Accept": "application/vnd.github.raw", "Cache-Control": "no-cache" };
      req.timeoutInterval = 10;
      const txt = await req.loadString();
      const code = req.response && req.response.statusCode;
      if (code && code !== 200) {
        throw new Error(code === 404
          ? "Файл на GitHub недоступен (репозиторий приватный?)"
          : "GitHub ответил ошибкой " + code);
      }
      const data = JSON.parse(txt);
      lfm.writeString(cache, txt);
      return data;
    } catch (e) {
      // нет интернета — берём последнюю сохранённую копию
      if (lfm.fileExists(cache)) { FROM_CACHE = true; return JSON.parse(lfm.readString(cache)); }
      throw e;
    }
  }
  const fm = FileManager.iCloud();
  const path = fm.joinPath(fm.documentsDirectory(), LOCAL_NAME);
  if (!fm.fileExists(path)) throw new Error("Положи " + LOCAL_NAME + " в папку Scriptable");
  await fm.downloadFileFromiCloud(path);
  return JSON.parse(fm.readString(path));
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function parseYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function mondayOf(d) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
function atTime(day, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

// Уроки на конкретную дату с учётом группы и изменений этой недели
function lessonsFor(data, date) {
  const key = DAYS[date.getDay()];
  const base = data.days[key] || [];
  const week = ymd(mondayOf(date));
  const out = [];
  for (let i = 0; i < data.times.length; i++) {
    let slot = base[i] || null;
    const set = slot && slot.set;
    if (slot && slot.groups) slot = slot.groups[GROUPS[slot.set] || "1"] || null;
    for (const ch of data.changes || []) {
      if (ch.day !== key || Number(ch.lesson) !== i + 1) continue;
      if (!ch.week || ymd(mondayOf(parseYmd(ch.week))) !== week) continue;
      if (ch.group && String(ch.group) !== (GROUPS[ch.set || set] || "1")) continue;
      const { week: _w, day: _d, lesson: _l, group: _g, set: _s, cancel, ...fields } = ch;
      slot = cancel ? null : { ...(slot || {}), ...fields, changed: true };
    }
    if (slot && slot.subject) {
      const [s, e] = data.times[i];
      out.push({ n: i + 1, ...slot, start: atTime(date, s), end: atTime(date, e) });
    }
  }
  return out;
}

function upcoming(data, now, count) {
  const out = [];
  for (let k = 0; k < 14 && out.length < count; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    for (const l of lessonsFor(data, d)) {
      if (l.end > now) { out.push(l); if (out.length >= count) break; }
    }
  }
  return out;
}

function dayLabel(d, now) {
  if (ymd(d) === ymd(now)) return "";
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (ymd(d) === ymd(tomorrow)) return "Завтра, ";
  return DAY_RU[DAYS[d.getDay()]] + ", ";
}

// Весь учебный день: сегодня, а если уроки кончились — следующий учебный день
function buildDay(w, data, now, first) {
  const day = new Date(first.start.getFullYear(), first.start.getMonth(), first.start.getDate());
  // Пустые места до последнего урока заполняем «окнами»
  const real = lessonsFor(data, day);
  const lastN = Math.max(...real.map((l) => l.n));
  const lessons = [];
  for (let n = 1; n <= lastN; n++) {
    const l = real.find((x) => x.n === n);
    if (l) { lessons.push(l); continue; }
    const [s, e] = data.times[n - 1];
    lessons.push({ n, subject: "Окно", window: true, start: atTime(day, s), end: atTime(day, e) });
  }
  const textColor = Color.dynamic(Color.black(), Color.white());
  const gray = Color.dynamic(new Color("#8e8e93"), new Color("#98989f"));
  w.setPadding(7, 10, 7, 10);
  w.addSpacer(); // центрирование по вертикали

  // Заголовок по центру
  const today = ymd(day) === ymd(now);
  const label = today ? "Сегодня" : dayLabel(day, now).replace(", ", "");
  const hs = w.addStack();
  hs.addSpacer();
  // В заголовке — время последнего обновления; «!» — нет сети, показана старая копия
  const upd = (FROM_CACHE ? "! " : "↻ ") + fmt(now);
  const head = hs.addText(`${label} · ${DAY_RU[DAYS[day.getDay()]]}`.toUpperCase() + "   " + upd);
  head.font = Font.semiboldSystemFont(10);
  head.textColor = gray;
  hs.addSpacer();
  w.addSpacer(4);

  // Два столбца, по центру по горизонтали
  const row = w.addStack();
  row.layoutHorizontally();
  row.addSpacer();
  const half = Math.ceil(lessons.length / 2);

  // Один размер шрифта на весь виджет: подбираем его по самому длинному
  // предмету и имени, чтобы всё влезло и выглядело одинаково
  const SHORT = { "Обществознание": "Общество", "Русский язык": "Русский" };
  const subj = (l) => SHORT[l.subject] || l.subject;
  const MAIN_W = 112; // ширина под номер, кабинет, предмет и имя (pt)
  // Считаем по всей неделе, чтобы размер не прыгал от дня к дню
  const week = mondayOf(day);
  const all = lessons.slice();
  for (let k = 0; k < 5; k++) all.push(...lessonsFor(data, new Date(week.getFullYear(), week.getMonth(), week.getDate() + k)));
  // Строка 1: номер | предмет · кабинет — подбираем общий размер,
  // при котором самый длинный предмет недели влезает целиком
  // В моноширинном шрифте каждый символ (и пробел) ≈ 0.6em
  const numW = (f) => f * 0.6 + 4;
  const roomW = (f) => (f - 1) * 0.55 * 3 + 8; // " · 302"
  const subjW = (f) => MAIN_W - numW(f) - roomW(f);
  const maxLen = Math.max(...all.map((l) => subj(l).length));
  let fs = 13.5;
  while (fs > 11 && maxLen * 0.56 * fs > subjW(fs)) fs -= 0.5;
  // Строка 2: имя и отчество на всю ширину (под кабинетом и предметом)
  let fn = 10.5;
  for (const l of all) {
    if (!l.window && l.teacher) fn = Math.min(fn, (MAIN_W - numW(fs)) / (l.teacher.length * 0.52));
  }
  fn = Math.max(9, Math.floor(fn * 2) / 2);
  [lessons.slice(0, half), lessons.slice(half)].forEach((col, ci) => {
    if (ci === 1) row.addSpacer(12);
    const st = row.addStack();
    st.layoutVertically();
    st.size = new Size(148, 0); // ширина столбца
    col.forEach((l, i) => {
      const live = l.start <= now && l.end > now;
      const past = l.end <= now;
      const color = past || l.window ? gray
        : l.changed ? new Color("#ff9500")
        : live ? new Color("#34c759")
        : textColor;

      // Урок: слева столбик времени (начало / конец), справа предмет и учитель
      const item = st.addStack();
      item.layoutHorizontally();
      item.centerAlignContent();

      // Время: моноширинные цифры, чтобы столбик был ровным
      const tc = item.addStack();
      tc.layoutVertically();
      tc.size = new Size(32, 0);
      const t1 = tc.addText(fmt(l.start));
      t1.font = Font.semiboldMonospacedSystemFont(9.5);
      t1.textColor = live ? color : gray;
      t1.lineLimit = 1;
      const t2 = tc.addText(fmt(l.end));
      t2.font = Font.regularMonospacedSystemFont(9.5);
      t2.textColor = gray;
      t2.lineLimit = 1;
      item.addSpacer(4);

      const main = item.addStack();
      main.layoutVertically();

      // Строка 1: номер, предмет · кабинет
      const line = main.addStack();
      line.layoutHorizontally();
      line.centerAlignContent();
      const n = line.addText(String(l.n));
      n.font = Font.boldMonospacedSystemFont(fs);
      n.textColor = live ? color : gray;
      line.addSpacer(5);
      const t = line.addText(subj(l));
      t.font = l.window ? Font.italicSystemFont(fs) : Font.semiboldRoundedSystemFont(fs);
      t.textColor = color;
      t.lineLimit = 1;
      // Кабинет — после предмета, серым, через точку: не путается с номером урока
      if (l.room) {
        const r = line.addText(" · " + l.room);
        r.font = Font.mediumSystemFont(fs - 1);
        r.textColor = gray;
        r.lineLimit = 1;
      }
      line.addSpacer();

      // Строка 2: имя и отчество учителя — ровно под предметом
      const nl = main.addStack();
      nl.addSpacer(Math.round(numW(fs)));
      const name = nl.addText(l.window ? "нет урока" : (l.teacher || " "));
      name.font = Font.systemFont(fn);
      name.textColor = gray;
      name.lineLimit = 1;
      if (i < col.length - 1) st.addSpacer(3);
    });
  });
  row.addSpacer();
  w.addSpacer(); // центрирование по вертикали
  return w;
}

async function build() {
  const now = new Date();
  const family = config.widgetFamily || "medium";
  const w = new ListWidget();

  let data;
  try { data = await loadData(); }
  catch (e) { const t = w.addText("⚠️ " + e.message); t.font = Font.systemFont(12); return w; }

  const counts = { small: 2, medium: 3, large: 7, accessoryRectangular: 1, accessoryInline: 1 };
  const list = upcoming(data, now, counts[family] || 3);
  if (!list.length) { w.addText("Уроков нет"); return w; }

  const first = list[0];
  // Обновляться не реже чем раз в 15 минут, чтобы замены подтягивались быстро
  const boundary = first.start > now ? first.start : first.end;
  const soon = new Date(now.getTime() + 15 * 60 * 1000);
  w.refreshAfterDate = boundary < soon ? boundary : soon;
  const when = (l) => (l.start <= now ? "Сейчас" : dayLabel(l.start, now) + fmt(l.start));

  // Экран блокировки — одна строка
  if (family === "accessoryInline") {
    w.addText(`${when(first)} ${first.subject}${first.room ? " · " + first.room : ""}`);
    return w;
  }
  // Экран блокировки — прямоугольный
  if (family === "accessoryRectangular") {
    const a = w.addText(when(first)); a.font = Font.semiboldSystemFont(12);
    const b = w.addText((first.changed ? "⚠︎ " : "") + first.subject); b.font = Font.boldSystemFont(15); b.lineLimit = 1;
    const c = w.addText(`${first.room ? "каб. " + first.room + " · " : ""}${first.teacher || ""}`);
    c.font = Font.systemFont(12); c.lineLimit = 1;
    return w;
  }

  w.backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e"));

  // Средний виджет — весь день в два столбца
  if (family === "medium") return buildDay(w, data, now, first);

  // Главный экран
  w.setPadding(12, 14, 12, 14);
  const head = w.addText(data.class || "Расписание");
  head.font = Font.semiboldSystemFont(11);
  head.textColor = Color.gray();
  w.addSpacer(4);

  const small = family === "small";
  for (const l of list) {
    const live = l.start <= now;
    const color = l.changed ? new Color("#ff9500")
      : live ? new Color("#34c759")
      : Color.dynamic(Color.black(), Color.white());
    const top = w.addText(`${live ? "● " : ""}${l.subject}${l.room ? " · " + l.room : ""}`);
    top.font = Font.boldSystemFont(small ? 13 : 15);
    top.textColor = color;
    top.lineLimit = 1;
    const sub = w.addText(
      `${dayLabel(l.start, now)}${fmt(l.start)}–${fmt(l.end)}${!small && l.teacher ? " · " + l.teacher : ""}`
    );
    sub.font = Font.systemFont(11);
    sub.textColor = Color.gray();
    sub.lineLimit = 1;
    if (small && l.teacher) {
      const t = w.addText(l.teacher); t.font = Font.systemFont(11); t.textColor = Color.gray(); t.lineLimit = 1;
    }
    w.addSpacer(6);
  }
  w.addSpacer();
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
