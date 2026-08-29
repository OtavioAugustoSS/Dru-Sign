-- CreateTable
CREATE TABLE "ordem_legado" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_entrada" DATE NOT NULL,
    "data_saida" DATE,
    "data_saida_texto" VARCHAR(8),
    "data_saida_suspeita" BOOLEAN NOT NULL DEFAULT false,
    "codigo_cliente_legado" INTEGER,
    "cliente_id" UUID,
    "cliente_nome" VARCHAR(60) NOT NULL,
    "nome_destruido" BOOLEAN NOT NULL DEFAULT false,
    "telefone" VARCHAR(20) NOT NULL,
    "situacao" VARCHAR(40) NOT NULL,
    "texto" TEXT NOT NULL,
    "valor_produtos" DECIMAL(12,4) NOT NULL,
    "valor_servicos" DECIMAL(12,4) NOT NULL,
    "mao_de_obra" DECIMAL(12,4) NOT NULL,
    "deslocamento" DECIMAL(12,4) NOT NULL,
    "desconto" DECIMAL(12,4) NOT NULL,
    "total" DECIMAL(12,4) NOT NULL,
    "forma" VARCHAR(20) NOT NULL,
    "responsavel" VARCHAR(40) NOT NULL,
    "usuario" VARCHAR(20) NOT NULL,
    "importado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordem_legado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordem_legado_empresa_id_data_entrada_idx" ON "ordem_legado"("empresa_id", "data_entrada");

-- CreateIndex
CREATE INDEX "ordem_legado_empresa_id_cliente_id_idx" ON "ordem_legado"("empresa_id", "cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordem_legado_empresa_id_numero_key" ON "ordem_legado"("empresa_id", "numero");

-- AddForeignKey
ALTER TABLE "ordem_legado" ADD CONSTRAINT "ordem_legado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_legado" ADD CONSTRAINT "ordem_legado_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

