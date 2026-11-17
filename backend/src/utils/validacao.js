// Validações de dados de entrada reutilizadas por cadastro, recuperação e perfil.

export const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

export const emailValido = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Valida CPF pelos dígitos verificadores (regra oficial da Receita Federal).
export const cpfValido = (cpf) => {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
};

export const SENHA_MINIMA = 8;
