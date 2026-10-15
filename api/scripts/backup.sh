#!/usr/bin/env bash
# Backup de la BD Postgres : un fichier .sql.gz par jour, garde les 7 plus récents.
set -euo pipefail

cd "$(dirname "$0")/.."                       # racine du repo, peu importe d'où on lance
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/aikaho-jjk}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/aikaho_jjk_$(date +%Y-%m-%d_%H%M).sql.gz"

# Les variables viennent de l'intérieur du conteneur : pas besoin de "source .env"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"                        # le fichier final existe seulement si le dump a réussi

# Supprime tout sauf les 7 plus récents
ls -1t "$BACKUP_DIR"/aikaho_jjk_*.sql.gz | tail -n +8 | xargs -r rm --

echo "$(date '+%F %T') Backup OK : $FILE ($(du -h "$FILE" | cut -f1))"