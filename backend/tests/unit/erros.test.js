// Testes de unidade: o middleware que transforma erros em respostas JSON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, errorMiddleware } from '../../src/utils/http.js';

// Imita o objeto "res" do Express e guarda o status e o corpo da resposta.
const respostaFalsa = () => {
  const res = {
    statusCode: null,
    body: null,
  };

  res.status = (codigo) => {
    res.statusCode = codigo;
    return res;
  };

  res.json = (corpo) => {
    res.body = corpo;
    return res;
  };

  return res;
};

test('HttpError vira resposta com o status e a mensagem do erro', () => {
  const res = respostaFalsa();

  errorMiddleware(
    new HttpError(404, 'Viagem não encontrada.'),
    {},
    res,
    () => {}
  );

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    error: 'Viagem não encontrada.',
  });
});

test('JSON mal formado no corpo da requisição vira erro 400', () => {
  const res = respostaFalsa();

  errorMiddleware(
    { type: 'entity.parse.failed' },
    {},
    res,
    () => {}
  );

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.error,
    'JSON inválido no corpo da requisição.'
  );
});

test('registro não encontrado no Prisma (P2025) vira erro 404', () => {
  const res = respostaFalsa();

  errorMiddleware(
    { code: 'P2025' },
    {},
    res,
    () => {}
  );

  assert.equal(res.statusCode, 404);
});