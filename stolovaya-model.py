"""
Имитационная модель очереди в школьной столовой.
Индивидуальный проект «Очередь в столовой: модель обслуживания»
Колобов Денис, 10 «Б», МБОУ «Лицей № 15» г. Ставрополь

Модель: двухфазная система массового обслуживания
  фаза 1 — линия раздачи (выбор блюд), c1 параллельных линий;
  фаза 2 — касса (оплата),             c2 параллельных касс.
Каждый ученик проходит обе фазы; дисциплина обслуживания FIFO,
очередь не ограничена. Времена обслуживания — логнормальные.
"""
import json
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

BREAK = 20 * 60          # длительность перемены, с
EAT_NEED = 10 * 60       # минимальное время на приём пищи, с
DEADLINE = BREAK - EAT_NEED  # успеть получить еду до 10-й минуты
N_STUDENTS = 60          # учеников, покупающих еду на перемене
RUNS = 2000              # число прогонов модели
rng = np.random.default_rng(15)


def lognorm(mean, cv, size):
    """Логнормальная величина с заданным средним и коэфф. вариации."""
    s2 = np.log(1 + cv ** 2)
    mu = np.log(mean) - s2 / 2
    return rng.lognormal(mu, np.sqrt(s2), size)


def arrivals_wave(n):
    """Все приходят сразу после звонка: в течение первых 3 минут."""
    return np.sort(rng.gamma(2.0, 45.0, n))


def arrivals_staggered(n):
    """Классы приходят по графику: 2 потока со сдвигом 4 минуты."""
    half = n // 2
    a = rng.uniform(0, 90, half)
    b = 240 + rng.uniform(0, 90, n - half)
    return np.sort(np.concatenate([a, b]))


def multi_server(arr, service, c):
    """FIFO-обслуживание c параллельными приборами. Возвращает
    моменты начала и окончания обслуживания."""
    free = np.zeros(c)
    start = np.empty_like(arr)
    end = np.empty_like(arr)
    for i, t in enumerate(arr):
        k = np.argmin(free)
        start[i] = max(t, free[k])
        end[i] = start[i] + service[i]
        free[k] = end[i]
    return start, end


def simulate(sc, n=N_STUDENTS):
    arr = sc["arrivals"](n)
    s1 = lognorm(sc["serve_mean"], 0.35, n)
    if sc.get("pay_mix"):
        cash = rng.random(n) < sc["cash_share"]
        s2 = np.where(cash, lognorm(30, 0.4, n), lognorm(12, 0.3, n))
    else:
        s2 = lognorm(sc["pay_mean"], 0.3, n)
    _, e1 = multi_server(arr, s1, sc["lines"])
    order = np.argsort(e1)              # в кассу — в порядке выхода с раздачи
    a2 = e1[order]
    _, e2s = multi_server(a2, s2[order], sc["cashiers"])
    e2 = np.empty_like(e2s)
    e2[order] = e2s
    wait = (e2 - arr) - s1 - s2
    return arr, e2, wait


SCENARIOS = [
    dict(key="A", name="Текущая модель: 1 раздача, 1 касса, наличные и карты",
         arrivals=arrivals_wave, lines=1, cashiers=1, serve_mean=14,
         pay_mix=True, cash_share=0.5),
    dict(key="B", name="Вторая касса",
         arrivals=arrivals_wave, lines=1, cashiers=2, serve_mean=14,
         pay_mix=True, cash_share=0.5),
    dict(key="C", name="Только безналичная оплата (карта/QR), 1 касса",
         arrivals=arrivals_wave, lines=1, cashiers=1, serve_mean=14,
         pay_mean=9),
    dict(key="D", name="Две линии раздачи + безналичная оплата на 2 кассах",
         arrivals=arrivals_wave, lines=2, cashiers=2, serve_mean=14,
         pay_mean=9),
    dict(key="E", name="Предзаказ (готовые подносы) + безнал, 1 касса",
         arrivals=arrivals_wave, lines=1, cashiers=1, serve_mean=6,
         pay_mean=6),
    dict(key="F", name="Текущая модель, но классы приходят по графику",
         arrivals=arrivals_staggered, lines=1, cashiers=1, serve_mean=14,
         pay_mix=True, cash_share=0.5),
]


def run_all():
    results = []
    for sc in SCENARIOS:
        mean_w, max_w, last, ok = [], [], [], []
        for _ in range(RUNS):
            arr, done, wait = simulate(sc)
            mean_w.append(wait.mean())
            max_w.append(wait.max())
            last.append(done.max())
            ok.append(np.mean(done <= DEADLINE))
        results.append(dict(
            key=sc["key"], name=sc["name"],
            mean_wait_min=round(np.mean(mean_w) / 60, 1),
            max_wait_min=round(np.mean(max_w) / 60, 1),
            last_served_min=round(np.mean(last) / 60, 1),
            on_time_pct=round(100 * np.mean(ok)),
        ))
    return results


def queue_curve(sc, reps=300):
    """Средняя длина очереди (ученики в системе) по минутам перемены."""
    grid = np.arange(0, BREAK + 1, 30)
    acc = np.zeros_like(grid, dtype=float)
    for _ in range(reps):
        arr, done, _ = simulate(sc)
        acc += [(np.sum(arr <= t) - np.sum(done <= t)) for t in grid]
    return grid / 60, acc / reps


def mm1_example():
    """Аналитический расчёт по формулам M/M/1 для кассы."""
    lam = 60 / 180 * 60       # 60 учеников за 3 мин -> чел/мин (пиковый поток)
    lam_avg = 60 / 20         # средний поток за перемену, чел/мин
    mu = 60 / 21              # касса: среднее 21 с на ученика -> чел/мин
    rho = lam_avg / mu
    return dict(lam_peak=round(lam, 1), lam_avg=lam_avg, mu=round(mu, 2),
                rho=round(rho, 2))


def sensitivity():
    """Сколько учеников успевает поесть при разном числе покупателей."""
    out = {}
    for key in ("A", "B", "D"):
        sc = next(s for s in SCENARIOS if s["key"] == key)
        row = []
        for n in (30, 40, 50, 60, 70, 80):
            ok = [np.mean(simulate(sc, n)[1] <= DEADLINE) for _ in range(800)]
            row.append(round(100 * np.mean(ok)))
        out[key] = row
    return out


if __name__ == "__main__":
    res = run_all()
    for r in res:
        print(r)
    print(mm1_example())
    json.dump(res, open("results.json", "w"), ensure_ascii=False, indent=1)

    plt.rcParams["font.family"] = "DejaVu Sans"
    # Рисунок 1 — очередь во времени
    fig, ax = plt.subplots(figsize=(8, 5.4), dpi=200)
    styles = {"A": ("#c0392b", "-"), "B": ("#2471a3", "--"),
              "C": ("#7d3c98", "-."), "D": ("#1e8449", "-"),
              "F": ("#b9770e", ":")}
    for sc in SCENARIOS:
        if sc["key"] not in styles:
            continue
        x, y = queue_curve(sc)
        col, ls = styles[sc["key"]]
        ax.plot(x, y, color=col, ls=ls, lw=2, label=f'{sc["key"]}: {sc["name"]}')
    ax.axvline(DEADLINE / 60, color="grey", lw=1)
    ax.text(DEADLINE / 60 + 0.2, 2,
            "10-я минута:\nпоследний момент,\nчтобы успеть поесть",
            fontsize=7.5, color="grey")
    ax.set_xlabel("Время от начала перемены, мин")
    ax.set_ylabel("Учеников в очереди, чел.")
    ax.set_ylim(0, 55)
    ax.set_xlim(0, 20)
    ax.grid(alpha=0.3)
    ax.legend(fontsize=7.5, loc="upper center", bbox_to_anchor=(0.5, -0.16),
              frameon=False)
    fig.tight_layout()
    fig.savefig("fig_queue.png")

    # Рисунок 2 — доля успевших
    fig, ax = plt.subplots(figsize=(8, 3.6), dpi=200)
    keys = [r["key"] for r in res]
    vals = [r["on_time_pct"] for r in res]
    cols = ["#c0392b" if v < 80 else "#1e8449" for v in vals]
    bars = ax.bar(keys, vals, color=cols, width=0.6)
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v + 2, f"{v}%",
                ha="center", fontsize=9)
    ax.set_ylim(0, 110)
    ax.set_ylabel("Успели получить еду\nдо 10-й минуты, %")
    ax.set_xlabel("Сценарий")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig("fig_ontime.png")


    sens = sensitivity()
    print(sens)
    json.dump(sens, open("sensitivity.json", "w"))
