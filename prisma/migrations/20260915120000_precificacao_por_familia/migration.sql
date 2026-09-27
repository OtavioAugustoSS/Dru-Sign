-- AlterTable
ALTER TABLE "material" ADD COLUMN     "custo" DECIMAL(12,4),
ADD COLUMN     "familia_preco_id" UUID,
ADD COLUMN     "preco_travado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "familia_preco" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "unidade_padrao" "unidade_cobranca" NOT NULL,
    "margem" DECIMAL(6,2) NOT NULL,
    "arredondamento" DECIMAL(6,2) NOT NULL DEFAULT 0.01,
    "minimo_cobranca" DECIMAL(8,4),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "familia_preco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_preco" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "de" DECIMAL(12,4) NOT NULL,
    "para" DECIMAL(12,4) NOT NULL,
    "motivo" VARCHAR(80) NOT NULL,
    "usuario_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_preco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "familia_preco_empresa_id_nome_key" ON "familia_preco"("empresa_id", "nome");

-- CreateIndex
CREATE INDEX "historico_preco_material_id_criado_em_idx" ON "historico_preco"("material_id", "criado_em");

-- CreateIndex
CREATE INDEX "material_empresa_id_familia_preco_id_idx" ON "material"("empresa_id", "familia_preco_id");

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_familia_preco_id_fkey" FOREIGN KEY ("familia_preco_id") REFERENCES "familia_preco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "familia_preco" ADD CONSTRAINT "familia_preco_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_preco" ADD CONSTRAINT "historico_preco_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_preco" ADD CONSTRAINT "historico_preco_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_preco" ADD CONSTRAINT "historico_preco_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
