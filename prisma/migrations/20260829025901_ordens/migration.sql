-- CreateEnum
CREATE TYPE "estado_producao" AS ENUM ('orcamento', 'aberta', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "tipo_acrescimo" AS ENUM ('instalacao', 'deslocamento', 'frete', 'imposto');

-- CreateTable
CREATE TABLE "contador_empresa" (
    "empresa_id" UUID NOT NULL,
    "proxima_os" INTEGER NOT NULL,

    CONSTRAINT "contador_empresa_pkey" PRIMARY KEY ("empresa_id")
);

-- CreateTable
CREATE TABLE "ordem_servico" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "estado_producao" "estado_producao" NOT NULL,
    "cliente_id" UUID,
    "cliente_nome" VARCHAR(120),
    "cliente_apelido" VARCHAR(60),
    "cliente_telefone" VARCHAR(20),
    "responsavel_id" UUID NOT NULL,
    "observacoes" TEXT,
    "subtotal_itens" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "subtotal_acrescimos" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "preco_calculado" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "preco_final" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "motivo_ajuste" VARCHAR(160),
    "ajustado_por_id" UUID,
    "ajustado_em" TIMESTAMPTZ(3),
    "preco_calculado_no_ajuste" DECIMAL(12,4),
    "aprovado_em" TIMESTAMPTZ(3),
    "preco_aprovado" DECIMAL(12,4),
    "aberta_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prometida_para" DATE,
    "concluida_em" TIMESTAMPTZ(3),
    "cancelada_em" TIMESTAMPTZ(3),
    "motivo_cancelamento" VARCHAR(160),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ordem_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_ordem" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ordem_id" UUID NOT NULL,
    "descricao" VARCHAR(160) NOT NULL,
    "material_id" UUID,
    "quantidade" INTEGER NOT NULL,
    "altura" DECIMAL(8,4),
    "largura" DECIMAL(8,4),
    "unidade_cobranca" "unidade_cobranca" NOT NULL,
    "valor_unitario" DECIMAL(12,4) NOT NULL,
    "total" DECIMAL(12,4) NOT NULL,
    "ordem_exibicao" INTEGER NOT NULL,
    "removido_em" TIMESTAMPTZ(3),
    "removido_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_ordem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acrescimo_ordem" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ordem_id" UUID NOT NULL,
    "tipo" "tipo_acrescimo" NOT NULL,
    "descricao" VARCHAR(120) NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,
    "removido_em" TIMESTAMPTZ(3),
    "removido_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acrescimo_ordem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutacao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "chave" VARCHAR(64) NOT NULL,
    "acao" VARCHAR(60) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "resposta" JSONB,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordem_servico_empresa_id_estado_producao_aberta_em_idx" ON "ordem_servico"("empresa_id", "estado_producao", "aberta_em");

-- CreateIndex
CREATE INDEX "ordem_servico_empresa_id_cliente_id_idx" ON "ordem_servico"("empresa_id", "cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordem_servico_empresa_id_numero_key" ON "ordem_servico"("empresa_id", "numero");

-- CreateIndex
CREATE INDEX "item_ordem_ordem_id_ordem_exibicao_idx" ON "item_ordem"("ordem_id", "ordem_exibicao");

-- CreateIndex
CREATE INDEX "item_ordem_empresa_id_material_id_idx" ON "item_ordem"("empresa_id", "material_id");

-- CreateIndex
CREATE INDEX "acrescimo_ordem_ordem_id_idx" ON "acrescimo_ordem"("ordem_id");

-- CreateIndex
CREATE UNIQUE INDEX "mutacao_empresa_id_chave_key" ON "mutacao"("empresa_id", "chave");

-- AddForeignKey
ALTER TABLE "contador_empresa" ADD CONSTRAINT "contador_empresa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_ajustado_por_id_fkey" FOREIGN KEY ("ajustado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_ordem" ADD CONSTRAINT "item_ordem_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordem_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_ordem" ADD CONSTRAINT "item_ordem_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acrescimo_ordem" ADD CONSTRAINT "acrescimo_ordem_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordem_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

