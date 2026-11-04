#!/usr/bin/env bash
# Déploiement automatique sur le Pi. Lancé par cron toutes les 5 minutes :
# s'il y a du nouveau sur master → backup, git pull, rebuild. Sinon, il ne fait rien.
#
#   */5 * * * * /home/andy/aikaho-jjk-guide/api/scripts/deploy.sh >> /home/andy/backups/aikaho-jjk/deploy.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/../.."                    # racine du repo
log() { echo "$(date '+%F %T') $*"; }

# Un seul déploiement à la fois (un build peut durer plus de 5 minutes sur le Pi)
exec 9>/tmp/aikaho-jjk-deploy.lock
flock -n 9 || exit 0

git fetch --quiet origin master
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)
[ "$LOCAL" = "$REMOTE" ] && exit 0

log "Nouveau code sur master : ${LOCAL:0:7} → ${REMOTE:0:7}"

# Les variables obligatoires de la NOUVELLE version doivent déjà être dans .env
missing=()
while read -r var; do
  [[ -z "$var" || "$var" == \#* ]] && continue
  grep -Eq "^${var}=.+" .env || missing+=("$var")
done < <(git show origin/master:api/scripts/required-env.txt)
if (( ${#missing[@]} )); then
  log "ANNULÉ : variable(s) manquante(s) dans .env : ${missing[*]}"
  exit 1
fi

# Backup avant tout changement (les migrations peuvent modifier la BD)
./api/scripts/backup.sh

if ! git merge --ff-only --quiet origin/master; then
  log "ANNULÉ : git merge --ff-only impossible (modifications locales sur le Pi ?)"
  exit 1
fi

# Pas de « source .env » : docker compose lit .env tout seul
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

# Vérifie que l'API répond (les migrations roulent au démarrage)
port=$(grep -E '^API_PORT=' .env | cut -d= -f2)
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${port:-3000}/health" >/dev/null 2>&1; then
    log "Déploiement OK : ${REMOTE:0:7}"
    exit 0
  fi
  sleep 2
done
log "ÉCHEC : /health ne répond pas après le déploiement de ${REMOTE:0:7} → docker compose logs api"
exit 1
