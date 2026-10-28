#!/usr/bin/env python3
"""Самопроверка merge.py: синтетические сессии brief_fixtures + испорченные ответы модели → числа, посчитанные вручную.

    python3 selftest-merge.py

Ручной счёт (сессии bq-1 … bq-4, все оценены; ответа модели по bq-4 нет — модельные метрики по трём сессиям;
параметры — reference/params.json, но минимум событий 1, иначе на четырёх сессиях почти ничего не измерено):
  места решения по вердикту модели: bq-1 [5] accepted (согласие через 3 с — «не читая»), [12] engaged; bq-2 [5] engaged;
    bq-3 [5] — верный ответ «no», не в счёт → 3 места:
    active_review 2/3 = 0.667 → 100 · blind_confirms 1/3 = 0.333 → (0.333 − 0.5) / (0.1 − 0.5) → 42 ·
    delegated 0/3 → 100 · ignored 0/3 → 100
  completion: запусков 4; bq-1 кончился вопросом «Добавить раздел…?» — модель: no, доведён; bq-2 — вопросом о коде
    ошибки — модель: yes, обрыв (следующая сессия через сутки — не продолжение); bq-3, bq-4 — без висящего вопроса
    → 3/4 = 0.75 → (0.75 − 0.5) / (0.9 − 0.5) = 62.5 → 63
  task_setup (поздние вводные): задач 1 + 1 + 1 (по запуску на сессию); bq-1 [1] (вторая находка на том же ходе
    отброшена) → 1/3 = 0.333 → 42
  loaded_context: вызовов скиллов 4, все в первом ходе — контекста перед ними ещё нет, сжатий нет → 0/4 → 100
  skill_share: реплик (с ответами на вопросы с вариантами) внутри запусков 5 + 6 + 5 + 4 = 20 из 6 + 7 + 6 + 5 = 24
    → 0.833 → 100
  общий: (10 · (100 + 42 + 100 + 100 + 63 + 42 + 100) + 5 · 100) / 75 = 5970 / 75 = 79.6 → 80; фрод: обход (bq-3) и
  неподтверждённое как подтверждённое (bq-2) → hold. С минимумом событий 5 измерена только skill_share (вес 5 из 75)
  → скор не посчитан. Находки убранных видов (ухудшение агента, нечёткая постановка, переход к задаче) отбрасываются.
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REFERENCE = os.path.join(HERE, "..", "session-quality", "reference")
sys.path.insert(0, REFERENCE)
sys.path.insert(0, HERE)
import brief_fixtures  # noqa: E402
import collect  # noqa: E402
import contract  # noqa: E402
import grade_brief  # noqa: E402
import merge  # noqa: E402
import params  # noqa: E402


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    root = tempfile.mkdtemp(prefix="sq-merge-")
    sessions = os.path.join(root, "sessions", "user-01")
    work, out = os.path.join(root, "work"), os.path.join(root, "out")
    os.makedirs(sessions)
    expected = brief_fixtures.build(sessions)
    with contextlib.redirect_stdout(io.StringIO()):
        collect.main(["--sessions", sessions, "--out", work])
    loose = params.load()
    loose["evaluation"]["min_events"]["value"] = 1
    loose_path = os.path.join(root, "params-min1.json")
    with open(loose_path, "w", encoding="utf-8") as handle:
        json.dump(loose, handle, ensure_ascii=False)

    journals = {}
    for session_id in expected:
        with open(os.path.join(work, f"{session_id}.journal.txt"), encoding="utf-8") as handle:
            journals[session_id] = handle.read()
    perfect = {session_id: grade_brief.perfect_answer(session_id, journals[session_id],
                                                      dict(expected[session_id], background=False))
               for session_id in expected}

    # Порча ответов — то, что модель делала на прогонах. Номера ходов — по тексту: в выгрузке они свои.
    turn_of = {session_id: (lambda text, sid=session_id: grade_brief.turn_with(journals[sid], text)) for session_id in journals}
    bq1_start, bq1_end = turn_of["bq-1"]("Делаем БТ по уведомлениям"), turn_of["bq-1"]("Хорошо. Документ сохранён")
    bq2_end = turn_of["bq-2"]("Раздел ошибок без одного кода")
    bq1 = perfect["bq-1"]
    bq1["findings"].append({"type": "degradation", "turn": bq1_end, "quote": "Добавить в него раздел",
                            "earlier_turn": bq1_start, "caught_turn": None})  # вид убран — отбрасывается
    bq1["findings"] += [{"type": "late_requirement", "turn": bq1_end, "quote": "этого в журнале нет"},
                        {"type": "vague_request", "turn": bq1_start, "quote": "Делаем БТ по уведомлениям клиента"},
                        {"type": "late_requirement", "turn": bq1_start, "quote": "Срок хранения уведомлений — 90 дней"},
                        {"type": "late_requirement", "turn": bq1_start, "quote": "Делаем БТ по уведомлениям клиента"}]
    first_try = dict(bq1, findings=[])
    bq2 = perfect["bq-2"]
    for item in bq2["findings"]:
        if item["type"] == "off_topic":
            item["note"] = "подарок жене и отпуск"
    bq2["findings"].append({"type": "off_topic", "turn": 15, "category": "non_work", "turns": 0})
    bq2["findings"].append({"type": "task_switch", "turn": 6, "quote": "Слушай, не по работе"})
    bq3 = perfect["bq-3"]
    bq3["findings"].append(dict(next(item for item in bq3["findings"] if item["type"] == "bypass")))  # тот же обход дважды
    bq3["findings"].append({"type": "degradation", "turn": 6, "quote": "Отмечаю спеку как переданную в разработку.",
                            "earlier_turn": None, "caught_turn": None})
    answers = {"bq-1": json.dumps(first_try, ensure_ascii=False) + "\n\nНет, поправлю:\n\n```json\n"
                       + json.dumps(bq1, ensure_ascii=False) + "\n```",
               "bq-2": json.dumps(bq2, ensure_ascii=False),
               "bq-3": json.dumps(bq3, ensure_ascii=False)}  # по bq-4 ответа модели нет
    for session_id, text in answers.items():
        with open(os.path.join(work, f"{session_id}.findings.txt"), "w", encoding="utf-8") as handle:
            handle.write(text)

    screen = io.StringIO()
    with contextlib.redirect_stdout(screen):
        code = merge.main(["--work", work, "--out", out, "--date", "2026-10-27", "--params", loose_path, "--keep-work"])
        strict = merge.main(["--work", work, "--out", os.path.join(root, "strict"), "--date", "2026-10-27", "--keep-work"])

    failures, checks = [], 0

    def expect(condition, message):
        nonlocal checks
        checks += 1
        if not condition:
            failures.append(message)

    expect(code == 0 and strict == 0, f"код выхода {code}, {strict}: {screen.getvalue()}")
    doc = json.load(open(os.path.join(out, "user-01-2026-10-27.json"), encoding="utf-8"))
    report = open(os.path.join(out, "user-01-2026-10-27.md"), encoding="utf-8").read()
    log = open(os.path.join(work, "merge-log.txt"), encoding="utf-8").read()
    with open(merge.SCHEMA_PATH, encoding="utf-8") as handle:
        expect(not contract.check_document(doc, json.load(handle)), "выход проходит contract.py")

    # Посылки ручного счёта — факты collect.
    facts = {sid: json.load(open(os.path.join(work, f"{sid}.facts.json"), encoding="utf-8")) for sid in expected}
    expect([facts[s]["user_turns"] for s in ("bq-1", "bq-2", "bq-3", "bq-4")] == [6, 7, 6, 5],
           "реплики 6/7/6/5 — ответ на вопрос с вариантами тоже реплика")
    expect([[run["user_turns"] for run in facts[s]["runs"]] for s in ("bq-1", "bq-2", "bq-3", "bq-4")] == [[5], [6], [5], [4]],
           "реплик внутри запусков 5/6/5/4")
    expect([[run["context_share_before"] for run in facts[s]["runs"]] for s in ("bq-1", "bq-2", "bq-3", "bq-4")]
           == [[0.0], [0.0], [0.0], [0.0]], "контекст перед вызовами: токены — с конца прошлого хода, а скиллы вызваны в первом")
    expect([[item["turn"] for item in facts[s]["decisions"]] for s in ("bq-1", "bq-2", "bq-3", "bq-4")]
           == [[turn_of["bq-1"]("ПОЛЬЗОВАТЕЛЬ: да"), turn_of["bq-1"]("90 дней, я же писал")],
               [turn_of["bq-2"]("ОТВЕТ: Формат")], [turn_of["bq-3"]("Пропусти проверку готовности")],
               [turn_of["bq-4"]("ОТВЕТ: Порядок"), turn_of["bq-4"]("ПОЛЬЗОВАТЕЛЬ: да")]], "кандидаты мест решения")
    expect(facts["bq-1"]["decisions"][0]["seconds"] == 3.0, f"bq-1: согласие через 3 с {facts['bq-1']['decisions'][0]}")
    expect([item["seconds"] for item in facts["bq-2"]["decisions"]] == [75.0],
           "вопрос с вариантами: время показа не выгружается — от прошлого события (вызов скилла) до ответа")

    metrics = {item["id"]: item for item in doc["metrics"]}
    want = {"active_review": (0.667, 100, 0, 3), "blind_confirms": (0.333, 42, 1, 3), "delegated": (0.0, 100, 0, 3),
            "ignored": (0.0, 100, 0, 3), "completion": (0.75, 63, 1, 4), "task_setup": (0.333, 42, 1, 3),
            "loaded_context": (0.0, 100, 0, 4), "skill_share": (0.833, 100, 0, 24)}
    for metric_id, (value, score, hits, events) in want.items():
        got = metrics[metric_id]
        expect(got["status"] == "measured" and abs(got["value"] - value) <= 0.0005 and got["score"] == score
               and got["sessions_hit"] == hits and got["events"] == events,
               f"{metric_id}: value {got['value']}, score {got['score']}, hits {got['sessions_hit']}, events {got['events']}; "
               f"ждали {value}, {score}, {hits}, {events}")
    expect(doc["score"] == {"value": 80, "status": "hold", "reason": "фрод: сигналов к проверке — 2", "measured_weight": 100},
           f"скор {doc['score']}")
    expect(doc["params"]["min_events"] == 1 and doc["params"]["file"] == loose_path, f"параметры в выходе {doc['params']}")
    kinds = {signal["kind"]: signal for signal in doc["fraud"]["signals"]}
    expect(set(kinds) == {"bypass", "deception"}, f"сигналы фрода {sorted(kinds)}")
    expect(kinds.get("bypass", {}).get("count") == 1, "обход: одна и та же находка дважды — один сигнал")
    topic = doc["discipline"]["off_topic"]
    expect(topic["cases"] == 1 and topic["replies"] == 2
           and topic["evidence"] == [{"session": "bq-2", "turn": 6, "category": "personal", "turns": 2}],
           f"посторонние темы — вне скора, без пересказа: {topic}")
    expect(set(doc["environment"]) == {"tool_errors", "api_errors", "compressions"}, f"окружение {doc['environment']}")
    expect([item["id"] for item in doc["metrics"]] == list(params.IMPLEMENTED_METRICS), "порядок метрик")
    completion = metrics["completion"]["evidence"]
    expect([(item["session"], item["turn"]) for item in completion] == [("bq-2", bq2_end)]
           and "без ответа работа не закончена" in completion[0]["note"], f"обрыв — bq-2 [{bq2_end}]: {completion}")
    expect([(item["session"], item["turn"], item["note"]) for item in metrics["task_setup"]["evidence"]]
           == [("bq-1", bq1_start, "вводные задним числом")], f"поздние вводные: {metrics['task_setup']['evidence']}")
    for line in ("цитата не подтвердилась", "вырезан пересказ", "turns: меньше 1", "самоисправление", "bq-4: нет ответа модели",
                 f"late_requirement в ходе {bq1_start} — на ходе уже есть такая находка", "находка отброшена — $.type"):
        expect(line in log, f"в merge-log.txt нет «{line}»")

    strict_doc = json.load(open(os.path.join(root, "strict", "user-01-2026-10-27.json"), encoding="utf-8"))
    expect(strict_doc["score"]["status"] == "insufficient" and strict_doc["score"]["measured_weight"] == 6.67
           and strict_doc["score"]["reason"] == "измерено 6.67 % веса — меньше 50",
           f"минимум событий 5: измерена только работа через скиллы → скор не посчитан: {strict_doc['score']}")
    blind_strict = next(item for item in strict_doc["metrics"] if item["id"] == "blind_confirms")
    expect(blind_strict["status"] == "not_measured" and blind_strict["reason"] == "мало событий: 3, нужно от 5",
           f"метрика с одним событием не считается: {blind_strict}")

    expect("**Скор: 80 из 100 — не окончательный:**" in report, "отчёт: скор и статус")
    expect(log.count("находка отброшена — $.type") == 4, "убранные виды находок отброшены все четыре")
    expect("Обход правил и проверок" in report and "Неподтверждённое выдаётся за подтверждённое" in report, "отчёт: фрод")
    expect("## Дисциплина" in report and "личное, реплик — 2" in report, "отчёт: посторонние темы — в дисциплине, без содержания")
    for secret in ("подарить", "жене", "отпуск", "Турция", "Qw3rty", "4111"):
        expect(secret not in report and secret not in json.dumps(doc, ensure_ascii=False),
               f"в выход попало личное или секрет: «{secret}»")

    # Перепроверка фрода: задания — по тем же находкам, что принял merge; «no» снимает, «yes» и мусор — оставляют.
    import verify  # noqa: E402
    with open(merge.FINDINGS_SCHEMA_PATH, encoding="utf-8") as handle:
        findings_schema = json.load(handle)
    tasks = {session_id: verify.tasks_for(session_id, answers[session_id], journals[session_id], findings_schema)
             for session_id in answers}
    deception_turn = turn_of["bq-2"]("Запиши в спеке, что лимит")
    bypass_turn = turn_of["bq-3"]("Пропусти проверку готовности")
    expect([name for name, _text in tasks["bq-2"]] == [verify.task_name("bq-2", "deception", deception_turn)]
           and [name for name, _text in tasks["bq-3"]] == [verify.task_name("bq-3", "bypass", bypass_turn)]
           and not tasks["bq-1"], f"задания перепроверки — по одной на находку фрода: {[[n for n, _t in v] for v in tasks.values()]}")
    text = tasks["bq-2"][0][1]
    expect(f"[{deception_turn}] ПОЛЬЗОВАТЕЛЬ: Не надо. Запиши в спеке" in text and "Сомневаешься — `no`." in text,
           "задание перепроверки: реплика с окружением журнала и правило сомнения")
    os.makedirs(os.path.join(work, "verify"))
    for name, answer in ((verify.task_name("bq-2", "deception", deception_turn), '{"verdict": "no"}'),
                         (verify.task_name("bq-3", "bypass", bypass_turn), "Да, это обход. {\"verdict\": \"yes\"}")):
        with open(os.path.join(work, "verify", name + ".answer.txt"), "w", encoding="utf-8") as handle:
            handle.write(answer)
    with contextlib.redirect_stdout(io.StringIO()):
        merge.main(["--work", work, "--out", os.path.join(root, "verified"), "--date", "2026-10-27", "--params", loose_path,
                    "--keep-work"])
    verified_doc = json.load(open(os.path.join(root, "verified", "user-01-2026-10-27.json"), encoding="utf-8"))
    verified_log = open(os.path.join(work, "merge-log.txt"), encoding="utf-8").read()
    expect([signal["kind"] for signal in verified_doc["fraud"]["signals"]] == ["bypass"]
           and f"deception в ходе {deception_turn} — перепроверка не подтвердила, снята" in verified_log,
           f"перепроверка «no» снимает находку, «yes» — оставляет: {verified_doc['fraud']['signals']}")
    with open(os.path.join(work, "verify", verify.task_name("bq-2", "deception", deception_turn) + ".answer.txt"),
              "w", encoding="utf-8") as handle:
        handle.write("не знаю")
    with contextlib.redirect_stdout(io.StringIO()):
        merge.main(["--work", work, "--out", os.path.join(root, "verified2"), "--date", "2026-10-27", "--params", loose_path])
    kept = json.load(open(os.path.join(root, "verified2", "user-01-2026-10-27.json"), encoding="utf-8"))
    expect(sorted(signal["kind"] for signal in kept["fraud"]["signals"]) == ["bypass", "deception"],
           "перепроверка без разобранного ответа — находка остаётся к ручной проверке")
    side_log = os.path.join(root, "verified2", "user-01-2026-10-27.log.txt")
    expect(not os.path.exists(work) and os.path.exists(side_log)
           and "не разобрана — находка остаётся" in open(side_log, encoding="utf-8").read(),
           "без --keep-work рабочая папка убрана, журнал отброшенного — рядом с отчётом")

    if failures:
        print("\n".join(failures))
        print(f"selftest-merge: провалов {len(failures)} из {checks}; папка оставлена: {root}")
        return 1
    shutil.rmtree(root, ignore_errors=True)
    print(f"selftest-merge: {checks}/{checks}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
