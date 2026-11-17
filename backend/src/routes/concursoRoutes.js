import { Router } from 'express';
import { autenticar } from '../middlewares/auth.js';
import {
  createConcurso,
  getAllConcursos,
  getConcursoById,
  updateConcurso,
  deleteConcurso,
  getBancas,
} from '../controllers/concursoController.js';

const router = Router();

// Consultas são públicas; criar, editar e excluir exigem login (N2).
router.get('/bancas', getBancas);
router.get('/concursos', getAllConcursos);
router.get('/concursos/:id', getConcursoById);
router.post('/concursos', autenticar, createConcurso);
router.put('/concursos/:id', autenticar, updateConcurso);
router.delete('/concursos/:id', autenticar, deleteConcurso);

export default router;
