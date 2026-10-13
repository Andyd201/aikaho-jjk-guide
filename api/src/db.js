import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Sans cet écouteur, une connexion inactive qui plante (ex. Postgres redémarre) crashe le process
pool.on('error', (err) => {
    console.error('Erreur inattendue du pool Postgres :', err.message);
});
