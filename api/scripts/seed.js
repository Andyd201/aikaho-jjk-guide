import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { RARITIES } from '../src/rarities.js';
import { pool } from '../src/db.js';

// 1. Lire data/cards.csv et le transformer en tableau d'objets
// Chemin relatif au script (api/scripts/), pas au dossier d'où on le lance
const csvPath = join(import.meta.dirname, '../../data/cards.csv');
const rows = parse(readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
});

// 2. Pour chaque ligne : calculer rarity_rank (et planter si rareté inconnue)
const cards = rows.map((row) => {
    const index = RARITIES.indexOf(row.rarity);
    if (index === -1) {
        throw new Error(`Rareté inconnue pour ${row.id} : ${row.rarity}`);
    }
    return { ...row, rarity_rank: index + 1 };
});

// 3. Insérer toutes les cartes dans une transaction
// Un seul client : BEGIN, INSERT et COMMIT doivent passer par la même connexion
const client = await pool.connect();
try {
    await client.query('BEGIN');
    // On repart à zéro pour pouvoir relancer le seed (annulé par le ROLLBACK si ça plante)
    await client.query('TRUNCATE cards');
    for (const card of cards) {
        await client.query(
            `INSERT INTO cards (id, name, set_code, number, rarity, rarity_rank)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [card.id, card.name, 'JJK-01', card.number, card.rarity, card.rarity_rank]
        );
    }
    await client.query('COMMIT');
    console.log(`${cards.length} cartes insérées`);
} catch (err) {
    await client.query('ROLLBACK');
    throw err;
} finally {
    // 4. Fermer le pool, sinon le script ne se termine jamais
    client.release();
    await pool.end();
}