import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, prisma, request, limparBanco, criarUsuario, criarConcurso } from './helpers.js';

let ana; let bruno; let carla; let diego; let eva;
before(async () => {
  await limparBanco();
  [ana, bruno, carla, diego, eva] = await Promise.all(['Ana', 'Bruno', 'Carla', 'Diego', 'Eva'].map((n) => criarUsuario(n)));
  const analista = await criarConcurso(ana.auth, { cargo: 'Analista Judiciário - TRT' });
  const tecnico = await criarConcurso(ana.auth, { cargo: 'Técnico Judiciário - TRT', data: '2026-12-13' });
  const ida = (c, d) => ({ id_concurso: c.id_concurso, cidade_origem: 'Joinville', data_ida: d });
  await request(app).post('/api/viagens').set(bruno.auth).send(ida(analista, '2026-12-05')).expect(201);
  await request(app).post('/api/viagens').set(carla.auth).send(ida(tecnico, '2026-12-12')).expect(201);
  await request(app).post('/api/viagens').set(diego.auth).send(ida(analista, '2026-12-05')).expect(201);
  await request(app).put('/api/me/privacidade').set(diego.auth).send({ perfil_publico: false }).expect(200);
  await request(app).put('/api/me/privacidade').set(eva.auth).send({ receber_solicitacoes: false }).expect(200);
});
after(() => prisma.$disconnect());

test('T19 [US07/US09 CA01/CA03 RF07] lista só perfis públicos e nunca o próprio usuário', async () => {
  const r = await request(app).get('/api/concurseiros').set(ana.auth);
  assert.equal(r.status, 200);
  const nomes = r.body.map((x) => x.nome);
  assert.ok(nomes.includes('Bruno') && nomes.includes('Carla'));
  assert.ok(!nomes.includes('Diego'), 'perfil privado não aparece');
  assert.ok(!nomes.includes('Ana'), 'próprio usuário não aparece');
  assert.equal((await request(app).get('/api/concurseiros')).status, 401);
});

test('T20 [US07/US09 CA02 RF08] filtro por cargo sem diferenciar maiúsculas/minúsculas', async () => {
  const r = await request(app).get('/api/concurseiros?cargo=analista').set(ana.auth);
  assert.deepEqual(r.body.map((x) => x.nome), ['Bruno']);
  const t = await request(app).get('/api/concurseiros?cargo=TÉCNICO').set(ana.auth);
  assert.deepEqual(t.body.map((x) => x.nome), ['Carla']);
});

test('T21 [US10 CA01 RF09] enviar solicitação cria conexão pendente', async () => {
  const r = await request(app).post('/api/conexoes').set(ana.auth).send({ id_destinatario: bruno.id_usuario });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'pendente');
  const lista = await request(app).get('/api/concurseiros').set(ana.auth);
  assert.equal(lista.body.find((x) => x.nome === 'Bruno').situacao, 'pendente_enviada');
});

test('T22 [US10 CA03] solicitação duplicada (409), para si mesmo (400) e para quem não recebe (403)', async () => {
  const dup = await request(app).post('/api/conexoes').set(ana.auth).send({ id_destinatario: bruno.id_usuario });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, 'SOLICITACAO_DUPLICADA');
  const inversa = await request(app).post('/api/conexoes').set(bruno.auth).send({ id_destinatario: ana.id_usuario });
  assert.equal(inversa.status, 409);
  assert.equal((await request(app).post('/api/conexoes').set(ana.auth).send({ id_destinatario: ana.id_usuario })).status, 400);
  assert.equal((await request(app).post('/api/conexoes').set(ana.auth).send({ id_destinatario: eva.id_usuario })).status, 403);
  assert.equal((await request(app).post('/api/conexoes').set(ana.auth).send({ id_destinatario: 99999 })).status, 404);
  assert.equal(await prisma.conexao.count(), 1, 'nada além da primeira solicitação foi gravado');
});

test('T23 [US10 CA02] só o destinatário responde; após aceitar, os dois veem a conexão aceita', async () => {
  const pendente = (await request(app).get('/api/conexoes').set(bruno.auth)).body.recebidas[0];
  assert.equal(pendente.outro.nome, 'Ana');
  assert.equal((await request(app).patch(`/api/conexoes/${pendente.id_conexao}`).set(ana.auth).send({ status: 'aceita' })).status, 403);
  assert.equal((await request(app).patch(`/api/conexoes/${pendente.id_conexao}`).set(bruno.auth).send({ status: 'talvez' })).status, 400);
  const ok = await request(app).patch(`/api/conexoes/${pendente.id_conexao}`).set(bruno.auth).send({ status: 'aceita' });
  assert.equal(ok.status, 200);
  assert.equal((await request(app).get('/api/conexoes').set(ana.auth)).body.aceitas[0].outro.nome, 'Bruno');
  assert.equal((await request(app).get('/api/conexoes').set(bruno.auth)).body.aceitas[0].outro.nome, 'Ana');
  assert.equal((await request(app).patch(`/api/conexoes/${pendente.id_conexao}`).set(bruno.auth).send({ status: 'recusada' })).status, 409);
});

test('T24 [US10 CA02] recusa fica visível para quem enviou e permite nova tentativa', async () => {
  const s = await request(app).post('/api/conexoes').set(carla.auth).send({ id_destinatario: ana.id_usuario });
  await request(app).patch(`/api/conexoes/${s.body.id_conexao}`).set(ana.auth).send({ status: 'recusada' }).expect(200);
  const enviadas = (await request(app).get('/api/conexoes').set(carla.auth)).body.enviadas;
  assert.equal(enviadas[0].status, 'recusada');
  const nova = await request(app).post('/api/conexoes').set(carla.auth).send({ id_destinatario: ana.id_usuario });
  assert.equal(nova.status, 201);
  assert.equal(nova.body.status, 'pendente');
});
