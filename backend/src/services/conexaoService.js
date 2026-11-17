import prisma from '../config/prisma.js';
import { HttpError, parseId } from '../utils/http.js';

export const TAMANHO_MAX_MENSAGEM = 1000;

// Carrega a conexão e confere se o usuário participa dela e se ela está aceita.
export const conexaoAceitaDoUsuario = async (id_usuario, idConexaoBruto) => {
  const id_conexao = parseId(idConexaoBruto, 'ID da conexão');
  const conexao = await prisma.conexao.findUnique({
    where: { id_conexao },
    include: {
      solicitante: { select: { id_usuario: true, nome: true, preferencia: true } },
      destinatario: { select: { id_usuario: true, nome: true, preferencia: true } },
    },
  });
  if (!conexao) throw new HttpError(404, 'Conexão não encontrada.');
  const participa = conexao.id_solicitante === id_usuario || conexao.id_destinatario === id_usuario;
  if (!participa || conexao.status !== 'aceita') {
    throw new HttpError(403, 'Você só pode conversar com conexões aceitas.');
  }
  return conexao;
};

// RF10 — histórico do chat, em ordem de envio.
export const listarMensagens = async (id_usuario, idConexao) => {
  const conexao = await conexaoAceitaDoUsuario(id_usuario, idConexao);
  return prisma.mensagem.findMany({
    where: { id_conexao: conexao.id_conexao },
    orderBy: [{ data_envio: 'asc' }, { id_mensagem: 'asc' }],
    select: { id_mensagem: true, id_conexao: true, id_remetente: true, conteudo: true, data_envio: true },
  });
};

// RF10 — valida e grava a mensagem ANTES de ela ser emitida no WebSocket.
export const enviarMensagem = async (id_usuario, idConexao, conteudoBruto) => {
  const conteudo = String(conteudoBruto ?? '').trim();
  if (!conteudo) throw new HttpError(400, 'A mensagem não pode ser vazia.');
  if (conteudo.length > TAMANHO_MAX_MENSAGEM) throw new HttpError(400, `A mensagem pode ter no máximo ${TAMANHO_MAX_MENSAGEM} caracteres.`);

  const conexao = await conexaoAceitaDoUsuario(id_usuario, idConexao);
  const outro = conexao.id_solicitante === id_usuario ? conexao.destinatario : conexao.solicitante;
  if (outro.preferencia && outro.preferencia.permitir_mensagens === false) {
    throw new HttpError(403, `${outro.nome} desativou o recebimento de mensagens.`);
  }

  return prisma.mensagem.create({
    data: { id_conexao: conexao.id_conexao, id_remetente: id_usuario, conteudo },
    select: { id_mensagem: true, id_conexao: true, id_remetente: true, conteudo: true, data_envio: true },
  });
};
