// « 2026-09-15 » → « 15 sept. 2026 ». On ne garde que la partie date :
// pas de new Date("2026-09-15") qui recule d'un jour selon le fuseau du visiteur
export function formatReleaseDate(value, locale = "en-CA") {
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const [, year, month, day] = match;
  return dateFormat.format(Date.UTC(year, month - 1, day));
}

