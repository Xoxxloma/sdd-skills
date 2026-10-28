#!/usr/bin/env python3
"""Контракт выхода specs-quality/1: схема и правила, которые схемой не выразить.

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

FILE_NAMES = {"bt": "business_requirements.md", "spec": "technical_specification.md"}
# Строка «БТ» → какой источник у спеки той же папки.
SOURCE_BY_ROW = {"bug_report": ("bug_report", "bug_report.md"), "change_request": ("change_request", "change_request.md"),
                 "foundation": ("not_passed", None), "absent": ("none", None)}
REASONS = ("below_pct", "zero", "template", "off_form", "by_code")
EXTRA_WHERE = ("template", "origin")


# ---------------------------------------------------------------- формулы


def round_half_up(number):
    return int(math.floor(round(number, 9) + 0.5))


def close(left, right):
    return abs(left - right) <= 1e-9


def score_ok(score, weight):
    """Балл с весом — 0, половина веса или вес: шкала рубрики 0 / 0.5 / 1, умноженная на вес."""
    return any(close(score, weight * level) for level in (0, 0.5, 1))


def total(criteria):
    scored = [item for item in criteria if item["status"] == "scored"]
    points = sum(item["score"] for item in scored)
    maximum = sum(item["weight"] for item in scored)
    pct = round_half_up(100.0 * points / maximum) if maximum else None
    return {"sum": round(points, 4), "max": round(maximum, 4), "pct": pct}


def zeros(criteria):
    return [item["id"] for item in criteria if item["status"] == "scored" and close(item["score"], 0)]


def off_form(missing_count, kind, form_min):
    return missing_count >= form_min[kind]


def origin_verdict(code_signs, traces, form):
    """Первое подходящее сверху — как в рубрике спеки."""
    if len({sign["n"] for sign in code_signs}) >= 2:
        return "by_code"
    if form is not None and not form["off_form"]:
        return "skill"
    if len({trace["n"] for trace in traces}) >= 2:
        return "skill_edited"
    return "outside"


def attention_reasons(document, below_pct):
    reasons = []
    pct = document["total"]["pct"] if document["total"] else None
    if pct is not None and pct < below_pct:
        reasons.append("below_pct")
    if document["zeros"]:
        reasons.append("zero")
    if document["template"] and document["template"]["flag"]:
        reasons.append("template")
    if document["form"] and document["form"]["off_form"]:
        reasons.append("off_form")
    if document["origin"] and document["origin"]["verdict"] == "by_code":
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
    if not path.endswith("/" + FILE_NAMES[kind]):
        errors.append(f"{name}: вид {kind}, а имя файла не {FILE_NAMES[kind]}")
    if kind == "bt" and document["source"] is not None:
        errors.append(f"{name}: у БТ source должен быть null")
    if kind == "spec" and document["source"] is None:
        errors.append(f"{name}: у спеки нет source")
    if kind == "bt" and document["origin"] is not None:
        errors.append(f"{name}: у БТ origin должен быть null")

    allowed_where = set(params.CRITERIA[kind]) | set(EXTRA_WHERE)
    for item in document["unverified"]:
        if item["where"] not in allowed_where:
            errors.append(f"{name}: unverified.where «{item['where']}» — не критерий {kind}, не template и не origin")

    expected_reasons = []
    if document["scored"]:
        criteria = document["criteria"]
        ids = tuple(item["id"] for item in criteria)
        if ids != params.CRITERIA[kind]:
            errors.append(f"{name}: критерии {', '.join(ids)}, а по рубрике {', '.join(params.CRITERIA[kind])}")
            return errors  # дальше счёт по чужим критериям бессмыслен
        weights = doc_params["weights"][kind]
        for item in criteria:
            if not close(item["weight"], weights[item["id"]]):
                errors.append(f"{name}: {item['id']}: вес {item['weight']:g}, в params {weights[item['id']]:g}")
            elif item["status"] == "scored" and not score_ok(item["score"], item["weight"]):
                errors.append(f"{name}: {item['id']}: балл {item['score']:g} не из шкалы 0 / {item['weight'] / 2:g} / {item['weight']:g}")
        expected = total(criteria)
        got = document["total"]
        if not close(got["sum"], expected["sum"]):
            errors.append(f"{name}: total.sum {got['sum']:g}, по критериям {expected['sum']:g}")
        if not close(got["max"], expected["max"]):
            errors.append(f"{name}: total.max {got['max']:g}, по весам без «н/п» {expected['max']:g}")
        if got["pct"] != expected["pct"]:
            errors.append(f"{name}: total.pct {got['pct']}, по формуле {expected['pct']}")
        if document["zeros"] != zeros(criteria):
            errors.append(f"{name}: zeros {document['zeros']}, по баллам {zeros(criteria)}")

        form = document["form"]
        if form is not None:
            numbers = [item["n"] for item in form["missing"]]
            if form["of"] != params.FORM_SECTIONS[kind]:
                errors.append(f"{name}: form.of {form['of']}, в списке рубрики {params.FORM_SECTIONS[kind]}")
            if len(set(numbers)) != len(numbers) or any(number > params.FORM_SECTIONS[kind] for number in numbers):
                errors.append(f"{name}: form.missing — номера повторяются или вне списка 1–{params.FORM_SECTIONS[kind]}")
            expected_off = off_form(len(numbers), kind, doc_params["form_min_missing"])
            if form["off_form"] != expected_off:
                errors.append(f"{name}: form.off_form {form['off_form']}, при {len(numbers)} пропущенных по порогу {expected_off}")

        origin = document["origin"]
        if origin is not None:
            verdict = origin_verdict(origin["code_signs"], origin["traces"], form)
            if origin["verdict"] != verdict:
                errors.append(f"{name}: origin.verdict {origin['verdict']}, по правилу {verdict}")
        expected_reasons = attention_reasons(document, doc_params["below_pct"])

    attention = document["attention"]
    if attention["reasons"] != expected_reasons:
        errors.append(f"{name}: attention.reasons {attention['reasons']}, по правилам {expected_reasons}")
    if attention["flag"] != bool(expected_reasons):
        errors.append(f"{name}: attention.flag {attention['flag']}, причин {len(expected_reasons)}")
    return errors


def check_invariants(doc):
    errors = []
    doc_params = doc["params"]
    documents = doc["documents"]
    by_path = {}
    for document in documents:
        if document["path"] in by_path:
            errors.append(f"документ {document['path']} встречается дважды")
        by_path[document["path"]] = document
        errors += check_document_rules(document, doc_params)

    folders = [row["folder"] for row in doc["rows"]]
    if len(set(folders)) != len(folders):
        errors.append("папки строк повторяются")
    referenced = {}
    for row in doc["rows"]:
        folder = row["folder"]
        foundation = folder.endswith("/_foundation")
        if foundation != (row["bt"].get("none") == "foundation"):
            errors.append(f"строка {folder}: «узел-фундамент» ставится только папке _foundation и всегда ей")
        for column in ("bt", "spec"):
            target = row[column].get("document")
            if target is None:
                continue
            referenced.setdefault(target, []).append(folder)
            document = by_path.get(target)
            if document is None:
                errors.append(f"строка {folder}: нет документа {target}")
                continue
            if document["kind"] != column:
                errors.append(f"строка {folder}: в колонке {column} документ вида {document['kind']}")
            if target != f"{folder}/{FILE_NAMES[document['kind']]}":
                errors.append(f"строка {folder}: документ {target} не из этой папки")
        spec_path = row["spec"].get("document")
        spec = by_path.get(spec_path) if spec_path else None
        if spec is None or spec["source"] is None:
            continue
        if "document" in row["bt"]:
            expected_source = {"kind": "bt", "path": row["bt"]["document"]}
        else:
            source_kind, file_name = SOURCE_BY_ROW[row["bt"]["none"]]
            expected_source = {"kind": source_kind, "path": f"{folder}/{file_name}" if file_name else None}
        if spec["source"] != expected_source:
            errors.append(f"строка {folder}: у спеки источник {spec['source']}, по строке {expected_source}")

    for path in by_path:
        folders_of = referenced.get(path, [])
        if not folders_of:
            errors.append(f"документ {path} не стоит ни в одной строке")
        elif len(folders_of) > 1:
            errors.append(f"документ {path} стоит в {len(folders_of)} строках")

    subject = doc["subject"]
    counts = {"rows_total": len(doc["rows"]), "documents_total": len(documents),
              "documents_scored": sum(1 for item in documents if item["scored"]),
              "documents_attention": sum(1 for item in documents if item["attention"]["flag"])}
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

    def criterion(doc, tail, criterion_id):
        return next(item for item in document(doc, tail)["criteria"] if item["id"] == criterion_id)

    good_bt = "PRJ-101/business_requirements.md"
    good_spec = "PRJ-101/technical_specification.md"
    zero_bt = "PRJ-102/business_requirements.md"
    bug_spec = "PRJ-103/technical_specification.md"
    epic_bt = "PRJ-104/business_requirements.md"
    fnd_spec = "_foundation/technical_specification.md"
    code_spec = "PRJ-105/technical_specification.md"

    def swap_criteria(doc):
        items = document(doc, bug_spec)["criteria"]
        items[1], items[2] = items[2], items[1]

    def fail_document(doc):
        item = document(doc, good_bt)
        item.update(scored=False, skip_reason="две попытки без ответа", criteria=[], total=None, zeros=[], template=None, form=None)
        doc["subject"]["documents_scored"] = 7

    def template_flag(doc):
        item = document(doc, good_bt)
        item["template"] = {"flag": True, "fact": None, "generic": ["повысить эффективность работы"]}
        item["attention"] = {"flag": True, "reasons": ["template"]}
        doc["subject"]["documents_attention"] = 4

    def form_unchecked(doc):
        item = document(doc, epic_bt)
        item["form"] = None
        item["attention"] = {"flag": False, "reasons": []}
        doc["subject"]["documents_attention"] = 2

    def spec_unchecked_form(doc):
        item = document(doc, good_spec)
        item["form"] = None
        item["origin"]["verdict"] = "skill_edited"

    def missing(count):
        return [{"n": n, "title": "раздел"} for n in range(1, count + 1)]

    def bt_five_missing(doc):  # порог БТ — от 5: ровно 5 — уже не по форме
        item = document(doc, good_bt)
        item["form"].update(missing=missing(5), off_form=True)
        item["attention"] = {"flag": True, "reasons": ["off_form"]}
        doc["subject"]["documents_attention"] = 4

    def bt_four_missing(doc):
        document(doc, good_bt)["form"].update(missing=missing(4), off_form=False)

    def spec_exactly_half(doc):  # 50% — не «ниже 50%»: подсвечивает только ноль
        item = document(doc, "PRJ-102/technical_specification.md")
        for criterion_id, score in zip(params.CRITERIA["spec"], (1, 0.5, 0.5, 0.5, 0)):
            next(c for c in item["criteria"] if c["id"] == criterion_id)["score"] = score
        item.update(total={"sum": 2.5, "max": 5, "pct": 50}, zeros=["contracts"], attention={"flag": True, "reasons": ["zero"]})
        doc["subject"]["documents_attention"] = 4

    # Порча → ожидаемый кусок сообщения. Известный результат, а не «хоть какая-то ошибка».
    broken = [
        ("сумма частей", lambda d: document(d, good_spec)["total"].update(sum=4), "total.sum 4, по критериям 4.5"),
        ("максимум без вычета н/п", lambda d: document(d, fnd_spec)["total"].update(max=5), "total.max 5, по весам без «н/п» 4"),
        ("процент", lambda d: document(d, zero_bt)["total"].update(pct=77), "total.pct 77, по формуле 78"),
        ("ноль не в zeros", lambda d: document(d, zero_bt).update(zeros=[]), "zeros [], по баллам ['acceptance']"),
        ("off_form против порога", lambda d: document(d, epic_bt)["form"].update(off_form=False), "form.off_form False, при 9 пропущенных"),
        ("подсветка без причины", lambda d: document(d, good_bt)["attention"].update(flag=True), "attention.flag True, причин 0"),
        ("причина без подсветки", lambda d: document(d, zero_bt)["attention"].update(reasons=[]), "attention.reasons [], по правилам ['zero']"),
        ("лишняя причина", lambda d: document(d, code_spec)["attention"]["reasons"].append("template"), "по правилам ['below_pct', 'zero', 'off_form', 'by_code']"),
        ("н/п не на своём месте", swap_criteria, "критерии source_logic, access, data_model"),
        ("балл не из шкалы", lambda d: criterion(d, good_spec, "access").update(score=0.7), "access: балл 0.7 не из шкалы 0 / 0.5 / 1"),
        ("балл цели по шкале критерия", lambda d: criterion(d, good_bt, "goal").update(score=1), "goal: балл 1 не из шкалы 0 / 0.25 / 0.5"),
        ("вес не из params", lambda d: criterion(d, good_bt, "roles").update(weight=2, score=2), "roles: вес 2, в params 1"),
        ("строка на несуществующий документ", lambda d: d["rows"][0]["spec"].update(document="coddoc/PRJ-101/spec.md"), "нет документа coddoc/PRJ-101/spec.md"),
        ("документ без строки", lambda d: d["rows"][3].update(bt={"none": "absent"}), f"документ coddoc/{epic_bt} не стоит ни в одной строке"),
        ("документ не из своей папки", lambda d: d["rows"][1]["bt"].update(document="coddoc/PRJ-101/business_requirements.md"), "стоит в 2 строках"),
        ("БТ в колонке спеки", lambda d: d["rows"][0].update(bt={"document": "coddoc/PRJ-101/technical_specification.md"}, spec={"document": "coddoc/PRJ-101/business_requirements.md"}), "в колонке bt документ вида spec"),
        ("источник не по строке", lambda d: document(d, bug_spec).update(source={"kind": "none", "path": None}), "у спеки источник"),
        ("фундамент не в _foundation", lambda d: d["rows"][5].update(bt={"none": "foundation"}), "«узел-фундамент» ставится только папке _foundation"),
        ("по коду при одном признаке", lambda d: document(d, code_spec)["origin"]["code_signs"].pop(), "origin.verdict by_code, по правилу outside"),
        ("скилл при форме не цела", lambda d: document(d, good_spec)["form"].update(missing=[{"n": n, "title": "раздел"} for n in range(1, 7)], off_form=True), "origin.verdict skill, по правилу"),
        ("origin у БТ", lambda d: document(d, good_bt).update(origin={"traces": [], "code_signs": [], "verdict": "outside"}), "у БТ origin должен быть null"),
        ("form.of не из рубрики", lambda d: document(d, good_bt)["form"].update(of=15), "form.of 15, в списке рубрики 16"),
        ("номер раздела вне списка", lambda d: document(d, good_spec)["form"]["missing"].append({"n": 24, "title": "лишний"}), "номера повторяются или вне списка 1–23"),
        ("факт без раздела", lambda d: document(d, good_bt)["template"]["fact"].pop("section"), "template.fact: должно подходить ровно под один вариант"),
        ("unverified не туда", lambda d: document(d, zero_bt)["unverified"][0].update(where="contracts"), "unverified.where «contracts» — не критерий bt"),
        ("н/п с баллом", lambda d: criterion(d, bug_spec, "access").update(score=1), "ожидался тип null"),
        ("н/п без причины", lambda d: criterion(d, fnd_spec, "source_logic").update(comment=None), "ожидался тип string"),
        ("не оценён, а баллы есть", lambda d: document(d, good_bt).update(scored=False, skip_reason="нет ответа"), "элементов больше 0"),
        ("оценён с причиной пропуска", lambda d: document(d, good_bt).update(skip_reason="лишнее"), "запрещённый вариант"),
        ("не оценён без причины", lambda d: document(d, good_bt).update(scored=False, criteria=[], total=None, zeros=[], template=None, form=None), "нет поля «skip_reason»"),
        ("счёт документов", lambda d: d["subject"].update(documents_total=9), "subject.documents_total = 9, а по списку 8"),
        ("счёт подсвеченных", lambda d: d["subject"].update(documents_attention=2), "subject.documents_attention = 2, а по списку 3"),
        ("документ дважды", lambda d: d["documents"].append(copy.deepcopy(d["documents"][0])), "встречается дважды"),
        ("лишнее поле", lambda d: d.update(team="a"), "лишнее поле «team»"),
        ("время без пояса", lambda d: d.update(generated_at="2026-10-28T15:00:00"), "часовым поясом"),
        ("true вместо 1", lambda d: criterion(d, good_bt, "roles").update(weight=True), "ожидался тип number"),
    ]
    for name, spoil, expected in broken:
        doc = copy.deepcopy(example)
        spoil(doc)
        errors = check_document(doc, schema)
        if not any(expected in error for error in errors):
            problems.append(f"порча «{name}»: ждали «{expected}», получили {errors or 'OK'}")

    valid = [("оценка не состоялась", fail_document), ("шаблонно — с причиной подсветки", template_flag),
             ("форма БТ не проверена — подсветки нет", form_unchecked),
             ("форма спеки не проверена — не «скилл»", spec_unchecked_form),
             ("БТ без 5 разделов — не по форме", bt_five_missing), ("БТ без 4 разделов — по форме", bt_four_missing),
             ("ровно 50% — не ниже порога", spec_exactly_half)]
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
