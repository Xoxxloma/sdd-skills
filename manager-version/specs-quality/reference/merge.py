#!/usr/bin/env python3
"""merge — последний шаг оценки: строки collect + ответы модели по рубрикам → specs-quality/1.

    python3 merge.py --work <папка collect> [--keep-work]
    python3 merge.py --work <папка collect> --check   # какие ответы перезапустить: нет файла, не JSON, не по схеме

В --work лежат collect.json и задания (их пишет collect) и <id>.findings.txt — ответ модели как есть. Пишет итог по
пути из collect.json, проверенный contract.py; после записи удаляет --work (с --keep-work — оставляет). Выход не
прошёл contract — итог не пишется, папка остаётся для разбора. На экран — что поправлено в ответах и список
«Требуют внимания».

Модель ничего не считает: итог, нули, форму, происхождение и подсветку считает contract.py по params.json. Ответ
разбирается терпимо: последний JSON в тексте; элемент criteria с чужим id отбрасывается, повтор id — берётся
последний, порядок — по рубрике; origin внутри form поднимается. Критерия рубрики нет, балл вне шкалы, ответ не по
схеме — документ «оценка не состоялась». Цитата, которой нет в тексте документа, — в unverified, балл тот же.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # соседние модули находятся и при `python -I`

import contract  # noqa: E402
import params  # noqa: E402
FINDINGS_SCHEMA_PATH = os.path.join(HERE, "findings.schema.json")
NA = "н/п"
RUBRIC_MAX = {"goal": 0.5}  # шкала рубрики: у цели БТ — до 0.5, у остальных критериев — до 1
LIMITS = {"quote": 300, "section": 200, "text": 1000}
NOISE_RE = re.compile(r"[`*_«»\"“”„'’~>|]")
ELLIPSIS_RE = re.compile(r"\s*(?:…|\.\.\.)\s*")
NOT_FOUND = {"не найдено", "не найден", "не найдена", "не найдены", "нет", "отсутствует"}  # «цитата» об отсутствии — это searched
REASON_NAMES = {"below_pct": None, "zero": "ноль", "template": "шаблонно: да", "off_form": "не по форме", "by_code": "по коду"}
KIND_NAMES = {"bt": "БТ", "spec": "спека"}


class Failed(ValueError):
    """Ответ модели не годится — документ «оценка не состоялась»."""


# ---------------------------------------------------------------- разбор ответа


def last_json(text):
    """Последний JSON-объект с criteria: модель, поправившая себя вторым JSON, имеет в виду второй."""
    decoder = json.JSONDecoder()
    found = None
    for match in re.finditer(r"\{", text):
        try:
            value, _ = decoder.raw_decode(text, match.start())
        except ValueError:
            continue
        if isinstance(value, dict) and "criteria" in value:
            found = value
    return found


def repair(answer, kind, log):
    """Известные огрехи формы — без пересмотра баллов. Остальное — к проверке по схеме."""
    rubric_ids = params.CRITERIA[kind]
    if kind == "spec" and "origin" not in answer and isinstance(answer.get("form"), dict) and "origin" in answer["form"]:
        answer["origin"] = answer["form"].pop("origin")
        log.append("origin стоял внутри form — поднят")
    items = answer.get("criteria")
    if isinstance(items, list):
        by_id = {}
        for item in items:
            criterion_id = item.get("id") if isinstance(item, dict) else None
            if criterion_id not in rubric_ids:
                log.append(f"в criteria лишний элемент «{criterion_id}» — отброшен")
                continue
            if criterion_id in by_id:
                log.append(f"критерий {criterion_id} дважды — взят последний")
            by_id[criterion_id] = item
        missing = [criterion_id for criterion_id in rubric_ids if criterion_id not in by_id]
        if missing:
            raise Failed(f"нет критерия {', '.join(missing)}")
        if [item.get("id") for item in items if isinstance(item, dict) and item.get("id") in rubric_ids] != list(rubric_ids):
            log.append("критерии не по порядку рубрики — переставлены")
        answer["criteria"] = [by_id[criterion_id] for criterion_id in rubric_ids]
    return answer


def parse_answer(text, kind, schema, log):
    answer = last_json(text or "")
    if answer is None:
        raise Failed("в ответе модели нет JSON с criteria")
    answer = repair(answer, kind, log)
    errors = contract.validate(answer, schema["$defs"][kind], schema)
    if errors:
        raise Failed("ответ не по схеме: " + "; ".join(errors[:3]))
    for item in answer["criteria"]:
        score = item["score"]
        top = RUBRIC_MAX.get(item["id"], 1)
        if score != NA and not any(contract.close(score, top * level) for level in (0, 0.5, 1)):
            raise Failed(f"{item['id']}: балл {score:g} вне шкалы 0 / {top / 2:g} / {top:g}")
    return answer


# ---------------------------------------------------------------- сверка цитат


def normalize(text):
    return re.sub(r"\s+", " ", NOISE_RE.sub("", text)).strip().casefold()


def quote_found(quote, haystack):
    """Цитата есть в тексте без учёта переносов, разметки и вида кавычек; «…» — пропуск между кусками."""
    pieces = [normalize(piece) for piece in ELLIPSIS_RE.split(quote)]
    return all(piece in haystack for piece in pieces if piece)


def cut(text, limit, log, where):
    if text is not None and len(text) > limit:
        log.append(f"{where}: длиннее {limit} симв. — обрезано")
        return text[:limit - 1] + "…"
    return text


# ---------------------------------------------------------------- документ


def failed_document(meta, reason):
    return {"path": meta["path"], "kind": meta["kind"], "author": meta["author"], "source": meta["source"],
            "scored": False, "skip_reason": reason, "criteria": [], "total": None, "zeros": [], "template": None,
            "form": None, "origin": None, "attention": {"flag": False, "reasons": []}, "unverified": []}


def evidence(items, log, where):
    return [{"section": cut(item["section"], LIMITS["section"], log, where), "quote": cut(item["quote"], LIMITS["quote"], log, where)}
            for item in items]


def scored_document(meta, answer, cfg, haystack, log):
    kind = meta["kind"]
    weights = params.weights(cfg, kind)
    criteria, unverified = [], []
    for item in answer["criteria"]:
        criterion_id, weight = item["id"], weights[item["id"]]
        absent = [e for e in item["evidence"] if normalize(e["quote"]).rstrip(".") in NOT_FOUND]
        if absent:
            item["searched"] = item["searched"] + [e["section"] for e in absent if e["section"] not in item["searched"]]
            log.append(f"{criterion_id}: «не найдено» стояло цитатой — перенесено в searched")
        found = evidence([e for e in item["evidence"] if e not in absent], log, criterion_id)
        unverified += [{"where": criterion_id, "quote": e["quote"]} for e in found if not quote_found(e["quote"], haystack)]
        comment = cut(item["comment"], LIMITS["text"], log, criterion_id)
        if item["score"] == NA:
            if not comment:
                comment = found[0]["quote"] if found else "не применимо"
                log.append(f"{criterion_id}: «н/п» без причины своими словами — взята цитата")
            status, score = "na", None
        else:
            status, score = "scored", round(item["score"] / RUBRIC_MAX.get(criterion_id, 1) * weight, 4)
        criteria.append({"id": criterion_id, "status": status, "score": score, "weight": weight, "evidence": found,
                         "searched": [cut(s, LIMITS["section"], log, criterion_id) for s in item["searched"]],
                         "comment": comment, "fix": cut(item["fix"], LIMITS["text"], log, criterion_id)})

    template = answer["template"]
    fact = evidence([template["fact"]], log, "template")[0] if template["fact"] else None
    if fact and not quote_found(fact["quote"], haystack):
        unverified.append({"where": "template", "quote": fact["quote"]})
    if not template["flag"] and fact is None:
        log.append("«шаблонно: нет» без факта")
    generic = [cut(g, LIMITS["quote"], log, "template") for g in template["generic"]] if template["flag"] else []

    seen, missing = set(), []
    for item in answer["form"]["missing"]:
        if item["n"] in seen or item["n"] > params.FORM_SECTIONS[kind]:
            log.append(f"форма: раздел {item['n']} повтор или вне списка — отброшен")
            continue
        seen.add(item["n"])
        missing.append({"n": item["n"], "title": item["title"]})
    missing.sort(key=lambda item: item["n"])
    form = {"missing": missing, "of": params.FORM_SECTIONS[kind],
            "off_form": contract.off_form(len(missing), kind, cfg["attention"]["form_min_missing"])}

    origin = None
    if kind == "spec":
        signs = [{"n": s["n"], "quote": cut(s["quote"], LIMITS["quote"], log, "origin")} for s in answer["origin"]["code_signs"]]
        unverified += [{"where": "origin", "quote": s["quote"]} for s in signs if not quote_found(s["quote"], haystack)]
        traces = [{"n": t["n"], "what": cut(t["what"], LIMITS["text"], log, "origin")} for t in answer["origin"]["traces"]]
        origin = {"traces": traces, "code_signs": signs, "verdict": contract.origin_verdict(signs, traces, form)}

    document = {"path": meta["path"], "kind": kind, "author": meta["author"], "source": meta["source"], "scored": True,
                "criteria": criteria, "total": contract.total(criteria), "zeros": contract.zeros(criteria),
                "template": {"flag": template["flag"], "fact": fact, "generic": generic}, "form": form, "origin": origin,
                "unverified": unverified}
    reasons = contract.attention_reasons(document, cfg["attention"]["below_pct"])
    document["attention"] = {"flag": bool(reasons), "reasons": reasons}
    return document


def read(path):
    with open(path, encoding="utf-8", errors="replace") as handle:
        return handle.read()


def check_answers(work):
    """Ответы, которые merge не примет: нет файла, нет JSON, не по схеме, нет критерия, балл вне шкалы. → [(meta, причина)]."""
    collected = json.loads(read(os.path.join(work, "collect.json")))
    schema = json.loads(read(FINDINGS_SCHEMA_PATH))
    bad = []
    for meta in collected["documents"]:
        path = os.path.join(work, meta["answer"])
        try:
            if not os.path.exists(path):
                raise Failed("нет ответа модели")
            parse_answer(read(path), meta["kind"], schema, [])
        except Failed as error:
            bad.append((meta, str(error)))
    return bad, collected


def build(work, now=None):
    """→ (документ specs-quality/1, лог поправок, collect)."""
    collected = json.loads(read(os.path.join(work, "collect.json")))
    cfg = params.load(collected["params"])
    schema = json.loads(read(FINDINGS_SCHEMA_PATH))
    root = collected["root"]
    documents, log = [], []
    for meta in collected["documents"]:
        doc_log = []
        answer_path = os.path.join(work, meta["answer"])
        try:
            if not os.path.exists(answer_path):
                raise Failed("нет ответа модели")
            answer = parse_answer(read(answer_path), meta["kind"], schema, doc_log)
            haystack = read(os.path.join(root, meta["path"]))
            if meta["source"] and meta["source"]["path"]:
                haystack += "\n" + read(os.path.join(root, meta["source"]["path"]))
            document = scored_document(meta, answer, cfg, normalize(haystack), doc_log)
        except Failed as error:
            document = failed_document(meta, str(error))
            doc_log.append(f"оценка не состоялась: {error}")
        documents.append(document)
        log += [f"{meta['path']}: {line}" for line in doc_log]

    stamp = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc = {
        "schema": "specs-quality/1",
        "generated_at": stamp,
        "subject": {"documents_dir": collected["documents_dir"], "team": collected["team"], "repo": collected["repo"],
                    "rows_total": len(collected["rows"]), "documents_total": len(documents),
                    "documents_scored": sum(1 for d in documents if d["scored"]),
                    "documents_attention": sum(1 for d in documents if d["attention"]["flag"])},
        "params": {"file": collected["params"], "below_pct": cfg["attention"]["below_pct"],
                   "form_min_missing": cfg["attention"]["form_min_missing"],
                   "weights": {kind: params.weights(cfg, kind) for kind in params.KINDS}},
        "rows": collected["rows"],
        "documents": documents,
    }
    return doc, log, collected


# ---------------------------------------------------------------- экран


def attention_lines(doc, cfg_labels):
    by_path = {d["path"]: d for d in doc["documents"]}
    lines = []
    for row in doc["rows"]:
        for column in ("bt", "spec"):
            target = row[column].get("document")
            document = by_path.get(target) if target else None
            if not document or not document["attention"]["flag"]:
                continue
            total = document["total"]
            parts = [f"{row['key']} · {KIND_NAMES[column]} {total['sum']:g} из {total['max']:g} ({total['pct']}%)"]
            for reason in document["attention"]["reasons"]:
                if reason == "zero":
                    parts.append("ноль: " + ", ".join(cfg_labels[column][c] for c in document["zeros"]))
                elif reason == "off_form":
                    parts.append(f"не по форме: нет {len(document['form']['missing'])} из {document['form']['of']} разделов")
                elif REASON_NAMES[reason]:
                    parts.append(REASON_NAMES[reason])
            lines.append("- " + " · ".join(parts))
    return lines


def main(argv=None):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--work", required=True)
    parser.add_argument("--keep-work", action="store_true")
    parser.add_argument("--check", action="store_true", help="только перечислить ответы, которые надо перезапустить")
    args = parser.parse_args(argv)
    work = os.path.abspath(args.work)
    if args.check:
        try:
            bad, collected = check_answers(work)
        except (OSError, ValueError) as error:
            print(f"Не проверить ответы: {error}")
            return 2
        print(f"Ответов: {len(collected['documents'])}, годных: {len(collected['documents']) - len(bad)}, перезапустить: {len(bad)}")
        for meta, reason in bad:
            print(f"- {meta['id']}: {reason}\n  задание: {os.path.join(work, meta['task'])}\n  ответ: {os.path.join(work, meta['answer'])}")
        return 0
    try:
        doc, log, collected = build(work)
    except (OSError, ValueError, params.ParamsError) as error:
        print(f"Не собрать итог: {error}")
        return 2
    out_schema = json.loads(read(contract.SCHEMA_PATH))
    errors = contract.check_schema_keywords(out_schema) + contract.check_document(doc, out_schema)
    if errors:
        print("Выход не прошёл contract.py — итог не записан, рабочая папка оставлена:")
        print("\n".join(errors))
        return 1
    with open(collected["output"], "w", encoding="utf-8", newline="\n") as handle:
        json.dump(doc, handle, ensure_ascii=False, indent=1)
        handle.write("\n")
    work_left = False
    if not args.keep_work:
        for _ in range(6):  # на Windows папку ненадолго держит сканер или чужой процесс
            shutil.rmtree(work, ignore_errors=True)
            if not os.path.exists(work):
                break
            time.sleep(0.5)
        work_left = os.path.exists(work)

    cfg = params.load(collected["params"])
    labels = {kind: {cid: params.label(cfg, kind, cid) for cid in params.CRITERIA[kind]} for kind in params.KINDS}
    subject = doc["subject"]
    print(f"Итог: {collected['output']}")
    if work_left:
        print(f"Рабочая папка не удалена — её держит другой процесс: {work}. Итог записан; папку можно удалить руками.")
    print(f"Документов: {subject['documents_total']}, оценено: {subject['documents_scored']}, "
          f"не состоялось: {subject['documents_total'] - subject['documents_scored']}, требуют внимания: {subject['documents_attention']}")
    unverified = sum(len(d["unverified"]) for d in doc["documents"])
    if unverified:
        print(f"Цитат не найдено в тексте документа: {unverified} (в unverified, баллы не менялись)")
    if log:
        print(f"Поправлено в ответах модели: {len(log)}")
        print("\n".join("  " + line for line in log))
    print("")
    print("Требуют внимания:")
    lines = attention_lines(doc, labels)
    print("\n".join(lines) if lines else "Сильно некачественных документов нет.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
