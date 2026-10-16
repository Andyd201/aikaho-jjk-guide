# Aikaho JJK Card Guide

Guide de cartes (style Collectr) pour le TCG **Jujutsu Kaisen d'Aikaho**, set **JJK-01** (151 cartes) : grille du set, fiche par carte, recherche et filtre par rareté.

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
db/init.sql       Schéma de la BD, exécuté au premier démarrage de Postgres
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

Table `cards` :

| Colonne | Type | Notes |
|---|---|---|
| `id` | text | Clé primaire, vient du CSV (ex. `JJK01-SSR-001`) |
| `name` | text | |
| `set_code` | text | ex. `JJK-01` |
| `number` | text | Numéro dans la rareté (recommence à `001` pour chaque rareté) |
| `rarity` | text | Une des 11 raretés (contrainte `CHECK`) |
| `rarity_rank` | int | 1 (la plus rare) à 11 (la plus commune) |
| `description` | text | Optionnel |
| `image_url` | text | Optionnel |
| `created_at` | timestamptz | Rempli automatiquement |

Ordre des raretés (`rarity_rank` 1 → 11) :
SE, ACE, CHR, UTR, TQR, SAR, QR, SSR, SR, RRR, R

> ⚠️ `db/init.sql` n'est exécuté que si le volume de données est **vide**. Après une modification du schéma, repartir à neuf avec `docker compose down -v` (efface les données).

## API

| Route | Statut |
|---|---|
| `GET /health` | ✅ Disponible |
| `GET /cards?search=&rarity=` | 🚧 Sprint 1 : recherche partielle sur le nom, filtre multi-rareté (`rarity=ACE,CHR`), tri par rareté puis numéro |
| `GET /cards/:id` | 🚧 Sprint 1 : `404` si la carte n'existe pas |
| `GET /rarities` | 🚧 Sprint 1 : les 11 raretés dans l'ordre |
| `/images` | 🚧 Sprint 1 : photos des cartes (WebP ~800 px) servies en statique |

## SEO

Objectif : sortir premier sur Google pour « aikaho jujutsu kaisen card list ». Titres, descriptions et texte du set sont en anglais.

### Variables du front (`web/aikaho-jjk`)

Voir [web/aikaho-jjk/.env.example](web/aikaho-jjk/.env.example).

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | URL de l'API (images des cartes, aussi utilisées pour `og:image`) |
| `VITE_SITE_URL` | URL publique du site, sans `/` à la fin : canonical, Open Graph, `sitemap.xml`, `robots.txt` |

`VITE_SITE_URL` vaut `https://aikaho-jjk-guide.onrender.com` par défaut ([.env.production](web/aikaho-jjk/.env.production)). Le jour où le domaine change : mettre la nouvelle valeur dans Render → Environment, puis **Clear build cache & deploy**.

### Ce qui est en place

- `<title>`, description, canonical, Open Graph et Twitter card sur chaque page, avec les balises natives de React 19 ([Seo.jsx](web/aikaho-jjk/src/components/Seo.jsx))
- JSON-LD : `ItemList` sur le set, `Product` (sans prix) sur chaque fiche
- Bloc « About the set » sous la grille, calculé à partir des cartes ([SetAbout.jsx](web/aikaho-jjk/src/components/SetAbout.jsx))
- Balises par défaut dans `index.html` (`data-fallback`) pour les robots qui n'exécutent pas le JavaScript
- `sitemap.xml` et `robots.txt` générés par [scripts/generate-seo-files.js](web/aikaho-jjk/scripts/generate-seo-files.js) à partir de `data/cards.csv`. Lancé tout seul avant `npm run build` (`prebuild`). Les fichiers ne sont pas commités.

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
- **Ma modification de `init.sql` n'est pas appliquée** : voir l'avertissement dans la section Base de données.

## Contribuer

Une branche par issue, commits conventionnels (`feat:`, `fix:`, `chore:`…), PR vers `master` avec `Closes #N` dans la description.
## Production

| Partie | Où | URL |
|---|---|---|
| Front | Render (site statique, redéployé à chaque merge sur `master`) | https://aikaho-jjk-guide.onrender.com |
| API + BD | Raspberry Pi 4, `docker compose` | Quick Tunnel Cloudflare (`*.trycloudflare.com`) |

### Mettre en route sur le Pi
```bash
git clone https://github.com/Andyd201/aikaho-jjk-guide.git && cd aikaho-jjk-guide
cp .env.example .env          # mettre un vrai mot de passe et CORS_ORIGIN=https://aikaho-jjk-guide.onrender.com
docker compose up -d --build
docker compose run --rm -v ./data:/data:ro api node scripts/seed.js   # → 151 cartes insérées
```

### Si le Pi redémarre
L'URL du Quick Tunnel change. Pour remettre le guide en ligne :
1. `docker compose logs tunnel | grep trycloudflare | tail -1` → copier la nouvelle URL
2. Render → Environment → mettre à jour `VITE_API_URL`
3. Render → Manual Deploy → **Clear build cache & deploy**

### ⚠️ À ne pas faire
- `source .env` ou `set -a; . ./.env` avant un `docker compose up` : les variables du terminal
  passent avant celles du fichier `.env`, et l'API démarre avec d'anciennes valeurs.
- `docker compose down` ou redémarrer le service `tunnel` sans raison : l'URL change.****