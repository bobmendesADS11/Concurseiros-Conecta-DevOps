// Testes de unidade: utilidades HTTP (parseId, parseDate, HttpError).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, parseId, parseDate } from '../../src/utils/http.js';

test('parseId converte texto numérico em inteiro', () => {
  assert.equal(parseId('7'), 7);
});

test('parseId recusa zero, negativo e texto com erro 400', () => {
  for (const valor of ['0', '-3', 'abc', '1.5']) {
    assert.throws(() => parseId(valor, 'ID da viagem'), (err) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.message, 'ID da viagem inválido.');
      return true;
    });
  }
});

test('parseDate devolve undefined para valor vazio e Date para data válida', () => {
  assert.equal(parseDate(''), undefined);
  assert.equal(parseDate('2026-11-19').toISOString().slice(0, 10), '2026-11-19');
});

test('parseDate recusa data inválida', () => {
  assert.throws(() => parseDate('31/31/2026'), { statusCode: 400 });
});
