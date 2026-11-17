import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { autenticar } from '../middlewares/auth.js';
import { listarConcurseiros } from '../controllers/concurseiroController.js';
import {
  solicitarConexao, listarConexoes, responderConexao, historicoMensagens, postarMensagem,
} from '../controllers/conexaoController.js';

const router = Router();

router.get('/concurseiros', autenticar, asyncHandler(listarConcurseiros));

router.use('/conexoes', autenticar);
router.post('/conexoes', asyncHandler(solicitarConexao));
router.get('/conexoes', asyncHandler(listarConexoes));
router.patch('/conexoes/:id', asyncHandler(responderConexao));
router.get('/conexoes/:id/mensagens', asyncHandler(historicoMensagens));
router.post('/conexoes/:id/mensagens', asyncHandler(postarMensagem));

export default router;
