import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { pool } from '../src/db.js';

// 1. Lire data/cards.csv et le transformer en tableau d'objets
// Chemin relatif au script (api/scripts/), pas au dossier d'où on le lance
const csvPath = join(import.meta.dirname, '../../data/cards.csv');
const rows = parse(readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
});

// Ce CSV ne contient que JJK-01. Les nouveaux sets passent par /admin.
const SET_CODE = 'JJK-01';

// 2. Valider chaque ligne (les raretés valides sont celles de JJK-01 dans la table rarities)
const { rows: rarityRows } = await pool.query('SELECT code FROM rarities WHERE set_code = $1', [SET_CODE]);
const rarities = new Set(rarityRows.map((r) => r.code));
if (rarities.size === 0) throw new Error(`Le set ${SET_CODE} n'existe pas : les migrations ont-elles roulé ?`);

const cards = rows.map((row, i) => {
    const line = i + 2; // +1 pour l'en-tête, +1 parce que les lignes commencent à 1
    if (!rarities.has(row.rarity)) throw new Error(`Ligne ${line} (${row.id}) : rareté inconnue "${row.rarity}"`);
    if (!row.name?.trim()) throw new Error(`Ligne ${line} (${row.id}) : nom vide`);
    if (row.id !== `JJK01-${row.rarity}-${row.number}`) throw new Error(`Ligne ${line} : id "${row.id}" incohérent avec rareté/numéro`);
    return { ...row, image_url: `/images/${row.image_file}` };
});

// 3. Insérer toutes les cartes dans une transaction
// Un seul client : BEGIN, INSERT et COMMIT doivent passer par la même connexion
const client = await pool.connect();
try {
    await client.query('BEGIN');
    // On repart à zéro pour ce set seulement : les autres sets ne sont pas touchés
    // (annulé par le ROLLBACK si ça plante)
    await client.query('DELETE FROM cards WHERE set_code = $1', [SET_CODE]);
    for (const card of cards) {
        await client.query(
            `INSERT INTO cards (id, name, set_code, number, rarity, image_url)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [card.id, card.name, SET_CODE, card.number, card.rarity, card.image_url]
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