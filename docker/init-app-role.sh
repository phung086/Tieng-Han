#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 --set=app_password="$HANEUL_DB_PASSWORD" <<'SQL'
CREATE ROLE haneul_app WITH LOGIN PASSWORD :'app_password';
ALTER DATABASE haneul OWNER TO haneul_app;
GRANT ALL ON SCHEMA public TO haneul_app;
SQL
