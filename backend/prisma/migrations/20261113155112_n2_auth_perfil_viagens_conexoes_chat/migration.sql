-- N2 (consolidação 13/11/2026): autenticação, perfil, privacidade, viagens, conexões e chat
-- AlterTable
ALTER TABLE "candidatos_concurso" ALTER COLUMN "data_inscricao" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "bio" VARCHAR(500),
ADD COLUMN     "foto_url" VARCHAR(255),
ALTER COLUMN "data_cadastro" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "preferencias_privacidade" (
    "id_preferencia" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "perfil_publico" BOOLEAN NOT NULL DEFAULT true,
    "receber_solicitacoes" BOOLEAN NOT NULL DEFAULT true,
    "permitir_mensagens" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "preferencias_privacidade_pkey" PRIMARY KEY ("id_preferencia")
);

-- CreateTable
CREATE TABLE "viagens" (
    "id_viagem" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_concurso" INTEGER NOT NULL,
    "cidade_origem" VARCHAR(100) NOT NULL,
    "data_ida" DATE NOT NULL,
    "data_volta" DATE,
    "transporte" VARCHAR(50),
    "hospedagem" VARCHAR(150),
    "observacoes" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'planejada',
    "conflito_datas" BOOLEAN NOT NULL DEFAULT false,
    "data_cadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viagens_pkey" PRIMARY KEY ("id_viagem")
);

-- CreateTable
CREATE TABLE "conexoes" (
    "id_conexao" SERIAL NOT NULL,
    "id_solicitante" INTEGER NOT NULL,
    "id_destinatario" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "data_solicitacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_resposta" TIMESTAMP(3),

    CONSTRAINT "conexoes_pkey" PRIMARY KEY ("id_conexao")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id_mensagem" SERIAL NOT NULL,
    "id_conexao" INTEGER NOT NULL,
    "id_remetente" INTEGER NOT NULL,
    "conteudo" VARCHAR(1000) NOT NULL,
    "data_envio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id_mensagem")
);

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_privacidade_id_usuario_key" ON "preferencias_privacidade"("id_usuario");

-- Migra a preferência perfil_publico de usuarios para a nova tabela (N2)
INSERT INTO "preferencias_privacidade" ("id_usuario", "perfil_publico")
SELECT "id_usuario", COALESCE("perfil_publico", true) FROM "usuarios";

ALTER TABLE "usuarios" DROP COLUMN "perfil_publico";

-- Regras de domínio (CHECK)
ALTER TABLE "viagens" ADD CONSTRAINT "ck_viagem_status" CHECK ("status" IN ('planejada', 'confirmada', 'cancelada'));
ALTER TABLE "viagens" ADD CONSTRAINT "ck_viagem_datas" CHECK ("data_volta" IS NULL OR "data_volta" >= "data_ida");
ALTER TABLE "conexoes" ADD CONSTRAINT "ck_conexao_status" CHECK ("status" IN ('pendente', 'aceita', 'recusada'));
ALTER TABLE "conexoes" ADD CONSTRAINT "ck_conexao_nao_propria" CHECK ("id_solicitante" <> "id_destinatario");
ALTER TABLE "mensagens" ADD CONSTRAINT "ck_mensagem_conteudo" CHECK (length(trim("conteudo")) > 0);

-- CreateIndex
CREATE INDEX "viagens_id_usuario_idx" ON "viagens"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "conexoes_par_unico" ON "conexoes"("id_solicitante", "id_destinatario");

-- CreateIndex
CREATE INDEX "mensagens_id_conexao_data_envio_idx" ON "mensagens"("id_conexao", "data_envio");

-- AddForeignKey
ALTER TABLE "preferencias_privacidade" ADD CONSTRAINT "fk_preferencia_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagens" ADD CONSTRAINT "fk_viagem_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagens" ADD CONSTRAINT "fk_viagem_concurso" FOREIGN KEY ("id_concurso") REFERENCES "concurso"("id_concurso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conexoes" ADD CONSTRAINT "fk_conexao_solicitante" FOREIGN KEY ("id_solicitante") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conexoes" ADD CONSTRAINT "fk_conexao_destinatario" FOREIGN KEY ("id_destinatario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "fk_mensagem_conexao" FOREIGN KEY ("id_conexao") REFERENCES "conexoes"("id_conexao") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "fk_mensagem_remetente" FOREIGN KEY ("id_remetente") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
