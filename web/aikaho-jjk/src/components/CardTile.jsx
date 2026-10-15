import { Link } from "react-router";
import { API_URL } from "../api.js";

function CardTile({ card }) {
  return (
    <Link to={`/cards/${card.id}`} className="card-tile" data-rarity={card.rarity}>
      <img
        src={`${API_URL}${card.image_url}`}
        alt={card.name}
        loading="lazy"
        width={197}
        height={274}
      />
      <p className="name">{card.name}</p>
      <p className="meta">
        {card.number} <span className="rarity">{card.rarity}</span>
      </p>
    </Link>
  );
}

export default CardTile;
