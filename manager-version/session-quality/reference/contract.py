#!/usr/bin/env python3
"""Контракт выхода session-quality/4: схема и правила, которые схемой не выразить.

    python3 contract.py <report.json>   # «OK» или список нарушений, код выхода 1
    python3 contract.py --selftest      # пример проходит, испорченные копии — нет

Без сторонних библиотек: на проме ничего не ставится. Валидатор понимает только
ключевые слова JSON Schema из session-quality.schema.json; незнакомое слово в схеме —
ошибка, а не молчаливый пропуск. Формулы скора здесь же — merge берёт их отсюда.
"""

from __future__ import annotations

import copy
import json
import math
import os
import re
import sys
from datetime import datetime

import params

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(HERE, "session-quality.schema.json")
EXAMPLE_PATH = os.path.join(HERE, "session-quality.example.json")

METRIC_IDS = params.IMPLEMENTED_METRICS
VALUE_TOLERANCE = 0.0005  # value в выходе округлён до трёх знаков

KNOWN_KEYWORDS = {
    "$schema", "$id", "title", "description", "$defs", "$ref", "type", "enum", "const",
    "required", "properties", "additionalProperties", "items", "minItems", "maxItems",
    "minimum", "maximum", "exclusiveMinimum", "minLength", "maxLength", "format",
    "oneOf", "allOf", "not", "if", "then", "else",
}
DATE_TIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")


# ---------------------------------------------------------------- формулы


def round_half_up(number):
    return int(math.floor(round(number, 9) + 0.5))


def metric_score(value, good, bad):
    ratio = (value - bad) / (good - bad)
    return round_half_up(max(0.0, min(1.0, ratio)) * 100)


def measured_weight(metrics):
    total = sum(metric["weight"] for metric in metrics)
    measured = sum(metric["weight"] for metric in metrics if metric["status"] == "measured")
    return 100.0 * measured / total if total else 0.0


def total_score(metrics):
    measured = [metric for metric in metrics if metric["status"] == "measured"]
    weight = sum(metric["weight"] for metric in measured)
    if not weight:
        return None
    return round_half_up(sum(metric["weight"] * metric["score"] for metric in measured) / weight)


def score_status(weight_share, fraud_status, min_weight):
    if weight_share < min_weight:
        return "insufficient"
    if fraud_status == "to_review":
        return "hold"
    return "final"


# ---------------------------------------------------------------- валидатор схемы


def check_schema_keywords(schema, path="#"):
    """Незнакомое ключевое слово в схеме — ошибка: иначе правило молча не проверяется."""
    problems = []
    if not isinstance(schema, dict):
        return problems
    for key, value in schema.items():
        if key not in KNOWN_KEYWORDS:
            problems.append(f"{path}: валидатор не знает ключевого слова «{key}»")
            continue
        if key in ("properties", "$defs"):
            for name, sub in value.items():
                problems += check_schema_keywords(sub, f"{path}/{key}/{name}")
        elif key in ("oneOf", "allOf"):
            for number, sub in enumerate(value):
                problems += check_schema_keywords(sub, f"{path}/{key}/{number}")
        elif key in ("items", "not", "if", "then", "else", "additionalProperties"):
            problems += check_schema_keywords(value, f"{path}/{key}")
    return problems


def same(left, right):
    if isinstance(left, bool) or isinstance(right, bool):
        return isinstance(left, bool) and isinstance(right, bool) and left == right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return left == right
    return type(left) is type(right) and left == right


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def type_ok(value, name):
    if name == "null":
        return value is None
    if name == "boolean":
        return isinstance(value, bool)
    if name == "integer":
        return is_number(value) and float(value).is_integer()
    if name == "number":
        return is_number(value)
    if name == "string":
        return isinstance(value, str)
    if name == "object":
        return isinstance(value, dict)
    if name == "array":
        return isinstance(value, list)
    raise ValueError(f"неизвестный тип в схеме: {name}")


def resolve(ref, root):
    if not ref.startswith("#/$defs/"):
        raise ValueError(f"поддерживаются только ссылки #/$defs/…, а не {ref}")
    return root["$defs"][ref[len("#/$defs/"):]]


def validate(value, schema, root, path="$"):
    errors = []
    if "$ref" in schema:
        errors += validate(value, resolve(schema["$ref"], root), root, path)

    if "type" in schema:
        names = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(type_ok(value, name) for name in names):
            return errors + [f"{path}: ожидался тип {' | '.join(names)}"]

    if "const" in schema and not same(value, schema["const"]):
        errors.append(f"{path}: ожидалось {json.dumps(schema['const'], ensure_ascii=False)}")
    if "enum" in schema and not any(same(value, option) for option in schema["enum"]):
        errors.append(f"{path}: значение не из списка {schema['enum']}")

    if is_number(value):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: меньше {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: больше {schema['maximum']}")
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            errors.append(f"{path}: должно быть больше {schema['exclusiveMinimum']}")

    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: короче {schema['minLength']} симв.")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(f"{path}: длиннее {schema['maxLength']} симв.")
        if schema.get("format") == "date-time" and not DATE_TIME_RE.match(value):
            errors.append(f"{path}: не время ISO 8601 с часовым поясом")

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: элементов меньше {schema['minItems']}")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: элементов больше {schema['maxItems']}")
        if "items" in schema:
            for number, item in enumerate(value):
                errors += validate(item, schema["items"], root, f"{path}[{number}]")

    if isinstance(value, dict):
        for name in schema.get("required", ()):
            if name not in value:
                errors.append(f"{path}: нет поля «{name}»")
        properties = schema.get("properties", {})
        for name, item in value.items():
            if name in properties:
                errors += validate(item, properties[name], root, f"{path}.{name}")
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}: лишнее поле «{name}»")

    for sub in schema.get("allOf", ()):
        errors += validate(value, sub, root, path)
    if "oneOf" in schema:
        results = [validate(value, sub, root, path) for sub in schema["oneOf"]]
        fits = sum(1 for result in results if not result)
        if fits != 1:
            errors.append(f"{path}: должно подходить ровно под один вариант, подошло {fits}")
        if fits == 0:
            errors += min(results, key=len)  # ближайший вариант — его ошибки и есть причина
    if "not" in schema and not validate(value, schema["not"], root, path):
        errors.append(f"{path}: подходит под запрещённый вариант")
    if "if" in schema:
        branch = "then" if not validate(value, schema["if"], root, path) else "else"
        if branch in schema:
            errors += validate(value, schema[branch], root, path)
    return errors


# ---------------------------------------------------------------- правила вне схемы


def parse_time(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def close(left, right):
    return abs(left - right) <= VALUE_TOLERANCE + 1e-9  # ровно полшага округления — не расхождение


def check_invariants(doc):
    errors = []
    metrics = doc["metrics"]
    sessions = doc["sessions"]
    by_id = {}
    for metric in metrics:
        if metric["id"] in by_id:
            errors.append(f"метрика {metric['id']} встречается дважды")
        by_id[metric["id"]] = metric
    missing = [metric_id for metric_id in METRIC_IDS if metric_id not in by_id]
    if missing:
        errors.append(f"нет метрик: {', '.join(missing)}")

    session_ids = [session["id"] for session in sessions]
    if len(set(session_ids)) != len(session_ids):
        errors.append("id сессий повторяются")
    known = set(session_ids)
    scored = [session for session in sessions if session["scored"]]
    scored_ids = {session["id"] for session in scored}

    subject = doc["subject"]
    if subject["sessions_total"] != len(sessions):
        errors.append(f"subject.sessions_total = {subject['sessions_total']}, а сессий {len(sessions)}")
    if subject["sessions_scored"] != len(scored):
        errors.append(f"subject.sessions_scored = {subject['sessions_scored']}, а оценённых {len(scored)}")

    for session in sessions:
        start, end = parse_time(session["start"]), parse_time(session["end"])
        if end < start:
            errors.append(f"сессия {session['id']}: конец раньше начала")
        elif session["duration_sec"] != round((end - start).total_seconds()):
            errors.append(f"сессия {session['id']}: duration_sec не равен концу минус начало")

    period = subject["period"]
    if not sessions:
        if period is not None:
            errors.append("subject.period должен быть null: сессий нет")
    elif period is None:
        errors.append("subject.period пуст, а сессии есть")
    else:
        if parse_time(period["from"]) != min(parse_time(session["start"]) for session in sessions):
            errors.append("subject.period.from — не самое раннее начало сессии")
        if parse_time(period["to"]) != max(parse_time(session["end"]) for session in sessions):
            errors.append("subject.period.to — не самый поздний конец сессии")

    min_events = doc["params"]["min_events"]
    for metric in metrics:
        name = metric["id"]
        if metric["good"] == metric["bad"]:
            errors.append(f"{name}: good и bad совпадают — скор не посчитать")
            continue
        if metric["sessions_hit"] > len(scored):
            errors.append(f"{name}: sessions_hit больше числа оценённых сессий")
        for item in metric["evidence"]:
            if item["session"] not in scored_ids:
                errors.append(f"{name}: доказательство из неоценённой или неизвестной сессии {item['session']}")
        if metric["status"] != "measured":
            continue
        if metric["events"] < min_events:
            errors.append(f"{name}: событий {metric['events']} — меньше {min_events:g}, а метрика посчитана")
        expected = metric_score(metric["value"], metric["good"], metric["bad"])
        if metric["score"] != expected:
            errors.append(f"{name}: score {metric['score']}, по формуле {expected}")

    score = doc["score"]
    share = measured_weight(metrics)
    if abs(score["measured_weight"] - share) > 0.01:
        errors.append(f"score.measured_weight {score['measured_weight']}, по метрикам {round(share, 2)}")
    status = score_status(share, doc["fraud"]["status"], doc["params"]["min_measured_weight"])
    if score["status"] != status:
        errors.append(f"score.status {score['status']}, по правилу {status}")
    if status != "insufficient":
        expected = total_score(metrics)
        if score["value"] != expected:
            errors.append(f"score.value {score['value']}, по формуле {expected}")

    topic = doc["discipline"]["off_topic"]
    for item in topic["evidence"]:
        if item["session"] not in known:
            errors.append(f"посторонние темы: неизвестная сессия {item['session']}")
    if not set(topic["sessions"]) <= known:
        errors.append("посторонние темы: неизвестная сессия в sessions")
    if topic["cases"] < len(topic["evidence"]):
        errors.append("посторонние темы: cases меньше числа примеров")

    for signal in doc["fraud"]["signals"]:
        if not set(signal["sessions"]) <= known:
            errors.append(f"фрод {signal['kind']}: неизвестная сессия в sessions")
        for item in signal["evidence"]:
            if item["session"] not in signal["sessions"]:
                errors.append(f"фрод {signal['kind']}: доказательство из сессии вне списка сигнала")
        if signal["count"] < len(signal["evidence"]):
            errors.append(f"фрод {signal['kind']}: count меньше числа доказательств")
    return errors


# ---------------------------------------------------------------- вход


def load_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def check_document(doc, schema):
    errors = validate(doc, schema, schema)
    if errors:
        return errors  # правила вне схемы опираются на её форму
    return check_invariants(doc)


def selftest():
    schema = load_json(SCHEMA_PATH)
    problems = check_schema_keywords(schema)
    example = load_json(EXAMPLE_PATH)
    problems += [f"пример: {error}" for error in check_document(example, schema)]

    def metric(doc, metric_id):
        return next(item for item in doc["metrics"] if item["id"] == metric_id)

    def unmeasure(doc, metric_id):
        item = metric(doc, metric_id)
        item.update(status="not_measured", value=None, score=None, reason="мало событий")

    def no_fraud(doc):
        doc["fraud"] = {"status": "none", "signals": []}
        doc["score"].update(status="final", reason=None)

    def one_unmeasured(doc):
        unmeasure(doc, "skill_share")
        doc["score"].update(value=68, measured_weight=93.33)

    mostly = ("active_review", "blind_confirms", "delegated", "ignored", "completion")

    def mostly_unmeasured(doc):
        for metric_id in mostly:
            unmeasure(doc, metric_id)
        doc["score"].update(value=None, status="insufficient", reason="измерено 33.33 % веса", measured_weight=33.33)

    # Порча → ожидаемый кусок сообщения. Известный результат, а не «хоть какая-то ошибка».
    broken = [
        ("скор не по формуле", lambda d: d["score"].update(value=70), "score.value 70, по формуле 69"),
        ("скор метрики не по формуле", lambda d: metric(d, "loaded_context").update(score=49), "loaded_context: score 49, по формуле 50"),
        ("final при фроде к проверке", lambda d: d["score"].update(status="final", reason=None), "score.status final, по правилу hold"),
        ("нет метрики", lambda d: d["metrics"].pop(), "нет метрик: skill_share"),
        ("метрика дважды", lambda d: metric(d, "skill_share").update(id="active_review"), "встречается дважды"),
        ("длинная цитата", lambda d: metric(d, "completion")["evidence"][0].update(quote="а" * 201), "quote: длиннее 200 симв."),
        ("категория в метрике", lambda d: metric(d, "completion")["evidence"].append(
            {"session": "05e393e5", "turn": 50, "category": "personal", "turns": 1}), "лишнее поле «category»"),
        ("цитата у посторонних", lambda d: d["discipline"]["off_topic"]["evidence"][0].update(quote="личное"), "лишнее поле «quote»"),
        ("посчитана при малом числе событий", lambda d: (d["params"].update(min_events=5), metric(d, "blind_confirms").update(events=3)),
         "blind_confirms: событий 3 — меньше 5"),
        ("пропущена без причины", lambda d: d["sessions"][6].pop("skip_reason"), "нет поля «skip_reason»"),
        ("оценена с причиной пропуска", lambda d: d["sessions"][0].update(skip_reason="лишнее"), "запрещённый вариант"),
        ("счёт сессий", lambda d: d["subject"].update(sessions_total=10), "sessions_total = 10"),
        ("неизвестная сессия", lambda d: metric(d, "completion")["evidence"][0].update(session="deadbeef"), "неизвестной сессии deadbeef"),
        ("доказательство из пропущенной", lambda d: metric(d, "completion")["evidence"][0].update(session="7c1e09aa"), "неоценённой или неизвестной сессии 7c1e09aa"),
        ("посторонняя тема из чужой сессии", lambda d: d["discipline"]["off_topic"]["evidence"][0].update(session="deadbeef"), "посторонние темы: неизвестная сессия deadbeef"),
        ("фрод none с сигналами", lambda d: d["fraud"].update(status="none"), "элементов больше 0"),
        ("неизвестный вид фрода", lambda d: d["fraud"]["signals"][0].update(kind="repeat_requests"), "значение не из списка"),
        ("лишнее поле", lambda d: d.update(team="a"), "лишнее поле «team»"),
        ("не измерена, а число есть", lambda d: metric(d, "skill_share").update(status="not_measured", reason="нет"), "$.metrics[7].value: ожидался тип null"),
        ("длительность", lambda d: d["sessions"][1].update(duration_sec=2600), "сессия 1f6a2c90: duration_sec"),
        ("период", lambda d: d["subject"]["period"].update(to="2026-10-27T12:00:00Z"), "period.to"),
        ("время без пояса", lambda d: d.update(generated_at="2026-10-27T15:00:00"), "часовым поясом"),
        ("true вместо 1", lambda d: metric(d, "skill_share").update(weight=True), "ожидался тип number"),
        ("мало веса, а скор есть", lambda d: [unmeasure(d, m) for m in mostly],
         "score.status hold, по правилу insufficient"),
    ]
    for name, spoil, expected in broken:
        doc = copy.deepcopy(example)
        spoil(doc)
        errors = check_document(doc, schema)
        if not any(expected in error for error in errors):
            problems.append(f"порча «{name}»: ждали «{expected}», получили {errors or 'OK'}")

    valid = [("без фрода — final", no_fraud), ("одна метрика не измерена — 68 из 93.33 % веса", one_unmeasured),
             ("измерено 33.33 % веса — insufficient", mostly_unmeasured)]
    for name, change in valid:
        doc = copy.deepcopy(example)
        change(doc)
        errors = check_document(doc, schema)
        if errors:
            problems.append(f"верный вариант «{name}» не прошёл: {errors}")

    total = 1 + len(broken) + len(valid)
    if problems:
        print("\n".join(problems))
        print(f"selftest: провалов {len(problems)} из {total} случаев")
        return 1
    print(f"selftest: {total}/{total}")
    return 0


def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    if argv[1:] == ["--selftest"]:
        return selftest()
    if len(argv) != 2:
        print(__doc__.strip())
        return 2
    schema = load_json(SCHEMA_PATH)
    errors = check_schema_keywords(schema) + check_document(load_json(argv[1]), schema)
    if errors:
        print("\n".join(errors))
        return 1
    print(f"OK: {argv[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
