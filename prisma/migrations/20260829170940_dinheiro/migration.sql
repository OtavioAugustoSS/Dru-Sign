-- CreateEnum
CREATE TYPE "forma_pagamento" AS ENUM ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque', 'boleto');

-- CreateEnum
CREATE TYPE "tipo_conta" AS ENUM ('receita', 'despesa');

-- CreateEnum
CREATE TYPE "tipo_lancamento" AS ENUM ('entrada', 'saida');

-- AlterTable
ALTER TABLE "empresa" ADD COLUMN     "conta_recebimento_id" UUID;

-- AlterTable
ALTER TABLE "ordem_servico" ADD COLUMN     "concluida_por_id" UUID;

-- CreateTable
CREATE TABLE "conta_plano" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "codigo" INTEGER NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "tipo" "tipo_conta" NOT NULL,
    "grupo" VARCHAR(60) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "codigo_legado" INTEGER,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conta_plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recebimento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ordem_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,
    "forma" "forma_pagamento" NOT NULL,
    "observacao" VARCHAR(160),
    "usuario_id" UUID NOT NULL,
    "lancamento_id" UUID NOT NULL,
    "estornado_em" TIMESTAMPTZ(3),
    "estornado_por_id" UUID,
    "motivo_estorno" VARCHAR(160),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_caixa" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "tipo_lancamento" NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,
    "conta_id" UUID NOT NULL,
    "historico" VARCHAR(160) NOT NULL,
    "ordem_id" UUID,
    "fornecedor" VARCHAR(120),
    "parcela" INTEGER,
    "total_parcelas" INTEGER,
    "usuario_id" UUID NOT NULL,
    "estornado_em" TIMESTAMPTZ(3),
    "estornado_por_id" UUID,
    "motivo_estorno" VARCHAR(160),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamento_caixa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conta_plano_empresa_id_tipo_idx" ON "conta_plano"("empresa_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "conta_plano_empresa_id_codigo_key" ON "conta_plano"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "recebimento_lancamento_id_key" ON "recebimento"("lancamento_id");

-- CreateIndex
CREATE INDEX "recebimento_empresa_id_ordem_id_idx" ON "recebimento"("empresa_id", "ordem_id");

-- CreateIndex
CREATE INDEX "recebimento_empresa_id_data_idx" ON "recebimento"("empresa_id", "data");

-- CreateIndex
CREATE INDEX "lancamento_caixa_empresa_id_data_idx" ON "lancamento_caixa"("empresa_id", "data");

-- CreateIndex
CREATE INDEX "lancamento_caixa_empresa_id_ordem_id_idx" ON "lancamento_caixa"("empresa_id", "ordem_id");

-- CreateIndex
CREATE INDEX "lancamento_caixa_empresa_id_conta_id_idx" ON "lancamento_caixa"("empresa_id", "conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_conta_recebimento_id_key" ON "empresa"("conta_recebimento_id");

-- AddForeignKey
ALTER TABLE "empresa" ADD CONSTRAINT "empresa_conta_recebimento_id_fkey" FOREIGN KEY ("conta_recebimento_id") REFERENCES "conta_plano"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conta_plano" ADD CONSTRAINT "conta_plano_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimento" ADD CONSTRAINT "recebimento_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordem_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimento" ADD CONSTRAINT "recebimento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimento" ADD CONSTRAINT "recebimento_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamento_caixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_caixa" ADD CONSTRAINT "lancamento_caixa_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta_plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_caixa" ADD CONSTRAINT "lancamento_caixa_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordem_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_caixa" ADD CONSTRAINT "lancamento_caixa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_concluida_por_id_fkey" FOREIGN KEY ("concluida_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

