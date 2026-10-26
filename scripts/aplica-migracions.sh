#!/usr/bin/env bash
# Aplica, en ordre, les migracions de supabase/migrations que la base de dades
# encara no té (segons la taula migracions_aplicades). Cada migració entra
# sencera o no entra (una sola transacció).
#
# Ús: DATABASE_URL=postgres://... scripts/aplica-migracions.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Cal la variable DATABASE_URL}"

psql_() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

aplicades=""
if [ "$(psql_ -tAc "select to_regclass('public.migracions_aplicades') is not null")" = "t" ]; then
  aplicades=$(psql_ -tAc "select nom from migracions_aplicades")
fi

n=0
for f in supabase/migrations/*.sql; do
  nom=$(basename "$f" .sql)
  grep -qxF "$nom" <<<"$aplicades" && continue
  echo "· $nom"
  { echo "begin;"; cat "$f"; echo; echo "insert into migracions_aplicades (nom) values ('$nom') on conflict do nothing;"; echo "commit;"; } | psql_ -f -
  n=$((n + 1))
done
echo "migracions aplicades: $n"
