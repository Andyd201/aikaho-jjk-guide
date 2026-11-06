# Foreign Card TCG

**https://foreigncardtcg.com** : le hub des cartes à collectionner **asiatiques** (sets japonais, coréens et chinois).
Pour chaque jeu et chaque set : la grille des cartes, une fiche par carte, recherche et filtre par rareté,
et un lien vers le produit chez **Eyesight Collectibles**, boutique partenaire.

Premiers sets : **JJK-01** (Aikaho Jujutsu Kaisen, 151 cartes) et **DS-07** (Demon Slayer). Les sets s'ajoutent
par photos dans `/admin` (voir « Import d'un set »).

## Stack

| Partie | Techno |
|---|---|
| Front | React + Vite, déployé en site statique sur Render |
| API | Node 24 + Express 5, driver `pg` (SQL direct, pas d'ORM) |
| BD | PostgreSQL 16 |
| Infra | docker-compose (api + db) sur Raspberry Pi 4 (ARM64), exposé via Cloudflare Tunnel |
| Tests | Vitest + Supertest contre un vrai Postgres, CI GitHub Actions |

## Structure

```
api/              API Express (Dockerfile, src/)
api/migrations/   Schéma de la BD (migrations, appliquées au démarrage de l'API)
data/cards.csv    Données des cartes du set JJK-01 (id,image_file,rarity,number,name)
images/           Photos des cartes (WebP), montées dans le conteneur api sur /app/images
web/aikaho-jjk/   Front React + Vite
docker-compose.yml
```

## Démarrage rapide (Docker)

Prérequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Engine + Compose).

```bash
# 1. Créer ton fichier de config à partir de l'exemple, puis changer le mot de passe
cp .env.example .env

# 2. Builder et démarrer la BD et l'API
docker compose up --build

# 3. Vérifier que tout répond
curl http://localhost:3000/health
# → {"status":"ok"}
```

`/health` fait un `SELECT 1` dans Postgres : il répond `200` si l'API **et** la BD fonctionnent, `503` si la BD est inaccessible.

## Développer l'API en local (sans Docker pour l'API)

```bash
docker compose up db     # Postgres seulement, accessible sur 127.0.0.1:5432
cd api
npm install
npm run dev              # redémarre à chaque modification, lit ../.env
```

Commandes de l'API :

| Commande | Effet |
|---|---|
| `npm start` | Démarre l'API |
| `npm run dev` | Démarre en mode watch avec `../.env` |
| `npm test` | Lance les tests Vitest |

## Variables d'environnement

Définies dans `.env` (jamais commité). Voir [.env.example](.env.example).

| Variable | Rôle |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Identifiants de la BD |
| `API_PORT` | Port de l'API (défaut `3000`) |
| `CORS_ORIGIN` | Domaine du front autorisé à appeler l'API |
| `DATABASE_URL` | Connexion à Postgres pour `npm run dev` en local (host `localhost`). Dans Docker, le compose fournit sa propre valeur avec le host `db`. |

Garde le mot de passe alphanumérique : il est inséré tel quel dans l'URL de connexion.

## Base de données

| Table | Contenu |
|---|---|
| `games` | Jeux (ex. `AIKAHO-JJK` « Aikaho Jujutsu Kaisen ») |
| `sets` | Sets d'un jeu : `code`, `name`, `release_date`, `product_url` (page Eyesight du set), `status` (`draft` dans `/admin`, `published` dans le guide) |
| `rarities` | Raretés **d'un set** avec leur rang (1 = la plus rare) |
| `cards` | Cartes : `id` (ex. `JJK01-SSR-001`), `name`, `set_code`, `number` (recommence à `001` dans chaque rareté), `rarity`, `image_url`, `product_url` (produit Eyesight de la carte, optionnel) |

Ordre des raretés de JJK-01 (rang 1 → 11) : SE, ACE, CHR, UTR, TQR, SAR, QR, SSR, SR, RRR, R

### Migrations
Le schéma vit dans `api/migrations/` ([node-pg-migrate](https://salsita.github.io/node-pg-migrate/)).
L'API applique les migrations manquantes **à son démarrage** : après un déploiement, la BD est toujours à jour.

```bash
cd api
npm run migrate:create -- nom-de-la-migration   # crée api/migrations/<timestamp>_nom-de-la-migration.js
npm run migrate                                 # applique (en local, avec DATABASE_URL du .env)
npm run migrate:down                            # annule la dernière
```
Une migration déjà mergée ne se modifie jamais : on en crée une nouvelle.

## API

| Route | Statut |
|---|---|
| `GET /health` | ✅ Disponible |
| `GET /games` | Jeux qui ont au moins un set publié |
| `GET /sets?game=` | Sets publiés, avec leur nombre de cartes |
| `GET /sets/:code` | Un set + ses raretés dans l'ordre (avec le nombre de cartes) ; `404` si inexistant ou en brouillon |
| `GET /sets/:code/rarities` | Les raretés du set dans l'ordre |
| `GET /sets/:code/cards?search=&rarity=` | Cartes du set : recherche partielle sur le nom, filtre multi-rareté (`rarity=SE,ACE`), tri par rareté puis numéro |
| `GET /cards?set=&search=&rarity=` | Même chose sur tous les sets publiés |
| `GET /cards/:id` | Une carte ; `product_url` = produit de la carte, sinon celui du set ; `404` si elle n'existe pas |
| `/images` | Photos des cartes (WebP) servies en statique |

## SEO

Objectif : sortir premier sur Google pour « aikaho jujutsu kaisen card list ». Titres, descriptions et texte du set sont en anglais.

### Variables du front (`web/aikaho-jjk`)

Voir [web/aikaho-jjk/.env.example](web/aikaho-jjk/.env.example).

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | URL de l'API (données, images des cartes pour `og:image`, et `sitemap.xml` au build) |
| `VITE_SITE_URL` | URL publique du site, sans `/` à la fin : canonical, Open Graph, `sitemap.xml`, `robots.txt` |

`VITE_SITE_URL` vaut `https://aikaho-jjk-guide.onrender.com` par défaut ([.env.production](web/aikaho-jjk/.env.production)). Le jour où le domaine change : mettre la nouvelle valeur dans Render → Environment, puis **Clear build cache & deploy**.

### Ce qui est en place

- `<title>`, description, canonical, Open Graph et Twitter card sur chaque page, avec les balises natives de React 19 ([Seo.jsx](web/aikaho-jjk/src/components/Seo.jsx))
- JSON-LD : `ItemList` sur chaque set, `Product` (sans prix, marque = le jeu) sur chaque fiche
- Bloc « About the set » sous la grille, calculé à partir des raretés du set renvoyées par l'API ([SetAbout.jsx](web/aikaho-jjk/src/components/SetAbout.jsx))
- Balises par défaut dans `index.html` (`data-fallback`, celles de l'accueil) pour les robots qui n'exécutent pas le JavaScript
- `sitemap.xml` et `robots.txt` générés par [scripts/generate-seo-files.js](web/aikaho-jjk/scripts/generate-seo-files.js) à partir de l'API (`VITE_API_URL`) : `/`, chaque `/games/:code`, chaque `/sets/:code` et chaque `/sets/:code/cards/:id` des sets publiés. Si l'API ne répond pas (15 s), le build **ne plante pas** : un avertissement s'affiche et le sitemap est fait à partir de `data/cards.csv` (JJK-01 seulement). Lancé tout seul avant `npm run build` (`prebuild`). Les fichiers ne sont pas commités.

### Pages du front

| URL | Page |
|---|---|
| `/` | Accueil : les sets publiés, regroupés par jeu |
| `/games/:code` | Un jeu et tous ses sets publiés |
| `/sets/:code` | Grille d'un set, recherche et filtres dans l'URL (`?q=goj&rarity=ACE,CHR`) |
| `/sets/:code/cards/:id` | Fiche d'une carte (si la carte est dans un autre set, redirection vers la bonne URL) |

Anciennes URL (d'avant le multi-set, déjà partagées) : `/cards/:id` redirige vers `/sets/<set de la carte>/cards/:id`, et `/?q=…&rarity=…` redirige vers `/sets/JJK-01` avec les mêmes filtres (`LEGACY_SET_CODE` dans [config.js](web/aikaho-jjk/src/config.js)).

La bannière Eyesight pointe vers le produit de la carte, sinon celui du set (`product_url`), sinon vers `EYESIGHT_URL`.

> ⚠️ Le site est encore une SPA : Discord, Facebook et LinkedIn ne lisent que les balises par défaut de `index.html`, pas celles de la carte. Le pré-rendu (#55) règle ça.

### Soumettre le site à Google Search Console

1. https://search.google.com/search-console → **Ajouter une propriété** → **Préfixe de l'URL** → coller la valeur de `VITE_SITE_URL`
2. Valider avec la méthode **Balise HTML** : ajouter la balise `<meta name="google-site-verification" …>` dans `web/aikaho-jjk/index.html` (sans `data-fallback`), merger, attendre le déploiement Render, puis **Valider**
3. **Sitemaps** → entrer `sitemap.xml` → **Envoyer**
4. **Inspection de l'URL** → coller l'URL du site → **Demander l'indexation** (refaire pour quelques fiches de cartes)
5. Revenir dans quelques jours : **Pages** montre ce qui est indexé, **Performances** montre les recherches qui mènent au guide

Si le domaine change, il faut ajouter une nouvelle propriété dans Search Console et renvoyer le sitemap.

## Dépannage

- **`Bind for 0.0.0.0:3000 failed: port is already allocated`** : un autre programme utilise le port. Change `API_PORT` dans `.env`.
- **L'API ne démarre pas, `Migrations échouées` dans `docker compose logs api`** : une migration a planté. Elle est annulée en entier (transaction) ; corrige-la, ou restaure le dernier backup.

## Import d'un set (`/admin`)

Pour ajouter un set au guide, plus besoin de CSV : tout se fait sur `https://api-jjk.andydouangpanya.com/admin/`.

1. **Nouveau set** : jeu, code (ex. `JJK-02`), nom, page Eyesight du set (booster box ou catégorie).
2. **Photos** : glisse les photos (une carte par photo). L'API les convertit en WebP 800 px (`images/<SET>/`).
   - **Sans Claude (gratuit, par défaut)** : les photos sont « à remplir ». Importe ensuite un CSV à l'étape 5,
     avec la colonne `fichier` = nom de chaque photo envoyée.
   - **Avec Claude (payant)** : coche « Lire les cartes avec Claude » avant d'envoyer. **Claude Vision** lit chaque
     carte : nom, nom imprimé, rareté, numéro, et un niveau de confiance.
   - **« Lire avec Claude les photos sans infos »** : seulement celles que le CSV n'a pas remplies.
3. **Ordre des raretés** : « Proposer à partir des photos » classe les raretés de la moins nombreuse à la plus
   nombreuse. Vérifie l'ordre, puis enregistre.
4. **Produits Eyesight** : chaque code (ex. `SSR-012`) est cherché dans WooCommerce. Un seul produit trouvé = choisi
   automatiquement ; plusieurs = tu choisis dans la liste. Sans produit, la fiche mène à la page du set.
   Ça marche aussi pour JJK-01 (cartes déjà en ligne).
5. **Vérifier** : corrige les champs au besoin, coche « Validée » (ou « Valider toutes les cartes sûr »).
   Les lignes surlignées sont à vérifier en priorité. Plus rapide pour un gros set :
   - **« Exporter en CSV »**, corriger dans Excel ou Google Sheets, puis **« Importer un CSV »** :
     les lignes importées sont validées d'un coup (colonne `valide` vide = oui) ;
   - le CSV peut aussi être écrit à la main, avec la colonne `fichier` (nom de la photo envoyée) au lieu de `photo_id` :
     colonnes `fichier`, `nom`, `nom_original`, `rarete`, `numero`, `lien_produit`, `valide` ;
   - une erreur dans le CSV annule tout l'import et donne la liste des lignes à corriger ;
   - **« Tout valider »** valide toutes les photos lues sans les vérifier une par une.
6. **Publier** : refusé tant qu'une carte n'est pas lue et validée, ou qu'une rareté manque dans l'ordre.
   Le set apparaît tout de suite dans le guide ; Render reconstruit le sitemap (deploy hook).
7. **Supprimer un set** (en bas de la page du set) : seulement s'il est en brouillon (« Retirer du guide » d'abord),
   en retapant son code. Cartes, raretés, photos et dossier `images/<SET>/` sont effacés, et le jeu aussi s'il
   n'a plus de set. Récupérable seulement depuis un backup (`~/backups/aikaho-jjk/`).

Sécurité : `/admin` est protégé par **Cloudflare Access** (connexion par courriel, avant même d'arriver au Pi).
L'API vérifie en plus le jeton signé par Cloudflare (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`) ; sans ces
variables, `/admin` reste fermé. En local : `ADMIN_DEV_BYPASS=1` dans `.env` (ignoré en production).

Variables (dans le `.env` du Pi, jamais dans Git) : voir la section « Page /admin » de `.env.example`.
Les photos importées ne sont pas dans Git : `backup.sh` les sauvegarde (`images_<date>.tar.gz`).

## Contribuer

Une branche par issue, commits conventionnels (`feat:`, `fix:`, `chore:`…), PR vers `master` avec `Closes #N` dans la description.
## Production

| Partie | Où | URL |
|---|---|---|
| Front | Render (site statique, redéployé à chaque merge sur `master`) | https://aikaho-jjk-guide.onrender.com |
| API + BD | Raspberry Pi 4, `docker compose` | Tunnel Cloudflare nommé : https://api-jjk.andydouangpanya.com |

### Mettre en route sur le Pi
```bash
git clone https://github.com/Andyd201/aikaho-jjk-guide.git && cd aikaho-jjk-guide
cp .env.example .env          # vrai mot de passe, CORS_ORIGIN, TUNNEL_TOKEN
docker compose up -d --build
docker compose run --rm -v ./data:/data:ro api node scripts/seed.js   # → 151 cartes insérées
```

### Tunnel nommé
L'URL de l'API ne change plus quand le Pi redémarre : le guide revient tout seul après une panne de courant.
- Cloudflare Zero Trust → Networks → Tunnels → tunnel `aikaho-pi`
- Public hostname `api-jjk.andydouangpanya.com` → `http://api:3000`
- Le token du tunnel va dans `.env` (`TUNNEL_TOKEN=...`), jamais dans Git

### Déploiement automatique
`api/scripts/deploy.sh` roule aux 5 minutes avec cron. S'il y a du nouveau sur `master`, il fait :
1. vérifier que le Pi n'a pas de commits locaux et que les variables de `api/scripts/required-env.txt` sont dans `.env` (sinon il **annule** sans rien toucher) ;
2. un backup de la BD (`predeploy_<date>.sql.gz`, gardés à part des backups quotidiens) ;
3. `git merge --ff-only`, puis `docker compose build`. **Si le build plante, il revient au code d'avant** : le site ne bouge pas ;
4. `docker compose up -d`, puis vérifier `/health`. Le commit est noté dans `.deployed-sha` seulement si `/health` répond.

Tant qu'un déploiement n'a pas réussi, il est retenté au passage suivant (aux 5 minutes).

Installation (une seule fois) : `crontab -e`, puis ajouter :
```
*/5 * * * * /home/andy/aikaho-jjk-guide/api/scripts/deploy.sh >> /home/andy/backups/aikaho-jjk/deploy.log 2>&1
```
Suivre les déploiements : `tail -f ~/backups/aikaho-jjk/deploy.log`

Vérifier sans se connecter au Pi : https://api-jjk.andydouangpanya.com/health affiche `version` (le commit en ligne)
et `started_at` (dernier redémarrage de l'API).

Quand une PR ajoute une variable à `required-env.txt`, ajoute-la dans le `.env` du Pi **avant** de merger, sinon le déploiement est annulé (le site reste sur l'ancienne version).

### Restaurer après un déploiement raté
Une migration peut changer le schéma : revenir à l'ancien code ne suffit pas, il faut aussi la BD d'avant.
```bash
cd ~/aikaho-jjk-guide
docker compose logs --tail 50 api                       # comprendre l'erreur
git reset --hard <commit-d-avant>                       # celui de .deployed-sha
ls -t ~/backups/aikaho-jjk/predeploy_*.sql.gz | head -1 # le backup fait juste avant
docker compose stop api
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
gunzip -c ~/backups/aikaho-jjk/predeploy_<date>.sql.gz | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose up -d --build api
```
Puis corriger le problème dans une PR : le prochain merge sur `master` sera déployé normalement.

### ⚠️ À ne pas faire
- `source .env` ou `set -a; . ./.env` avant un `docker compose up` : les variables du terminal
  passent avant celles du fichier `.env`, et l'API démarre avec d'anciennes valeurs.
- Modifier des fichiers suivis par Git directement sur le Pi : le déploiement automatique ne pourra plus faire `git merge --ff-only`.
