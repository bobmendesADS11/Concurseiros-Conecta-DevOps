# Concurseiros Conecta

Plataforma para concurseiros que viajam para fazer provas em outras cidades: planejar a viagem, encontrar quem vai fazer a mesma prova, conectar-se e combinar transporte e hospedagem pelo chat.

**Versão:** `v3.0.0-n2` (entrega final da N2 — PMI III / ADS31, 13/11/2026) · Pipeline de CI/CD da **N3 de Ferramentas de Implantação Contínua (DevOps)**

**Equipe:** Gabriel de Rezende Silva Scatolino, Moacyr Mendes de Oliveira Neto e Fernando Tolentino de Souza Hessmann Dutra.

## O que funciona nesta versão

| História / requisito | Funcionalidade |
|---|---|
| US01 · RF01/RF02 | Cadastro com CPF validado e único, login com senha em hash (bcrypt) e token JWT, redefinição de senha por e-mail + CPF |
| US02/US04 · RF03 | Editar nome, cidade, UF, bio e foto (link) |
| US03/US08 · RF04 | Privacidade: perfil público, receber solicitações, receber mensagens |
| US05/US06 · RF05/RF06 | Planejar viagens ligadas a um concurso, aviso de **conflito de datas**, confirmar/cancelar/excluir |
| N1 | CRUD de concursos e bancas (gravar exige login) |
| US07/US09 · RF07/RF08 | Lista de concurseiros com perfil público e filtro por cargo |
| US10 · RF09 | Solicitar conexão, aceitar ou recusar |
| RF10 | Chat em tempo real (Socket.IO) entre conexões aceitas, com histórico salvo |

Fora desta versão: avaliações (RF13/RF14), recomendações e notificações push (RF12/RF15) e mapa (RF16).

## Tecnologias

- **Frontend:** HTML5, CSS3 e JavaScript puro (`frontend/`), servido pelo próprio backend.
- **Backend:** Node.js 18+ com Express, Socket.IO, bcryptjs e jsonwebtoken (`backend/`).
- **Banco:** PostgreSQL com Prisma ORM e migrations versionadas (`backend/prisma/`).

## Como rodar

Pré-requisitos: **Node.js 20+** (os testes usam `node --test` com padrão de arquivos) e **PostgreSQL 14+** rodando na porta 5432.

```bash
# 1. Clonar e entrar no backend
git clone https://github.com/GabrielScatolino/Concurseiros-Conecta.git
cd Concurseiros-Conecta/backend

# 2. Instalar as dependências
npm install

# 3. Configurar o ambiente: copie o exemplo e coloque a senha do seu PostgreSQL
cp .env.example .env        # no Windows: copy .env.example .env

# 4. Criar o banco "concurseiro_conecta" no pgAdmin (ou: createdb concurseiro_conecta)
#    e aplicar as migrations
npm run db:migrate
npm run db:generate

# 5. (Opcional) Dados de demonstração
npm run db:seed

# 6. Subir API + chat + frontend
npm run dev
```

Abra **http://localhost:3000** no navegador.

### Dados de demonstração (`npm run db:seed`)

Usuários fictícios `demo1@exemplo.com` a `demo4@exemplo.com`, todos com a senha **`Demo@1234`** (só para demonstração; não reutilize). O seed cria três concursos, viagens, uma conexão aceita entre Ana (demo1) e Bruno (demo2) com mensagens, uma solicitação pendente de Carla (demo3) para Ana, e Diego (demo4) com perfil privado. Pode rodar mais de uma vez.

Para testar o chat ao vivo, abra uma janela normal com demo1 e uma anônima com demo2.

## DevOps (N3)

### Branches
- `main` — produção (o que está no EC2)
- `develop` — integração
- `feature/*` — cada funcionalidade nova, com pull request para `develop`

### Workflows (`.github/workflows/`)
| Workflow | Quando roda | O que faz |
|---|---|---|
| **CI/CD** (`ci.yml`) | push em `main`, `develop`, `feature/**` e pull requests | ESLint (análise estática), testes de unidade + integração com cobertura, teste de interface com Selenium e, em `main`/`develop`, empacota a aplicação como artefato (entrega contínua) |
| **CD - Deploy no EC2** (`cd.yml`) | quando o CI/CD passa na `main` (ou manualmente) | entra no EC2 por SSH, atualiza o código, aplica as migrations e reinicia a aplicação com PM2 |

Secrets do repositório usados pelo deploy: `EC2_HOST` (IP público), `EC2_USER` (`ubuntu`) e `EC2_SSH_KEY` (conteúdo do arquivo `.pem`).

### Servidor
Ubuntu no EC2 com Node.js 22, PostgreSQL, PM2 (app na porta 3001) e nginx publicando na porta 80. A preparação inicial está em `deploy/setup-ec2.sh` e cada deploy roda `deploy/deploy.sh`. Acesse `http://<ip_do_servidor>`.

### Comandos
```bash
cd backend
npm run lint           # análise estática
npm run test:unit      # só testes de unidade (não precisam de banco)
npm test               # unidade + integração
npm run test:coverage  # tudo com relatório de cobertura (coverage/lcov.info)
APP_URL=http://localhost:3000 npm run test:e2e   # Selenium (app precisa estar rodando)
```

## Testes automatizados

```bash
cd backend
npm test
```

São 30 testes de integração (T01–T30), 12 testes de unidade em `tests/unit/` e 2 testes de interface com Selenium em `tests/e2e/`. Os de integração usam `node:test`, `supertest` e `socket.io-client`: cenários de sucesso e de falha de cadastro, login, perfil, privacidade, concursos (regressão da N1), viagens, conexões e chat em tempo real. Eles usam um banco separado, **`concurseiro_conecta_test`**, criado automaticamente pelo `prisma migrate deploy` se o usuário do PostgreSQL tiver permissão; senão, crie o banco vazio antes. Os dados de demonstração não são tocados.

## Documentação

- `docs/api.md` — contrato dos endpoints e eventos do WebSocket, com validações e erros.
- `docs/diagramas/` — arquitetura, casos de uso, DER e diagramas de sequência (login, conexão, chat), em Mermaid (`.mmd`) e imagem (`.png`).

## Estrutura

```
backend/
  prisma/            schema.prisma, migrations/ e seed.js
  src/app.js         Express: rotas /api e arquivos do frontend
  src/server.js      HTTP + Socket.IO
  src/routes/        rotas por recurso
  src/controllers/   regras de cada recurso
  src/services/      senha (bcrypt), token (JWT), conexões e mensagens
  src/websocket/     chat em tempo real
  src/middlewares/   autenticação JWT
  tests/             testes de integração T01–T30, unit/ e e2e/ (Selenium)
frontend/            index.html, script.js, styles.css
docs/                api.md e diagramas
deploy/              scripts do servidor EC2
.github/workflows/   ci.yml e cd.yml
```
