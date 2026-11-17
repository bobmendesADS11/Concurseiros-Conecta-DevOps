// Configuração do PM2 (gerenciador de processos) usada no servidor EC2.
module.exports = {
  apps: [
    {
      name: 'concurseiro-conecta',
      script: 'src/server.js',
      cwd: __dirname,
      env: { NODE_ENV: 'production' },
    },
  ],
};
