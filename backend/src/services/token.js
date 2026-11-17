import jwt from 'jsonwebtoken';
import { HttpError } from '../utils/http.js';

const segredo = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não configurado no .env');
  return s;
};

export const emitirToken = (usuario) =>
  jwt.sign({ sub: usuario.id_usuario, nome: usuario.nome }, segredo(), { expiresIn: '8h' });

export const validarToken = (token) => {
  try {
    const payload = jwt.verify(token, segredo());
    return { id_usuario: Number(payload.sub), nome: payload.nome };
  } catch {
    throw new HttpError(401, 'Sessão inválida ou expirada. Faça login novamente.');
  }
};
