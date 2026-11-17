import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { autenticar } from '../middlewares/auth.js';
import { criarViagem, listarViagens, obterViagem, atualizarViagem, excluirViagem } from '../controllers/viagemController.js';

const router = Router();

router.use('/viagens', autenticar);
router.post('/viagens', asyncHandler(criarViagem));
router.get('/viagens', asyncHandler(listarViagens));
router.get('/viagens/:id', asyncHandler(obterViagem));
router.put('/viagens/:id', asyncHandler(atualizarViagem));
router.delete('/viagens/:id', asyncHandler(excluirViagem));

export default router;
