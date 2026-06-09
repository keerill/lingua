#!/bin/sh
# ---------------------------------------------------------------------------
# Lingua — Postgres init (db-per-service on a single container).
#
# Runs once, only on FIRST boot (empty data dir), via
# /docker-entrypoint-initdb.d. Creates one logical database per service (all
# slices), all owned by the bootstrap superuser ($POSTGRES_USER = lingua).
#
# CREATE DATABASE has no IF NOT EXISTS, so we guard each with a \gexec trick
# to stay re-run safe if this script is ever invoked manually.
# ---------------------------------------------------------------------------
set -e

create_db() {
  db="$1"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE "$db" OWNER "$POSTGRES_USER"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
  echo "ensured database: $db"
}

create_db identity
create_db vocabulary
create_db learning
# svc-ai-dialog persists sessions/turns + its own outbox.
create_db dialog
# content (scenarios/lessons/templates), progress (read-model), notifications.
create_db content
create_db progress
create_db notifications
