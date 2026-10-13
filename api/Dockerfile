# L'image de départ : Node 24 sur Alpine, un Linux de quelques Mo.
FROM node:24-alpine

# Le dossier de travail dans l'image ; les commandes suivantes s'y exécutent.
WORKDIR /app

# Mode production : Express plus rapide, moins de détails d'erreur exposés.
ENV NODE_ENV=production

# Le manifeste d'abord, seul : tant qu'il ne change pas, la couche
# npm ci est reprise du cache, même si le code change.
COPY package*.json ./

RUN npm ci --omit=dev

# Le code ensuite. Le point final, c'est WORKDIR.
COPY . .

# Documentation : ce conteneur écoute sur ce port. (N'ouvre rien tout seul.)
# Le vrai port vient de API_PORT, fourni par docker-compose.
EXPOSE 3000

# Pas de root : l'image Node fournit déjà l'utilisateur « node ».
USER node

# La commande lancée au démarrage du conteneur.
# node direct (pas npm start) pour recevoir le SIGTERM de docker stop.
CMD ["node", "src/index.js"]
