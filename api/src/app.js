import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Health check échoué :', err.code || err.message);
        res.status(503).json({ status: 'error', db: 'unreachable' });
    }
});
