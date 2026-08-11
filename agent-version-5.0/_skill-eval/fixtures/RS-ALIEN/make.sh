#!/usr/bin/env bash
# Генератор фикстуры RS-ALIEN — стек, которого НЕТ ни в одной таблице маркеров скилла.
#
# Rust + axum + sqlx. В таблицах скилла есть Java/Kotlin, Go, Node, Python, C#/PHP и пять
# фронтовых фреймворков — Rust не упомянут нигде. Проверяется Шаг 2.4: незнакомый стек обязан
# давать ОДИН ВОПРОС С ОБРАЗЦАМИ, а не отказ и не молчаливый ноль.
#
# Вызов:  ./make.sh <куда>   →  <куда>/ledger-core/ и <куда>/specs/
set -eu
OUT="${1:-./out}"
R="$OUT/ledger-core"
rm -rf "$OUT"; mkdir -p "$R/src" "$OUT/specs/services"
mkdir -p "$R/.git"; echo "ref: refs/heads/main" > "$R/.git/HEAD"

cat > "$R/Cargo.toml" <<'EOF'
[package]
name = "ledger-core"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
sqlx = { version = "0.7", features = ["postgres"] }
tokio = { version = "1", features = ["full"] }
EOF

# домены: <папка> <хендлеров> <моделей>
DOMAINS="
accounts 26 7
postings 22 6
statements 14 4
limits 9 3
audit 6 2
"

echo "$DOMAINS" | while read -r d h m; do
  [ -z "${d:-}" ] && continue
  mkdir -p "$R/src/$d/handlers" "$R/src/$d/models"
  i=0
  while [ "$i" -lt "$h" ]; do
    cat > "$R/src/$d/handlers/${d}_$i.rs" <<EOF
use axum::{extract::State, Json};
use crate::shared::error::AppError;

// route: GET /api/$d/$i
pub async fn ${d}_get_$i(State(db): State<Db>) -> Result<Json<()>, AppError> { Ok(Json(())) }

// route: POST /api/$d/$i
pub async fn ${d}_post_$i(State(db): State<Db>) -> Result<Json<()>, AppError> { Ok(Json(())) }
EOF
    i=$(( i + 1 ))
  done
  j=0
  while [ "$j" -lt "$m" ]; do
    cat > "$R/src/$d/models/${d}_model_$j.rs" <<EOF
use sqlx::FromRow;

#[derive(FromRow)]
pub struct ${d}Row$j {
    pub id: i64,
    pub note: Option<String>,
}
EOF
    j=$(( j + 1 ))
  done
done

# регистрация роутов — отдельным файлом, вне доменных папок (ловушка того же рода,
# что controllers/ в RS-MONO и lib/api в RS-FRONT)
mkdir -p "$R/src/router"
cat > "$R/src/router/mod.rs" <<'EOF'
use axum::{routing::{get, post}, Router};

pub fn build() -> Router {
    Router::new()
        .route("/api/accounts", get(accounts_list))
        .route("/api/postings", post(postings_create))
        .route("/healthz", get(healthz))
}
EOF

# сквозное
mkdir -p "$R/src/shared"
i=0; while [ "$i" -lt 18 ]; do
  echo "pub fn helper_$i(x: i64) -> i64 { x }" > "$R/src/shared/helper_$i.rs"; i=$(( i + 1 )); done
cat > "$R/src/shared/error.rs" <<'EOF'
// 409 — повтор внешнего идентификатора; 422 — проводка по закрытому счёту
pub struct AppError;
EOF

cat > "$OUT/specs/services/manifest.yaml" <<'EOF'
# Слепок соседних сервисов. Этот файл ведёт человек.
services:
  - name: geo
    path: ../geo-service
    type: backend
EOF
mkdir -p "$OUT/geo-service/.git"; echo "ref: refs/heads/main" > "$OUT/geo-service/.git/HEAD"
echo "module geo" > "$OUT/geo-service/go.mod"

echo "RS-ALIEN собрана в $OUT"
echo "  файлов .rs: $(find "$R/src" -name '*.rs' | wc -l)"
echo "  pub async fn: $(grep -rhoE 'pub async fn' "$R/src" | wc -l)"
echo "  FromRow: $(grep -rhoE 'FromRow' "$R/src" | wc -l)"
