-- CreateEnum
CREATE TYPE "papel" AS ENUM ('administracao', 'operacao');

-- CreateTable
CREATE TABLE "empresa" (
    "id" UUID NOT NULL,
    "razao_social" VARCHAR(160) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "arquivado_em" TIMESTAMPTZ(3),

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "papel" NOT NULL DEFAULT 'operacao',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" VARCHAR(64) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_login_key" ON "usuario"("login");

-- CreateIndex
CREATE INDEX "usuario_empresa_id_idx" ON "usuario"("empresa_id");

-- CreateIndex
CREATE INDEX "sessao_usuario_id_idx" ON "sessao"("usuario_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
