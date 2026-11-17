import 'dotenv/config';
import http from 'node:http';
import app from './app.js';
import { iniciarChat } from './websocket/chat.js';

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);
iniciarChat(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Concurseiros Conecta rodando em http://localhost:${PORT} (API + chat WebSocket)`);
});
