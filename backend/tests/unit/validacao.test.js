// Testes de unidade: funções puras de validação (não usam banco).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpfValido, emailValido, somenteDigitos } from '../../src/utils/validacao.js';

test('somenteDigitos remove pontos, traços e espaços', () => {
  assert.equal(somenteDigitos('529.982.247-25'), '52998224725');
  assert.equal(somenteDigitos(null), '');
});

test('cpfValido aceita CPF com dígitos verificadores corretos', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('52998224725'), true);
});

test('cpfValido recusa CPF com dígito errado, repetido ou tamanho errado', () => {
  assert.equal(cpfValido('529.982.247-26'), false);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(cpfValido('123'), false);
});

test('emailValido confere o formato do e-mail', () => {
  assert.equal(emailValido('bob@exemplo.com'), true);
  assert.equal(emailValido('sem-arroba.com'), false);
  assert.equal(emailValido(42), false);
});
