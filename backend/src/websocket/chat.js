import { Server } from 'socket.io';
import { validarToken } from '../services/token.js';
import { conexaoAceitaDoUsuario, enviarMensagem } from '../services/conexaoService.js';

let io = null;
const sala = (id_conexao) => `conexao:${id_conexao}`;

const respostaErro = (err) => ({ ok: false, status: err.statusCode || 500, error: err.statusCode ? err.message : 'Erro interno no chat.' });

// RF10 — chat em tempo real. O handshake exige o mesmo JWT da API REST.
export const iniciarChat = (httpServer) => {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.use((socket, next) => {
    try {
      socket.usuario = validarToken(socket.handshake.auth?.token);
      next();
    } catch (err) {
      next(new Error(err.message));
    }
  });

  io.on('connection', (socket) => {
    // Entrar na sala de uma conexão: só participantes de conexão aceita.
    socket.on('entrar_conexao', async ({ id_conexao } = {}, ack = () => {}) => {
      try {
        const conexao = await conexaoAceitaDoUsuario(socket.usuario.id_usuario, id_conexao);
        socket.join(sala(conexao.id_conexao));
        ack({ ok: true });
      } catch (err) {
        ack(respostaErro(err));
      }
    });

    // Grava no banco e só então emite para a sala.
    socket.on('enviar_mensagem', async ({ id_conexao, conteudo } = {}, ack = () => {}) => {
      try {
        const mensagem = await enviarMensagem(socket.usuario.id_usuario, id_conexao, conteudo);
        notificarMensagem(mensagem);
        ack({ ok: true, mensagem });
      } catch (err) {
        ack(respostaErro(err));
      }
    });
  });

  return io;
};

export const notificarMensagem = (mensagem) => {
  if (io) io.to(sala(mensagem.id_conexao)).emit('receber_mensagem', mensagem);
};

export const encerrarChat = () => new Promise((resolve) => (io ? io.close(() => resolve()) : resolve()));
