import prisma from '../config/prisma.js';
import { HttpError, parseId } from '../utils/http.js';
import { listarMensagens, enviarMensagem } from '../services/conexaoService.js';
import { notificarMensagem } from '../websocket/chat.js';

const pessoa = { select: { id_usuario: true, nome: true, cidade: true, estado: true, foto_url: true } };

// US10 / RF09 CA01 + CA03 — enviar solicitação de conexão.
export const solicitarConexao = async (req, res) => {
  const meuId = req.usuario.id_usuario;
  const id_destinatario = parseId(req.body?.id_destinatario, 'Destinatário');
  if (id_destinatario === meuId) throw new HttpError(400, 'Você não pode enviar solicitação para si mesmo.');

  const destinatario = await prisma.usuario.findUnique({ where: { id_usuario: id_destinatario }, include: { preferencia: true } });
  if (!destinatario) throw new HttpError(404, 'Concurseiro não encontrado.');
  if (destinatario.preferencia && !destinatario.preferencia.receber_solicitacoes) {
    throw new HttpError(403, 'Este concurseiro não está recebendo solicitações de conexão.');
  }

  const existente = await prisma.conexao.findFirst({
    where: {
      OR: [
        { id_solicitante: meuId, id_destinatario },
        { id_solicitante: id_destinatario, id_destinatario: meuId },
      ],
    },
  });

  if (existente) {
    const enviadaPorMim = existente.id_solicitante === meuId;
    if (existente.status === 'recusada' && enviadaPorMim) {
      // Depois de uma recusa, permite uma nova tentativa reabrindo a mesma solicitação.
      const reaberta = await prisma.conexao.update({
        where: { id_conexao: existente.id_conexao },
        data: { status: 'pendente', data_solicitacao: new Date(), data_resposta: null },
      });
      return res.status(201).json(reaberta);
    }
    if (existente.status === 'aceita') throw new HttpError(409, 'Vocês já estão conectados.', { code: 'JA_CONECTADOS' });
    if (!enviadaPorMim && existente.status === 'pendente') {
      throw new HttpError(409, 'Este concurseiro já te enviou uma solicitação. Responda em Conexões.', { code: 'SOLICITACAO_RECEBIDA' });
    }
    throw new HttpError(409, 'Solicitação já enviada. Aguarde a resposta.', { code: 'SOLICITACAO_DUPLICADA' });
  }

  const conexao = await prisma.conexao.create({ data: { id_solicitante: meuId, id_destinatario } });
  return res.status(201).json(conexao);
};

// US10 / RF09 CA02 — listar solicitações recebidas, enviadas e conexões aceitas.
export const listarConexoes = async (req, res) => {
  const meuId = req.usuario.id_usuario;
  const conexoes = await prisma.conexao.findMany({
    where: { OR: [{ id_solicitante: meuId }, { id_destinatario: meuId }] },
    include: { solicitante: pessoa, destinatario: pessoa },
    orderBy: { data_solicitacao: 'desc' },
  });

  const formatar = (c) => ({
    id_conexao: c.id_conexao,
    status: c.status,
    data_solicitacao: c.data_solicitacao,
    data_resposta: c.data_resposta,
    enviada_por_mim: c.id_solicitante === meuId,
    outro: c.id_solicitante === meuId ? c.destinatario : c.solicitante,
  });

  return res.json({
    recebidas: conexoes.filter((c) => c.id_destinatario === meuId && c.status === 'pendente').map(formatar),
    enviadas: conexoes.filter((c) => c.id_solicitante === meuId && c.status !== 'aceita').map(formatar),
    aceitas: conexoes.filter((c) => c.status === 'aceita').map(formatar),
  });
};

// US10 / RF09 CA02 — destinatário aceita ou recusa.
export const responderConexao = async (req, res) => {
  const id_conexao = parseId(req.params.id, 'ID da conexão');
  const { status } = req.body ?? {};
  if (!['aceita', 'recusada'].includes(status)) throw new HttpError(400, 'Status deve ser "aceita" ou "recusada".');

  const conexao = await prisma.conexao.findUnique({ where: { id_conexao } });
  if (!conexao) throw new HttpError(404, 'Conexão não encontrada.');
  if (conexao.id_destinatario !== req.usuario.id_usuario) throw new HttpError(403, 'Só o destinatário pode responder a solicitação.');
  if (conexao.status !== 'pendente') throw new HttpError(409, `Esta solicitação já foi ${conexao.status}.`);

  const atualizada = await prisma.conexao.update({
    where: { id_conexao },
    data: { status, data_resposta: new Date() },
    include: { solicitante: pessoa, destinatario: pessoa },
  });
  return res.json(atualizada);
};

// RF10 CA02 — histórico (REST).
export const historicoMensagens = async (req, res) => {
  res.json(await listarMensagens(req.usuario.id_usuario, req.params.id));
};

// RF10 — envio via REST (mesma regra do WebSocket; útil quando o socket cai e para testes).
export const postarMensagem = async (req, res) => {
  const mensagem = await enviarMensagem(req.usuario.id_usuario, req.params.id, req.body?.conteudo);
  notificarMensagem(mensagem);
  res.status(201).json(mensagem);
};
