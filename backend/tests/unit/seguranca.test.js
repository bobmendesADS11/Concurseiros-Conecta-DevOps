// Testes de unidade: hash de senha (bcrypt) e token JWT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarHash, conferirSenha } from '../../src/services/senha.js';
import { emitirToken, validarToken } from '../../src/services/token.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste-unitario';

test('gerarHash cria um hash bcrypt que confere com a senha certa', async () => {
  const hash = await gerarHash('minhasenha123');
  assert.match(hash, /^\$2/);
  assert.deepEqual(await conferirSenha('minhasenha123', hash), { ok: true, precisaMigrar: false });
  assert.equal((await conferirSenha('senhaerrada', hash)).ok, false);
});

test('conferirSenha avisa quando a senha salva ainda está em texto puro', async () => {
  assert.deepEqual(await conferirSenha('abc', 'abc'), { ok: true, precisaMigrar: true });
});

test('emitirToken e validarToken fazem o caminho de ida e volta', () => {
  const token = emitirToken({ id_usuario: 5, nome: 'Bob' });
  assert.deepEqual(validarToken(token), { id_usuario: 5, nome: 'Bob' });
});

test('validarToken recusa token adulterado com erro 401', () => {
  assert.throws(() => validarToken('token.falso.123'), { statusCode: 401 });
});
