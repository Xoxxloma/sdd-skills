#!/usr/bin/env node
// make-sm-ent.mjs — собирает фикстуру SM-ENT: изолированная проба «сущности — сверка сверху» (2.2.0).
//
//   node make-sm-ent.mjs            → fixtures/SM-ENT/case-*.md + expect.json
//
// Каждый случай — то, что ведущий видит на Шаге 4: счёт маркеров сущностей по коду (3.1), строки
// сущностей описи (с маркером в скобках или без), заголовки блоков «Владеет данными» и строки
// `сущности:` контракта. Ожидание: ДОБОР (с «убери из Владеет данными» и перезаписью `сущности:`)
// либо ПРОЙДЕН. Случаи — с поля 22.09 (navigator, statistic) и два контроля (Mongo, после добора).
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, 'fixtures', 'SM-ENT')
mkdirSync(dir, { recursive: true })

const NAV = ['NavigatorRequestFilter', 'CommonLabels', 'IncidentCategoryStatistic', 'IncidentDamageStatistic', 'IncidentsAndDetentions', 'UorIncident', 'LostSearch', 'UorSecurity', 'UorDetention', 'UorSocialEngineering', 'UorIncidentKind', 'UorFemidaApplication', 'UorFemidaDamage', 'UorFemidaReimbursedDamage', 'UorAntiterrorAndCheck', 'Antiterror', 'Check', 'PerformanceRating']
const NAV_EP = ['GET /api/v1/navigator/informing/incident/statistic/categories', 'GET /api/v1/navigator/informing/incident/statistic/damage', 'GET /api/v1/navigator/uor/security', 'GET /api/v1/navigator/uor/detentions', 'GET /api/v1/navigator/uor/femida/damage', 'GET /api/v1/navigator/perfomance-rating']
const NAV_RET = ['IncidentCategoryStatistic', 'IncidentDamageStatistic', 'UorSecurity', 'UorDetention', 'UorFemidaDamage', 'PerformanceRating']
const STAT = ['ArmataCard', 'ArmataCardImportHistory', 'OperationRisk', 'Setting', 'ArmataCardArea', 'ArmataCardProduct', 'ArmataCardUser', 'ArmataCardCategory', 'ArmataCardDamage', 'ArmataCardComment', 'ArmataCardCriminalCase', 'ArmataCardVulnerability', 'ArmataCardChannel', 'ArmataCardMethod', 'ArmataCardGroup', 'ArmataCardSchema', 'ArmataCardSample', 'ArmataCardCameraAnalysis', 'ArmataCardDenyReason']
const MONGO = ['Order', 'Customer', 'Invoice', 'Payment']

const opis = (names, marker, dirName) => names.map(n => `${n} — ${dirName}/${n}.java${marker ? ` (${marker})` : ''}`)
const contract = (eps, rets, fields) => eps.map((e, i) => `### \`${e}\`\nСрез за период.\nсущности: → ${rets[i]}\n${fields ? '- `labelDate`: `date`\n- `bankName`: `string`\n- `total`: `integer`\n' : '- ответ маппится без исключения полей\n'}`).join('\n')

const text = (svc, markers, opisLines, blocks, contractText) => [
  `Сервис \`${svc}\`, тип \`backend\`, стек Spring (маркеры из таблицы 3.1 применимы). Данные грепов:`,
  '',
  `## Счёт маркеров по коду (Шаг 3.1)`,
  `сущности \`@Entity\\b|^model |@Table\\(\`: ${markers}`,
  '',
  `## Строки сущностей в описи (класс «сущности»; служебные и прочие классы опущены)`,
  opisLines.length ? opisLines.join('\n') : '(строк сущностей нет; ⟹ сущностей 0)',
  '',
  `## Заголовки \`###\` в «Владеет данными» черновика (${blocks.length})`,
  blocks.length ? blocks.map(b => `### \`${b}\``).join('\n') : '—',
  '',
  `## Блоки «Публичного контракта» черновика (выдержка, 6 из 13)`,
  contractText,
].join('\n')

const cases = [
  ['navigator-18-dto-0-markers', text('summary-ms-navigator', 0, opis(NAV, '', 'dto'), NAV, contract(NAV_EP, NAV_RET, false)), 'ДОБОР', 'маркеров 0, 18 блоков DTO без маркера — добор: убрать, поля в блоки ручек, сущности: переписать'],
  ['statistic-19-own-38-markers', text('summary-ms-statistic', 38, opis(STAT, '@Entity', 'entity'), STAT, contract(['GET /api/v1/statistic/armata/card/area', 'GET /api/v1/statistic/slideshow/security'], ['ArmataCardArea', 'не сущность, агрегат по ArmataCard'], false)), 'ПРОЙДЕН', '19 блоков при 38 маркерах — своё'],
  ['mongo-4-schema-0-markers', text('orders-ms', 0, opis(MONGO, '@Schema', 'schema'), MONGO, contract(['GET /api/orders', 'GET /api/customers'], ['Order', 'Customer'], false)), 'ПРОЙДЕН', 'маркеров 0, но опись называет маркер вне таблицы — исключение по грепу'],
  ['navigator-after-dobor', text('summary-ms-navigator', 0, [], [], contract(NAV_EP, NAV_EP.map(() => 'не сущность, ответ summary-ms-consolidate'), true)), 'ПРОЙДЕН', 'после добора: блоков 0, сущности: переписаны — ни сверка сверху, ни «Сущности у ручек» добора не требуют'],
]

const expect = {}
for (const [name, body, want, why] of cases) {
  writeFileSync(join(dir, `case-${name}.md`), body)
  expect[name] = { want, why }
}
writeFileSync(join(dir, 'expect.json'), JSON.stringify(expect, null, 2))
writeFileSync(join(dir, 'README.md'), `# SM-ENT — изолированная проба «сущности — сверка сверху» (service-map 2.2.0)

Собирается \`node make-sm-ent.mjs\`. Каждый \`case-*.md\` — счёт маркеров сущностей по коду, строки
сущностей описи, заголовки «Владеет данными» и строки \`сущности:\` контракта — то, что ведущий видит
после грепов на Шаге 4. Раннер \`run-sm-ent.sh\` даёт прогону текст маркерного гейта, сверки сверху
и проверки «Сущности у ручек» из SKILL.md (по якорям) и один случай; ожидается последняя строка
\`СУЩНОСТИ: ПРОЙДЕН\` либо \`СУЩНОСТИ: ДОБОР\`. У ДОБОР грейдер требует в тексте «убери» и «сущности:».
Ожидания — в \`expect.json\`. Случаи: navigator (агрегатор, поле 22.09), statistic (свои сущности),
Mongo (маркер вне таблицы), navigator после добора.
`)
console.log('SM-ENT:', cases.length, 'случаев →', dir)
