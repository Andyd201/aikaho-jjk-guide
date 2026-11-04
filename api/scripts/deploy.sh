#!/usr/bin/env bash
# Déploiement automatique sur le Pi. Lancé par cron toutes les 5 minutes :
# s'il y a du nouveau sur master → backup, git pull, build, redémarrage. Sinon, il ne fait rien.
#
#   */5 * * * * /home/andy/aikaho-jjk-guide/api/scripts/deploy.sh >> /home/andy/backups/aikaho-jjk/deploy.log 2>&1
#
# .deployed-sha garde le dernier commit qui a VRAIMENT démarré (/health OK).
# Tant qu'un déploiement n'a pas réussi, le script réessaie au passage suivant.
set -euo pipefail

cd "$(dirname "$0")/../.."                    # racine du repo
log() { echo "$(date '+%F %T') $*"; }
STATE=.deployed-sha

# Un seul déploiement à la fois (un build peut durer plus de 5 minutes sur le Pi)
exec 9>/tmp/aikaho-jjk-deploy.lock
flock -n 9 || exit 0

git fetch --quiet origin master
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)
DEPLOYED=$(cat "$STATE" 2>/dev/null || echo "$LOCAL")
[ "$DEPLOYED" = "$REMOTE" ] && exit 0

log "Déploiement de ${REMOTE:0:7} (en ligne : ${DEPLOYED:0:7})"

# 1. Vérifications AVANT de toucher à quoi que ce soit
if ! git merge-base --is-ancestor HEAD origin/master; then
  log "ANNULÉ : le Pi a des commits qui ne sont pas sur master (git log origin/master..HEAD)"
  exit 1
fi
missing=()
while read -r var; do
  [[ -z "$var" || "$var" == \#* ]] && continue
  grep -Eq "^${var}=.+" .env || missing+=("$var")
done < <(git show origin/master:api/scripts/required-env.txt)
if (( ${#missing[@]} )); then
  log "ANNULÉ : variable(s) manquante(s) dans .env : ${missing[*]}"
  exit 1
fi

# 2. Backup avant tout changement (les migrations peuvent modifier la BD).
#    Préfixe à part : les backups de déploiement ne poussent pas dehors les backups quotidiens.
BACKUP_PREFIX=predeploy ./api/scripts/backup.sh

# 3. Nouveau code + build. Si le build plante, on revient au code d'avant : le site n'a pas bougé.
git merge --ff-only --quiet origin/master
if ! docker compose build --quiet; then
  git reset --hard --quiet "$LOCAL"
  log "ÉCHEC du build de ${REMOTE:0:7} : retour à ${LOCAL:0:7}, nouvel essai dans 5 minutes"
  exit 1
fi

# 4. Redémarrage (pas de « source .env » : docker compose lit .env tout seul)
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

# 5. L'API répond ? (les migrations roulent à son démarrage)
port=$(grep -E '^API_PORT=' .env | cut -d= -f2)
for _ in $(seq 1 45); do
  if curl -fsS "http://127.0.0.1:${port:-3000}/health" >/dev/null 2>&1; then
    echo "$REMOTE" > "$STATE"
    log "Déploiement OK : ${REMOTE:0:7}"
    exit 0
  fi
  sleep 2
done
log "ÉCHEC : /health ne répond pas après le déploiement de ${REMOTE:0:7}. Voir « docker compose logs api » et la section Restaurer du README"
exit 1
