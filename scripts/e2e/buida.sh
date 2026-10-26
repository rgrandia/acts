#!/usr/bin/env bash
# Deixa l'entorn de proves com acabat de crear (sense usuaris ni dades).
set -euo pipefail
DIR=${E2E_DIR:-/tmp/acts-e2e}
psql "postgres://postgres:${E2E_DB_PASS:-postgres}@${E2E_DB_HOST:-localhost}:${E2E_DB_PORT:-5432}/${E2E_DB_NAME:-postgres}" \
  -X -q -v ON_ERROR_STOP=1 -c "truncate auth.users, public.esdeveniments cascade"
: > "$DIR/correus.txt"
