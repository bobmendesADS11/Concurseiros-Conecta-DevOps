import prisma from '../config/prisma.js';
import { HttpError, parseId, parseDate } from '../utils/http.js';

const STATUS = ['planejada', 'confirmada', 'cancelada'];
const TRANSPORTES = ['onibus', 'carro', 'aviao', 'carona', 'outro'];

const incluirConcurso = {
  concurso: { select: { id_concurso: true, cargo: true, local: true, data: true, bancaRef: { select: { nome: true } } } },
};

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// Lê e valida os campos da viagem. Em edição (parcial=true) só valida o que veio.
const lerDados = async (body, atual = null) => {
  const parcial = Boolean(atual);
  const dados = {};

  if (!parcial || body.id_concurso !== undefined) {
    const id_concurso = parseId(body.id_concurso, 'Concurso');
    const existe = await prisma.concurso.findUnique({ where: { id_concurso } });
    if (!existe) throw new HttpError(400, 'Concurso informado não existe.');
    dados.id_concurso = id_concurso;
  }
  if (!parcial || body.cidade_origem !== undefined) {
    const cidade = String(body.cidade_origem ?? '').trim();
    if (cidade.length < 2) throw new HttpError(400, 'Informe a cidade de origem.');
    dados.cidade_origem = cidade;
  }
  if (!parcial || body.data_ida !== undefined) {
    const ida = parseDate(body.data_ida, 'Data de ida');
    if (!ida) throw new HttpError(400, 'Informe a data de ida.');
    dados.data_ida = ida;
  }
  if (body.data_volta !== undefined) dados.data_volta = parseDate(body.data_volta, 'Data de volta') ?? null;
  if (body.transporte !== undefined) {
    const t = String(body.transporte || '').trim().toLowerCase();
    if (t && !TRANSPORTES.includes(t)) throw new HttpError(400, `Transporte deve ser: ${TRANSPORTES.join(', ')}.`);
    dados.transporte = t || null;
  }
  if (body.hospedagem !== undefined) dados.hospedagem = String(body.hospedagem || '').trim() || null;
  if (body.observacoes !== undefined) {
    if (String(body.observacoes || '').length > 500) throw new HttpError(400, 'Observações: máximo de 500 caracteres.');
    dados.observacoes = String(body.observacoes || '').trim() || null;
  }
  if (body.status !== undefined) {
    if (!STATUS.includes(body.status)) throw new HttpError(400, `Status deve ser: ${STATUS.join(', ')}.`);
    dados.status = body.status;
  }

  const ida = dados.data_ida ?? atual?.data_ida;
  const volta = dados.data_volta !== undefined ? dados.data_volta : atual?.data_volta;
  if (volta && ida && volta < ida) throw new HttpError(400, 'A data de volta não pode ser antes da data de ida.');

  const idConcurso = dados.id_concurso ?? atual?.id_concurso;
  const concurso = await prisma.concurso.findUnique({ where: { id_concurso: idConcurso } });
  if (concurso?.data && ida && ida > concurso.data) {
    throw new HttpError(400, 'A data de ida deve ser no dia da prova ou antes dele.');
  }

  return { dados, concurso, ida, volta };
};

// RF05 / US05 CA02 — procura viagens ativas do mesmo usuário que caem no mesmo
// período ou têm prova no mesmo dia.
const buscarConflitos = async (id_usuario, concurso, ida, volta, ignorarId = null) => {
  const outras = await prisma.viagem.findMany({
    where: { id_usuario, status: { not: 'cancelada' }, ...(ignorarId ? { id_viagem: { not: ignorarId } } : {}) },
    include: incluirConcurso,
  });
  const inicio = ida;
  const fim = volta ?? concurso?.data ?? ida;
  return outras.filter((v) => {
    const vInicio = v.data_ida;
    const vFim = v.data_volta ?? v.concurso.data ?? v.data_ida;
    const mesmaProva = concurso?.data && v.concurso.data && dia(concurso.data) === dia(v.concurso.data);
    const periodoSobreposto = inicio <= vFim && vInicio <= fim;
    return mesmaProva || periodoSobreposto;
  });
};

const descreverConflitos = (lista) =>
  lista.map((v) => ({ id_viagem: v.id_viagem, concurso: v.concurso.cargo, data_prova: dia(v.concurso.data), data_ida: dia(v.data_ida) }));

// US05 / RF05 — cadastrar viagem vinculada a um concurso e ao usuário logado.
export const criarViagem = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  const { dados, concurso, ida, volta } = await lerDados(req.body ?? {});

  const conflitos = await buscarConflitos(id_usuario, concurso, ida, volta);
  if (conflitos.length && req.body?.confirmar_conflito !== true) {
    throw new HttpError(409, 'Conflito de datas com outra viagem planejada. Confirme para salvar mesmo assim.', {
      code: 'CONFLITO_DATAS',
      detalhes: descreverConflitos(conflitos),
    });
  }

  const viagem = await prisma.$transaction(async (tx) => {
    const criada = await tx.viagem.create({
      data: { ...dados, id_usuario, conflito_datas: conflitos.length > 0 },
      include: incluirConcurso,
    });
    // Ao planejar a viagem, o usuário passa a constar como candidato do concurso.
    await tx.candidatosConcurso.upsert({
      where: { id_usuario_id_concurso: { id_usuario, id_concurso: dados.id_concurso } },
      update: {},
      create: { id_usuario, id_concurso: dados.id_concurso },
    });
    return criada;
  });

  return res.status(201).json(viagem);
};

// US06 / RF06 — listar as viagens do usuário (ordem por data de ida).
export const listarViagens = async (req, res) => {
  const viagens = await prisma.viagem.findMany({
    where: { id_usuario: req.usuario.id_usuario },
    include: incluirConcurso,
    orderBy: [{ data_ida: 'asc' }, { id_viagem: 'asc' }],
  });
  return res.json(viagens);
};

const buscarDoUsuario = async (req) => {
  const id_viagem = parseId(req.params.id, 'ID da viagem');
  const viagem = await prisma.viagem.findFirst({
    where: { id_viagem, id_usuario: req.usuario.id_usuario },
    include: incluirConcurso,
  });
  if (!viagem) throw new HttpError(404, 'Viagem não encontrada.');
  return viagem;
};

export const obterViagem = async (req, res) => res.json(await buscarDoUsuario(req));

// US06 / RF06 — editar viagem (inclui mudar status para confirmada/cancelada).
export const atualizarViagem = async (req, res) => {
  const atual = await buscarDoUsuario(req);
  const { dados, concurso, ida, volta } = await lerDados(req.body ?? {}, atual);
  if (!Object.keys(dados).length) throw new HttpError(400, 'Nenhum campo foi informado para atualização.');

  const statusFinal = dados.status ?? atual.status;
  let conflitos = [];
  if (statusFinal !== 'cancelada') {
    conflitos = await buscarConflitos(atual.id_usuario, concurso, ida, volta, atual.id_viagem);
    if (conflitos.length && req.body?.confirmar_conflito !== true && !atual.conflito_datas) {
      throw new HttpError(409, 'Conflito de datas com outra viagem planejada. Confirme para salvar mesmo assim.', {
        code: 'CONFLITO_DATAS',
        detalhes: descreverConflitos(conflitos),
      });
    }
  }

  const viagem = await prisma.viagem.update({
    where: { id_viagem: atual.id_viagem },
    data: { ...dados, conflito_datas: conflitos.length > 0 },
    include: incluirConcurso,
  });
  return res.json(viagem);
};

export const excluirViagem = async (req, res) => {
  const atual = await buscarDoUsuario(req);
  await prisma.viagem.delete({ where: { id_viagem: atual.id_viagem } });
  return res.json({ message: 'Viagem removida com sucesso.' });
};
