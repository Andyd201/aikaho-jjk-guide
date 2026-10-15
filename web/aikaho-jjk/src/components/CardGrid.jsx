import CardTile from "./CardTile.jsx"; 

function CardGrid({cards }) {
    return(
        <div className="card-grid">
            {cards.map((card) => (
                <CardTile key={card.id} card={card} />
            ))}


        </div>
    )
}

export default CardGrid;