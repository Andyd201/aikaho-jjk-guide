import { useT } from "../i18n.js";

// Texte sous la grille, dans la langue du visiteur (Google le lit en anglais).
// Tout vient de l'API (set + raretés avec leur nombre de cartes) : aucun chiffre écrit à la main
// rarities : raretés du set qui ont au moins une carte, de la plus rare à la plus commune
function SetAbout({ set, cardCount, rarities }) {
  const { t, lang } = useT();
  return (
    <section className="set-about" lang={lang} aria-labelledby="set-about-title">
      <h2 id="set-about-title">{t.aboutTitle(set.name)}</h2>
      <p>
        {t.aboutText({
          set: set.name,
          game: set.game_name,
          cardCount,
          rarityCount: rarities.length,
          rarest: rarities[0]?.code,
          commonest: rarities[rarities.length - 1]?.code,
        })}
      </p>
      {/* TODO PO : contenu d'un booster et d'une boîte, taux de pull, date de sortie.
          Ne rien écrire tant que ce n'est pas confirmé par une source officielle. */}

      <h3>{t.raritiesTitle}</h3>
      <table className="rarity-table">
        <thead>
          <tr>
            <th scope="col">{t.rarity}</th>
            <th scope="col">{t.cardsColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rarities.map((rarity) => (
            <tr key={rarity.code} data-rarity={rarity.code}>
              <th scope="row">
                <span className="rarity">{rarity.code}</span>
              </th>
              <td>{rarity.card_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default SetAbout;
