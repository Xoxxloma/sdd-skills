#!/usr/bin/env node
// make-cd-xlsx.mjs — собирает `.xlsx` фикстуры CD-XLSX из эталона `cd-xlsx-truth.mjs`.
//
//   node make-cd-xlsx.mjs [путь]        по умолчанию fixtures/CD-XLSX/inbox/dms-limits.xlsx
//
// Зачем свой сборщик, а не готовая утилита: в окружении стенда нет ни pandoc, ни рабочего
// Python (`python` — заглушка WindowsApps), а фикстура обязана быть НАСТОЯЩИМ xlsx — иначе проба
// меряет реакцию на битый файл, а не на бинарный формат. Здесь zip пишется методом «stored»
// (без сжатия): Excel, `unzip` и `file` такой контейнер принимают, а кода — одна таблица CRC.
//
// После сборки: сверь фикстуру с манифестом (`_manifest.txt`) — состав файлов не меняется, если
// имя выходного файла прежнее.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROWS, HEADER, sharedStrings, NUMERIC_COLS } from './cd-xlsx-truth.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = process.argv[2] ?? join(HERE, 'fixtures/CD-XLSX/inbox/dms-limits.xlsx')

// ─── zip: stored, без сжатия ────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32 (buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Дата в фикстуре фиксированная: пересборка не должна давать другой байт без правки данных. */
const DOS_TIME = ((12 << 11) | (30 << 5) | 0) & 0xffff
const DOS_DATE = (((2026 - 1980) << 9) | (2 << 5) | 9) & 0xffff

function zip (entries) {
  const locals = []
  const central = []
  let offset = 0
  for (const [name, text] of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const data = Buffer.from(text, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)          // version needed
    local.writeUInt16LE(0x0800, 6)      // флаг: имена в UTF-8
    local.writeUInt16LE(0, 8)           // метод: stored
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    nameBuf.copy(local, 30)
    locals.push(local, data)

    const cd = Buffer.alloc(46 + nameBuf.length)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0x0800, 8)
    cd.writeUInt16LE(0, 10)
    cd.writeUInt16LE(DOS_TIME, 12)
    cd.writeUInt16LE(DOS_DATE, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(offset, 42)
    nameBuf.copy(cd, 46)
    central.push(cd)
    offset += local.length + data.length
  }
  const cdBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cdBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cdBuf, end])
}

// ─── содержимое книги ───────────────────────────────────────────────────────────────────────

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const col = (i) => String.fromCharCode(65 + i)

const dict = sharedStrings()
const idx = new Map(dict.map((s, i) => [s, i]))

function row (cells, r) {
  const xml = cells.map((v, i) => {
    const ref = `${col(i)}${r}`
    // Числовые колонки идут без `t="s"` — в этом и ловушка: то же самое `<v>15</v>` в соседней
    // колонке означало бы пятнадцатую строку словаря.
    if (r > 1 && NUMERIC_COLS.includes(i)) return `<c r="${ref}"><v>${v}</v></c>`
    return `<c r="${ref}" t="s"><v>${idx.get(v)}</v></c>`
  }).join('')
  return `<row r="${r}">${xml}</row>`
}

const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:E${ROWS.length + 1}"/><sheetData>${[HEADER, ...ROWS].map((cells, i) => row(cells, i + 1)).join('')}</sheetData></worksheet>`

const strings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${dict.length}" uniqueCount="${dict.length}">${dict.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`

const entries = [
  ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`],
  ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Лимиты" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`],
  ['xl/worksheets/sheet1.xml', sheet],
  ['xl/sharedStrings.xml', strings],
]

writeFileSync(OUT, zip(entries))
console.log(`записан: ${OUT}`)
console.log(`строк данных: ${ROWS.length}, уникальных строк в словаре: ${dict.length}`)
console.log(`первая строка: ${ROWS[0].join(' | ')}`)
console.log(`последняя строка: ${ROWS[ROWS.length - 1].join(' | ')}`)
