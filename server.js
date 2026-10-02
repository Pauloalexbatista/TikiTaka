import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Servir ficheiros estáticos da pasta public e da raiz
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Fallback universal para SPA (compatível Express 4 e Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚽ Tiki-Taka Simulator online na porta ${PORT}`);
});
