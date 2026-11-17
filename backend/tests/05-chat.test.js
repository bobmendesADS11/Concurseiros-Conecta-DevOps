import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as conectar } from 'socket.io-client';
import { app, prisma, request, limparBanco, criarUsuario } from './helpers.js';

const { iniciarChat, encerrarChat } = await import('../src/websocket/chat.js');

let servidor; let url; let ana; let bruno; let carla; let idConexao; let idPendente;
const sockets = [];

const abrir = (token) => new Promise((resolve, reject) => {
  const s = conectar(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  sockets.push(s);
  s.on('connect', () => resolve(s));
  s.on('connect_error', reject);
});
const emitir = (s, evento, dados) => new Promise((resolve) => s.emit(evento, dados, resolve));

before(async () => {
  await limparBanco();
  [ana, bruno, carla] = await Promise.all(['Ana', 'Bruno', 'Carla'].map((n) => criarUsuario(n)));
  const c = await request(app).post('/api/conexoes').set(ana.auth).send({ id_destinatario: bruno.id_usuario });
  await request(app).patch(`/api/conexoes/${c.body.id_conexao}`).set(bruno.auth).send({ status: 'aceita' }).expect(200);
  idConexao = c.body.id_conexao;
  const p = await request(app).post('/api/conexoes').set(ana.auth).send({ id_destinatario: carla.id_usuario });
  idPendente = p.body.id_conexao;
  servidor = http.createServer(app);
  iniciarChat(servidor);
  await new Promise((r) => servidor.listen(0, r));
  url = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  sockets.forEach((s) => s.disconnect());
  await encerrarChat();
  await new Promise((r) => servidor.close(r));
  await prisma.$disconnect();
});

test('T25 [RF10 CA01] duas pessoas conectadas trocam mensagens em tempo real', async () => {
  const sa = await abrir(ana.token);
  const sb = await abrir(bruno.token);
  assert.deepEqual(await emitir(sa, 'entrar_conexao', { id_conexao: idConexao }), { ok: true });
  assert.deepEqual(await emitir(sb, 'entrar_conexao', { id_conexao: idConexao }), { ok: true });

  const chegou = new Promise((resolve) => sb.once('receber_mensagem', resolve));
  const ack = await emitir(sa, 'enviar_mensagem', { id_conexao: idConexao, conteudo: 'Oi Bruno, vamos dividir o Uber?' });
  assert.equal(ack.ok, true);
  const recebida = await chegou;
  assert.equal(recebida.conteudo, 'Oi Bruno, vamos dividir o Uber?');
  assert.equal(recebida.id_remetente, ana.id_usuario);

  const volta = new Promise((resolve) => sa.once('receber_mensagem', resolve));
  await emitir(sb, 'enviar_mensagem', { id_conexao: idConexao, conteudo: 'Bora!' });
  assert.equal((await volta).conteudo, 'Bora!');
});

test('T26 [RF10 CA02] histórico fica gravado e reaparece ao reabrir o chat', async () => {
  const r = await request(app).get(`/api/conexoes/${idConexao}/mensagens`).set(bruno.auth);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((m) => m.conteudo), ['Oi Bruno, vamos dividir o Uber?', 'Bora!']);
});

test('T27 [RF10 CA03] sem conexão aceita o envio é recusado com 403 e nada é gravado', async () => {
  const sc = await abrir(carla.token);
  const antes = await prisma.mensagem.count();
  const r1 = await emitir(sc, 'enviar_mensagem', { id_conexao: idConexao, conteudo: 'invadindo' });
  assert.equal(r1.ok, false);
  assert.equal(r1.status, 403);
  const sa = await abrir(ana.token);
  const r2 = await emitir(sa, 'enviar_mensagem', { id_conexao: idPendente, conteudo: 'ainda pendente' });
  assert.equal(r2.status, 403);
  assert.equal((await emitir(sc, 'entrar_conexao', { id_conexao: idConexao })).status, 403);
  assert.equal((await request(app).get(`/api/conexoes/${idConexao}/mensagens`).set(carla.auth)).status, 403);
  assert.equal(await prisma.mensagem.count(), antes);
});

test('T28 [RF10 CA03] mensagem vazia ou longa demais é recusada (400)', async () => {
  const sa = await abrir(ana.token);
  assert.equal((await emitir(sa, 'enviar_mensagem', { id_conexao: idConexao, conteudo: '   ' })).status, 400);
  assert.equal((await emitir(sa, 'enviar_mensagem', { id_conexao: idConexao, conteudo: 'x'.repeat(1001) })).status, 400);
});

test('T29 [RF10 CA03] se o destinatário desativar mensagens, o envio é bloqueado (403)', async () => {
  await request(app).put('/api/me/privacidade').set(bruno.auth).send({ permitir_mensagens: false }).expect(200);
  const r = await request(app).post(`/api/conexoes/${idConexao}/mensagens`).set(ana.auth).send({ conteudo: 'oi?' });
  assert.equal(r.status, 403);
  await request(app).put('/api/me/privacidade').set(bruno.auth).send({ permitir_mensagens: true }).expect(200);
  assert.equal((await request(app).post(`/api/conexoes/${idConexao}/mensagens`).set(ana.auth).send({ conteudo: 'oi!' })).status, 201);
});

test('T30 [RF10] socket sem token válido é recusado no handshake', async () => {
  await assert.rejects(abrir('token-falso'));
  await assert.rejects(abrir(undefined));
});
