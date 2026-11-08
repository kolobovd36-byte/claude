// Виджет «Трекер тренировок» для Scriptable
// Экран блокировки (круглый / прямоугольный / строка над часами) и домашний экран.
// Нажатие на виджет открывает трекер.

// ⬇️ Вставь сюда ссылку, по которой открываешь трекер
const URL = "https://kolobovd36-byte.github.io/claude/workout-tracker.html";

const family = config.widgetFamily || "small";
const w = new ListWidget();
w.url = URL;

function symbol(name, size) {
  const s = SFSymbol.named(name);
  s.applyFont(Font.systemFont(size));
  return s.image;
}

// Подсказка по дню недели: Пн/Чт — Anterior, Вт/Пт — Posterior, Ср/Сб — жим
// (поменяй под своё расписание; null = день отдыха)
const PLAN = { 1: "Anterior", 2: "Posterior", 3: "Bench Press", 4: "Anterior", 5: "Posterior", 6: "Bench Press", 0: null };
const today = PLAN[new Date().getDay()];

if (family === "accessoryCircular") {
  w.addAccessoryWidgetBackground = true;
  const st = w.addStack(); st.addSpacer();
  const img = st.addImage(symbol("dumbbell.fill", 22));
  img.imageSize = new Size(26, 26); img.tintColor = Color.white();
  st.addSpacer();
} else if (family === "accessoryRectangular") {
  const row = w.addStack(); row.centerAlignContent(); row.spacing = 6;
  const img = row.addImage(symbol("dumbbell.fill", 14));
  img.imageSize = new Size(18, 18); img.tintColor = Color.white();
  const t = row.addText("Трекер"); t.font = Font.boldSystemFont(15);
  const s = w.addText(today ? "Сегодня: " + today : "Сегодня отдых");
  s.font = Font.systemFont(13); s.textOpacity = 0.75;
} else if (family === "accessoryInline") {
  w.addText("🏋️ " + (today || "Отдых"));
} else {
  // домашний экран
  w.backgroundColor = new Color("#1c1c1e");
  w.setPadding(14, 14, 14, 14);
  const img = w.addImage(symbol("dumbbell.fill", 26));
  img.imageSize = new Size(30, 30); img.tintColor = Color.white();
  w.addSpacer();
  const t = w.addText("Трекер"); t.font = Font.boldSystemFont(18); t.textColor = Color.white();
  const s = w.addText(today ? today : "День отдыха");
  s.font = Font.systemFont(13); s.textColor = today ? new Color("#30d158") : new Color("#8e8e93");
}

if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  Safari.open(URL); // запуск скрипта вручную тоже открывает трекер
}
Script.complete();
