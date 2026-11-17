# Contrato da API — Concurseiros Conecta (v3.0.0-n2)

Base: `http://localhost:3000/api` · Corpo e respostas em JSON · Erros no formato `{ "error": "mensagem", "code"?: "...", "detalhes"?: [...] }`.

Rotas marcadas com 🔒 exigem o cabeçalho `Authorization: Bearer <token>` (token do login, válido por 8 h). Sem token ou com token inválido: **401**.

## Autenticação (US01 / RF01 / RF02)

| Método e rota | Entrada | Saída | Validações e erros |
|---|---|---|---|
| `POST /auth/cadastro` | `nome, email, cpf, senha, confirmarSenha` | **201** usuário (sem senha nem CPF) | 400: nome < 3 letras, e-mail inválido, CPF inválido (dígitos verificadores), senha < 8, senhas diferentes · 409 `CPF_DUPLICADO` / `EMAIL_DUPLICADO` |
| `POST /auth/login` | `email, senha` | **200** `{ token, usuario }` | 400 campos vazios · 401 "E-mail ou senha incorretos." |
| `POST /auth/recuperar-senha` | `email, cpf, novaSenha` | **200** mensagem | 400 dados inválidos · 404 e-mail e CPF não batem |

A senha é gravada com **bcrypt**. Usuários antigos (senha em texto puro, antes da N2) têm a senha convertida para hash no primeiro login.

## Perfil e privacidade (US02 / US03 / US04 / US08 / RF03 / RF04)

| Método e rota | Entrada | Saída | Validações e erros |
|---|---|---|---|
| 🔒 `GET /me` | — | perfil + `preferencia` + `total_viagens` | — |
| 🔒 `PUT /me` | `nome?, cidade?, estado?, bio?, foto_url?` | perfil atualizado | 400: nome < 3, UF ≠ 2 letras, bio > 500, foto sem `http(s)://`, nenhum campo |
| 🔒 `GET /me/privacidade` | — | `perfil_publico, receber_solicitacoes, permitir_mensagens` | — |
| 🔒 `PUT /me/privacidade` | qualquer um dos três booleanos | preferências | 400 valor não booleano ou nenhum campo |

## Viagens (US05 / US06 / RF05 / RF06)

| Método e rota | Entrada | Saída | Validações e erros |
|---|---|---|---|
| 🔒 `POST /viagens` | `id_concurso, cidade_origem, data_ida, data_volta?, transporte?, hospedagem?, observacoes?, confirmar_conflito?` | **201** viagem com concurso | 400: concurso inexistente, cidade vazia, ida ausente, volta antes da ida, ida depois da prova, transporte fora de `onibus/carro/aviao/carona/outro` · **409 `CONFLITO_DATAS`** com `detalhes` (viagens que caem no mesmo período ou com prova no mesmo dia) — reenviar com `confirmar_conflito: true` grava com `conflito_datas = true` |
| 🔒 `GET /viagens` | — | viagens do usuário, ordenadas pela ida | — |
| 🔒 `GET /viagens/:id` | — | viagem | 404 se não existe ou é de outro usuário |
| 🔒 `PUT /viagens/:id` | mesmos campos + `status` (`planejada/confirmada/cancelada`) | viagem | mesmas do POST · 404 |
| 🔒 `DELETE /viagens/:id` | — | mensagem | 404 |

Ao cadastrar a viagem, o usuário também é inscrito em `candidatos_concurso` (o trigger da N1 atualiza `qtd_candidatos`).

## Concursos e bancas (N1)

| Método e rota | Entrada | Saída | Validações e erros |
|---|---|---|---|
| `GET /bancas` | — | lista de bancas | — |
| `GET /concursos` · `GET /concursos/:id` | — | concurso(s) com banca | 400 id inválido · 404 |
| 🔒 `POST /concursos` | `cargo, id_banca, local, data, url_edital` | **201** | 400 cargo/banca ausentes, banca inexistente, data inválida |
| 🔒 `PUT /concursos/:id` | campos parciais | concurso | 400 · 404 |
| 🔒 `DELETE /concursos/:id` | — | mensagem | 404 · 409 se houver viagens ligadas |

## Concurseiros e conexões (US07 / US09 / US10 / RF07 / RF08 / RF09)

| Método e rota | Entrada | Saída | Validações e erros |
|---|---|---|---|
| 🔒 `GET /concurseiros?cargo=&id_concurso=` | filtros opcionais | lista com `concursos`, `aceita_solicitacoes`, `situacao` (`nenhuma`, `pendente_enviada`, `pendente_recebida`, `aceita`, `recusada`) e `id_conexao` | Só perfis com `perfil_publico = true`; nunca o próprio usuário; filtro de cargo sem diferenciar maiúsculas |
| 🔒 `POST /conexoes` | `id_destinatario` | **201** conexão `pendente` | 400 para si mesmo · 404 destinatário inexistente · 403 destinatário com `receber_solicitacoes = false` · 409 `SOLICITACAO_DUPLICADA`, `SOLICITACAO_RECEBIDA`, `JA_CONECTADOS`. Após uma recusa, quem enviou pode tentar de novo (volta a `pendente`). |
| 🔒 `GET /conexoes` | — | `{ recebidas, enviadas, aceitas }` | — |
| 🔒 `PATCH /conexoes/:id` | `status`: `aceita` ou `recusada` | conexão | 400 status inválido · 403 quem responde não é o destinatário · 404 · 409 já respondida |

## Chat (RF10)

| Interface | Entrada | Saída | Validações e erros |
|---|---|---|---|
| 🔒 `GET /conexoes/:id/mensagens` | — | histórico em ordem de envio | 403 se não participa ou a conexão não está aceita · 404 |
| 🔒 `POST /conexoes/:id/mensagens` | `conteudo` | **201** mensagem (também emitida no WebSocket) | 400 vazia ou > 1000 caracteres · 403 sem conexão aceita ou destinatário com `permitir_mensagens = false` |
| Socket.IO — handshake | `auth: { token }` | conexão aberta | token ausente/inválido: conexão recusada (`connect_error`) |
| Evento `entrar_conexao` | `{ id_conexao }` | ack `{ ok: true }` | ack `{ ok: false, status: 403 }` |
| Evento `enviar_mensagem` | `{ id_conexao, conteudo }` | ack `{ ok: true, mensagem }` e evento `receber_mensagem` para a sala da conexão | mesmas regras do POST; a mensagem é **gravada antes** de ser emitida |

## Usuários (CRUD administrativo da N1)

🔒 `GET/POST/PUT/DELETE /users[/:id]` — mantido da N1, agora com senha em hash e exigindo login. O app usa `/auth/cadastro` para criar contas.
