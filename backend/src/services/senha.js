import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export const gerarHash = (senha) => bcrypt.hash(senha, ROUNDS);

// Senhas gravadas antes da N2 estavam em texto puro. Se o valor salvo não for
// um hash bcrypt, compara direto e informa que precisa ser migrado para hash.
export const conferirSenha = async (senhaDigitada, senhaSalva) => {
  if (typeof senhaSalva === 'string' && senhaSalva.startsWith('$2')) {
    return { ok: await bcrypt.compare(senhaDigitada, senhaSalva), precisaMigrar: false };
  }
  return { ok: senhaDigitada === senhaSalva, precisaMigrar: true };
};
