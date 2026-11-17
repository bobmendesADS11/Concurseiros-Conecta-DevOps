import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import concursoRoutes from './routes/concursoRoutes.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import perfilRoutes from './routes/perfilRoutes.js';
import viagemRoutes from './routes/viagemRoutes.js';
import conexaoRoutes from './routes/conexaoRoutes.js';
import { errorMiddleware } from './utils/http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', perfilRoutes);
app.use('/api', viagemRoutes);
app.use('/api', conexaoRoutes);
app.use('/api', concursoRoutes);
app.use('/api', userRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// O próprio backend serve o frontend: basta abrir http://localhost:3000
app.use(express.static(path.resolve(__dirname, '../../frontend'), {
  // Sempre confere se o arquivo mudou, para o navegador não mostrar versão antiga.
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use(errorMiddleware);

export default app;
