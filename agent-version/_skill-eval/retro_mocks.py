"""Синтетические сессии для стенда ретро: журналы чата GigaCode (формат qwen-code) с заложенными случаями.

build(chats, cwd) пишет журналы в папку chats и возвращает ожидания: по сессии — какие пары (признак, сторона) ретро
обязано найти (must; список пар — годится любая из них) и каких быть не должно (must_not), и сколько сессий должно
уйти в разбор. Восемь сессий проекта
(p1…p8) идут по дням; рядом — вызов ретро, короткая сессия и чужой проект: их ретро пропускает.
"""

from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "manager-version", "_skill-eval"))
from sessionlib import Builder, ask, call, option  # noqa: E402

HYPOTHESES = (
    "Собрал гипотезы по требованиям. Проверь каждую — после подтверждения они пойдут в документ как решённые. "
    "Г1. Справка доступна в приложении всем клиентам с зарплатным проектом. Г2. Период справки — последние 6 месяцев. "
    "Г3. Справка формируется в PDF с электронной подписью банка. Г4. Повторный запрос за тот же период отдаёт уже "
    "готовый файл, новый не формируется. Г5. Справка хранится в истории клиента 90 дней. Г6. Если данных о доходе за "
    "месяц нет, месяц выводится с пометкой «нет данных», справка всё равно выдаётся. Г7. Заказать справку можно не "
    "чаще пяти раз в сутки. Г8. Клиенту без зарплатного проекта кнопка не показывается. Г9. Уведомление о готовности "
    "приходит пушем. Г10. Ошибка формирования показывается экраном «попробуйте позже» без кода ошибки. "
    "Отдельно: по Г2 и Г5 возможен конфликт — справка за 6 месяцев хранится меньше, чем её могут запросить повторно. "
    "Подтверждаешь гипотезы Г1–Г10?"
)
THOUGHT = "The user hasn't answered yet, so I should wait and check the previous step again. " * 40
FINAL = option("Проверить спеку", "Доработать спеку", "Разбить на этапы", "Начать другую задачу")


class Session:
    """Сборка сессии с часами: каждая запись — на step секунд позже прошлой, если не сказано иначе."""

    def __init__(self, session_id, day, model=None):
        self.b = Builder(session_id, f"2026-10-{day}T09:00:00")
        self.t, self.model, self.tokens = 0, model, 20000

    def tick(self, seconds=20):
        self.t += seconds
        return self.t

    def user(self, text, wait=40):
        return self.b.user(self.tick(wait), text)

    def slash(self, name, args="", wait=10):
        return self.b.slash_skill(self.tick(wait), name, args)

    def raw_slash(self, raw, wait=10):
        return self.b.slash(self.tick(wait), raw)

    def agent(self, text=None, calls=(), tokens=None, wait=20):
        self.tokens = tokens or self.tokens + 3000
        number = self.b.agent(self.tick(wait), text=text, calls=calls, tokens=self.tokens)
        record = json.loads(self.b.lines[-1])
        if self.model:
            record["model"] = self.model
        if text:  # модель с рассуждением: перед ответом — часть thought, её пользователь не видит
            record["message"]["parts"].insert(0, {"text": THOUGHT, "thought": True})
        self.b.lines[-1] = json.dumps(record, ensure_ascii=False)
        return number

    def skill(self, name, tokens=None):
        call_id = f"s{self.t}"
        self.agent(calls=[call("skill", {"skill": name}, call_id)], tokens=tokens)
        return self.b.result(self.tick(1), "skill", call_id, output="loaded")

    def asked(self, header, question, labels, answer, wait=60, text=None):
        call_id = f"q{self.t}"
        self.agent(text=text, calls=[ask(call_id, [{"header": header, "question": question, "options": option(*labels)}])])
        return self.b.result(self.tick(wait), "ask_user_question", call_id,
                             output=f"User has provided the following answers:\n\n**{header}**: {answer}")

    def read(self, *paths):
        ids = [f"r{self.t}-{index}" for index in range(len(paths))]
        self.agent(calls=[call("read_file", {"absolute_path": path}, call_id) for path, call_id in zip(paths, ids)])
        for call_id in ids:
            self.b.result(self.tick(1), "read_file", call_id, output="…")

    def start(self, key, idea):
        self.slash("analyst-workspace", f"{key} {idea}")
        self.asked("Вход", "Что на руках?", ["Бизнес: идея или задача", "Аналитика: готовые БТ", "Продолжить начатое"],
                   "Бизнес: идея или задача", wait=15)

    def lines(self, cwd):
        out = []
        for line in self.b.lines:
            record = json.loads(line)
            out.append(json.dumps(dict(record, cwd=cwd), ensure_ascii=False))
        return out


def p1():
    """Хорошая сессия: вход через оркестратор с ключом, гипотезы поправлены, честное TBD, /clear на точке очистки."""
    s = Session("p1", "20")
    s.start("PAY-1", "справка о доходах в приложении")
    s.skill("business-requirements-doc")
    s.read("services/payments.md", "context/glossary.md")
    s.asked("Гипотезы", "Подтверждаешь гипотезы Г1–Г10?", ["Да, всё верно", "Иначе — поправлю"],
            "Г2 неверно: справка нужна за 12 месяцев, а не за 6; Г9 — не пуш, а СМС; остальное верно", wait=240, text=HYPOTHESES)
    s.agent("Принял: период 12 месяцев, уведомление СМС. Какой срок хранения справки в истории клиента?")
    s.user("Не знаю, TBD — срок скажет юрист", wait=90)
    s.agent("БТ записан: coddoc/PAY-1/business_requirements.md. Дальше — спека; здесь можно `/clear`.")
    s.raw_slash("/clear", wait=30)
    return s, {"must": [("entry", "helps"), ("hypotheses", "helps"), ("unknowns", "helps"), ("context_hygiene", "helps")],
               "must_not": [("hypotheses", "hurts"), ("decisions", "hurts"), ("entry", "hurts")]}


def p2():
    """Пачка гипотез подтверждена за секунды, решение отдано агенту, агент спросил то, чего нет в проекте."""
    s = Session("p2", "21")
    s.start("PAY-2", "уведомление о смене лимита")
    s.skill("business-requirements-doc")
    s.asked("Гипотезы", "Подтверждаешь гипотезы Г1–Г10?", ["Да, всё верно", "Иначе — поправлю"], "Да, всё верно",
            wait=3, text=HYPOTHESES)
    s.agent("Какой канал уведомления выбрать для смены лимита: пуш или СМС?")
    s.user("сам реши, мне без разницы", wait=15)
    s.agent("Беру пуш. Кто согласует изменение лимита со стороны банка?")
    s.user("Согласует руководитель отдела кредитных рисков", wait=60)
    s.agent("БТ записан: coddoc/PAY-2/business_requirements.md.")
    s.user("ок")
    return s, {"must": [("hypotheses", "hurts"), ("decisions", "hurts"), ("context_gap", "hurts")], "must_not": []}


def p3():
    """Снова подтверждение за секунды; спека начата в той же сессии при загруженном окне; слабая модель."""
    s = Session("p3", "22", model="qwen-3.6b")
    s.start("PAY-3", "выгрузка выписки за год")
    s.skill("business-requirements-doc", tokens=60000)
    s.asked("Гипотезы", "Подтверждаешь гипотезы Г1–Г10?", ["Да, всё верно", "Иначе — поправлю"], "Да, всё верно",
            wait=4, text=HYPOTHESES)
    s.agent("БТ записан: coddoc/PAY-3/business_requirements.md. Дальше — спека; здесь можно `/clear`.", tokens=150000)
    s.user("давай сразу спеку", wait=20)
    s.skill("technical-spec-doc", tokens=190000)
    s.agent("Спека записана: coddoc/PAY-3/technical_spec.md.", tokens=200000)
    s.user("ок")
    return s, {"must": [("hypotheses", "hurts"), ("context_hygiene", "hurts")], "must_not": []}


def p4():
    """Большой документ вставлен в чат, решение снова отдано агенту, агент переспросил сказанное."""
    s = Session("p4", "23")
    s.start("PAY-4", "ежедневная выгрузка операций")
    s.user("Вот регламент выгрузки целиком: " + "Пункт регламента о порядке выгрузки операций. " * 110, wait=30)
    s.skill("business-requirements-doc")
    s.agent("Какой формат файла выгрузки: CSV или XLSX?")
    s.user("сам реши", wait=10)
    s.agent("Беру CSV. Как часто делать выгрузку?")
    s.user("Раз в сутки, в 6 утра", wait=30)
    s.agent("Записал. Уточните ещё раз, как часто делать выгрузку — раз в сутки или чаще?")
    s.user("я же написал: раз в сутки, в 6 утра", wait=20)
    s.agent("БТ записан: coddoc/PAY-4/business_requirements.md.")
    return s, {"must": [("paste", "hurts"), ("decisions", "hurts"), ("agent_slip", "agent")], "must_not": []}


def p5():
    """Одно и то же поправлено трижды; «уточню позже» вместо честного «не знаю»."""
    s = Session("p5", "24")
    s.start("PAY-5", "перевод по номеру телефона")
    s.skill("business-requirements-doc")
    s.agent("Сделал поле суммы необязательным: клиент может отправить перевод без суммы.")
    s.user("нет, сумма должна быть обязательной", wait=20)
    s.agent("Понял. Оставил сумму необязательной, но добавил подсказку.")
    s.user("нет же, сумма обязательна, без неё перевод не отправляется", wait=20)
    s.agent("Сумма необязательна, при пустой сумме покажем предупреждение.")
    s.user("я третий раз говорю: сумма обязательна", wait=20)
    s.agent("Исправил: сумма обязательна. Какой лимит на один перевод?")
    s.user("уточню позже", wait=15)
    s.agent("Оставил лимит открытым пунктом. БТ записан: coddoc/PAY-5/business_requirements.md.")
    # Агент дважды не учёл поправку — это и петля поправок, и сбой агента: годится любое из двух прочтений.
    return s, {"must": [[("correction_loop", "hurts"), ("agent_slip", "agent")], ("unknowns", "hurts")], "must_not": []}


def p6():
    """Контроль: спека проверена до разбиения, /clear между стадиями, ответы без спешки."""
    s = Session("p6", "25")
    s.slash("analyst-workspace", "PAY-6 Аналитика: БТ готовы")
    s.read("coddoc/PAY-6/business_requirements.md", "services/cards.md")
    s.skill("technical-spec-doc")
    s.agent("Спека записана: coddoc/PAY-6/technical_spec.md. Приёмка technical_spec.md: нарушений нет.")
    s.asked("Что дальше", "Что дальше со спекой?", [item["label"] for item in FINAL], "Проверить спеку", wait=90)
    s.skill("spec-readiness")
    s.agent("Проверка готовности: вопросов задано 6, закрыто цитатой 6, осталось 0. Готово к разработке.")
    s.asked("Что дальше", "Что дальше со спекой?", [item["label"] for item in FINAL], "Разбить на этапы", wait=80)
    s.skill("stage-breakdown-doc")
    s.agent("Этапы записаны: coddoc/PAY-6/stages.md. Здесь можно `/clear`.")
    s.raw_slash("/interaction-diagram coddoc/PAY-6/technical_spec.md", wait=40)  # ручной скилл — не обход оркестратора
    s.agent("Схема записана рядом со спекой.")
    s.raw_slash("/clear", wait=30)
    return s, {"must": [("order", "helps")],
               "must_not": [("hypotheses", "hurts"), ("decisions", "hurts"), ("correction_loop", "hurts"),
                            ("paste", "hurts"), ("entry", "hurts"), ("order", "hurts")]}


def p7():
    """Пошёл дальше при нарушениях приёмки и разбил на этапы без проверки спеки."""
    s = Session("p7", "26")
    s.slash("analyst-workspace", "PAY-7 Аналитика: БТ готовы")
    s.skill("technical-spec-doc")
    s.agent("Спека записана: coddoc/PAY-7/technical_spec.md. Приёмка technical_spec.md: 4 нарушения.")
    s.asked("Спека", "Спека принята — идём дальше?",
            ["Поправить документ сейчас — 4 нарушения, 1 открытый вопрос", "Идти дальше", "Пока остановиться"],
            "Идти дальше", wait=20)
    s.asked("Что дальше", "Что дальше со спекой?", [item["label"] for item in FINAL], "Разбить на этапы", wait=15)
    s.skill("stage-breakdown-doc")
    s.agent("Этапы записаны: coddoc/PAY-7/stages.md.")
    s.user("ок")
    return s, {"must": [("acceptance", "hurts"), ("order", "hurts")], "must_not": [("order", "helps")]}


def p8():
    """Спека заказана словами, без /analyst-workspace: агент сам вызвал пишущий скилл."""
    s = Session("p8", "27")
    s.user("напиши спеку по задаче PAY-8, там надо добавить фильтр операций по дате", wait=5)
    s.skill("technical-spec-doc")
    s.agent("Спека записана: coddoc/PAY-8/technical_spec.md.")
    s.user("спасибо")
    s.agent("Пожалуйста.")
    s.user("ок")
    return s, {"must": [("entry", "hurts")], "must_not": [("entry", "helps")]}


def skipped():
    """Пропускаемые: вызов ретро, короткая сессия, чужой проект."""
    retro = Session("r1", "28")
    retro.user("Посмотрим, как я работаю")
    retro.agent("Запускаю ретро.")
    retro.raw_slash("/retro")
    retro.agent("Ретро готово.")
    short = Session("s1", "28")
    short.user("Привет")
    short.agent("Здравствуйте.")
    other = Session("o1", "28")
    for text in ("Реплика один", "Реплика два", "Реплика три"):
        other.user(text)
        other.agent("Ответ.")
    return [(retro, None), (short, None), (other, "/elsewhere/other-project")]


BUILDERS = (p1, p2, p3, p4, p5, p6, p7, p8)


def build(chats, cwd):
    os.makedirs(chats, exist_ok=True)
    expected = {}
    for builder in BUILDERS:
        session, item = builder()
        expected[session.b.session_id] = item
        write(chats, session, cwd)
    for session, own_cwd in skipped():
        write(chats, session, own_cwd or cwd)
    return {"sessions": expected, "analysed": len(BUILDERS), "weak_sessions": ["p3"],
            "habits": {("hypotheses", "hurts"): 2, ("decisions", "hurts"): 2}}


def write(chats, session, cwd):
    with open(os.path.join(chats, f"{session.b.session_id}.jsonl"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(session.lines(cwd)) + "\n")
