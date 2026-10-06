// Подготовка ровно трёх контрольных проб; инференса здесь нет.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const round = import.meta.dirname
const previous = resolve(round, '../2026-10-06-na-strike-v2')
if (existsSync(join(round, 'READY'))) throw new Error('Раунд уже подготовлен')
for (const name of ['technical-spec-doc', 'spec-review']) {
  const destination = join(round, '_skills', name)
  if (!existsSync(destination)) cpSync(resolve('agent-version', name), destination, { recursive: true })
}
writeFileSync(join(round, '_skills/commit.txt'), execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }))
mkdirSync(join(round, '_src-base/technical-spec-doc'), { recursive: true })
cpSync(join(previous, '_src-base/technical-spec-doc/SKILL.md'), join(round, '_src-base/technical-spec-doc/SKILL.md'))

const work = join(round, 'after/run-01')
mkdirSync(join(work, 'docs/NA-410'), { recursive: true })
cpSync(join(previous, 'after/run-02/docs/NA-410/change_request.md'), join(work, 'docs/NA-410/change_request.md'))
const continuation = readFileSync(join(previous, 'after/run-02/prompt.txt'), 'utf8') +
  '\nНовая формулировка относится только к этой кнопке; прежнее название нигде не используется в инструкциях, письмах, обучении или существующих тестах. Другие тексты не меняются.\n'
const writerPrompt = `Ты выполняешь technical-spec-doc. Прочитай ${join(round, '_skills/technical-spec-doc/SKILL.md')} и необходимые ссылки внутри этого снимка. Рабочая папка: ${work}. Все пути документов ниже относительны ей. Не читай другие раунды или живые скиллы, не запускай внешний инференс, не делегируй. Выполни запрос и запиши итоговую реплику в answer.md рабочей папки.\n\n${continuation}`
writeFileSync(join(work, 'prompt.txt'), writerPrompt)
writeFileSync(join(round, 'after-manifest.json'), JSON.stringify([
  { arm: 'after', scenario: 'change', work, skill: join(round, '_skills/technical-spec-doc/SKILL.md'), target: 'docs/NA-410/technical_specification.md' }
], null, 2) + '\n')

const reviews = []
for (const [i, old, name, expected] of [[1, 2, 'mixed', 0], [2, 5, 'applied-and-open-struck', 2]]) {
  const reviewWork = join(round, 'review', `run-${String(i).padStart(2, '0')}`)
  const docs = join(reviewWork, 'docs/NA-410')
  mkdirSync(docs, { recursive: true })
  const oldDocs = join(previous, 'review', `run-${String(old).padStart(2, '0')}`, 'docs/NA-410')
  cpSync(join(oldDocs, 'change_request.md'), join(docs, 'change_request.md'))
  let artifact = readFileSync(join(oldDocs, 'technical_specification.md'), 'utf8')
  if (i === 2) {
    const title = '### 6.2. Обратная совместимость'
    if (!artifact.includes(title)) throw new Error('Заголовок не найден')
    artifact = artifact.replace(title, '### ~~6.2. Обратная совместимость~~')
  }
  writeFileSync(join(docs, 'technical_specification.md'), artifact)
  const checklist = join(round, '_skills/spec-review/reference/checklist-spec.md')
  const prompt = `Ты рецензент, вызванный spec-review. Прочитай чек-лист ${checklist}, артефакт ${join(docs, 'technical_specification.md')} и источник ${join(docs, 'change_request.md')}. Примени весь чек-лист к записанному файлу. Для context/ можно проверить только корень рабочей папки ${reviewWork}. Другие раунды, живые скиллы и репозиторий не читай; внешние модели и делегирование не используй. Входные документы не меняй. Запиши вывод с цитатами, номерами строк, номерами пунктов чек-листа и итогом в формате «нарушений: N» в ${join(reviewWork, 'answer.md')}.\n`
  writeFileSync(join(reviewWork, 'prompt.txt'), prompt)
  reviews.push({ name, work: reviewWork, target: 'docs/NA-410/technical_specification.md', source: 'docs/NA-410/change_request.md', checklist, expected })
}
writeFileSync(join(round, 'review-manifest.json'), JSON.stringify(reviews, null, 2) + '\n')
writeFileSync(join(round, 'READY'), 'Подготовлено: одна запись, две приёмки.\n')
console.log('Подготовлено: одна запись, две приёмки, снимок сокращённых инструкций.')
