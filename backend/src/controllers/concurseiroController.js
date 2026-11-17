import prisma from '../config/prisma.js';
import { HttpError, parseId } from '../utils/http.js';

// Situação da conexão entre o usuário logado e cada concurseiro listado.
const situacaoConexao = (conexoes, meuId, outroId) => {
  const c = conexoes.find(
    (x) => (x.id_solicitante === meuId && x.id_destinatario === outroId) || (x.id_solicitante === outroId && x.id_destinatario === meuId),
  );
  if (!c) return { situacao: 'nenhuma', id_conexao: null };
  if (c.status === 'pendente') return { situacao: c.id_solicitante === meuId ? 'pendente_enviada' : 'pendente_recebida', id_conexao: c.id_conexao };
  return { situacao: c.status, id_conexao: c.id_conexao };
};

// US07 / US09 / RF07 / RF08 — listar concurseiros com perfil público, com filtro por cargo e concurso.
export const listarConcurseiros = async (req, res) => {
  const meuId = req.usuario.id_usuario;
  const cargo = String(req.query.cargo ?? '').trim();
  const idConcurso = req.query.id_concurso ? parseId(req.query.id_concurso, 'Concurso') : null;
  if (cargo.length > 150) throw new HttpError(400, 'Filtro de cargo muito longo.');

  const filtroConcurso = {};
  if (cargo) filtroConcurso.cargo = { contains: cargo, mode: 'insensitive' };
  if (idConcurso) filtroConcurso.id_concurso = idConcurso;

  const usuarios = await prisma.usuario.findMany({
    where: {
      id_usuario: { not: meuId },
      // Sem linha de preferência conta como público (padrão do cadastro).
      OR: [{ preferencia: { is: { perfil_publico: true } } }, { preferencia: { is: null } }],
      ...(cargo || idConcurso ? { candidatosConcurso: { some: { concurso: filtroConcurso } } } : {}),
    },
    select: {
      id_usuario: true, nome: true, cidade: true, estado: true, bio: true, foto_url: true,
      preferencia: { select: { receber_solicitacoes: true } },
      candidatosConcurso: { select: { concurso: { select: { id_concurso: true, cargo: true, local: true, data: true } } } },
    },
    orderBy: { nome: 'asc' },
  });

  const ids = usuarios.map((u) => u.id_usuario);
  const conexoes = await prisma.conexao.findMany({
    where: {
      OR: [
        { id_solicitante: meuId, id_destinatario: { in: ids } },
        { id_destinatario: meuId, id_solicitante: { in: ids } },
      ],
    },
  });

  return res.json(
    usuarios.map(({ candidatosConcurso, preferencia, ...u }) => ({
      ...u,
      aceita_solicitacoes: preferencia?.receber_solicitacoes ?? true,
      concursos: candidatosConcurso.map((c) => c.concurso),
      ...situacaoConexao(conexoes, meuId, u.id_usuario),
    })),
  );
};
