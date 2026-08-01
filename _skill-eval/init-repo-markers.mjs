// Восстанавливает маркеры репозиториев в фикстурах: `<путь>/.git/HEAD`.
//
// ЗАЧЕМ. Половина фикстур `service-map` меряет обнаружение соседних репозиториев — а оно ищет
// их по `**/.git/HEAD`. Сам git вложенные каталоги `.git` не хранит: после свежего клона маркеров
// нет, глоб находит ноль кандидатов, и фикстура молча меряет пустоту. Проверено 2026-08-01:
// на диске 34 маркера, в индексе — ноль.
//
// Поэтому список путей лежит текстом в `REPO-MARKERS.txt` (он коммитится), а маркеры
// материализуются этим скриптом. Список ЯВНЫЙ, а не выведенный по признакам вроде `package.json`:
// в `SM-DISCOVER` часть каталогов — ловушки, они похожи на репозитории и репозиториями не
// являются, а `svc-alpha/vendor/inner` наоборот вложенный репозиторий и маркер ему нужен.
// Угадывать здесь нельзя, можно только перечислить.
//
// Запуск из корня репозитория: node _skill-eval/init-repo-markers.mjs
// Идемпотентен: существующие маркеры не трогает.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const list = join(here, 'REPO-MARKERS.txt');

if (!existsSync(list)) {
  console.error(`нет списка: ${list}`);
  process.exit(1);
}

const paths = readFileSync(list, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
let created = 0, already = 0, missing = 0;

for (const rel of paths) {
  const dir = join(root, rel);
  if (!existsSync(dir)) {
    console.error(`  !! каталога нет, маркер не создан: ${rel}`);
    missing++;
    continue;
  }
  const head = join(dir, '.git', 'HEAD');
  if (existsSync(head)) { already++; continue; }
  mkdirSync(join(dir, '.git'), { recursive: true });
  writeFileSync(head, 'ref: refs/heads/main\n');
  created++;
}

console.log(`маркеров в списке: ${paths.length}; создано: ${created}; уже были: ${already}; каталог отсутствует: ${missing}`);
if (missing) {
  console.error('Список разошёлся с деревом фикстур — правь REPO-MARKERS.txt.');
  process.exit(1);
}
