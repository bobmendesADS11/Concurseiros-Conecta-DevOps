import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, prisma, request, limparBanco, novoCpf, SENHA } from './helpers.js';

before(limparBanco);
after(() => prisma.$disconnect());

const dados = () => ({ nome: 'Maria Teste', email: `maria${Date.now()}@teste.com`, cpf: novoCpf(), senha: SENHA, confirmarSenha: SENHA });

test('T01 [US01 CA01] cadastro válido cria usuário, senha em hash e privacidade padrão', async () => {
  const d = dados();
  const r = await request(app).post('/api/auth/cadastro').send(d);
  assert.equal(r.status, 201);
  assert.equal(r.body.email, d.email);
  assert.equal(r.body.senha, undefined, 'senha não pode voltar na resposta');
  const salvo = await prisma.usuario.findUnique({ where: { email: d.email }, include: { preferencia: true } });
  assert.match(salvo.senha, /^\$2[aby]\$/, 'senha deve estar em hash bcrypt');
  assert.equal(salvo.preferencia.perfil_publico, true);
});

test('T02 [US01 CA03] CPF já cadastrado é bloqueado com 409 e não grava', async () => {
  const d = dados();
  await request(app).post('/api/auth/cadastro').send(d).expect(201);
  const antes = await prisma.usuario.count();
  const r = await request(app).post('/api/auth/cadastro').send({ ...d, email: `outro${Date.now()}@teste.com` });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'CPF já cadastrado.');
  assert.equal(await prisma.usuario.count(), antes);
});

test('T03 [US01 CA03] e-mail já cadastrado é bloqueado com 409', async () => {
  const d = dados();
  await request(app).post('/api/auth/cadastro').send(d).expect(201);
  const r = await request(app).post('/api/auth/cadastro').send({ ...d, cpf: novoCpf() });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'E-mail já cadastrado.');
});

test('T04 [US01 CA01] dados inválidos (CPF, e-mail, senha curta, confirmação) retornam 400', async () => {
  for (const ruim of [
    { cpf: '12345678900' },
    { email: 'sem-arroba' },
    { senha: '123', confirmarSenha: '123' },
    { confirmarSenha: 'diferente1' },
  ]) {
    const r = await request(app).post('/api/auth/cadastro').send({ ...dados(), ...ruim });
    assert.equal(r.status, 400, JSON.stringify(ruim));
  }
});

test('T05 [US01 CA02] login correto devolve token JWT; senha errada devolve 401', async () => {
  const d = dados();
  await request(app).post('/api/auth/cadastro').send(d).expect(201);
  const ok = await request(app).post('/api/auth/login').send({ email: d.email, senha: SENHA });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.token.split('.').length, 3);
  const errado = await request(app).post('/api/auth/login').send({ email: d.email, senha: 'SenhaErrada9' });
  assert.equal(errado.status, 401);
  assert.equal(errado.body.error, 'E-mail ou senha incorretos.');
});

test('T06 [US01] rota protegida sem token ou com token falso retorna 401', async () => {
  assert.equal((await request(app).get('/api/me')).status, 401);
  assert.equal((await request(app).get('/api/me').set('Authorization', 'Bearer abc.def.ghi')).status, 401);
});

test('T07 [US01 RF02] recuperação de senha confere e-mail + CPF e troca a senha', async () => {
  const d = dados();
  await request(app).post('/api/auth/cadastro').send(d).expect(201);
  const errado = await request(app).post('/api/auth/recuperar-senha').send({ email: d.email, cpf: novoCpf(), novaSenha: 'NovaSenha1' });
  assert.equal(errado.status, 404);
  await request(app).post('/api/auth/recuperar-senha').send({ email: d.email, cpf: d.cpf, novaSenha: 'NovaSenha1' }).expect(200);
  assert.equal((await request(app).post('/api/auth/login').send({ email: d.email, senha: SENHA })).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ email: d.email, senha: 'NovaSenha1' })).status, 200);
});

test('T08 [US01] usuário antigo com senha em texto puro entra e a senha vira hash', async () => {
  const cpf = novoCpf();
  await prisma.usuario.create({ data: { nome: 'Legado', email: 'legado@teste.com', cpf, senha: 'antiga123' } });
  const r = await request(app).post('/api/auth/login').send({ email: 'legado@teste.com', senha: 'antiga123' });
  assert.equal(r.status, 200);
  const salvo = await prisma.usuario.findUnique({ where: { email: 'legado@teste.com' } });
  assert.match(salvo.senha, /^\$2[aby]\$/);
});
