-- AlterTable
ALTER TABLE "empresa" ADD COLUMN     "bairro" VARCHAR(60),
ADD COLUMN     "cep" VARCHAR(9),
ADD COLUMN     "cidade" VARCHAR(60),
ADD COLUMN     "cnpj" VARCHAR(14),
ADD COLUMN     "endereco" VARCHAR(160),
ADD COLUMN     "nome_fantasia" VARCHAR(80),
ADD COLUMN     "telefone_1" VARCHAR(11),
ADD COLUMN     "telefone_2" VARCHAR(11),
ADD COLUMN     "uf" VARCHAR(2);

