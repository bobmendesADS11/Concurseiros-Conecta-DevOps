import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, prisma, request, limparBanco, criarUsuario, criarConcurso } from './helpers.js';

let u; let outro; let analista; let tecnico; let pf;
before(async () => {
  await limparBanco();
  u = await criarUsuario('Vera Viagem');
  outro = await criarUsuario('Outro Usuário');
  analista = await criarConcurso(u.auth, { cargo: 'Analista Judiciário - TRT', data: '2026-12-06' });
  tecnico = await criarConcurso(u.auth, { cargo: 'Técnico Judiciário - TRT', data: '2026-12-06' });
  pf = await criarConcurso(u.auth, { cargo: 'Agente PF', data: '2027-01-24' });
});
after(() => prisma.$disconnect());

const viagem = (concurso, extra = {}) => ({ id_concurso: concurso.id_concurso, cidade_origem: 'Florianópolis', data_ida: '2026-12-05', data_volta: '2026-12-06', transporte: 'onibus', ...extra });

test('T13 [US05 CA01/CA03 RF05] cadastrar viagem vinculada ao concurso e ao usuário logado', async () => {
  const r = await request(app).post('/api/viagens').set(u.auth).send(viagem(analista));
  assert.equal(r.status, 201);
  assert.equal(r.body.id_usuario, u.id_usuario);
  assert.equal(r.body.status, 'planejada');
  assert.equal(r.body.concurso.cargo, 'Analista Judiciário - TRT');
  const inscrito = await prisma.candidatosConcurso.findUnique({ where: { id_usuario_id_concurso: { id_usuario: u.id_usuario, id_concurso: analista.id_concurso } } });
  assert.ok(inscrito, 'usuário passa a constar como candidato do concurso');
});

test('T14 [US05 CA02] viagem com prova no mesmo dia gera alerta 409 CONFLITO_DATAS e não grava', async () => {
  const antes = await prisma.viagem.count();
  const r = await request(app).post('/api/viagens').set(u.auth).send(viagem(tecnico));
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'CONFLITO_DATAS');
  assert.equal(r.body.detalhes[0].concurso, 'Analista Judiciário - TRT');
  assert.equal(await prisma.viagem.count(), antes);
});

test('T15 [US05 CA02] confirmando o conflito, a viagem é salva marcada com aviso', async () => {
  const r = await request(app).post('/api/viagens').set(u.auth).send(viagem(tecnico, { confirmar_conflito: true }));
  assert.equal(r.status, 201);
  assert.equal(r.body.conflito_datas, true);
});

test('T16 [US06 RF06] listar, editar status e excluir as próprias viagens', async () => {
  const nova = await request(app).post('/api/viagens').set(u.auth).send(viagem(pf, { data_ida: '2027-01-23', data_volta: '2027-01-24', transporte: 'aviao' }));
  assert.equal(nova.status, 201);
  const lista = await request(app).get('/api/viagens').set(u.auth);
  assert.equal(lista.body.length, 3);
  const editada = await request(app).put(`/api/viagens/${nova.body.id_viagem}`).set(u.auth).send({ status: 'confirmada', hospedagem: 'Hotel Centro' });
  assert.equal(editada.status, 200);
  assert.equal(editada.body.status, 'confirmada');
  assert.equal((await request(app).delete(`/api/viagens/${nova.body.id_viagem}`).set(u.auth)).status, 200);
  assert.equal((await request(app).get('/api/viagens').set(u.auth)).body.length, 2);
});

test('T17 [US05] dados inválidos da viagem retornam 400', async () => {
  for (const ruim of [
    { data_volta: '2026-12-01' },          // volta antes da ida
    { data_ida: '2027-01-25', data_volta: '2027-01-26' }, // ida depois da prova (24/01)
    { cidade_origem: '' },
    { transporte: 'foguete' },
    { id_concurso: 99999 },
  ]) {
    const r = await request(app).post('/api/viagens').set(u.auth).send(viagem(pf, { data_ida: '2027-01-23', data_volta: '2027-01-24', ...ruim }));
    assert.equal(r.status, 400, JSON.stringify(ruim));
  }
});

test('T18 [US06] um usuário não vê nem altera viagem de outro (404) e sem login é 401', async () => {
  const minha = (await request(app).get('/api/viagens').set(u.auth)).body[0];
  assert.equal((await request(app).get(`/api/viagens/${minha.id_viagem}`).set(outro.auth)).status, 404);
  assert.equal((await request(app).delete(`/api/viagens/${minha.id_viagem}`).set(outro.auth)).status, 404);
  assert.equal((await request(app).get('/api/viagens').set(outro.auth)).body.length, 0);
  assert.equal((await request(app).get('/api/viagens')).status, 401);
});
