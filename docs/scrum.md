# Scrum do Concurseiros Conecta

Este documento reúne como o projeto foi organizado com Scrum: o backlog, as sprints, as estimativas, as revisões e as retrospectivas. Os detalhes de cada entrega estão nos relatórios das sprints, entregues no Classroom, e no documento final da N2.

## Equipe e papéis

**Projeto (PMI III, ADS31):** Gabriel de Rezende Silva Scatolino, Moacyr Mendes de Oliveira Neto e Fernando Tolentino de Souza Hessmann Dutra.

O trabalho de DevOps (CI/CD e deploy na nuvem) foi feito na disciplina de Ferramentas de Implantação Contínua, com outra equipe: Moacyr, Bento Biral Foerster e Eduardo Varela.

## Product backlog

Cada história tem critérios de aceite e uma estimativa em pontos.

| ID | História | Requisitos | Pontos | Situação |
| --- | --- | --- | --- | --- |
| US01 | Cadastrar conta, entrar e trocar a senha | RF01, RF02 | 8 | Concluída |
| US02 / US04 | Editar perfil, bio e foto | RF03 | 5 | Concluída |
| US03 / US08 | Escolher a privacidade do perfil | RF04 | 3 | Concluída |
| US05 / US06 | Planejar e gerenciar viagens, com aviso de conflito de datas | RF05, RF06 | 8 | Concluída |
| US07 / US09 | Listar concurseiros e filtrar por cargo | RF07, RF08 | 5 | Concluída |
| US10 | Enviar, aceitar e recusar conexão | RF09 | 5 | Concluída |
| RF10 | Chat em tempo real entre conexões | RF10 | 8 | Concluída |
| RF12 / RF15 | Recomendações e notificações | RF12, RF15 | — | Fora do escopo |
| RF13 / RF14 | Avaliações entre usuários | RF13, RF14 | — | Fora do escopo |
| RF16 | Mapa com os locais de prova | RF16 | — | Fora do escopo |

**Total entregue:** 42 pontos de história.

## Sprints

| Sprint | Período | Objetivo | Entrega |
| --- | --- | --- | --- |
| Semestre anterior | 03 a 06/2026 | Protótipo navegável, landing page e CRUD de concursos e usuários | Telas e API com PostgreSQL e Prisma |
| Sprint 1 | 01/10 a 16/10/2026 | Primeiro fluxo: cadastro, login, perfil e viagens | Relatório da Sprint 1 |
| Sprint 2 | 16/10 a 30/10/2026 | Encontrar concurseiros, conexões e chat | Entrega parcial da Sprint 2 |
| Consolidação | 30/10 a 13/11/2026 | Integrar tudo, testar e documentar | Versão `v3.0.1-n2` e documento final da N2 |
| Incremento DevOps | 16/11 a 19/11/2026 | CI/CD, testes de unidade, Selenium e deploy no EC2 | PRs #1 a #16 deste repositório |
| Ajustes para a banca | 24/11/2026 | README e slogan corrigidos | PRs #17 e #18 |

## Cerimônias e artefatos

- **Planejamento:** no começo de cada sprint, a equipe escolheu as histórias do backlog e estimou em pontos.
- **Revisão:** cada sprint terminou com uma entrega ao professor (relatório ou documento), que serviu de revisão do incremento.
- **Retrospectiva:** registrada nos relatórios das sprints e no documento final da N2.
- **Definição de pronto:** uma história só conta como concluída quando tem o código no repositório, os testes passando e a documentação atualizada.
- **Fluxo de trabalho:** cada mudança entra por uma branch (`feature/*`, `fix/*` ou `docs/*`), passa por um pull request para a `develop` e depois para a `main`. O CI roda o lint e os testes em todo PR.

## Retrospectiva geral

**O que funcionou:** dividir o produto em histórias pequenas, com critérios de aceite claros, e testar cada critério com testes automáticos.

**O que não funcionou:** nas Sprints 1 e 2, a documentação andou na frente do código. Também não usamos um quadro Kanban durante as sprints.

**O que mudou:** na consolidação, passamos a seguir a definição de pronto à risca, a gerar os diagramas a partir do código e a usar pull requests com CI. O quadro do projeto no GitHub foi montado no fim, para organizar o backlog daqui em diante.

## Onde está cada coisa

- Diagramas: [`docs/diagramas`](diagramas)
- Contrato da API: [`docs/api.md`](api.md)
- Documento final da N2: pasta `documents` do repositório [GabrielScatolino/Concurseiros-Conecta](https://github.com/GabrielScatolino/Concurseiros-Conecta/tree/master/documents)
- Relatórios das Sprints 1 e 2: entregues no Classroom da disciplina
- Pull requests: aba **Pull requests** deste repositório
