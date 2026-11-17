import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { autenticar } from '../middlewares/auth.js';
import { meuPerfil, atualizarPerfil, minhaPrivacidade, atualizarPrivacidade } from '../controllers/perfilController.js';

const router = Router();

router.get('/me', autenticar, asyncHandler(meuPerfil));
router.put('/me', autenticar, asyncHandler(atualizarPerfil));
router.get('/me/privacidade', autenticar, asyncHandler(minhaPrivacidade));
router.put('/me/privacidade', autenticar, asyncHandler(atualizarPrivacidade));

export default router;
