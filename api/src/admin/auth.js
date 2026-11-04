import { createRemoteJWKSet, jwtVerify } from "jose";

// La page /admin est protégée par Cloudflare Access : Cloudflare demande ton courriel
// AVANT que la requête arrive au Pi. On vérifie quand même le jeton signé par Cloudflare
// (en-tête Cf-Access-Jwt-Assertion) : si quelqu'un arrivait à joindre l'API sans passer
// par Cloudflare, il serait refusé ici.
//
// Variables (.env) :
//   CF_ACCESS_TEAM_DOMAIN  ex. andydouangpanya.cloudflareaccess.com
//   CF_ACCESS_AUD          « Application Audience (AUD) Tag » de l'application Access
//   ADMIN_DEV_BYPASS=1     en local seulement (ignoré si NODE_ENV=production)

let jwks;
let jwksDomain;

function getJwks(teamDomain) {
  if (!jwks || jwksDomain !== teamDomain) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksDomain = teamDomain;
  }
  return jwks;
}

function readToken(req) {
  const header = req.get("cf-access-jwt-assertion");
  if (header) return header;
  // Cloudflare met aussi le jeton dans le cookie CF_Authorization
  const cookie = req.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function requireAdmin(req, res, next) {
  const { CF_ACCESS_TEAM_DOMAIN: teamDomain, CF_ACCESS_AUD: audience } = process.env;

  if (process.env.ADMIN_DEV_BYPASS === "1" && process.env.NODE_ENV !== "production") {
    req.adminEmail = "dev@localhost";
    return next();
  }

  // Pas configuré = admin fermé (jamais ouvert par défaut)
  if (!teamDomain || !audience) {
    return res.status(503).json({ error: "Admin désactivé : CF_ACCESS_TEAM_DOMAIN et CF_ACCESS_AUD manquants" });
  }

  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Connexion Cloudflare Access requise" });
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience,
    });
    req.adminEmail = payload.email;
    next();
  } catch {
    res.status(403).json({ error: "Jeton Cloudflare Access invalide" });
  }
}

// Contre le CSRF : une requête qui modifie quelque chose doit venir de la page /admin elle-même
export function sameOriginOnly(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        return res.status(403).json({ error: "Origine refusée" });
      }
    } catch {
      return res.status(403).json({ error: "Origine refusée" });
    }
  }
  next();
}
