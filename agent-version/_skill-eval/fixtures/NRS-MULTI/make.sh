#!/usr/bin/env bash
# Генератор фикстуры NRS-MULTI — монорепа из ЧЕТЫРЁХ приложений, из которых порог перевалило
# ровно одно.
#
# Зачем ещё одна фикстура при живых RS-MONO, RS-HUB и RS-REAL. У RS-MONO и RS-HUB репа — ОДНО
# приложение, и Шаг 4 в них исполняет одну причину разреза из двух: «сервис не берётся сканом».
# Вторая причина — «в репе несколько сервисов» — на них не меряется вовсе, а вместе с ней не
# меряется и правило «порог решает, лезть ли ВНУТРЬ приложения, а не резать ли репу на
# приложения». NRS-MULTI кладёт скилл ровно на стык этих двух причин: приложений четыре, порог
# перевалило одно.
#
# Четыре ловушки, и все четыре — из текста скилла, а не выдуманы:
#   1. КРОШЕЧНОЕ ПРИЛОЖЕНИЕ. `apps/bot` — 11 файлов, `apps/importer` — 6. Обоим полагается своя
#      строка манифеста: сервису карточка нужна не потому, что он велик, а потому, что он
#      отдельный. Красный исход — «мелочь, вошла в общий кусок» либо молчание о ней.
#   2. ПОРОГ — ПРО ВНУТРЬ, А НЕ ПРО РЕПУ. Над порогом только `apps/api` (720 файлов, 151 ключ).
#      Под-куски полагаются ему одному; `web`, `bot`, `importer` режутся ровно на самих себя.
#      Красный исход — под-куски у `web` («страницы / компоненты / api») или отказ «все под
#      порогом, разрез не нужен».
#   3. ПАПКА С ЭКСПОРТАМИ — НЕ ВСЕГДА `lib`. `packages/ui` — 40 файлов, в каждом `export function`,
#      и при этом НОЛЬ ключей: ни роутов, ни вызовов чужого API, ни состояния, а `package.json`
#      приватный и полей публикации в нём нет. Рядом `packages/contracts` — те же экспорты, но
#      `main`/`exports`/`types` на месте: это `lib` и 22 ключа. Различает их не имя папки.
#   4. ТОПИКИ ЖИВУТ ВНЕ `modules/`. Девять топиков объявлены в `apps/api/src/config/queues.ts`,
#      и ни один из 22 модулей не содержит ни одного маркера событий. Сумма по модулям даёт по
#      классу «события» ноль при девяти событиях в приложении.
#
# Стек и домен выбраны не такими, как у RS-MONO (Nest+GraphQL, прокат техники) и RS-HUB
# (Java/Spring, перевозки): TypeScript, Nest + Next.js, медицинские осмотры. Проверяется правило,
# а не память о примере.
#
# Вызов:  ./make.sh <куда>      →  <куда>/medex/, <куда>/billing-gw/ и <куда>/specs/
# По умолчанию <куда> = ./out (в .gitignore стенда).
set -eu

# Запись файла БЕЗ внешнего процесса. `cat > f <<EOF` — это запуск `cat` на каждый файл, а файлов
# здесь тысяча: на Windows выходит минута вместо десяти секунд. `read` и `printf` встроенные.
w() {
  _f="$1"; _b=''
  while IFS= read -r _l || [ -n "$_l" ]; do _b="$_b$_l
"; done
  printf '%s' "$_b" > "$_f"
}
OUT="${1:-./out}"
R="$OUT/medex"
API="$R/apps/api"
WEB="$R/apps/web"
BOT="$R/apps/bot"
IMP="$R/apps/importer"
UI="$R/packages/ui"
CTR="$R/packages/contracts"

rm -rf "$OUT"
mkdir -p "$R/.git" "$OUT/specs/services"
echo "ref: refs/heads/main" > "$R/.git/HEAD"

w "$R/package.json" <<'EOF'
{ "name": "medex", "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": { "build": "turbo run build", "dev": "turbo run dev" },
  "devDependencies": { "turbo": "*", "typescript": "*" } }
EOF

w "$R/README.md" <<'EOF'
# medex — медицинские осмотры

Монорепа: `apps/api` (Nest), `apps/web` (Next.js), `apps/bot` (Telegram), `apps/importer`
(загрузка лабораторных выгрузок), общие пакеты в `packages/`.
EOF

# ==================================================================================
# apps/api — ЕДИНСТВЕННОЕ приложение над порогом: 720 файлов, 96 эндпоинтов, 41 сущность,
# 5 фоновых задач, 9 топиков.
# ==================================================================================
mkdir -p "$API/src/config" "$API/src/modules"

w "$API/package.json" <<'EOF'
{ "name": "@medex/api", "private": true,
  "scripts": { "start": "nest start", "build": "nest build" },
  "dependencies": { "@nestjs/common": "*", "@nestjs/core": "*", "@nestjs/schedule": "*",
                    "typeorm": "*", "@medex/contracts": "*" } }
EOF

w "$API/src/main.ts" <<'EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
void bootstrap();
EOF

w "$API/src/app.module.ts" <<'EOF'
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

@Module({ imports: [ScheduleModule.forRoot()] })
export class AppModule {}
EOF

# ЛОВУШКА 4: топики объявлены ВНЕ modules/ — ни один модуль маркеров событий не содержит.
w "$API/src/config/queues.ts" <<'EOF'
/** Единственное место, где перечислены топики шины. В коде модулей их нет. */
export const QUEUES = {
  examinationCreated: 'medex.examination.created',
  examinationFinished: 'medex.examination.finished',
  referralIssued: 'medex.referral.issued',
  referralClosed: 'medex.referral.closed',
  labResultReceived: 'medex.lab.result.received',
  invoiceIssued: 'medex.invoice.issued',
  invoicePaid: 'medex.invoice.paid',
  employerRosterSynced: 'medex.employer.roster.synced',
  reportReady: 'medex.report.ready',
} as const;
EOF

w "$API/src/config/app.config.ts" <<'EOF'
export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:3000',
};
EOF

w "$API/src/config/database.config.ts" <<'EOF'
export const databaseConfig = {
  host: process.env.PGHOST ?? 'localhost',
  database: process.env.PGDATABASE ?? 'medex',
  synchronize: false,
};
EOF

# --- таблица модулей: <имя> <эндпоинтов> <сущностей> <задач> <класс> ----------------
# hub    — хаб связности (Шаг 3: звезда)
# core   — ядро, висит на хабе
# perA/B/C — три периферийных кластера: внутри плотно, к хабу единицы ссылок
# cross  — ноль ключей по КАЖДОМУ классу
MODULES="
examination 28 14 0 hub
patient 8 5 0 core
clinic 12 4 0 core
referral 11 3 0 core
doctor 5 3 0 core
employer 6 3 0 core
schedule 4 2 0 core
attachment 1 1 0 core
dictionary 1 2 0 core
audit 1 0 0 core
invoice 9 3 0 perA
tariff 2 0 0 perA
contract 2 1 0 perA
report 3 0 1 perB
analytics 1 0 1 perB
integration 1 0 1 perC
notification 1 0 1 perC
health 0 0 1 perC
common 0 0 0 cross
shared 0 0 0 cross
config 0 0 0 cross
errors 0 0 0 cross
"

# --- матрица связности: <откуда> <куда> <сколько ссылок> ---------------------------
# Звезда вокруг `examination`: 274 конца из 420, то есть 65 %. Между самими пакетами ядра
# ссылок НЕТ — слабого шва внутри ядра не существует, и это факт о репе, а не о прогоне.
# Периферия отходит чисто: внутри кластера десятки, к хабу единицы.
LINKS="
examination patient 34
examination clinic 26
examination referral 24
examination doctor 20
examination employer 18
examination schedule 16
examination attachment 12
examination dictionary 10
examination audit 8
examination invoice 5
examination report 3
examination notification 3
patient examination 16
clinic examination 12
referral examination 11
doctor examination 9
employer examination 8
schedule examination 7
attachment examination 5
dictionary examination 4
audit examination 4
invoice tariff 24
invoice contract 17
invoice examination 4
tariff invoice 15
tariff examination 2
contract invoice 12
contract examination 2
report analytics 22
report examination 3
analytics report 15
analytics examination 2
integration notification 18
integration health 8
integration examination 3
notification integration 10
notification examination 2
health integration 5
health examination 1
"

links_for() {  # печатает строки `<куда> <сколько>` для модуля $1
  echo "$LINKS" | while read -r a b n; do
    [ "${a:-}" = "$1" ] && printf '%s %s\n' "$b" "$n"
  done
}

emit_links() {  # ровно столько файлов-ссылок, сколько велит матрица
  d="$1"; b="$API/src/modules/$d/services"; mkdir -p "$b"
  links_for "$d" | while read -r t n; do
    [ -z "${t:-}" ] && continue
    j=0
    while [ "$j" -lt "$n" ]; do
      w "$b/$d-to-$t-$j.ts" <<EOF
import { Injectable } from '@nestjs/common';
import { ${t}Service } from '../../$t/services/$t.service';
import { assertPresent } from '../../common/common.util';

@Injectable()
export class ${d}To${t}$j {
  constructor(private readonly peer: ${t}Service) {}
  run(id: string) { return assertPresent(this.peer.load(id)); }
}
EOF
      j=$(( j + 1 ))
    done
  done
}

emit_module() {  # $1 имя, $2 эндпоинтов, $3 сущностей, $4 задач, $5 класс
  d="$1"; ep="$2"; ent="$3"; job="$4"; kind="$5"
  b="$API/src/modules/$d"; mkdir -p "$b"
  w "$b/$d.module.ts" <<EOF
import { Module } from '@nestjs/common';

@Module({ imports: [], controllers: [], providers: [], exports: [] })
export class ${d}Module {}
EOF
  [ "$kind" = cross ] && return 0

  # --- контроллеры: КЛЮЧ — МЕТОД, а не класс. По четыре метода на файл ---------------
  c=0; left="$ep"
  while [ "$left" -gt 0 ]; do
    take=4; [ "$left" -lt 4 ] && take="$left"
    mkdir -p "$b/controllers"
    {
      echo "import { Controller, Get, Post, Put, Delete } from '@nestjs/common';"
      echo "import { ${d}Service } from '../services/$d.service';"
      echo ""
      echo "@Controller('$d')"
      echo "export class ${d}${c}Controller {"
      echo "  constructor(private readonly svc: ${d}Service) {}"
      k=0
      while [ "$k" -lt "$take" ]; do
        case $(( k % 4 )) in
          0) echo "  @Get(':id') read$k(id: string) { return this.svc.load(id); }" ;;
          1) echo "  @Post() add$k(body: unknown) { return this.svc.save(body); }" ;;
          2) echo "  @Put(':id') edit$k(id: string, body: unknown) { return this.svc.save(body); }" ;;
          3) echo "  @Delete(':id') drop$k(id: string) { return this.svc.remove(id); }" ;;
        esac
        k=$(( k + 1 ))
      done
      echo "}"
    } > "$b/controllers/$d$c.controller.ts"
    left=$(( left - take )); c=$(( c + 1 ))
  done

  # --- сущности ----------------------------------------------------------------------
  n=0
  while [ "$n" -lt "$ent" ]; do
    mkdir -p "$b/entities"
    w "$b/entities/$d$n.entity.ts" <<EOF
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('${d}_$n')
export class ${d}${n}Entity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ type: 'timestamptz' }) createdAt!: Date;
}
EOF
    n=$(( n + 1 ))
  done

  # --- фоновые задачи: @Cron, и это НЕ события ----------------------------------------
  n=0
  while [ "$n" -lt "$job" ]; do
    mkdir -p "$b/jobs"
    w "$b/jobs/$d$n.job.ts" <<EOF
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ${d}${n}Job {
  @Cron('0 $n * * *')
  async run(): Promise<void> {
    await Promise.resolve();
  }
}
EOF
    n=$(( n + 1 ))
  done

  # --- сервисы, dto, репозитории: ключей не несут -------------------------------------
  mkdir -p "$b/services" "$b/dto" "$b/repositories"
  w "$b/services/$d.service.ts" <<EOF
import { Injectable } from '@nestjs/common';

@Injectable()
export class ${d}Service {
  load(id: string) { return { id }; }
  save(body: unknown) { return body; }
  remove(id: string) { return { id, removed: true }; }
}
EOF
  w "$b/services/$d-query.service.ts" <<EOF
import { Injectable } from '@nestjs/common';

@Injectable()
export class ${d}QueryService {
  list(limit: number) { return Array.from({ length: limit }, (_, i) => i); }
}
EOF
  w "$b/services/$d-command.service.ts" <<EOF
import { Injectable } from '@nestjs/common';

@Injectable()
export class ${d}CommandService {
  apply(id: string, patch: Record<string, unknown>) { return { id, ...patch }; }
}
EOF
  w "$b/dto/$d.dto.ts" <<EOF
export class ${d}Dto {
  id!: string;
  title!: string;
}
EOF
  w "$b/dto/$d-list.dto.ts" <<EOF
export class ${d}ListDto {
  items!: unknown[];
  total!: number;
}
EOF
  w "$b/repositories/$d.repository.ts" <<EOF
import { Injectable } from '@nestjs/common';

@Injectable()
export class ${d}Repository {
  findById(id: string) { return { id }; }
}
EOF
  w "$b/repositories/$d-view.repository.ts" <<EOF
import { Injectable } from '@nestjs/common';

@Injectable()
export class ${d}ViewRepository {
  page(offset: number) { return { offset, rows: [] as unknown[] }; }
}
EOF
}

# --- сквозные модули: ноль ключей по КАЖДОМУ классу, но файлов много ------------------
emit_cross_files() {  # $1 модуль, $2 сколько файлов сверх *.module.ts
  d="$1"; c="$2"; b="$API/src/modules/$d"; mkdir -p "$b"
  i=0
  while [ "$i" -lt "$c" ]; do
    w "$b/$d-$i.util.ts" <<EOF
/** Сквозной механизм: ни контракта, ни сущностей, ни расписания. */
export const ${d}Rule$i = (value: string): string => value.trim();
EOF
    i=$(( i + 1 ))
  done
}

echo "$MODULES" | while read -r name ep ent job kind; do
  [ -z "${name:-}" ] && continue
  emit_module "$name" "$ep" "$ent" "$job" "$kind"
done

echo "$MODULES" | while read -r name ep ent job kind; do
  [ -z "${name:-}" ] && continue
  [ "$kind" = cross ] || emit_links "$name"
done

emit_cross_files common 29
emit_cross_files shared 20
emit_cross_files config 9
emit_cross_files errors 9

# `common.util.ts` — тот самый помощник, который импортируют все файлы-ссылки.
w "$API/src/modules/common/common.util.ts" <<'EOF'
/** Сквозной механизм: 409 — повтор номера направления, 422 — осмотр уже закрыт. */
export function assertPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('not found');
  return value;
}
EOF

w "$API/src/modules/errors/http-exception.filter.ts" <<'EOF'
import { Catch, ExceptionFilter } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(): void { /* маппинг доменных ошибок в коды ответа */ }
}
EOF

# ==================================================================================
# apps/web — ПОД порогом: 180 файлов, 24 экрана, 31 вызов чужого API, 6 сторов.
# Внутрь этого приложения лезть нечем и незачем: оно один кусок целиком.
# ==================================================================================
set -f          # `[id]` в путях роутов не должно попасть под раскрытие имён
mkdir -p "$WEB/app" "$WEB/src/stores" "$WEB/src/api" "$WEB/src/components"

w "$WEB/package.json" <<'EOF'
{ "name": "@medex/web", "private": true,
  "scripts": { "dev": "next dev", "build": "next build" },
  "dependencies": { "next": "*", "react": "*", "zustand": "*", "@medex/contracts": "*",
                    "@medex/ui": "*" } }
EOF

SCREENS="_root examinations examinations/[id] examinations/new patients patients/[id]
patients/[id]/history referrals referrals/[id] clinics clinics/[id] doctors doctors/[id]
schedule schedule/day invoices invoices/[id] contracts tariffs reports reports/monthly
settings settings/users login"

for s in $SCREENS; do
  if [ "$s" = _root ]; then dir="$WEB/app"; title="Сводка"; else dir="$WEB/app/$s"; title="$s"; fi
  mkdir -p "$dir"
  w "$dir/page.tsx" <<EOF
import { Card0 } from '@/components/cards/card-0';

export default function Page() {
  return (
    <main className="screen">
      <h1>$title</h1>
      <Card0 />
    </main>
  );
}
EOF
done

for l in _root examinations patients referrals invoices reports; do
  if [ "$l" = _root ]; then dir="$WEB/app"; else dir="$WEB/app/$l"; fi
  w "$dir/layout.tsx" <<EOF
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <section className="shell">{children}</section>;
}
EOF
done

# --- состояние: ХРАНИЛИЩЕ, переживающее экран. Шесть сторов, ни одного useState --------
i=0
for st in examination patient filter session notification ui; do
  w "$WEB/src/stores/$st.store.ts" <<EOF
import { create } from 'zustand';

export const use${st}Store = create((set) => ({
  current: null,
  select: (id) => set({ current: id }),
  reset: () => set({ current: null }),
}));
EOF
  i=$(( i + 1 ))
done

# --- вызовы чужого API: 31 `fetch(` в десяти файлах ------------------------------------
emit_web_api() {  # $1 имя, $2 сколько вызовов
  f="$WEB/src/api/$1.api.ts"; n="$2"; j=0
  { echo "const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';"; echo ""; } > "$f"
  while [ "$j" -lt "$n" ]; do
    {
      echo "export async function $1Call$j(id: string) {"
      echo "  const res = await fetch(\`\${BASE}/$1/\${id}?v=$j\`, { cache: 'no-store' });"
      echo "  return res.json();"
      echo "}"
      echo ""
    } >> "$f"
    j=$(( j + 1 ))
  done
}
for a in examinations patients referrals clinics doctors schedule invoices contracts reports; do
  emit_web_api "$a" 3
done
emit_web_api auth 4

# --- компоненты: 134 файла, ноль ключей ------------------------------------------------
emit_web_components() {  # $1 папка, $2 базовое имя, $3 сколько
  g="$1"; nm="$2"; c="$3"; mkdir -p "$WEB/src/components/$g"; i=0
  while [ "$i" -lt "$c" ]; do
    w "$WEB/src/components/$g/${nm,,}-$i.tsx" <<EOF
import type { ReactNode } from 'react';

export function ${nm}${i}({ children }: { children?: ReactNode }) {
  return <div className="$g-$i">{children ?? '—'}</div>;
}
EOF
    i=$(( i + 1 ))
  done
}
emit_web_components forms   Field  30
emit_web_components tables  Row    28
emit_web_components cards   Card   26
emit_web_components widgets Widget 26
emit_web_components layout  Slot   24

# ==================================================================================
# apps/bot — СИЛЬНО под порогом: 11 файлов. И всё равно отдельный кусок.
# ==================================================================================
mkdir -p "$BOT/src/commands" "$BOT/src/entities"
w "$BOT/package.json" <<'EOF'
{ "name": "@medex/bot", "private": true,
  "scripts": { "start": "node dist/main.js" },
  "dependencies": { "@nestjs/common": "*", "nestjs-telegraf": "*", "typeorm": "*",
                    "@medex/contracts": "*" } }
EOF
w "$BOT/src/main.ts" <<'EOF'
import { NestFactory } from '@nestjs/core';
import { BotModule } from './bot.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(BotModule);
  await app.init();
}
void bootstrap();
EOF
w "$BOT/src/bot.module.ts" <<'EOF'
import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';

@Module({ imports: [TelegrafModule.forRoot({ token: process.env.BOT_TOKEN ?? '' })] })
export class BotModule {}
EOF
for cmd in start help status exam referral slot cancel; do
  w "$BOT/src/commands/$cmd.command.ts" <<EOF
import { Injectable } from '@nestjs/common';
import { Command, Ctx } from 'nestjs-telegraf';

@Injectable()
export class ${cmd}Command {
  @Command('$cmd')
  async handle(@Ctx() ctx: { reply: (t: string) => Promise<void> }): Promise<void> {
    await ctx.reply('$cmd');
  }
}
EOF
done
i=0
for e in session subscription; do
  w "$BOT/src/entities/$e.entity.ts" <<EOF
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('bot_$e')
export class ${e}Entity {
  @PrimaryColumn() chatId!: string;
  @Column({ type: 'text' }) state!: string;
}
EOF
  i=$(( i + 1 ))
done

# ==================================================================================
# apps/importer — СИЛЬНО под порогом: 6 файлов, ни одного эндпоинта, 3 задачи, 2 топика.
# Ноль эндпоинтов — это не «пустой сервис» и не повод его потерять.
# ==================================================================================
mkdir -p "$IMP/src/jobs" "$IMP/src/config"
w "$IMP/package.json" <<'EOF'
{ "name": "@medex/importer", "private": true,
  "scripts": { "start": "node dist/main.js" },
  "dependencies": { "@nestjs/common": "*", "@nestjs/schedule": "*", "@medex/contracts": "*" } }
EOF
w "$IMP/src/main.ts" <<'EOF'
import { NestFactory } from '@nestjs/core';
import { ImporterModule } from './importer.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ImporterModule);
  await app.init();
}
void bootstrap();
EOF
w "$IMP/src/importer.module.ts" <<'EOF'
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

@Module({ imports: [ScheduleModule.forRoot()] })
export class ImporterModule {}
EOF
w "$IMP/src/config/topics.ts" <<'EOF'
/** Импортер только ЧИТАЕТ шину: оба топика объявлены в apps/api/src/config/queues.ts. */
export const CONSUMED_TOPICS = [
  'medex.lab.result.received',
  'medex.employer.roster.synced',
] as const;
EOF
i=0
for j in lab-results employer-roster archive; do
  w "$IMP/src/jobs/$j.job.ts" <<EOF
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class feed${i}Job {
  @Cron('0 $i * * *')
  async run(): Promise<void> {
    await Promise.resolve();
  }
}
EOF
  i=$(( i + 1 ))
done

# ==================================================================================
# packages/contracts — ЭТО `lib`: 14 файлов, 22 экспорта типов, публикуемый package.json.
# ==================================================================================
mkdir -p "$CTR/src"
w "$CTR/package.json" <<'EOF'
{ "name": "@medex/contracts", "version": "3.4.0",
  "main": "./dist/index.js", "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "publishConfig": { "access": "restricted" } }
EOF
{
  echo "// Публичный API пакета. Реэкспорт, собственных объявлений здесь нет."
  for m in examination patient referral clinic doctor schedule invoice contract tariff \
           report audit dictionary shared; do
    echo "export * from './$m';"
  done
} > "$CTR/src/index.ts"

emit_contract() {  # $1 файл, $2 сколько объявлений (1 или 2)
  m="$1"; n="$2"
  {
    echo "export interface ${m}Payload {"
    echo "  id: string;"
    echo "  updatedAt: string;"
    echo "}"
    if [ "$n" -eq 2 ]; then
      echo ""
      echo "export type ${m}Status = 'draft' | 'active' | 'closed';"
    fi
  } > "$CTR/src/$m.ts"
}
for m in examination patient referral clinic doctor schedule invoice contract tariff; do
  emit_contract "$m" 2
done
for m in report audit dictionary shared; do
  emit_contract "$m" 1
done

# ==================================================================================
# packages/ui — 40 файлов, в каждом `export function`, и НОЛЬ ключей по всем классам:
# ни роутов, ни вызовов чужого API, ни состояния. `package.json` приватный, полей
# публикации в нём нет — значит это не `lib`, и экспорты ключами не являются.
# ==================================================================================
mkdir -p "$UI/src"
w "$UI/package.json" <<'EOF'
{ "name": "@medex/ui", "private": true,
  "dependencies": { "react": "*" } }
EOF
i=0
for nm in Button Input Select Checkbox Radio Switch Slider Badge Chip Avatar \
          Tooltip Popover Modal Drawer Tabs Accordion Table Pagination Breadcrumb Menu \
          Toolbar Toast Spinner Skeleton Divider Stack Grid Panel Header Footer \
          Sidebar Icon Label Caption Heading Text Link Alert Progress Empty; do
  w "$UI/src/${nm,,}.tsx" <<EOF
import type { ReactNode } from 'react';

export function ${nm}({ children }: { children?: ReactNode }) {
  return <div className="ui-${nm,,}">{children ?? null}</div>;
}
EOF
  i=$(( i + 1 ))
done

# ==================================================================================
# Соседняя репа: свой .git, в манифест НЕ входит. Нужна, чтобы Шаг 1 не выродился
# в «кроме medex ничего нет».
# ==================================================================================
mkdir -p "$OUT/billing-gw/.git" "$OUT/billing-gw/src/routes"
echo "ref: refs/heads/main" > "$OUT/billing-gw/.git/HEAD"
w "$OUT/billing-gw/package.json" <<'EOF'
{ "name": "billing-gw", "private": true,
  "dependencies": { "fastify": "*" } }
EOF
i=0
while [ "$i" -lt 25 ]; do
  w "$OUT/billing-gw/src/routes/route-$i.ts" <<EOF
import type { FastifyInstance } from 'fastify';

export function route$i(app: FastifyInstance): void {
  app.get('/gw/$i', async () => ({ ok: true }));
}
EOF
  i=$(( i + 1 ))
done

# ==================================================================================
# Спек-репа: манифест ЕСТЬ, и medex стоит в нём ОДНОЙ строкой — это состояние ДО разреза.
# ==================================================================================
w "$OUT/specs/services/manifest.yaml" <<'EOF'
# Слепок соседних сервисов. Этот файл ведёт человек.
services:
  - name: medex
    path: ../medex
    type: fullstack
EOF

# ==================================================================================
# Правда, посчитанная ПО ФАКТУ, а не по замыслу.
# ==================================================================================
set +f
EP='@Get\(|@Post\(|@Put\(|@Delete\('
echo "NRS-MULTI собрана в $OUT"
printf '  apps/api        файлов %4s  эндпоинтов %3s  сущностей %3s  задач %2s  топиков %2s\n' \
  "$(find "$API" -name '*.ts' | wc -l)" \
  "$(grep -rhoE "$EP" "$API" | wc -l)" \
  "$(find "$API" -name '*.entity.ts' | wc -l)" \
  "$(grep -rhoE '@Cron\(' "$API" | wc -l)" \
  "$(grep -c "'medex\." "$API/src/config/queues.ts")"
printf '  apps/web        файлов %4s  экранов    %3s  вызовов   %3s  сторов %2s\n' \
  "$(find "$WEB" \( -name '*.ts' -o -name '*.tsx' \) | wc -l)" \
  "$(find "$WEB" -name 'page.tsx' | wc -l)" \
  "$(grep -rhoE 'fetch\(' "$WEB" | wc -l)" \
  "$(grep -rhoE 'create\(' "$WEB" | wc -l)"
printf '  apps/bot        файлов %4s  команд     %3s  сущностей %3s\n' \
  "$(find "$BOT" -name '*.ts' | wc -l)" \
  "$(grep -rhoE '@Command\(' "$BOT" | wc -l)" \
  "$(find "$BOT" -name '*.entity.ts' | wc -l)"
printf '  apps/importer   файлов %4s  эндпоинтов %3s  задач     %3s  топиков %2s\n' \
  "$(find "$IMP" -name '*.ts' | wc -l)" \
  "$(grep -rhoE "$EP" "$IMP" | wc -l)" \
  "$(grep -rhoE '@Cron\(' "$IMP" | wc -l)" \
  "$(grep -c "'medex\." "$IMP/src/config/topics.ts")"
printf '  packages/contracts файлов %2s экспортов %3s\n' \
  "$(find "$CTR" -name '*.ts' | wc -l)" \
  "$(grep -rhoE '^export (type|interface) ' "$CTR" | wc -l)"
printf '  packages/ui     файлов %4s  ключей всех классов %s\n' \
  "$(find "$UI" -name '*.tsx' | wc -l)" \
  "$(( $(grep -rhoE "$EP" "$UI" | wc -l) + $(grep -rhoE '@Cron\(|@Entity\(|fetch\(|create\(' "$UI" | wc -l) + $(find "$UI" -name 'page.tsx' | wc -l) ))"
printf '  связность api:  строк матрицы %s, концов у examination %s\n' \
  "$(echo "$LINKS" | grep -c '[a-z]')" \
  "$(echo "$LINKS" | awk '$1=="examination"||$2=="examination"{s+=$3} END{print s+0}')"
