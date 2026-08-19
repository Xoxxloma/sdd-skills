#!/usr/bin/env node
// make-cdoc-binaries.mjs — собирает бинарные исходники для проб скилла `context-doc`.
//
//   node make-cdoc-binaries.mjs
//
// Пишет один файл:
//   fixtures/CD-DOCX/inbox/sim-reglament.docx — настоящий OOXML-контейнер (zip + XML)
//
// XLSX ОТСЮДА УБРАН 2026-08-17, И ВОЗВРАЩАТЬ ЕГО НЕЛЬЗЯ. Здесь лежал сборщик листа 4×3 — той
// первой редакции CD-XLSX, которую замер забраковал (на таком листе распаковка не ошибается, и
// проба мерила дисциплину вместо сохранности данных). Нынешний лист на 60 строк собирает
// `make-cd-xlsx.mjs` из эталона `cd-xlsx-truth.mjs`, общего с грейдером. Оставленный здесь
// `buildXlsx` был миной: один запуск этого скрипта — и фикстура тихо откатывается к старому
// листу, а грейдер начинает сверять её с эталоном, которого в файле уже нет.
//
// ЛЕЖИТ ВНЕ `fixtures/`, И ЭТО НЕ ГИГИЕНА. Всё, что лежит внутри фикстуры, кроме `README.md` и
// `*-prompt.txt`, едет в песочницу засевом (`run-ctx.sh`). Скрипт-сборщик, попавший в песочницу,
// показал бы прогону и содержимое таблицы, и то, что файл собран стендом.
//
// Zip пишется руками (заголовки + центральный каталог + CRC32), а не `Compress-Archive`:
// PowerShell 5.1 в некоторых сборках кладёт в имена записей обратный слэш, и `unzip -p
// word/document.xml` перестаёт находить часть. Здесь имена записей заданы явно.
//
// ПОЧЕМУ XLSX СОБРАН ИМЕННО ТАК. Текстовые ячейки — `t="s"` с числовым индексом в `<v>`, строки
// в отдельном `xl/sharedStrings.xml`, числа — тем же тегом `<v>` без `t="s"`. В сетке `<v>3</v>`
// означает то индекс словаря, то число три. Распаковка даёт правдоподобную и неверную таблицу —
// ровно то, ради чего проба заведена.

import { deflateRawSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIX = join(HERE, 'fixtures')

// ─── ZIP ────────────────────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32 (buf) {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const DOS_TIME = (12 << 11) | (30 << 5) | 0            // 12:30:00
const DOS_DATE = ((2026 - 1980) << 9) | (2 << 5) | 9   // 2026-02-09

function zip (entries) {
  const parts = []
  const central = []
  let offset = 0
  for (const { name, text } of entries) {
    const data = Buffer.from(text, 'utf8')
    const comp = deflateRawSync(data)
    const crc = crc32(data)
    const nameBuf = Buffer.from(name, 'utf8')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)          // version needed
    local.writeUInt16LE(0, 6)           // flags
    local.writeUInt16LE(8, 8)           // deflate
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comp.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    parts.push(local, nameBuf, comp)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)             // version made by
    cd.writeUInt16LE(20, 6)             // version needed
    cd.writeUInt16LE(0, 8)
    cd.writeUInt16LE(8, 10)
    cd.writeUInt16LE(DOS_TIME, 12)
    cd.writeUInt16LE(DOS_DATE, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(comp.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(0, 30)             // extra + comment len
    cd.writeUInt16LE(0, 34)             // disk
    cd.writeUInt16LE(0, 36)             // internal attrs
    cd.writeUInt32LE(0, 38)             // external attrs
    cd.writeUInt32LE(offset, 42)
    central.push(cd, nameBuf)

    offset += 30 + nameBuf.length + comp.length
  }
  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, cdBuf, eocd])
}

function put (rel, buf) {
  const p = join(FIX, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, buf)
  console.log(`${rel}  ${buf.length} байт`)
}

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ─── DOCX: регламент по SIM ─────────────────────────────────────────────────────────────────

const COLOPHON = 'ООО «Тайгасвязь» — внутренний документ, копирование запрещено'
const TABLE_HEAD = ['Категория', 'Тариф', 'Кто одобряет']
const TABLE_ROWS = [
  ['Полевой инженер', 'ТСВ-Дельта', 'Руководитель участка'],
  ['Диспетчер', 'ТСВ-Компакт', 'Начальник смены'],
  ['Подрядчик по договору', 'ТСВ-Компакт', 'Директор по безопасности'],
  ['Стажёр', 'ТСВ-Компакт, первые 3 месяца', 'Кадровая служба'],
]

const p = (t) => `<w:p><w:r><w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`
const h = (t) => `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`
const tr = (cells) => `<w:tr>${cells.map((c) => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${p(c)}</w:tc>`).join('')}</w:tr>`

function buildDocx () {
  const body = [
    p(COLOPHON),
    h('Регламент выдачи корпоративных SIM-карт'),
    p('Действует с 2026-01-12. Заменяет памятку от 2024-03-18.'),
    h('1. Заявка'),
    p('Заявка на SIM подаётся не позднее чем за 9 рабочих дней до даты выдачи. Заявки, поданные позже, рассматриваются в порядке исключения по служебной записке на имя технического директора.'),
    p('— 2 —'),
    p(COLOPHON),
    h('2. Лимит и превышение'),
    p('Лимит на корпоративный номер — 1480 ₽ в месяц. Превышение удерживается из подотчёта после согласования с руководителем ЦФО.'),
    p('Номер, не активированный в течение 21 дня после выдачи, отзывается в резерв.'),
    h('3. Тарифы'),
    p('Тариф ТСВ-Дельта включает 12 ГБ и безлимит на внутренние номера. Тариф ТСВ-Компакт включает 4 ГБ, внутренние номера тарифицируются как обычные.'),
    p('— 3 —'),
    p(COLOPHON),
    // Заголовок раздела намеренно НЕ повторяет слова шапки таблицы («Кто одобряет»): по числу
    // её вхождений грейдер считает, свёрнут ли повтор шапки, и заголовок дал бы ложное второе.
    h('4. Порядок согласования'),
    `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>${
      tr(TABLE_HEAD)}${tr(TABLE_ROWS[0])}${tr(TABLE_ROWS[1])}</w:tbl>`,
    p('— 4 —'),
    p(COLOPHON),
    // Шапка таблицы повторена на следующей «странице» — типовой мусор переноса.
    `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>${
      tr(TABLE_HEAD)}${tr(TABLE_ROWS[2])}${tr(TABLE_ROWS[3])}</w:tbl>`,
    p('Спорные случаи разбирает комиссия по связи, заседание раз в две недели.'),
  ].join('')

  return zip([
    { name: '[Content_Types].xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { name: '_rels/.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>` },
    { name: 'word/document.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>` },
  ])
}

put('CD-DOCX/inbox/sim-reglament.docx', buildDocx())
console.log('готово. Не забудь обновить _manifest.txt обеих фикстур, если состав менялся.')
