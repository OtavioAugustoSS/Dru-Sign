-- CreateEnum
CREATE TYPE "unidade_cobranca" AS ENUM ('m2', 'unidade', 'metro_linear');

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "codigo_legado" INTEGER,
    "nome" VARCHAR(120) NOT NULL,
    "apelido" VARCHAR(60),
    "documento" VARCHAR(14),
    "email" VARCHAR(120),
    "contato" VARCHAR(80),
    "endereco" VARCHAR(160),
    "bairro" VARCHAR(60),
    "cidade" VARCHAR(60),
    "uf" VARCHAR(2),
    "cep" VARCHAR(9),
    "observacoes" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "arquivado_em" TIMESTAMPTZ(3),

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telefone_cliente" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "original" VARCHAR(20) NOT NULL,
    "normalizado" VARCHAR(11),
    "inferido" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "telefone_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "categoria" VARCHAR(60),
    "preco" DECIMAL(12,4) NOT NULL,
    "unidade_cobranca" "unidade_cobranca" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cliente_empresa_id_nome_idx" ON "cliente"("empresa_id", "nome");

-- CreateIndex
CREATE INDEX "cliente_empresa_id_apelido_idx" ON "cliente"("empresa_id", "apelido");

-- CreateIndex
CREATE INDEX "cliente_empresa_id_documento_idx" ON "cliente"("empresa_id", "documento");

-- CreateIndex
CREATE INDEX "cliente_codigo_legado_idx" ON "cliente"("codigo_legado");

-- CreateIndex
CREATE INDEX "telefone_cliente_empresa_id_normalizado_idx" ON "telefone_cliente"("empresa_id", "normalizado");

-- CreateIndex
CREATE INDEX "telefone_cliente_cliente_id_idx" ON "telefone_cliente"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_empresa_id_nome_key" ON "material"("empresa_id", "nome");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telefone_cliente" ADD CONSTRAINT "telefone_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

