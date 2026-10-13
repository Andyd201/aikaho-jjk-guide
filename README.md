# Aikaho JJK Card Guide

Guide de cartes (style Collectr) pour le TCG **Jujutsu Kaisen d'Aikaho**, set **JJK-01** (~150 cartes) : grille du set, fiche par carte, recherche et filtre par rareté.

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
data/cards.csv    Données des cartes du set JJK-01
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
| `id` | serial | Clé primaire |
| `name` | text | |
| `set_code` | text | ex. `JJK-01` |
| `number` | text | Numéro dans le set ; `UNIQUE(set_code, number)` |
| `rarity` | text | ex. `SGR`, `SSR`, `R` |
| `rarity_rank` | int | 1 (la plus rare) à 17 (la plus commune) |
| `description` | text | Optionnel |
| `image_url` | text | Optionnel |
| `created_at` | timestamptz | Rempli automatiquement |

Ordre des raretés (`rarity_rank` 1 → 17) :
SGR, LGR, LNR, XP, NR, CR, SSP, SP, MR, AR, QR, OR, HR, UR, SSR, SR, R

> ⚠️ `db/init.sql` n'est exécuté que si le volume de données est **vide**. Après une modification du schéma, repartir à neuf avec `docker compose down -v` (efface les données).

## API

| Route | Statut |
|---|---|
| `GET /health` | ✅ Disponible |
| `GET /cards?search=&rarity=` | 🚧 Sprint 1 : recherche partielle sur le nom, filtre multi-rareté (`rarity=SGR,SSR`), tri par numéro |
| `GET /cards/:id` | 🚧 Sprint 1 : `404` si la carte n'existe pas |
| `GET /rarities` | 🚧 Sprint 1 : les 17 raretés dans l'ordre |
| `/images` | 🚧 Sprint 1 : photos des cartes (WebP ~800 px) servies en statique |

## Dépannage

- **`Bind for 0.0.0.0:3000 failed: port is already allocated`** : un autre programme utilise le port. Change `API_PORT` dans `.env`.
- **Ma modification de `init.sql` n'est pas appliquée** : voir l'avertissement dans la section Base de données.

## Contribuer

Une branche par issue, commits conventionnels (`feat:`, `fix:`, `chore:`…), PR vers `master` avec `Closes #N` dans la description.
