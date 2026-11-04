import pg from 'pg';

const { Pool, types } = pg;

// Colonnes « date » (ex. sets.release_date) : gardées en texte AAAA-MM-JJ.
// Sinon pg crée un objet Date à minuit dans le fuseau du serveur, et le jour peut reculer de 1.
types.setTypeParser(types.builtins.DATE, (value) => value);

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Sans cet écouteur, une connexion inactive qui plante (ex. Postgres redémarre) crashe le process
pool.on('error', (err) => {
    console.error('Erreur inattendue du pool Postgres :', err.message);
});
