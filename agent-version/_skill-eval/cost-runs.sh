#!/usr/bin/env bash
# cost-runs.sh — сумма total_cost_usd по прогонам раунда: последняя строка `result` каждого stream*.jsonl.
#   ./cost-runs.sh <каталог раунда или пробы> [...]
# Двойник аналитика (`_twin/twin-*.json`) считается отдельно.
set -u
for d in "$@"; do
  node -e '
    const fs = require("fs"), path = require("path")
    let sum = 0, runs = new Set(), twin = 0
    const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, e.name)
      if (e.isDirectory()) walk(q)
      else if (/^stream(-\d+)?\.jsonl$/.test(e.name)) {
        for (const line of fs.readFileSync(q, "utf8").split("\n")) {
          if (!line.includes("\"total_cost_usd\"")) continue
          try { const j = JSON.parse(line); if (j.type === "result" && j.total_cost_usd) { sum += j.total_cost_usd; runs.add(path.dirname(q)) } } catch {}
        }
      } else if (/^twin-\d+\.json$/.test(e.name)) {
        try { twin += JSON.parse(fs.readFileSync(q, "utf8")).total_cost_usd || 0 } catch {}
      }
    } }
    walk(process.argv[1])
    console.log(`${process.argv[1]}: $${sum.toFixed(2)} за ${runs.size} прогонов` + (twin ? `, двойник $${twin.toFixed(2)}` : ""))
  ' "$d"
done
