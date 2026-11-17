import { HttpError } from '../utils/http.js';
import { validarToken } from '../services/token.js';

// Exige o cabeçalho Authorization: Bearer <token> e coloca o usuário em req.usuario.
export const autenticar = (req, _res, next) => {
  try {
    const [tipo, token] = (req.headers.authorization || '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new HttpError(401, 'Faça login para continuar.');
    }
    req.usuario = validarToken(token);
    next();
  } catch (err) {
    next(err);
  }
};
