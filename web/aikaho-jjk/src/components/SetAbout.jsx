// Texte en anglais sous la grille : c'est ce que Google lit pour comprendre la page.
// Tout vient de l'API (set + raretés avec leur nombre de cartes) : aucun chiffre écrit à la main
// rarities : raretés du set qui ont au moins une carte, de la plus rare à la plus commune
function SetAbout({ set, cardCount, rarities }) {
  return (
    <section className="set-about" lang="en" aria-labelledby="set-about-title">
      <h2 id="set-about-title">About the {set.name} set</h2>
      <p>
        {set.name} is a trading card set from {set.game_name}. This guide lists all {cardCount}{" "}
        cards of the set with their image, card number and rarity. The set has {rarities.length}{" "}
        {rarities.length > 1 ? "rarities" : "rarity"}
        {rarities.length > 1 && (
          <>
            , from {rarities[0].code} (the rarest) to {rarities[rarities.length - 1].code} (the most
            common)
          </>
        )}
        .
      </p>
      {/* TODO PO : contenu d'un booster et d'une boîte, taux de pull, date de sortie.
          Ne rien écrire tant que ce n'est pas confirmé par une source officielle. */}

      <h3>Rarities and card count</h3>
      <table className="rarity-table">
        <thead>
          <tr>
            <th scope="col">Rarity</th>
            <th scope="col">Cards</th>
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
