import prisma from '../config/prisma.js';
import { HttpError } from '../utils/http.js';

const camposPerfil = {
  id_usuario: true, nome: true, email: true, cidade: true, estado: true,
  bio: true, foto_url: true, data_cadastro: true,
  preferencia: { select: { perfil_publico: true, receber_solicitacoes: true, permitir_mensagens: true } },
};

const garantirPreferencia = (id_usuario) =>
  prisma.preferenciaPrivacidade.upsert({ where: { id_usuario }, update: {}, create: { id_usuario } });

// US02 / US04 / RF03 — consultar o próprio perfil.
export const meuPerfil = async (req, res) => {
  await garantirPreferencia(req.usuario.id_usuario);
  const perfil = await prisma.usuario.findUnique({ where: { id_usuario: req.usuario.id_usuario }, select: camposPerfil });
  if (!perfil) throw new HttpError(404, 'Usuário não encontrado.');
  const viagens = await prisma.viagem.count({ where: { id_usuario: req.usuario.id_usuario, status: { not: 'cancelada' } } });
  return res.json({ ...perfil, total_viagens: viagens });
};

// US02 / US04 / RF03 — editar nome, cidade, estado, bio e foto.
export const atualizarPerfil = async (req, res) => {
  const { nome, cidade, estado, bio, foto_url } = req.body ?? {};
  const dados = {};

  if (nome !== undefined) {
    if (String(nome).trim().length < 3) throw new HttpError(400, 'O nome deve ter pelo menos 3 letras.');
    dados.nome = String(nome).trim();
  }
  if (cidade !== undefined) dados.cidade = String(cidade).trim() || null;
  if (estado !== undefined) {
    const uf = String(estado).trim().toUpperCase();
    if (uf && !/^[A-Z]{2}$/.test(uf)) throw new HttpError(400, 'Estado deve ser a sigla com 2 letras (ex.: SC).');
    dados.estado = uf || null;
  }
  if (bio !== undefined) {
    if (String(bio).length > 500) throw new HttpError(400, 'A bio pode ter no máximo 500 caracteres.');
    dados.bio = String(bio).trim() || null;
  }
  if (foto_url !== undefined) {
    const url = String(foto_url).trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) throw new HttpError(400, 'A foto deve ser um link http(s).');
    dados.foto_url = url || null;
  }
  if (!Object.keys(dados).length) throw new HttpError(400, 'Nenhum campo foi informado para atualização.');

  const perfil = await prisma.usuario.update({ where: { id_usuario: req.usuario.id_usuario }, data: dados, select: camposPerfil });
  return res.json(perfil);
};

// US03 / US08 / RF04 — preferências de privacidade.
export const minhaPrivacidade = async (req, res) => {
  const pref = await garantirPreferencia(req.usuario.id_usuario);
  return res.json(pref);
};

export const atualizarPrivacidade = async (req, res) => {
  const campos = ['perfil_publico', 'receber_solicitacoes', 'permitir_mensagens'];
  const dados = {};
  for (const campo of campos) {
    if (req.body?.[campo] !== undefined) {
      if (typeof req.body[campo] !== 'boolean') throw new HttpError(400, `${campo} deve ser verdadeiro ou falso.`);
      dados[campo] = req.body[campo];
    }
  }
  if (!Object.keys(dados).length) throw new HttpError(400, 'Nenhuma preferência foi informada.');

  const pref = await prisma.preferenciaPrivacidade.upsert({
    where: { id_usuario: req.usuario.id_usuario },
    update: dados,
    create: { id_usuario: req.usuario.id_usuario, ...dados },
  });
  return res.json(pref);
};
