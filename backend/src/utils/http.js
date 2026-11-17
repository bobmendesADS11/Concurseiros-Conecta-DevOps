// Utilidades HTTP compartilhadas pelos controllers.

export class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    Object.assign(this, extra);
  }
}

export const parseId = (value, nome = 'ID') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `${nome} inválido.`);
  }
  return id;
};

export const parseDate = (value, nome = 'Data') => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${nome} inválida.`);
  }
  return date;
};

// Envolve um controller async e encaminha erros para o middleware de erro.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware final de erros: traduz HttpError e erros do Prisma em respostas JSON.
export const errorMiddleware = (err, req, res, _next) => {
  if (err instanceof HttpError || err.statusCode) {
    const body = { error: err.message };
    if (err.code) body.code = err.code;
    if (err.detalhes) body.detalhes = err.detalhes;
    return res.status(err.statusCode).json(body);
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }
  if (err.code === 'P1001' || err.code === 'ECONNREFUSED' || err.meta?.driverAdapterError?.name === 'DriverAdapterError') {
    console.error('[Banco fora do ar]', err.message.split('\n').filter(Boolean).pop());
    return res.status(503).json({ error: 'Não foi possível acessar o banco de dados. Confira se o PostgreSQL está ligado.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro não encontrado.' });
  }
  console.error('[Erro interno]', err);
  return res.status(500).json({ error: 'Erro interno no servidor.' });
};
