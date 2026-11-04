import CardTile from "./CardTile.jsx";

function CardGrid({ cards, setName }) {
  return (
    <div className="card-grid">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} setName={setName} />
      ))}
    </div>
  );
}

export default CardGrid;
