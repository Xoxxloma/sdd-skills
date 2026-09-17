#!/usr/bin/env bash
# run-sm-gate.sh <SKILL.md> <папка-раунда> [N] — изолированная проба гейта «Бизнес-правила» (фикстура SM-GATE).
# Текст скилла про секцию вырезается из УКАЗАННОГО SKILL.md по якорям: плечо «до» собирается из
# снимка (`git show <commit>:…`), плечо «после» — из живого файла. Инструментов прогон не получает.
set -u
SKILL="${1:?путь к SKILL.md}"; ROUND="${2:?папка раунда}"; N="${3:-3}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; FIX="$HERE/fixtures/SM-GATE"; OUT="$ROUND/sm-gate"
MODEL="${SM_MODEL:-sonnet}"
ln() { grep -n -m1 -- "$1" "$SKILL" | cut -d: -f1; }
B1=$(ln '^- \*\*у `backend` и `fullstack` — строки'); B2=$(ln '^- три правила выше')
O1=$(ln 'строки описи, из которых собираются'); O2=$(ln '^\*\*У каждого ключа контракта в описи стоит строка')
G1=$(ln '^- \*\*Бизнес-правила (ГЕЙТ'); G2=$(ln '^- \*\*Хвост-файл (ГЕЙТ')
U1=$(ln '^\*\*Бюджет: на один сервис'); U2=$(ln '^\*\*Пустой ответ, отказ или ответ без описи')
for x in "$B1" "$B2" "$O1" "$O2" "$G1" "$G2" "$U1" "$U2"; do [ -n "$x" ] || { echo "не нашёл якорь в $SKILL" >&2; exit 1; }; done
mkdir -p "$OUT"; cp "$SKILL" "$OUT/_skill-snapshot.md"
printf 'модель: %s\nпрогонов на вариант: %s\nякоря: бриф %s–%s, опись %s–%s, гейт %s–%s, бюджет %s–%s\n' "$MODEL" "$N" "$B1" "$B2" "$O1" "$O2" "$G1" "$G2" "$U1" "$U2" > "$OUT/_settings.txt"
for ans in "$FIX"/answer-*.md; do
  v="$(basename "$ans" .md)"; v="${v#answer-}"; mkdir -p "$OUT/$v"
  {
    echo 'Ты — ведущий агент скилла `service-map` на Шаге 4: субагент вернул ответ по сервису, и перед записью карточки ты прогоняешь гейт «Бизнес-правила». Ниже — всё, что твой скилл говорит про эту секцию, дословно.'
    echo; echo '### Из брифа субагенту (Шаг 3)'; echo; sed -n "${B1},$((B2-1))p" "$SKILL"
    echo; echo '### Правила описи (Шаг 3)'; echo; sed -n "${O1},$((O2-1))p" "$SKILL"
    echo; echo '### Гейт (Шаг 4)'; echo; sed -n "${G1},$((G2-1))p" "$SKILL"
    echo; echo '### Бюджет доборов'; echo; sed -n "${U1},$((U2-1))p" "$SKILL"
    echo; echo '---'; echo; cat "$ans"; echo
    echo 'Прогони гейт «Бизнес-правила» по этому ответу. По каждому из пяти чисел напиши одной-двумя строками, что с чем сравнил и сошлось ли. Последней строкой ответа — ровно одно из двух: `ГЕЙТ: ПРОЙДЕН` либо `ГЕЙТ: ДОБОР — <что именно потребуешь у субагента>`.'
  } > "$OUT/$v/prompt.md"
  for i in $(seq 1 "$N"); do
    ( cd "$OUT/$v" && claude -p "$(cat prompt.md)" --model "$MODEL" --output-format json > "out-$i.json" 2> "err-$i.log"
      node -e 'const fs=require("fs");let j={};try{j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))}catch(e){};fs.writeFileSync(process.argv[2],j.result||"");fs.writeFileSync(process.argv[3],String(j.total_cost_usd||0))' "out-$i.json" "answer-$i.md" "cost-$i.txt"; rm -f "out-$i.json" ) &
  done
  wait
  echo "  $v — готов"
done
echo "ГОТОВО: $OUT"
