// Ambiente de teste: usa um banco separado (TEST_DATABASE_URL ou <banco>_test)
// para nunca apagar os dados de demonstração.
import 'dotenv/config';
import { execSync } from 'node:child_process';

const urlTeste = () => {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
  return url.toString();
};

process.env.DATABASE_URL = urlTeste();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';

let preparado = false;
export const prepararBanco = () => {
  if (preparado) return;
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'ignore' });
  preparado = true;
};

prepararBanco();

const { default: app } = await import('../src/app.js');
const { default: prisma } = await import('../src/config/prisma.js');
const { default: request } = await import('supertest');

export { app, prisma, request };

export const limparBanco = async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE mensagens, conexoes, viagens, candidatos_concurso, preferencias_privacidade, usuarios, concurso RESTART IDENTITY CASCADE',
  );
};

let contador = 0;
// Gera um CPF válido diferente a cada chamada.
export const novoCpf = () => {
  contador += 1;
  const base = String(100000000 + contador * 7919 + Math.floor(Math.random() * 1000)).slice(0, 9).split('').map(Number);
  const dv = (nums) => {
    const soma = nums.reduce((acc, n, i) => acc + n * (nums.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join('');
};

export const SENHA = 'Senha@123';

export const criarUsuario = async (nome = 'Usuário Teste') => {
  const email = `u${Date.now()}${Math.floor(Math.random() * 1e6)}@teste.com`;
  const cpf = novoCpf();
  const cad = await request(app).post('/api/auth/cadastro').send({ nome, email, cpf, senha: SENHA, confirmarSenha: SENHA });
  if (cad.status !== 201) throw new Error(`cadastro falhou: ${cad.status} ${JSON.stringify(cad.body)}`);
  const log = await request(app).post('/api/auth/login').send({ email, senha: SENHA });
  return { ...cad.body, email, cpf, token: log.body.token, auth: { Authorization: `Bearer ${log.body.token}` } };
};

export const criarConcurso = async (auth, { cargo = 'Analista Judiciário', data = '2026-12-06' } = {}) => {
  const banca = await prisma.banca.upsert({ where: { nome: 'FCC' }, update: {}, create: { nome: 'FCC' } });
  const r = await request(app).post('/api/concursos').set(auth)
    .send({ cargo, id_banca: banca.id_banca, local: 'Curitiba/PR', data, url_edital: 'https://exemplo.com/edital' });
  if (r.status !== 201) throw new Error(`concurso falhou: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
