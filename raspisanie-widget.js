// Виджет расписания 10Б для Scriptable (iPhone)
// Показывает текущий/следующие уроки, кабинет и учителя.
// Изменения из "changes" действуют только на указанную неделю.

// ===== НАСТРОЙКИ =====
// Твои группы: en — английский, project — индивидуальный проект ("1" или "2")
const GROUPS = { en: "2", project: "1" };
// Расписание берётся с GitHub — туда Claude вносит замены, которые ты присылаешь.
// Пусто = брать файл schedule.json из папки Scriptable в iCloud.
const DATA_URL = "https://raw.githubusercontent.com/kolobovd36-byte/claude/main/schedule.json";
const LOCAL_NAME = "schedule.json";
// =====================

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_RU = { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Вс" };

async function loadData() {
  const lfm = FileManager.local();
  const cache = lfm.joinPath(lfm.documentsDirectory(), "schedule-cache.json");
  if (DATA_URL) {
    try {
      const req = new Request(DATA_URL + "?t=" + Date.now());
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
      if (lfm.fileExists(cache)) return JSON.parse(lfm.readString(cache));
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
  const head = hs.addText(`${label} · ${DAY_RU[DAYS[day.getDay()]]}`.toUpperCase());
  head.font = Font.semiboldSystemFont(10);
  head.textColor = gray;
  hs.addSpacer();
  w.addSpacer(4);

  // Два столбца, по центру по горизонтали
  const row = w.addStack();
  row.layoutHorizontally();
  row.addSpacer();
  const half = Math.ceil(lessons.length / 2);
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

      const tc = item.addStack();
      tc.layoutVertically();
      tc.size = new Size(28, 0);
      const t1 = tc.addText(fmt(l.start));
      t1.font = Font.semiboldSystemFont(9.5);
      t1.textColor = live ? color : gray;
      t1.lineLimit = 1;
      t1.minimumScaleFactor = 0.8;
      const t2 = tc.addText(fmt(l.end));
      t2.font = Font.systemFont(9.5);
      t2.textColor = gray;
      t2.lineLimit = 1;
      t2.minimumScaleFactor = 0.8;
      item.addSpacer(5);

      const main = item.addStack();
      main.layoutVertically();

      // Строка 1: номер, предмет ... кабинет справа
      const line = main.addStack();
      line.layoutHorizontally();
      line.centerAlignContent();
      const n = line.addText(String(l.n));
      n.font = Font.boldRoundedSystemFont(13);
      n.textColor = live ? color : gray;
      line.addSpacer(4);
      const t = line.addText(l.subject);
      t.font = l.window ? Font.italicSystemFont(13.5) : Font.semiboldRoundedSystemFont(13.5);
      t.textColor = color;
      t.lineLimit = 1;
      t.minimumScaleFactor = 0.65;
      line.addSpacer();
      if (l.room) {
        line.addSpacer(3);
        const r = line.addText(l.room);
        r.font = Font.semiboldRoundedSystemFont(13.5);
        r.textColor = color;
        r.lineLimit = 1;
      }

      // Строка 2: имя и отчество учителя (длинные слегка уменьшаются)
      const name = main.addText(l.window ? "нет урока" : (l.teacher || " "));
      name.font = Font.systemFont(10.5);
      name.textColor = gray;
      name.lineLimit = 1;
      name.minimumScaleFactor = 0.75;
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
  w.refreshAfterDate = first.start > now ? first.start : first.end;
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
