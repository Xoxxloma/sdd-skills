#!/usr/bin/env python3
"""merge — последний шаг оценки: факты collect + находки модели → session-quality/4 и отчёт.

    python3 merge.py --work <папка collect> --out <папка отчёта> [--date ГГГГ-ММ-ДД] [--params <файл>] [--keep-work]

В --work лежат collect.json, <id>.facts.json, <id>.journal.txt (их пишет collect) и <id>.findings.txt — ответ
модели на brief.md как есть. Пишет в --out <user>-<дата>.json (проверен contract.py) и <user>-<дата>.md,
в --work — merge-log.txt: что из ответов модели отброшено и почему.

Модель ничего не считает: доли, скоры и статусы считаются здесь, пороги и веса — из params.json (или --params).
Находка модели без подтверждённой цитаты выпадает; у посторонней темы пересказ вырезается; битая находка
отбрасывается одна, а не весь ответ; поздние вводные — одна находка на ход.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timezone

import collect
import contract
import params

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(HERE, "session-quality.schema.json")
FINDINGS_SCHEMA_PATH = os.path.join(HERE, "findings.schema.json")

SOURCES = {"active_review": "script+model", "blind_confirms": "script+model", "delegated": "script+model",
           "ignored": "script+model", "completion": "script+model", "task_setup": "model",
           "loaded_context": "script", "skill_share": "script"}
UNDECIDED = "?"  # спорная концовка запуска без вердикта модели
FRAUD_NAMES = {"deception": "Неподтверждённое выдаётся за подтверждённое", "bypass": "Обход правил и проверок",
               "autoinput": "Автоматический ввод"}

EVENT_RE = re.compile(r"^\[(\d+)\] (.*)$")
CHECK_RE = re.compile(r"^- (\w+) \[(\d+)\]:")


# ---------------------------------------------------------------- журнал и ответ модели


VERDICTS_HEADER = "Вердикты (сессия [ход] проверка: вердикт):"


def parse_journal(text):
    """(события по ходам, ходы пользователя по порядку, кандидаты раздела «Проверить»)."""
    body, _, checks = text.partition(collect.CHECKS_HEADER)
    events, users = {}, []
    for line in body.splitlines():
        match = EVENT_RE.match(line)
        if not match:
            continue
        turn, content = int(match.group(1)), match.group(2)
        events.setdefault(turn, []).append(content)
        if content.startswith(collect.USER_LABEL + ":") and turn not in users:
            users.append(turn)
    candidates = [(m.group(1), int(m.group(2))) for m in map(CHECK_RE.match, checks.splitlines()) if m]
    return events, users, candidates


def extract_json(text):
    """(объект, пометки, ошибка). Обёртку ``` терпим. Объектов несколько — модель поправила себя после первого
    ответа: берём последний."""
    decoder, objects, index = json.JSONDecoder(), [], 0
    while True:
        start = text.find("{", index)
        if start < 0:
            break
        try:
            value, end = decoder.raw_decode(text, start)
        except ValueError:
            index = start + 1
            continue
        if isinstance(value, dict):
            objects.append(value)
        index = end
    notes = ["ответ в обёртке ```"] if "```" in text else []
    if not objects:
        return None, notes, "не JSON"
    if len(objects) > 1:
        notes.append(f"самоисправление: объектов {len(objects)}, взят последний")
    return objects[-1], notes, None


def norm(text):
    return re.sub(r"\s+", " ", text).strip().strip("«»\"' ")


def quote_in(quote, lines):
    """Цитата есть в одной из строк хода; «…» внутри цитаты — пропуск, куски идут по порядку."""
    pieces = [norm(piece).strip(". ") for piece in norm(quote).split("…")]
    pieces = [piece for piece in pieces if piece]
    if not pieces:
        return False
    for line in lines:
        flat, start = norm(line), 0
        for piece in pieces:
            found = flat.find(piece, start)
            if found < 0:
                break
            start = found + len(piece)
        else:
            return True
    return False


def event_quote(events, turn, prefixes=()):
    """Цитата из журнала для доказательства, которое нашёл скрипт: строка хода с нужной меткой, до 200 символов."""
    lines = [line for line in events[turn] if line.startswith(prefixes)] if prefixes else []
    return collect.clip((lines or events[turn])[0], 199)


def line_quote(events, turn):
    """Текст хода без метки — для реплик пользователя; в ходе с вопросом агента — строка ответа, а не вопроса."""
    lines = events[turn]
    content = next((line for line in lines if line.startswith(("ОТВЕТ:", collect.USER_LABEL + ":"))), lines[0])
    content = content.split(": ", 1)[1] if ": " in content else content
    return collect.clip(content, 199)


def model_findings(session_id, raw, events, users, candidates, schema, log, hidden=()):
    """Проверенные находки модели по сессии; None — ответа нет или он не разобрался. hidden — реплики из одних
    заглушек вставки: находки на них не судимы и отбрасываются."""
    if raw is None:
        log(f"{session_id}: нет ответа модели")
        return None
    answer, notes, error = extract_json(raw)
    for note in notes:
        log(f"{session_id}: {note}")
    if error or not isinstance(answer.get("findings"), list) or not isinstance(answer.get("checks"), list):
        log(f"{session_id}: ответ модели не разобран — {error or 'нет findings или checks'}")
        return None
    defs = schema["$defs"]
    result = {"late_requirement": [], "deception": [], "bypass": {}, "off_topic": [], "checks": {}}
    for item in answer["findings"]:
        if not isinstance(item, dict):
            log(f"{session_id}: находка не объект — отброшена")
            continue
        if item.get("type") == "off_topic" and "note" in item:
            item = {key: value for key, value in item.items() if key != "note"}
            log(f"{session_id}: у посторонней темы в ходе {item.get('turn')} вырезан пересказ")
        definition = defs["topic_finding"] if item.get("type") == "off_topic" else defs["quote_finding"]
        errors = contract.validate(item, definition, schema)
        if errors:
            log(f"{session_id}: находка отброшена — {errors[0]}")
            continue
        turn = item["turn"]
        if turn in hidden:
            log(f"{session_id}: {item['type']} в ходе {turn} — реплика из заглушки вставки, текста нет, отброшена")
            continue
        if item["type"] == "off_topic":
            if turn not in users:
                log(f"{session_id}: посторонняя тема с хода {turn} — не реплика пользователя, отброшена")
                continue
            start = users.index(turn)
            covered = users[start:start + item["turns"]]
            result["off_topic"].append({"session": session_id, "turn": turn, "category": item["category"],
                                        "turns": len(covered), "covered": covered})
            continue
        if turn not in events or not quote_in(item["quote"], events[turn]):
            log(f"{session_id}: {item['type']} в ходе {turn} — цитата не подтвердилась, отброшена")
            continue
        entry = {"session": session_id, "turn": turn, "quote": item["quote"]}
        if item["type"] == "bypass":
            result["bypass"].setdefault(turn, entry)
        elif any(found["turn"] == turn for found in result[item["type"]]):
            log(f"{session_id}: {item['type']} в ходе {turn} — на ходе уже есть такая находка, отброшена")
        else:
            result[item["type"]].append(entry)
    for item in answer["checks"]:
        if not isinstance(item, dict) or contract.validate(item, defs["check"], schema):
            log(f"{session_id}: ответ на проверку отброшен — не по форме")
            continue
        key = (item["check"], item["turn"])
        if key not in candidates:
            log(f"{session_id}: ответ на проверку {key[0]} [{key[1]}], которой нет в журнале, — отброшен")
        elif key in result["checks"]:
            log(f"{session_id}: проверка {key[0]} [{key[1]}] отвечена дважды — взят первый ответ")
        else:
            result["checks"][key] = item["verdict"]
    for key in candidates:
        if key not in result["checks"]:
            log(f"{session_id}: нет ответа на проверку {key[0]} [{key[1]}] — не засчитана")
    return result


def apply_verification(work, session_id, found, log):
    """Перепроверка фрода (verify.py): ответ «no» снимает находку; ответа нет — находка остаётся к ручной проверке."""
    import verify  # verify сам опирается на merge — импорт здесь, а не в начале

    def keep(kind, turn):
        path = os.path.join(work, "verify", verify.task_name(session_id, kind, turn) + ".answer.txt")
        if not os.path.exists(path):
            return True
        with open(path, encoding="utf-8") as handle:
            verdict = verify.verdict_of(handle.read())
        if verdict is None:
            log(f"{session_id}: перепроверка {kind} в ходе {turn} не разобрана — находка остаётся")
            return True
        if verdict == "no":
            log(f"{session_id}: {kind} в ходе {turn} — перепроверка не подтвердила, снята")
        return verdict == "yes"

    found["deception"] = [entry for entry in found["deception"] if keep("deception", entry["turn"])]
    found["bypass"] = {turn: entry for turn, entry in found["bypass"].items() if keep("bypass", turn)}


# ---------------------------------------------------------------- метрики


def parse_time(text):
    return contract.parse_time(text)


def share(part, whole):
    return round(part / whole, 3) if whole else None


def worse(value, good, bad):
    """Значение хуже нормы — с учётом направления метрики («больше — лучше» или наоборот)."""
    return value is not None and (value > good if bad > good else value < good)


def compute_metrics(scored, model, events, p, all_facts=None):
    """scored — факты оценённых сессий; model — {id сессии: находки модели} по разобранным ответам;
    events — события журналов, из них скрипт берёт цитаты для своих доказательств; all_facts — все сессии,
    по ним видно продолжение работы в следующей сессии."""
    all_facts = scored if all_facts is None else all_facts
    min_events, limit = params.value(p, "min_events"), params.value(p, "evidence_limit")
    threshold, reading = params.value(p, "loaded_context_share"), params.value(p, "reading_speed")
    hours = params.value(p, "continuation_hours")

    def metric(metric_id, value, count, per_session, evidence, reason):
        good, bad, weight = params.metric(p, metric_id)
        measured = value is not None and count >= min_events
        if value is not None and not measured:
            reason = f"мало событий: {count}, нужно от {min_events:g}"
        item = {"id": metric_id, "status": "measured" if measured else "not_measured",
                "value": value if measured else None,
                "score": contract.metric_score(value, good, bad) if measured else None,
                "good": good, "bad": bad, "weight": weight, "source": SOURCES[metric_id], "events": count,
                "sessions_hit": sum(1 for value_ in per_session if worse(value_, good, bad)),
                "evidence": evidence[:limit] if measured else []}
        if not measured:
            item["reason"] = reason
        return item

    with_model = [facts for facts in scored if facts["session"] in model]
    no_model = "нет разобранных ответов модели"
    out = {}

    # Места решения: вердикт модели делит их на «включился», «согласился», «отдал агенту», «ответил не на вопрос».
    # Выбор готового варианта — только в «не читая»: остальные три меряют ответы текстом, иначе меряли бы набор скиллов.
    places, typed_places, picked = 0, 0, {kind: [] for kind in ("engaged", "blind", "delegated", "ignored")}
    per_session = {kind: [] for kind in picked}
    for facts in with_model:
        verdicts = model[facts["session"]]["checks"]
        mine = [(item, verdicts[("decision", item["turn"])]) for item in facts["decisions"]
                if verdicts.get(("decision", item["turn"])) not in (None, "no")]
        typed = [(item, verdict) for item, verdict in mine if not item.get("option")]
        places += len(mine)
        typed_places += len(typed)
        session_picked = {
            "engaged": [item for item, verdict in typed if verdict == "engaged"],
            "blind": [item for item, verdict in mine if verdict == "accepted" and item["speed"] is not None
                      and item["speed"] > reading],
            "delegated": [item for item, verdict in typed if verdict == "delegated"],
            "ignored": [item for item, verdict in typed if verdict == "ignored"],
        }
        for kind, items in session_picked.items():
            picked[kind] += [(facts, item) for item in items]
            per_session[kind].append(share(len(items), len(mine) if kind == "blind" else len(typed)))
    notes = {"engaged": lambda item: "включился по существу",
             "blind": lambda item: f"согласие через {item['seconds']:g} с на {item['agent_chars']} симв. текста агента",
             "delegated": lambda item: "решение отдано агенту",
             "ignored": lambda item: "ответ не на вопрос или предупреждение агента"}
    for metric_id, kind in (("active_review", "engaged"), ("blind_confirms", "blind"), ("delegated", "delegated"),
                            ("ignored", "ignored")):
        whole = places if kind == "blind" else typed_places
        out[metric_id] = metric(metric_id, share(len(picked[kind]), whole) if with_model else None, whole, per_session[kind],
                                [{"session": facts["session"], "turn": item["turn"],
                                  "quote": line_quote(events[facts["session"]], item["turn"]), "note": notes[kind](item)}
                                 for facts, item in picked[kind]],
                                no_model if not with_model else
                                "не было мест решения" if kind == "blind" else "не было мест решения с ответом текстом")

    # Доведение до результата: запуск, кончившийся ошибкой, не в счёт; спорная концовка без вердикта модели — тоже.
    order = sorted(all_facts, key=lambda facts: facts["start"])
    next_start = {current["session"]: following["start"] for current, following in zip(order, order[1:])}

    def continued(facts):
        following = next_start.get(facts["session"])
        return following is not None and (parse_time(following) - parse_time(facts["end"])).total_seconds() <= hours * 3600

    def run_break(run, verdicts):
        question = run["question"]
        if not run["replied"]:
            return "агент после запуска ничего не ответил"
        if question:
            verdict = verdicts.get(("ending", question["turn"]))
            if verdict is None:
                return UNDECIDED
            if verdict == "yes":
                return "висит вопрос агента — без ответа работа не закончена"
        return None

    units, done_total, broken, per_session_done = 0, 0, [], []
    for facts in scored:
        verdicts = model.get(facts["session"], {}).get("checks", {})
        counted = done = 0
        for index, run in enumerate(facts["runs"]):
            if run["error_end"]:
                continue
            reason = run_break(run, verdicts)
            if reason == UNDECIDED:
                continue
            if reason and index == len(facts["runs"]) - 1 and run["ended_by"] == "session_end" and continued(facts):
                reason = None
            counted += 1
            if reason:
                broken.append((facts, run, reason))
            else:
                done += 1
        units += counted
        done_total += done
        per_session_done.append(share(done, counted))
    out["completion"] = metric(
        "completion", share(done_total, units), units, per_session_done,
        [{"session": facts["session"], "turn": run["question"]["turn"] if run["question"] else run["turn"],
          "quote": run["question"]["text"] if run["question"]
          else event_quote(events[facts["session"]], run["turn"], ("СКИЛЛ",)),
          "note": f"запуск {run['skill']}: {reason}"} for facts, run, reason in broken],
        "не было запусков скиллов")

    # Поздние вводные: задачи — запуски скиллов; сессия без них — одна задача.
    tasks_total, bad_total, setup, per_session_setup = 0, 0, [], []
    for facts in with_model:
        found = model[facts["session"]]
        tasks = max(1, len(facts["runs"]))
        # Находка — в задачу своего запуска (до первого запуска — в первую); задача с поздними вводными одна, пример — первый.
        by_task = {}
        for entry in sorted(found["late_requirement"], key=lambda entry: entry["turn"]):
            task = sum(1 for run in facts["runs"][1:] if run["turn"] <= entry["turn"])
            by_task.setdefault(task, dict(entry, note="вводные задним числом"))
        tasks_total += tasks
        bad_total += len(by_task)
        per_session_setup.append(share(len(by_task), tasks))
        setup += sorted(by_task.values(), key=lambda entry: entry["turn"])
    out["task_setup"] = metric("task_setup", share(bad_total, tasks_total) if with_model else None, tasks_total,
                               per_session_setup, setup, no_model)

    # Нагруженный контекст: новая работа в той же сессии — вызов скилла.
    moments, per_session_loaded = [], []
    for facts in scored:
        session_id = facts["session"]
        mine = [(run["turn"], run["context_share_before"], run["after_compression"],
                 event_quote(events[session_id], run["turn"], ("СКИЛЛ",)), "вызов скилла") for run in facts["runs"]]
        heavy = [moment for moment in mine if moment[2] or (moment[1] is not None and moment[1] > threshold)]
        moments += [(session_id, moment, moment in heavy) for moment in mine]
        per_session_loaded.append(share(len(heavy), len(mine)))

    def loaded_note(moment):
        _turn, context, compressed, _quote, kind = moment
        parts = ([f"контекст {round(context * 100)} % окна"] if context is not None else []) + \
                (["после сжатия"] if compressed else [])
        return f"{kind}: {', '.join(parts)}"

    heavy_all = [(session_id, moment) for session_id, moment, is_heavy in moments if is_heavy]
    out["loaded_context"] = metric(
        "loaded_context", share(len(heavy_all), len(moments)), len(moments), per_session_loaded,
        [{"session": session_id, "turn": moment[0], "quote": moment[3], "note": loaded_note(moment)}
         for session_id, moment in sorted(heavy_all, key=lambda item: (item[0], item[1][0]))],
        "не было начал новой работы")

    turns = sum(facts["user_turns"] for facts in scored)
    inside = sum(run["user_turns"] for facts in scored for run in facts["runs"])
    out["skill_share"] = metric("skill_share", share(inside, turns), turns,
                                [share(sum(run["user_turns"] for run in facts["runs"]), facts["user_turns"]) for facts in scored],
                                [], "нет реплик пользователя")

    assert set(out) == set(params.IMPLEMENTED_METRICS)
    return [out[metric_id] for metric_id in params.IMPLEMENTED_METRICS]


# ---------------------------------------------------------------- вне скора


def fraud_signals(all_facts, model, events, p):
    limit = params.value(p, "evidence_limit")
    repeat_min, fast_min = params.value(p, "autoinput_repeat_min"), params.value(p, "autoinput_fast_min")
    signals = []
    for kind in ("deception", "bypass"):
        entries = []
        for found in model.values():
            entries += list(found[kind].values()) if kind == "bypass" else found[kind]
        if entries:
            signals.append({"kind": kind, "status": "to_review", "count": len(entries),
                            "sessions": sorted({entry["session"] for entry in entries}),
                            "evidence": [{key: entry[key] for key in ("session", "turn", "quote")} for entry in entries[:limit]]})

    places = []  # автоввод — только внутри одной сессии
    for facts in all_facts:
        streaks = [item for item in facts["repeat_streaks"] if item["count"] >= repeat_min]
        fast = facts["fast"] if len(facts["fast"]) >= fast_min else []
        places += [(facts["session"], item["turn"], f"одинаковая реплика {item['count']} раз подряд") for item in streaks]
        places += [(facts["session"], item["turn"], f"ответ через {item['seconds']:g} с") for item in fast]
    if places:
        signals.append({"kind": "autoinput", "status": "to_review", "count": len(places),
                        "sessions": sorted({session for session, _turn, _note in places}),
                        "evidence": [{"session": session, "turn": turn, "quote": line_quote(events[session], turn), "note": note}
                                     for session, turn, note in places[:limit]]})
    return signals


def discipline(all_facts, model, p):
    limit = params.value(p, "evidence_limit")
    blocks = [block for facts in all_facts if facts["session"] in model for block in model[facts["session"]]["off_topic"]]
    topic = {"status": "measured" if model else "not_measured", "cases": len(blocks),
             "replies": sum(len(block["covered"]) for block in blocks),
             "sessions": sorted({block["session"] for block in blocks}),
             "evidence": [{key: block[key] for key in ("session", "turn", "category", "turns")} for block in blocks[:limit]]}
    if not model:
        topic["reason"] = "нет разобранных ответов модели"
    return {"off_topic": topic}


def environment(all_facts):
    def env(values, missing):
        values = [value for value in values if value is not None]
        if not values:
            return {"status": "not_measured", "value": None, "reason": missing}
        return {"status": "measured", "value": sum(values)}

    return {
        "tool_errors": env([facts["environment"]["tool_errors"] for facts in all_facts], "в выгрузке нет вызовов инструментов"),
        "api_errors": env([facts["environment"]["api_errors"] for facts in all_facts], "в журнале нет записей об ошибках API"),
        "compressions": env([len(facts["compressions"]) for facts in all_facts], "нет данных"),
    }


# ---------------------------------------------------------------- сборка


def build(work, p, params_file, generated_at=None):
    with open(os.path.join(work, "collect.json"), encoding="utf-8") as handle:
        summary = json.load(handle)
    with open(FINDINGS_SCHEMA_PATH, encoding="utf-8") as handle:
        findings_schema = json.load(handle)
    log_lines = []
    all_facts, model, journals = [], {}, {}
    for item in summary["sessions"]:
        with open(os.path.join(work, item["facts"]), encoding="utf-8") as handle:
            facts = json.load(handle)
        with open(os.path.join(work, item["journal"]), encoding="utf-8") as handle:
            events, users, candidates = parse_journal(handle.read())
        journals[facts["session"]] = events
        raw_path = os.path.join(work, f"{facts['session']}.findings.txt")
        raw = open(raw_path, encoding="utf-8").read() if os.path.exists(raw_path) else None
        found = model_findings(facts["session"], raw, events, users, candidates, findings_schema, log_lines.append,
                               set(facts.get("hidden_turns", [])))
        if found is not None:
            apply_verification(work, facts["session"], found, log_lines.append)
            model[facts["session"]] = found
        all_facts.append(facts)

    scored = [facts for facts in all_facts if facts["scored"]]
    metrics = compute_metrics(scored, model, journals, p, all_facts)
    signals = fraud_signals(all_facts, model, journals, p)
    fraud = {"status": "to_review" if signals else "none", "signals": signals}
    min_weight = params.value(p, "min_measured_weight")
    weight = round(contract.measured_weight(metrics), 2)
    status = contract.score_status(weight, fraud["status"], min_weight)
    if status == "insufficient":
        reason = f"измерено {weight:g} % веса — меньше {min_weight:g}"
    elif status == "hold":
        reason = f"фрод: сигналов к проверке — {len(signals)}"
    else:
        reason = None

    doc = {
        "schema": "session-quality/4",
        "generated_at": generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "subject": {
            "user": summary["user"],
            "sessions_dir": summary["sessions_dir"],
            "period": {"from": min(f["start"] for f in all_facts), "to": max(f["end"] for f in all_facts)} if all_facts else None,
            "sessions_total": len(all_facts),
            "sessions_scored": len(scored),
        },
        "params": {"file": params_file, "min_events": params.value(p, "min_events"), "min_measured_weight": min_weight},
        "score": {"value": contract.total_score(metrics) if status != "insufficient" else None, "status": status,
                  "reason": reason, "measured_weight": weight},
        "metrics": metrics,
        "fraud": fraud,
        "discipline": discipline(all_facts, model, p),
        "environment": environment(all_facts),
        "sessions": [],
    }
    for facts in all_facts:
        item = {"id": facts["session"], "start": facts["start"], "end": facts["end"], "duration_sec": facts["duration_sec"],
                "user_turns": facts["user_turns"], "skills": facts["skills"], "context_peak": facts["context"]["peak_share"],
                "scored": facts["scored"]}
        if not facts["scored"]:
            item["skip_reason"] = facts["skip_reason"]
        doc["sessions"].append(item)
    # Вердикты модели по каждой проверке — без цитат: по ним перепроверяют метрики, когда рабочей папки уже нет.
    options = {(facts["session"], item["turn"]) for facts in all_facts for item in facts["decisions"] if item.get("option")}
    verdict_lines = [f"{session_id} [{turn}] {check}: {verdict}"
                     + (" (выбор варианта)" if check == "decision" and (session_id, turn) in options else "")
                     for session_id, found in model.items()
                     for (check, turn), verdict in sorted(found["checks"].items(), key=lambda pair: (pair[0][1], pair[0][0]))]
    return doc, log_lines, verdict_lines


# ---------------------------------------------------------------- отчёт


def times(count):
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return f"{count} раза"
    return f"{count} раз"


def fmt_value(item):
    return "—" if item["value"] is None else f"{round(item['value'] * 100, 1):g} %"


def fmt_threshold(item):
    return f"{item['good'] * 100:g} % → {item['bad'] * 100:g} %"


def fmt_duration(seconds):
    hours, rest = divmod(int(seconds), 3600)
    return f"{hours} ч {rest // 60:02d} мин" if hours else f"{rest // 60} мин"


def render(doc, p):
    def name(metric_id):
        label = p["metrics"][metric_id].get("label", metric_id)
        return label[:1].upper() + label[1:]

    subject, score = doc["subject"], doc["score"]
    period = subject["period"]
    lines = [f"# Оценка сессий · {subject['user']}", ""]
    if period:
        lines += [f"Период: {period['from'][:10]} — {period['to'][:10]} · сессий: {subject['sessions_total']}, "
                  f"оценено: {subject['sessions_scored']}", ""]
    if score["status"] == "insufficient":
        lines.append(f"**Скор не посчитан:** {score['reason']}.")
    elif score["status"] == "hold":
        lines.append(f"**Скор: {score['value']} из 100 — не окончательный:** {score['reason']}. Сначала посмотрите сигналы ниже.")
    else:
        lines.append(f"**Скор: {score['value']} из 100.**")
    if score["measured_weight"] < 100:
        lines.append(f"Измерено {score['measured_weight']:g} % веса метрик.")
    lines += ["", "## Метрики", "", "| Метрика | Значение | Норма → плохо | Скор | Вес | Событий | Сессий хуже нормы |",
              "|---|---|---|---|---|---|---|"]
    for item in doc["metrics"]:
        if item["status"] == "measured":
            lines.append(f"| {name(item['id'])} | {fmt_value(item)} | {fmt_threshold(item)} | {item['score']} | "
                         f"{item['weight']:g} | {item['events']} | {item['sessions_hit']} |")
    skipped = [item for item in doc["metrics"] if item["status"] != "measured"]
    if skipped:
        lines += ["", "Не измерено: " + "; ".join(f"{name(item['id'])} — {item['reason']}" for item in skipped) + "."]

    lines += ["", "## Фрод — к проверке", ""]
    if not doc["fraud"]["signals"]:
        lines.append("Сигналов нет.")
    for signal in doc["fraud"]["signals"]:
        lines.append(f"- **{FRAUD_NAMES[signal['kind']]}** — {times(signal['count'])}, сессий: {len(signal['sessions'])}")
        for item in signal["evidence"]:
            tail = f" — {item['note']}" if item.get("note") else ""
            lines.append(f"  - сессия {item['session']}, ход {item['turn']}: «{item['quote']}»{tail}")

    topic = doc["discipline"]["off_topic"]
    lines += ["", "## Дисциплина — в скор не входит", ""]
    if topic["status"] != "measured":
        lines.append(f"Посторонние темы: не измерено ({topic['reason']}).")
    elif not topic["cases"]:
        lines.append("Посторонних тем нет.")
    else:
        lines.append(f"Посторонние темы: {times(topic['cases'])}, реплик — {topic['replies']}, сессий — {len(topic['sessions'])}.")
        for item in topic["evidence"]:
            kind = "личное" if item["category"] == "personal" else "нерабочее"
            lines.append(f"- сессия {item['session']}, ход {item['turn']}: {kind}, реплик — {item['turns']}")

    examples = [item for item in doc["metrics"] if item["evidence"]]
    if examples:
        lines += ["", "## Примеры по метрикам", ""]
        for item in examples:
            lines.append(f"**{name(item['id'])}**")
            for proof in item["evidence"]:
                tail = f" — {proof['note']}" if proof.get("note") else ""
                lines.append(f"- сессия {proof['session']}, ход {proof['turn']}: «{proof['quote']}»{tail}")
            lines.append("")
        lines.pop()

    environment_ = doc["environment"]

    def env(key, label):
        value = environment_[key]
        return f"{label}: {value['value']}" if value["status"] == "measured" else f"{label}: не измерено ({value['reason']})"

    lines += ["", "## Окружение — в скор не входит", "",
              "; ".join([env("tool_errors", "ошибки инструментов"), env("api_errors", "ошибки API"),
                         env("compressions", "сжатия контекста")]) + ".", "",
              "## Сессии", "",
              "| Сессия | Начало | Длительность | Реплик | Скиллы | Пик контекста | Оценена |", "|---|---|---|---|---|---|---|"]
    for item in doc["sessions"]:
        peak = f"{round(item['context_peak'] * 100):g} %" if item["context_peak"] is not None else "—"
        mark = "да" if item["scored"] else f"нет — {item['skip_reason']}"
        lines.append(f"| {item['id']} | {item['start'][:16].replace('T', ' ')} | {fmt_duration(item['duration_sec'])} | "
                     f"{item['user_turns']} | {', '.join(item['skills']) or '—'} | {peak} | {mark} |")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- main


def main(argv=None):
    parser = argparse.ArgumentParser(description="Факты collect + находки модели → session-quality/4 и отчёт.")
    parser.add_argument("--work", required=True, help="папка collect с ответами модели <id>.findings.txt")
    parser.add_argument("--out", required=True, help="куда положить JSON и отчёт")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--params", default=None, help="файл параметров (по умолчанию reference/params.json)")
    parser.add_argument("--keep-work", action="store_true", help="не убирать рабочую папку после отчёта (для разбора)")
    cfg = parser.parse_args(argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    try:
        p = params.load(cfg.params)
    except params.ParamsError as error:
        print(f"Параметры не годятся: {error}")
        return 2

    doc, log_lines, verdict_lines = build(cfg.work, p, cfg.params or params.DEFAULT_PATH)
    with open(SCHEMA_PATH, encoding="utf-8") as handle:
        schema = json.load(handle)
    errors = contract.check_document(doc, schema)
    with open(os.path.join(cfg.work, "merge-log.txt"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(log_lines) + ("\n" if log_lines else ""))
    if errors:
        print("Выход не прошёл contract.py — файл не записан:")
        print("\n".join(errors))
        return 1
    os.makedirs(cfg.out, exist_ok=True)
    base = os.path.join(cfg.out, f"{doc['subject']['user']}-{cfg.date}")
    with open(base + ".json", "w", encoding="utf-8") as handle:
        json.dump(doc, handle, ensure_ascii=False, indent=2)
    with open(base + ".md", "w", encoding="utf-8") as handle:
        handle.write(render(doc, p))
    if log_lines or verdict_lines:  # что отброшено и вердикты — рядом с отчётом, рабочая папка дальше не нужна
        with open(base + ".log.txt", "w", encoding="utf-8") as handle:
            verdict_block = [VERDICTS_HEADER] + verdict_lines if verdict_lines else []
            handle.write("\n".join(log_lines + ([""] if log_lines and verdict_block else []) + verdict_block) + "\n")
    if not cfg.keep_work:
        collect.clean_work(cfg.work)
        try:
            os.rmdir(cfg.work)
        except OSError:
            pass  # в папке есть чужие файлы — их не трогаем
    score = doc["score"]
    print(f"Скор: {score['value'] if score['value'] is not None else '—'} ({score['status']})")
    print(f"Сессий: {doc['subject']['sessions_total']}, оценено: {doc['subject']['sessions_scored']}")
    print(f"Сигналов фрода: {len(doc['fraud']['signals'])}")
    print(f"Записей об отброшенном: {len(log_lines)}, вердиктов: {len(verdict_lines)}"
          + (f" — {base}.log.txt" if log_lines or verdict_lines else ""))
    print(f"Куда записано: {base}.json, {base}.md")
    print("Рабочая папка " + ("оставлена" if cfg.keep_work or os.path.isdir(cfg.work) else "убрана") + f": {cfg.work}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
