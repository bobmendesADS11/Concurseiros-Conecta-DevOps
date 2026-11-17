import { Router } from 'express';
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} from '../controllers/userController.js';

import { autenticar } from '../middlewares/auth.js';

const router = Router();

// CRUD administrativo de usuários (da N1). O cadastro do app usa /api/auth/cadastro.
router.use('/users', autenticar);

router.post('/users', createUser);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

export default router;