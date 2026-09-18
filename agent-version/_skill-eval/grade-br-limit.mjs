// grade-br-limit.mjs — BR-LIMIT: потребитель читает «ограничение» и молчит про «не определено».
//
//   node grade-br-limit.mjs <раунд>/br-limit
//
// R1 — в ответе есть гипотеза/риск про отключённую приёмку (настройка проекта у владельца);
// R2 — нет ни слова про CANCELLED / отменённый акт (строка «не определено» — пробел, не гипотеза);
// A  — анкеры BR-REAL A1–A8 (те же регэкспы), ≥ 3 в прогоне — регресс «не хуже».
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BIZ_ANCHORS = [
  ['A1', /((^|[^0-9])100\s*%|полност[а-яё]*\s+выполн)[\s\S]{0,200}(при[её]мк|акт[аеуы]?\s)|(при[её]мк)[\s\S]{0,200}((^|[^0-9])100\s*%|полност[а-яё]*\s+выполн)/i],
  ['A2', /(отклон[а-яё]*|REJECTED)[\s\S]{0,150}(NONE|возвращ|снова|повторн|заново|можно[\s\S]{0,20}отправ)/i],
  ['A3', /(только|лишь)\s+(прораб|FOREMAN|руковод|владел|OWNER)[\s\S]{0,80}(редактир|измен|управл|приглаш|добавл|удал)/i],
  ['A4', /(прораб|FOREMAN)[\s\S]{0,200}(переназнач|переход|станов|назнача|подтягива)[\s\S]{0,120}(владел|руковод|OWNER)/i],
  ['A5', /(исключ[её]н|удал[её]н|сн[яи]т|убра[нл])[а-яё]*[\s\S]{0,200}(нов[а-яё]*\s+приглаш|повторн[а-яё]*\s+приглаш|мастер-?ссылк|общ[а-яё]*\s+ссылк|e-?mail)/i],
  ['A6', /(публичн[а-яё]*|без\s+(входа|авторизац|регистрац|логин))[\s\S]{0,300}(телефон|цен[аыу]?\s+за\s+единиц|скры|не\s+(показ|видн|отда))/i],
  ['A7', /(истори[а-яё]*\s+(изменени[а-яё]*\s+)?смет|журнал[а-яё]*\s+(изменений\s+)?смет)[\s\S]{0,300}(дельт|разниц|итог[а-яё]*\s+после|сумм[а-яё]*\s+после)/i],
  ['A8', /(автор[а-яё]*|инициатор[а-яё]*)[\s\S]{0,100}(не\s+получа|исключа|кроме)|(кроме|за\s+исключением)\s+(самого\s+)?(автор|инициатор)|(один|выбранн?[а-яё]*|предпочт[а-яё]*)\s+канал/i],
];
const R1 = /(отключ[а-яё]*|выключ[а-яё]*|запрет[а-яё]*)[\s\S]{0,80}(при[её]мк|отправ[а-яё]*\s+(работ|на\s+при[её]мк))|(при[её]мк[а-яё]*|отправк[а-яё]*\s+на\s+при[её]мк[а-яё]*)[\s\S]{0,80}(отключ|выключ|настройк[а-яё]*\s+проект)|настройк[а-яё]*\s+проект[а-яё]*[\s\S]{0,120}(при[её]мк|акт)/i;
const R2 = /CANCELLED|отмен[её]нн[а-яё]*\s+акт|акт[а-яё]*\s+отмен[её]н|отмен[а-яё]*\s+акта/i;
const RE_API = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

const root = process.argv[2];
if (!root || !existsSync(root)) { console.error('нужна папка прогонов'); process.exit(1); }
const runs = readdirSync(root).filter((d) => /^run-/.test(d) && statSync(join(root, d)).isDirectory()).sort();
let n = 0, r1 = 0, r2 = 0, warm = 0, wrote = 0;
console.log(`\nпроба br-limit, ${root}`);
for (const d of runs) {
  const f = join(root, d, 'answer.md');
  const text = existsSync(f) ? readFileSync(f, 'utf8') : '';
  if (!text.trim() || RE_API.test(text)) { console.log(`  ${d}: НЕ ИЗМЕРЕНО`); continue; }
  n++;
  const a = BIZ_ANCHORS.filter(([, re]) => re.test(text)).map(([k]) => k);
  const hasR1 = R1.test(text), hasR2 = R2.test(text);
  const file = walk(join(root, d)).some((p) => /business_requirements\.md$/.test(p));
  if (hasR1) r1++; if (hasR2) r2++; if (a.length >= 3) warm++; if (file) wrote++;
  console.log(`  ${d}: R1 ограничение в гипотезах ${hasR1 ? '✅' : '❌'} · R2 про CANCELLED молчит ${hasR2 ? '❌ (есть)' : '✅'} · анкеров ${a.length} [${a.join(' ')}] · файл ${file ? '⚠ записан' : 'нет'}`);
}
console.log(`  измерено ${n} из ${runs.length} · R1 ${r1}/${n} · R2 чисто ${n - r2}/${n} · анкеров ≥ 3: ${warm}/${n} · файл на первом ходу: ${wrote}`);
