export const API_URL = import.meta.env.VITE_API_URL;

export async function fetchCards() {
  const res = await fetch(`${API_URL}/cards`);

  // fetch ne lance une erreur que si le réseau est coupé : un 500 de l'API passe quand même
  if (!res.ok) {
    throw new Error(`Erreur API : ${res.status}`);
  }

  return res.json();
}
