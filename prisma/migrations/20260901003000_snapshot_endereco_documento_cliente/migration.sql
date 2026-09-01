-- O documento do cliente era lido da relacao viva na hora de imprimir, e o resto
-- do cadastro (nome, apelido, telefone) ja era congelado na ordem. Uma ordem
-- antiga saia com o nome de antes e o documento de agora, na mesma folha.
--
-- O endereco entra junto porque nesta loja ele E o endereco do servico: o
-- produtor tem um cadastro por fazenda justamente para isso, e a folha que vai
-- para a bancada precisa dizer para onde o servico vai.
ALTER TABLE "ordem_servico" ADD COLUMN "cliente_documento" VARCHAR(14);
ALTER TABLE "ordem_servico" ADD COLUMN "cliente_endereco" VARCHAR(160);
ALTER TABLE "ordem_servico" ADD COLUMN "cliente_bairro" VARCHAR(60);
ALTER TABLE "ordem_servico" ADD COLUMN "cliente_cidade" VARCHAR(60);
ALTER TABLE "ordem_servico" ADD COLUMN "cliente_uf" VARCHAR(2);
ALTER TABLE "ordem_servico" ADD COLUMN "cliente_cep" VARCHAR(9);

-- Ordens que ja existem: copia o cadastro de hoje. Nao e o endereco "daquele
-- dia" -- esse dado nunca foi guardado e nao da para inventar --, mas e o unico
-- que existe, e imprimir o endereco de hoje e melhor que imprimir nenhum. Daqui
-- para frente o valor e congelado na hora de escolher o cliente.
UPDATE "ordem_servico" o
SET "cliente_documento" = c."documento",
    "cliente_endereco"  = c."endereco",
    "cliente_bairro"    = c."bairro",
    "cliente_cidade"    = c."cidade",
    "cliente_uf"        = c."uf",
    "cliente_cep"       = c."cep"
FROM "cliente" c
WHERE o."cliente_id" = c."id";
