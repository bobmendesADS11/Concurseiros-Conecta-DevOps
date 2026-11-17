// Dados de demonstração da N2 (fictícios). Rode com: npm run db:seed
// Pode rodar mais de uma vez: registros já existentes são reaproveitados.
import 'dotenv/config';
import prisma from '../src/config/prisma.js';
import { gerarHash } from '../src/services/senha.js';

export const SENHA_DEMO = 'Demo@1234';

const usuariosDemo = [
  { nome: 'Ana Souza', email: 'demo1@exemplo.com', cpf: '52998224725', cidade: 'Florianópolis', estado: 'SC', bio: 'Estudo para tribunais. Procuro carona e dividir hospedagem em Curitiba.', publico: true },
  { nome: 'Bruno Lima', email: 'demo2@exemplo.com', cpf: '15350946056', cidade: 'Joinville', estado: 'SC', bio: 'Analista Judiciário é o foco. Topo dividir Airbnb.', publico: true },
  { nome: 'Carla Mendes', email: 'demo3@exemplo.com', cpf: '11144477735', cidade: 'Blumenau', estado: 'SC', bio: 'Técnica Judiciária em preparação.', publico: true },
  { nome: 'Diego Prado', email: 'demo4@exemplo.com', cpf: '39053344705', cidade: 'Itajaí', estado: 'SC', bio: 'Perfil privado para teste de privacidade.', publico: false },
];

const concursosDemo = [
  { cargo: 'Analista Judiciário - TRT-PR', banca: 'FCC', local: 'Curitiba/PR', data: '2026-12-06', url_edital: 'https://www.exemplo.com/edital-trt-pr' },
  { cargo: 'Técnico Judiciário - TRT-PR', banca: 'FCC', local: 'Curitiba/PR', data: '2026-12-06', url_edital: 'https://www.exemplo.com/edital-trt-pr' },
  { cargo: 'Agente de Polícia Federal', banca: 'Cebrasp', local: 'Porto Alegre/RS', data: '2027-01-24', url_edital: 'https://www.exemplo.com/edital-pf' },
];

async function main() {
  const hash = await gerarHash(SENHA_DEMO);

  const bancas = {};
  for (const nome of ['FGV', 'Cebrasp', 'FCC']) {
    bancas[nome] = await prisma.banca.upsert({ where: { nome }, update: {}, create: { nome } });
  }

  const concursos = [];
  for (const c of concursosDemo) {
    let concurso = await prisma.concurso.findFirst({ where: { cargo: c.cargo } });
    if (!concurso) {
      concurso = await prisma.concurso.create({
        data: { cargo: c.cargo, local: c.local, data: new Date(c.data), url_edital: c.url_edital, id_banca: bancas[c.banca].id_banca },
      });
    }
    concursos.push(concurso);
  }

  const usuarios = [];
  for (const u of usuariosDemo) {
    const usuario = await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nome: u.nome, email: u.email, cpf: u.cpf, senha: hash, cidade: u.cidade, estado: u.estado, bio: u.bio,
        preferencia: { create: { perfil_publico: u.publico } },
      },
    });
    usuarios.push(usuario);
  }
  const [ana, bruno, carla, diego] = usuarios;
  const [analista, tecnico, pf] = concursos;

  const viagens = [
    { u: ana, c: analista, origem: 'Florianópolis', ida: '2026-12-05', volta: '2026-12-06', transporte: 'onibus' },
    { u: bruno, c: analista, origem: 'Joinville', ida: '2026-12-05', volta: '2026-12-06', transporte: 'carro' },
    { u: carla, c: tecnico, origem: 'Blumenau', ida: '2026-12-05', volta: '2026-12-06', transporte: 'carona' },
    { u: diego, c: pf, origem: 'Itajaí', ida: '2027-01-23', volta: '2027-01-24', transporte: 'aviao' },
  ];
  for (const v of viagens) {
    const existe = await prisma.viagem.findFirst({ where: { id_usuario: v.u.id_usuario, id_concurso: v.c.id_concurso } });
    if (!existe) {
      await prisma.viagem.create({
        data: { id_usuario: v.u.id_usuario, id_concurso: v.c.id_concurso, cidade_origem: v.origem, data_ida: new Date(v.ida), data_volta: new Date(v.volta), transporte: v.transporte },
      });
    }
    await prisma.candidatosConcurso.upsert({
      where: { id_usuario_id_concurso: { id_usuario: v.u.id_usuario, id_concurso: v.c.id_concurso } },
      update: {},
      create: { id_usuario: v.u.id_usuario, id_concurso: v.c.id_concurso },
    });
  }

  // Ana e Bruno conectados, com conversa; Carla mandou solicitação para Ana (pendente).
  const aceita = await prisma.conexao.upsert({
    where: { id_solicitante_id_destinatario: { id_solicitante: ana.id_usuario, id_destinatario: bruno.id_usuario } },
    update: {},
    create: { id_solicitante: ana.id_usuario, id_destinatario: bruno.id_usuario, status: 'aceita', data_resposta: new Date() },
  });
  await prisma.conexao.upsert({
    where: { id_solicitante_id_destinatario: { id_solicitante: carla.id_usuario, id_destinatario: ana.id_usuario } },
    update: {},
    create: { id_solicitante: carla.id_usuario, id_destinatario: ana.id_usuario, status: 'pendente' },
  });
  if (!(await prisma.mensagem.count({ where: { id_conexao: aceita.id_conexao } }))) {
    await prisma.mensagem.create({ data: { id_conexao: aceita.id_conexao, id_remetente: ana.id_usuario, conteudo: 'Oi Bruno! Vai de carro para Curitiba?' } });
    await prisma.mensagem.create({ data: { id_conexao: aceita.id_conexao, id_remetente: bruno.id_usuario, conteudo: 'Vou sim, saio de Joinville no sábado de manhã. Tem vaga!' } });
  }

  console.log(`Seed concluído: ${usuarios.length} usuários (senha ${SENHA_DEMO}), ${concursos.length} concursos, viagens, conexões e mensagens.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
