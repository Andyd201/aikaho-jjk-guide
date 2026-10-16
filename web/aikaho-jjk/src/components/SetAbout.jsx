import { SET_NAME } from "../config.js";

// Texte en anglais sous la grille : c'est ce que Google lit pour comprendre la page.
// Tout est calculé à partir des cartes : aucun chiffre écrit à la main
function SetAbout({ cards, rarities }) {
  const counts = new Map(rarities.map((rarity) => [rarity, 0]));
  for (const card of cards) {
    counts.set(card.rarity, counts.get(card.rarity) + 1);
  }

  return (
    <section className="set-about" lang="en" aria-labelledby="set-about-title">
      <h2 id="set-about-title">About the {SET_NAME} set</h2>
      <p>
        JJK-01 is a Jujutsu Kaisen trading card set by Aikaho. This guide lists all{" "}
        {cards.length} cards of the set with their image, card number and rarity. The set has{" "}
        {rarities.length} rarities, from {rarities[0]} (the rarest) to{" "}
        {rarities[rarities.length - 1]} (the most common).
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
            <tr key={rarity} data-rarity={rarity}>
              <th scope="row">
                <span className="rarity">{rarity}</span>
              </th>
              <td>{counts.get(rarity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default SetAbout;
