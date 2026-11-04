import { app } from './app.js';
import { migrate } from './migrate.js';
import { resumeQueue } from './admin/queue.js';

const port = process.env.API_PORT || 3000;

// Les migrations roulent avant d'accepter des requêtes : après un déploiement,
// la BD est toujours au bon schéma. Si une migration plante, l'API ne démarre pas.
try {
    await migrate();
} catch (err) {
    console.error('Migrations échouées :', err.message);
    process.exit(1);
}

// Photos restées en attente de lecture par Claude (ex. le Pi a redémarré pendant un import)
await resumeQueue();

app.listen(port, () => {
    console.log(`API démarrée sur le port ${port}`);
});
