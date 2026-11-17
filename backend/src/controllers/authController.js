import prisma from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { cpfValido, emailValido, somenteDigitos, SENHA_MINIMA } from '../utils/validacao.js';
import { gerarHash, conferirSenha } from '../services/senha.js';
import { emitirToken } from '../services/token.js';

const camposPublicos = {
  id_usuario: true, nome: true, email: true, cidade: true, estado: true,
  bio: true, foto_url: true, data_cadastro: true,
};

// US01 / RF01 — cadastro com validação e unicidade de CPF e e-mail.
export const cadastrar = async (req, res) => {
  const { nome, email, cpf, senha, confirmarSenha } = req.body ?? {};
  const erros = [];

  if (!nome || String(nome).trim().length < 3) erros.push('Informe o nome completo (mínimo 3 letras).');
  if (!emailValido(email)) erros.push('E-mail inválido.');
  if (!cpfValido(cpf)) erros.push('CPF inválido.');
  if (!senha || String(senha).length < SENHA_MINIMA) erros.push(`A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`);
  if (confirmarSenha !== undefined && confirmarSenha !== senha) erros.push('As senhas não conferem.');
  if (erros.length) throw new HttpError(400, erros[0], { detalhes: erros });

  const cpfLimpo = somenteDigitos(cpf);
  const emailLimpo = String(email).trim().toLowerCase();

  const existente = await prisma.usuario.findFirst({
    where: { OR: [{ cpf: cpfLimpo }, { email: emailLimpo }] },
    select: { cpf: true, email: true },
  });
  if (existente?.cpf === cpfLimpo) throw new HttpError(409, 'CPF já cadastrado.', { code: 'CPF_DUPLICADO' });
  if (existente) throw new HttpError(409, 'E-mail já cadastrado.', { code: 'EMAIL_DUPLICADO' });

  const usuario = await prisma.usuario.create({
    data: {
      nome: String(nome).trim(),
      email: emailLimpo,
      cpf: cpfLimpo,
      senha: await gerarHash(senha),
      preferencia: { create: {} },
    },
    select: camposPublicos,
  });

  return res.status(201).json(usuario);
};

// US01 / RF02 — login com senha em hash bcrypt e emissão de JWT.
export const login = async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) throw new HttpError(400, 'Informe e-mail e senha.');

  const usuario = await prisma.usuario.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });
  const conferencia = usuario ? await conferirSenha(senha, usuario.senha) : { ok: false };
  if (!conferencia.ok) throw new HttpError(401, 'E-mail ou senha incorretos.');

  // Usuários antigos (senha em texto puro) passam a ter hash no primeiro login.
  if (conferencia.precisaMigrar) {
    await prisma.usuario.update({ where: { id_usuario: usuario.id_usuario }, data: { senha: await gerarHash(senha) } });
  }

  const { senha: _omitida, cpf: _cpf, ...publico } = usuario;
  return res.status(200).json({ token: emitirToken(usuario), usuario: publico });
};

// US01 / RF02 — redefinição de senha conferindo e-mail + CPF (sem envio de e-mail nesta versão).
export const recuperarSenha = async (req, res) => {
  const { email, cpf, novaSenha } = req.body ?? {};
  if (!emailValido(email) || !cpfValido(cpf)) throw new HttpError(400, 'Informe um e-mail e um CPF válidos.');
  if (!novaSenha || String(novaSenha).length < SENHA_MINIMA) {
    throw new HttpError(400, `A nova senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`);
  }

  const usuario = await prisma.usuario.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  if (!usuario || usuario.cpf !== somenteDigitos(cpf)) {
    throw new HttpError(404, 'Não encontramos uma conta com esse e-mail e CPF.');
  }

  await prisma.usuario.update({ where: { id_usuario: usuario.id_usuario }, data: { senha: await gerarHash(novaSenha) } });
  return res.status(200).json({ message: 'Senha alterada com sucesso. Faça login com a nova senha.' });
};
