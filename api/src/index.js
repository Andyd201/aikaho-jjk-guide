import { app } from './app.js';

const port = process.env.API_PORT || 3000;

app.listen(port, () => {
    console.log(`API démarrée sur le port ${port}`);
});
