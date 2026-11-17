import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { cadastrar, login, recuperarSenha } from '../controllers/authController.js';

const router = Router();

router.post('/auth/cadastro', asyncHandler(cadastrar));
router.post('/auth/login', asyncHandler(login));
router.post('/auth/recuperar-senha', asyncHandler(recuperarSenha));

export default router;
