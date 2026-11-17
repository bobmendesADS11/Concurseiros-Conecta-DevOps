import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, prisma, request, limparBanco, criarUsuario } from './helpers.js';

let u;
before(async () => { await limparBanco(); u = await criarUsuario('Pedro Perfil'); });
after(() => prisma.$disconnect());

test('T09 [US02/US04 RF03] editar nome, cidade, estado, bio e foto do próprio perfil', async () => {
  const r = await request(app).put('/api/me').set(u.auth)
    .send({ nome: 'Pedro Atualizado', cidade: 'Florianópolis', estado: 'sc', bio: 'Foco em tribunais', foto_url: 'https://exemplo.com/foto.png' });
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'SC');
  const me = await request(app).get('/api/me').set(u.auth);
  assert.equal(me.body.nome, 'Pedro Atualizado');
  assert.equal(me.body.bio, 'Foco em tribunais');
});

test('T10 [US02 RF03] perfil inválido (UF errada, foto sem http, bio longa) retorna 400 e não altera', async () => {
  for (const ruim of [{ estado: 'Santa' }, { foto_url: 'foto.png' }, { bio: 'x'.repeat(501) }, {}]) {
    assert.equal((await request(app).put('/api/me').set(u.auth).send(ruim)).status, 400, JSON.stringify(ruim));
  }
  assert.equal((await request(app).get('/api/me').set(u.auth)).body.nome, 'Pedro Atualizado');
});

test('T11 [US03/US08 RF04] preferências de privacidade são lidas e salvas', async () => {
  const antes = await request(app).get('/api/me/privacidade').set(u.auth);
  assert.equal(antes.body.perfil_publico, true);
  const r = await request(app).put('/api/me/privacidade').set(u.auth).send({ perfil_publico: false, permitir_mensagens: false });
  assert.equal(r.status, 200);
  assert.equal(r.body.perfil_publico, false);
  assert.equal(r.body.receber_solicitacoes, true);
  assert.equal((await request(app).put('/api/me/privacidade').set(u.auth).send({ perfil_publico: 'sim' })).status, 400);
});

test('T12 [Regressão N1] CRUD de concursos continua funcionando (com login para gravar)', async () => {
  const banca = await prisma.banca.upsert({ where: { nome: 'FGV' }, update: {}, create: { nome: 'FGV' } });
  const corpo = { cargo: 'Auditor Fiscal', id_banca: banca.id_banca, local: 'Florianópolis/SC', data: '2027-03-10', url_edital: 'https://exemplo.com/e' };
  assert.equal((await request(app).post('/api/concursos').send(corpo)).status, 401, 'sem login não grava');
  const criado = await request(app).post('/api/concursos').set(u.auth).send(corpo);
  assert.equal(criado.status, 201);
  const id = criado.body.id_concurso;
  assert.equal((await request(app).get(`/api/concursos/${id}`)).body.cargo, 'Auditor Fiscal');
  assert.equal((await request(app).put(`/api/concursos/${id}`).set(u.auth).send({ local: 'Joinville/SC' })).body.local, 'Joinville/SC');
  assert.ok((await request(app).get('/api/concursos')).body.some((c) => c.id_concurso === id));
  assert.equal((await request(app).delete(`/api/concursos/${id}`).set(u.auth)).status, 200);
  assert.equal((await request(app).get(`/api/concursos/${id}`)).status, 404);
  assert.equal((await request(app).post('/api/concursos').set(u.auth).send({ ...corpo, id_banca: 9999 })).status, 400);
});
