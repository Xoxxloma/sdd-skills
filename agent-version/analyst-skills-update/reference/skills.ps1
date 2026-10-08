# skills.ps1 — то же, что skills.sh, для Windows: установить или обновить скиллы в репозитории со спеками.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .gigacode\skills\analyst-skills-update\reference\skills.ps1                 # → .\.gigacode\skills
#   powershell -NoProfile -ExecutionPolicy Bypass -File .gigacode\skills\analyst-skills-update\reference\skills.ps1 .claude\skills  # → другая папка
#
# Если запуск .ps1 запрещён групповой политикой, тот же скрипт читается как текст (другая папка — в SDD_SKILLS_DEST):
#
#   powershell -NoProfile -Command "Invoke-Expression (Get-Content -Raw -Encoding UTF8 .gigacode\skills\analyst-skills-update\reference\skills.ps1)"
#
# Именно в скобках, не через `|`: в конвейере Get-Content держит файл открытым, и скрипт не может удалить свою папку.
#
# Что копируется и что печатается — как в skills.sh; правятся оба файла вместе. Нужен только git.
# Пишется под Windows PowerShell 5.1 и ограниченный режим языка: только командлеты, без вызовов .NET.
# Файл хранится в UTF-8 с BOM — без него 5.1 читает русские строки как cp1251.
# Временная копия себя, как в skills.sh, не нужна: PowerShell читает скрипт целиком до запуска.
param([string]$Dest = $env:SDD_SKILLS_DEST)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = if ($env:SDD_SKILLS_REPO) { $env:SDD_SKILLS_REPO } else { 'https://api.sc-ci.sber.ru/ai-security-deparment/AI-SDD-SKILLS.git' }
$ref = $env:SDD_SKILLS_REF            # ветка или тег; пусто — ветка по умолчанию
if (-not $Dest) { $Dest = '.gigacode\skills' }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Output 'нужен git'; exit 1 }

$src = Join-Path $env:TEMP ('sdd-skills.' + (Get-Random))
try {
  if ($ref) { Write-Output "скиллы: $repo #$ref" } else { Write-Output "скиллы: $repo" }
  $cloneArgs = @('clone', '-q', '--depth', '1')
  if ($ref) { $cloneArgs += @('--branch', $ref) }
  # Предупреждения git в stderr не должны обрывать скрипт: решает только код возврата.
  $ErrorActionPreference = 'Continue'
  & git @cloneArgs $repo $src
  $ErrorActionPreference = 'Stop'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $skills = Join-Path $src 'skills'
  if (-not (Test-Path -LiteralPath $skills -PathType Container)) { $skills = Join-Path $src '.gigacode' }
  if (-not (Test-Path -LiteralPath $skills -PathType Container)) { Write-Output 'в репозитории со скиллами нет папки skills/'; exit 1 }

  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  $count = 0
  foreach ($dir in Get-ChildItem -LiteralPath $skills -Directory | Sort-Object Name) {
    $name = $dir.Name
    if ($name -like '_*') { continue }
    $skillMd = Join-Path $dir.FullName 'SKILL.md'
    if (-not (Test-Path -LiteralPath $skillMd -PathType Leaf)) { continue }
    $target = Join-Path $Dest $name
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    Copy-Item -LiteralPath $dir.FullName -Destination $target -Recurse -Force
    $version = '—'
    $found = Select-String -LiteralPath $skillMd -Pattern '^version:\s*(.*)$' -CaseSensitive | Select-Object -First 1
    if ($found -and $found.Matches[0].Groups[1].Value.Trim()) { $version = $found.Matches[0].Groups[1].Value.Trim() }
    Write-Output ('  {0,-28} {1}' -f $name, $version)
    $count++
  }
  if ($count -eq 0) { Write-Output "в $(Split-Path -Leaf $skills)/ не нашлось ни одной папки со SKILL.md"; exit 1 }
  Write-Output "установлено в ${Dest}: $count скиллов; точка входа — analyst-workspace"
} finally {
  Remove-Item -LiteralPath $src -Recurse -Force -ErrorAction SilentlyContinue
}
