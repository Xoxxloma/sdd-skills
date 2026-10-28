#!/usr/bin/env python3
"""Контракт выхода specs-quality/2: схема и правила, которые схемой не выразить.

    python3 contract.py <specs-quality.json>   # «OK» или список нарушений, код выхода 1
    python3 contract.py --selftest             # пример проходит, испорченные копии — нет

Без сторонних библиотек: на проме ничего не ставится. Валидатор понимает только
ключевые слова JSON Schema из specs-quality.schema.json; незнакомое слово в схеме —
ошибка, а не молчаливый пропуск. Формулы итога, подсветки и происхождения здесь же —
merge берёт их отсюда.
"""

from __future__ import annotations

import copy
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # соседние модули находятся и при `python -I`

import params  # noqa: E402
SCHEMA_PATH = os.path.join(HERE, "specs-quality.schema.json")
EXAMPLE_PATH = os.path.join(HERE, "specs-quality.example.json")

KNOWN_KEYWORDS = {
    "$schema", "$id", "title", "description", "$defs", "$ref", "type", "enum", "const",
    "required", "properties", "additionalProperties", "items", "minItems", "maxItems",
    "minimum", "maximum", "exclusiveMinimum", "minLength", "maxLength", "format",
    "oneOf", "allOf", "not", "if", "then", "else",
}
DATE_TIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")

NA = "н/п"
FILE_NAMES = {"bt": "business_requirements.md", "spec": "technical_specification.md"}
ORIGIN_FINDING = "origin"


# ---------------------------------------------------------------- формулы


def round_half_up(number):
    return int(math.floor(round(number, 9) + 0.5))


def close(left, right):
    return abs(left - right) <= 1e-9


def score_ok(score, weight):
    """Балл с весом — 0, половина веса или вес: шкала рубрики 0 / 0.5 / 1, умноженная на вес."""
    return any(close(score, weight * level) for level in (0, 0.5, 1))


def total(criteria, weights):
    """criteria — {критерий: балл с весом | «н/п»} → (sum, max, pct)."""
    scored = {cid: score for cid, score in criteria.items() if score != NA}
    points = sum(scored.values())
    maximum = sum(weights[cid] for cid in scored)
    pct = round_half_up(100.0 * points / maximum) if maximum else None
    return round(points, 4), round(maximum, 4), pct


def zero_ids(criteria):
    return [cid for cid, score in criteria.items() if score != NA and close(score, 0)]


def lowered_ids(criteria, weights):
    """Критерии, у которых должна быть строка findings: «н/п» или балл ниже веса."""
    return [cid for cid, score in criteria.items() if score == NA or score < weights[cid] - 1e-9]


def off_form(missing_count, kind, form_min):
    return missing_count >= form_min[kind]


DONE_SIGNS = {1, 3, 6}  # код этой задачи уже написан: сделано в прошедшем времени, объём в строках, закрытое изменение


def origin_verdict(code_signs, traces, form_intact):
    """Первое подходящее сверху. form_intact — форма проверена и цела. «По коду» — два разных признака, и среди них
    «уже сделано» (1, 3, 6): пути, рефакторинг и миграции (2, 4, 5) пишет и проект поверх существующего кода."""
    numbers = {sign["n"] for sign in code_signs}
    if len(numbers) >= 2 and numbers & DONE_SIGNS:
        return "by_code"
    if form_intact:
        return "skill"
    if len({trace["n"] for trace in traces}) >= 2:
        return "skill_edited"
    return "outside"


def attention_reasons(document, below_pct, form_min):
    reasons = []
    if document["pct"] is not None and document["pct"] < below_pct:
        reasons.append("below_pct")
    if zero_ids(document["criteria"]):
        reasons.append("zero")
    if document["template"]:
        reasons.append("template")
    if document["form_missing"] is not None and off_form(len(document["form_missing"]), document["kind"], form_min):
        reasons.append("off_form")
    if document["origin"] == "by_code":
        reasons.append("by_code")
    return reasons


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


def check_document_rules(document, doc_params):
    errors = []
    path, kind = document["path"], document["kind"]
    name = f"документ {path}"
    if not path.endswith("/" + FILE_NAMES[kind]) and path != FILE_NAMES[kind]:
        errors.append(f"{name}: вид {kind}, а имя файла не {FILE_NAMES[kind]}")
    if kind == "bt" and document["source"] is not None:
        errors.append(f"{name}: у БТ source должен быть null")
    if not document["scored"]:
        return errors
    if kind == "bt" and document["origin"] is not None:
        errors.append(f"{name}: у БТ origin должен быть null")

    criteria = document["criteria"]
    if tuple(criteria) != params.CRITERIA[kind]:
        errors.append(f"{name}: критерии {', '.join(criteria)}, а по рубрике {', '.join(params.CRITERIA[kind])}")
        return errors  # дальше счёт по чужим критериям бессмыслен
    weights = doc_params["weights"][kind]
    for cid, score in criteria.items():
        if score != NA and not score_ok(score, weights[cid]):
            errors.append(f"{name}: {cid}: балл {score:g} не из шкалы 0 / {weights[cid] / 2:g} / {weights[cid]:g}")
    points, maximum, pct = total(criteria, weights)
    if not close(document["sum"], points):
        errors.append(f"{name}: sum {document['sum']:g}, по критериям {points:g}")
    if not close(document["max"], maximum):
        errors.append(f"{name}: max {document['max']:g}, по весам без «н/п» {maximum:g}")
    if document["pct"] != pct:
        errors.append(f"{name}: pct {document['pct']}, по формуле {pct}")

    missing = document["form_missing"]
    if missing is not None and (missing != sorted(set(missing)) or any(n > params.FORM_SECTIONS[kind] for n in missing)):
        errors.append(f"{name}: form_missing — не по возрастанию, с повтором или вне списка 1–{params.FORM_SECTIONS[kind]}")

    expected = attention_reasons(document, doc_params["below_pct"], doc_params["form_min_missing"])
    if document["attention"] != expected:
        errors.append(f"{name}: attention {document['attention']}, по правилам {expected}")

    finding_ids = [item["criterion"] for item in document["findings"]]
    expected_ids = lowered_ids(criteria, weights) + ([ORIGIN_FINDING] if document["origin"] == "by_code" else [])
    if finding_ids != expected_ids:
        errors.append(f"{name}: findings по {finding_ids}, а нужны ровно по {expected_ids} — сниженные и «н/п» по порядку рубрики")
    return errors


def check_invariants(doc):
    errors = []
    documents = doc["documents"]
    paths = [item["path"] for item in documents]
    for path in sorted({p for p in paths if paths.count(p) > 1}):
        errors.append(f"документ {path} встречается дважды")
    for document in documents:
        errors += check_document_rules(document, doc["params"])
    subject = doc["subject"]
    counts = {"documents_total": len(documents), "documents_scored": sum(1 for item in documents if item["scored"]),
              "documents_attention": sum(1 for item in documents if item["scored"] and item["attention"])}
    for field, value in counts.items():
        if subject[field] != value:
            errors.append(f"subject.{field} = {subject[field]}, а по списку {value}")
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

    def document(doc, tail):
        return next(item for item in doc["documents"] if item["path"].endswith(tail))

    good_bt, good_spec = "PRJ-101/business_requirements.md", "PRJ-101/technical_specification.md"
    zero_bt, part_spec = "PRJ-102/business_requirements.md", "PRJ-102/technical_specification.md"
    bug_spec, epic_bt = "PRJ-103/technical_specification.md", "PRJ-104/business_requirements.md"
    fnd_spec, code_spec = "_foundation/technical_specification.md", "PRJ-105/technical_specification.md"

    def swap_criteria(doc):
        item = document(doc, bug_spec)
        keys = list(item["criteria"])
        keys[1], keys[2] = keys[2], keys[1]
        item["criteria"] = {key: item["criteria"][key] for key in keys}

    def fail_document(doc):
        item = document(doc, good_bt)
        for field in ("pct", "sum", "max", "criteria", "attention", "template", "form_missing", "origin", "findings"):
            item.pop(field)
        item.update(scored=False, skip_reason="нет ответа модели")
        doc["subject"]["documents_scored"] = 7

    def template_flag(doc):
        item = document(doc, good_bt)
        item.update(template=True, attention=["template"])
        doc["subject"]["documents_attention"] = 4

    def form_unchecked(doc):
        item = document(doc, epic_bt)
        item.update(form_missing=None, attention=[])
        doc["subject"]["documents_attention"] = 2

    def bt_five_missing(doc):  # порог БТ — от 5: ровно 5 — уже не по форме
        item = document(doc, good_bt)
        item.update(form_missing=[1, 2, 3, 4, 5], attention=["off_form"])
        doc["subject"]["documents_attention"] = 4

    def bt_four_missing(doc):
        document(doc, good_bt).update(form_missing=[1, 2, 3, 4])

    def spec_exactly_half(doc):  # 50% — не «ниже 50%»: подсвечивает только ноль
        item = document(doc, part_spec)
        item["criteria"] = dict(zip(params.CRITERIA["spec"], (1, 0.5, 0.5, 0.5, 0)))
        item.update(sum=2.5, max=5, pct=50, attention=["zero"])
        item["findings"].insert(2, {"criterion": "services", "comment": "дыра", "fix": "x", "quote": None})
        doc["subject"]["documents_attention"] = 4

    # Порча → ожидаемый кусок сообщения. Известный результат, а не «хоть какая-то ошибка».
    broken = [
        ("сумма частей", lambda d: document(d, good_spec).update(sum=4), "sum 4, по критериям 4.5"),
        ("максимум без вычета н/п", lambda d: document(d, fnd_spec).update(max=5), "max 5, по весам без «н/п» 4"),
        ("процент", lambda d: document(d, zero_bt).update(pct=77), "pct 77, по формуле 78"),
        ("ноль без причины", lambda d: document(d, zero_bt).update(attention=[]), "attention [], по правилам ['zero']"),
        ("не по форме без причины", lambda d: document(d, epic_bt).update(attention=[]), "по правилам ['off_form']"),
        ("причина без повода", lambda d: document(d, good_bt).update(attention=["zero"]), "attention ['zero'], по правилам []"),
        ("лишняя причина", lambda d: document(d, code_spec)["attention"].append("template"), "по правилам ['below_pct', 'zero', 'off_form', 'by_code']"),
        ("н/п не на своём месте", swap_criteria, "критерии source_logic, access, data_model"),
        ("балл не из шкалы", lambda d: document(d, good_spec)["criteria"].update(access=0.7), "access: балл 0.7 не из шкалы 0 / 0.5 / 1"),
        ("балл цели по шкале критерия", lambda d: document(d, good_bt)["criteria"].update(goal=1), "goal: балл 1 не из шкалы 0 / 0.25 / 0.5"),
        ("вес в params не тот, каким считали", lambda d: d["params"]["weights"]["bt"].update(roles=2), "max 4.5, по весам без «н/п» 5.5"),
        ("нет находки у сниженного", lambda d: document(d, part_spec)["findings"].pop(0), "нужны ровно по ['data_model', 'access', 'contracts']"),
        ("находка у полного балла", lambda d: document(d, good_bt)["findings"].append({"criterion": "roles", "comment": "x", "fix": None, "quote": None}),
         "findings по ['roles'], а нужны ровно по []"),
        ("находки не по порядку", lambda d: document(d, part_spec)["findings"].reverse(), "нужны ровно по ['data_model', 'access', 'contracts']"),
        ("по коду без находки origin", lambda d: document(d, code_spec)["findings"].pop(), "нужны ровно по ['source_logic', 'data_model', 'access', 'contracts', 'origin']"),
        ("находка origin без «по коду»", lambda d: document(d, good_spec)["findings"].append({"criterion": "origin", "comment": "x", "fix": None, "quote": None}),
         "нужны ровно по ['access']"),
        ("origin у БТ", lambda d: document(d, good_bt).update(origin="outside"), "у БТ origin должен быть null"),
        ("source у БТ", lambda d: document(d, good_bt).update(source="coddoc/x/bug_report.md"), "у БТ source должен быть null"),
        ("форма не по возрастанию", lambda d: document(d, epic_bt).update(form_missing=[3, 1, 4, 6, 7, 10, 13, 14, 15]), "form_missing — не по возрастанию"),
        ("номер раздела вне списка", lambda d: document(d, good_spec).update(form_missing=[19, 24]), "вне списка 1–23"),
        ("вид не по имени файла", lambda d: document(d, good_spec).update(kind="bt"), "вид bt, а имя файла не business_requirements.md"),
        ("не оценён, а баллы есть", lambda d: document(d, good_bt).update(scored=False, skip_reason="нет ответа"), "запрещённый вариант"),
        ("не оценён без причины", lambda d: [document(d, good_bt).pop(f) for f in ("pct", "sum", "max", "criteria", "attention", "template",
                                                                                   "form_missing", "origin", "findings")] and document(d, good_bt).update(scored=False),
         "нет поля «skip_reason»"),
        ("оценён с причиной пропуска", lambda d: document(d, good_bt).update(skip_reason="лишнее"), "запрещённый вариант"),
        ("чужой критерий", lambda d: document(d, good_bt)["criteria"].update(contracts=1), "лишнее поле «contracts»"),
        ("quote_found: true", lambda d: document(d, part_spec)["findings"][0].update(quote_found=True), "ожидалось false"),
        ("н/п строкой с опечаткой", lambda d: document(d, bug_spec)["criteria"].update(access="н.п"), "ожидался тип number"),
        ("счёт документов", lambda d: d["subject"].update(documents_total=9), "subject.documents_total = 9, а по списку 8"),
        ("счёт подсвеченных", lambda d: d["subject"].update(documents_attention=2), "subject.documents_attention = 2, а по списку 3"),
        ("документ дважды", lambda d: d["documents"].append(copy.deepcopy(d["documents"][0])), "встречается дважды"),
        ("лишнее поле", lambda d: d.update(rows=[]), "лишнее поле «rows»"),
        ("время без пояса", lambda d: d.update(generated_at="2026-10-28T15:00:00"), "часовым поясом"),
        ("true вместо числа", lambda d: document(d, good_bt)["criteria"].update(roles=True), "ожидался тип number"),
    ]
    for name, spoil, expected in broken:
        doc = copy.deepcopy(example)
        spoil(doc)
        errors = check_document(doc, schema)
        if not any(expected in error for error in errors):
            problems.append(f"порча «{name}»: ждали «{expected}», получили {errors or 'OK'}")

    valid = [("оценка не состоялась", fail_document), ("шаблонно — с причиной подсветки", template_flag),
             ("форма не проверена — подсветки нет", form_unchecked), ("БТ без 5 разделов — не по форме", bt_five_missing),
             ("БТ без 4 разделов — по форме", bt_four_missing), ("ровно 50% — не ниже порога", spec_exactly_half)]
    for name, change in valid:
        doc = copy.deepcopy(example)
        change(doc)
        errors = check_document(doc, schema)
        if errors:
            problems.append(f"верный вариант «{name}» не прошёл: {errors}")

    total_cases = 1 + len(broken) + len(valid)
    if problems:
        print("\n".join(problems))
        print(f"selftest: провалов {len(problems)} из {total_cases} случаев")
        return 1
    print(f"selftest: {total_cases}/{total_cases}")
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
