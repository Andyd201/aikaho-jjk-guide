#!/usr/bin/env bash
# Backup de la BD Postgres : un fichier .sql.gz par jour, garde les 7 plus récents.
set -euo pipefail

cd "$(dirname "$0")/.."                       # dossier api/ (docker compose trouve le docker-compose.yml du dossier parent)
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/aikaho-jjk}"
mkdir -p "$BACKUP_DIR"
# BACKUP_PREFIX=predeploy pour les backups faits par deploy.sh (gardés à part)
PREFIX="${BACKUP_PREFIX:-aikaho_jjk}"
FILE="$BACKUP_DIR/${PREFIX}_$(date +%Y-%m-%d_%H%M).sql.gz"

# Les variables viennent de l'intérieur du conteneur : pas besoin de "source .env"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"                        # le fichier final existe seulement si le dump a réussi

# Supprime tout sauf les 7 plus récents
ls -1t "$BACKUP_DIR"/"${PREFIX}"_*.sql.gz | tail -n +8 | xargs -r rm --

echo "$(date '+%F %T') Backup OK : $FILE ($(du -h "$FILE" | cut -f1))"