-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "analytics";

-- CreateEnum
CREATE TYPE "public"."MembershipRole" AS ENUM ('OWNER', 'FINANCEIRO', 'ANALISTA');

-- CreateEnum
CREATE TYPE "public"."AuditAcao" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'BAIXA', 'ESTORNO_SOLICITADO', 'ESTORNO_APROVADO', 'ESTORNO_REJEITADO');

-- CreateEnum
CREATE TYPE "public"."CategoriaTipo" AS ENUM ('RECEITA', 'CUSTO', 'DESPESA');

-- CreateEnum
CREATE TYPE "public"."ClienteFornecedorTipo" AS ENUM ('CLIENTE', 'FORNECEDOR', 'AMBOS');

-- CreateEnum
CREATE TYPE "public"."ContaBancariaOrigem" AS ENUM ('MANUAL', 'PLUGGY');

-- CreateEnum
CREATE TYPE "public"."ContaBancariaTipo" AS ENUM ('CORRENTE', 'POUPANCA', 'CAIXA', 'CARTAO_CREDITO');

-- CreateEnum
CREATE TYPE "public"."BankProvider" AS ENUM ('PLUGGY');

-- CreateEnum
CREATE TYPE "public"."BankConnectionStatus" AS ENUM ('SYNCING', 'ACTIVE', 'LOGIN_ERROR', 'SYNC_ERROR', 'NEEDS_USER_INPUT', 'CONSENT_EXPIRED', 'CONSENT_REVOKED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."TransacaoBancariaStatus" AS ENUM ('PENDENTE', 'CONCILIADA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "public"."ConciliacaoSugestaoStatus" AS ENUM ('PENDENTE', 'CONFIRMADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "public"."RegraCategorizacaoMatch" AS ENUM ('CONTEM', 'REGEX', 'FAVORECIDO_EXATO');

-- CreateEnum
CREATE TYPE "public"."TituloTipo" AS ENUM ('PAGAR', 'RECEBER');

-- CreateEnum
CREATE TYPE "public"."TituloStatus" AS ENUM ('ABERTO', 'PARCIAL', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "public"."RecorrenciaPeriodicidade" AS ENUM ('MENSAL', 'SEMANAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "public"."EstornoStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "public"."InsumoMovimentoTipo" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "public"."AlertaTipo" AS ENUM ('SALDO_PROJETADO_NEGATIVO', 'DESPESA_FORA_DO_PADRAO', 'TITULO_VENCIDO', 'INSUMO_ABAIXO_DO_MINIMO', 'CONSENTIMENTO_EXPIRANDO', 'CONEXAO_BANCARIA_COM_ERRO');

-- CreateTable
CREATE TABLE "public"."empresas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "toleranciaInadimplenciaDias" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "role" "public"."MembershipRole" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeMembershipId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" "public"."AuditAcao" NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categoria_templates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "public"."CategoriaTipo" NOT NULL,
    "parentTemplateId" TEXT,

    CONSTRAINT "categoria_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categorias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "public"."CategoriaTipo" NOT NULL,
    "parentId" TEXT,
    "origemTemplateId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."centros_custo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clientes_fornecedores" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "tipo" "public"."ClienteFornecedorTipo" NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "clientes_fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contas_bancarias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "public"."ContaBancariaTipo" NOT NULL,
    "origem" "public"."ContaBancariaOrigem" NOT NULL,
    "saldoAtual" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_connections" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "provider" "public"."BankProvider" NOT NULL DEFAULT 'PLUGGY',
    "providerItemId" TEXT NOT NULL,
    "status" "public"."BankConnectionStatus" NOT NULL DEFAULT 'SYNCING',
    "requiresManualReauth" BOOLEAN NOT NULL DEFAULT false,
    "consentExpiresAt" TIMESTAMP(3),
    "consentRevokedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_account_links" (
    "id" TEXT NOT NULL,
    "bankConnectionId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "contaBancariaId" TEXT NOT NULL,

    CONSTRAINT "bank_account_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transacoes_bancarias" (
    "id" TEXT NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "dedupHash" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "descricao" TEXT NOT NULL,
    "descricaoNormalizada" TEXT NOT NULL,
    "categoriaSugeridaId" TEXT,
    "categoriaId" TEXT,
    "status" "public"."TransacaoBancariaStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacoes_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conciliacao_sugestoes" (
    "id" TEXT NOT NULL,
    "transacaoBancariaId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "score" DECIMAL(5,4) NOT NULL,
    "status" "public"."ConciliacaoSugestaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "conciliacao_sugestoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."regras_categorizacao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "padrao" TEXT NOT NULL,
    "tipoMatch" "public"."RegraCategorizacaoMatch" NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "regras_categorizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recorrencias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "periodicidade" "public"."RecorrenciaPeriodicidade" NOT NULL,
    "diaReferencia" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "valor" DECIMAL(18,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."titulos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "public"."TituloTipo" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorOriginal" DECIMAL(18,2) NOT NULL,
    "saldoAberto" DECIMAL(18,2) NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "centroCustoId" TEXT,
    "clienteFornecedorId" TEXT,
    "contaBancariaPrevistaId" TEXT,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "status" "public"."TituloStatus" NOT NULL DEFAULT 'ABERTO',
    "recorrenciaId" TEXT,
    "parcelaAtual" INTEGER,
    "parcelaTotal" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "titulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."baixas" (
    "id" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "valorPago" DECIMAL(18,2) NOT NULL,
    "juros" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "multa" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "data" TIMESTAMP(3) NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "transacaoBancariaId" TEXT,
    "criadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estornadaEm" TIMESTAMP(3),

    CONSTRAINT "baixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."estorno_solicitacoes" (
    "id" TEXT NOT NULL,
    "baixaId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "solicitadoPor" TEXT NOT NULL,
    "status" "public"."EstornoStatus" NOT NULL DEFAULT 'PENDENTE',
    "aprovadoPor" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estorno_solicitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anexos" (
    "id" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "enviadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."unidades_medida" (
    "id" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "unidades_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."insumos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidadeMedidaBaseId" TEXT NOT NULL,
    "estoqueMinimo" DECIMAL(18,4) NOT NULL,
    "estoqueAtual" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "custoMedioPonderado" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fatores_conversao_unidade" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "unidadeMedidaId" TEXT NOT NULL,
    "fator" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "fatores_conversao_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."insumo_movimentos" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "public"."InsumoMovimentoTipo" NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "unidadeMedidaId" TEXT NOT NULL,
    "quantidadeConvertida" DECIMAL(18,4) NOT NULL,
    "centroCustoId" TEXT NOT NULL,
    "custoUnitario" DECIMAL(18,4),
    "tituloId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insumo_movimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alerta_configs" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "public"."AlertaTipo" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "parametros" JSONB NOT NULL,

    CONSTRAINT "alerta_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alertas_disparados" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "public"."AlertaTipo" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "contexto" JSONB NOT NULL,
    "lidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_disparados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."dim_tempo" (
    "data" DATE NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "diaDaSemana" INTEGER NOT NULL,
    "nomeMes" TEXT NOT NULL,
    "ehFeriado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dim_tempo_pkey" PRIMARY KEY ("data")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_documento_key" ON "public"."empresas"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_empresaId_key" ON "public"."memberships"("userId", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_refreshTokenHash_key" ON "public"."refresh_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "audit_logs_empresaId_entidade_entidadeId_idx" ON "public"."audit_logs"("empresaId", "entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "categorias_empresaId_idx" ON "public"."categorias"("empresaId");

-- CreateIndex
CREATE INDEX "centros_custo_empresaId_idx" ON "public"."centros_custo"("empresaId");

-- CreateIndex
CREATE INDEX "clientes_fornecedores_empresaId_idx" ON "public"."clientes_fornecedores"("empresaId");

-- CreateIndex
CREATE INDEX "contas_bancarias_empresaId_idx" ON "public"."contas_bancarias"("empresaId");

-- CreateIndex
CREATE INDEX "bank_connections_empresaId_idx" ON "public"."bank_connections"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_connections_provider_providerItemId_key" ON "public"."bank_connections"("provider", "providerItemId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_links_contaBancariaId_key" ON "public"."bank_account_links"("contaBancariaId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_links_bankConnectionId_providerAccountId_key" ON "public"."bank_account_links"("bankConnectionId", "providerAccountId");

-- CreateIndex
CREATE INDEX "transacoes_bancarias_contaBancariaId_status_idx" ON "public"."transacoes_bancarias"("contaBancariaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transacoes_bancarias_contaBancariaId_providerTransactionId_key" ON "public"."transacoes_bancarias"("contaBancariaId", "providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "transacoes_bancarias_contaBancariaId_dedupHash_key" ON "public"."transacoes_bancarias"("contaBancariaId", "dedupHash");

-- CreateIndex
CREATE INDEX "conciliacao_sugestoes_transacaoBancariaId_status_idx" ON "public"."conciliacao_sugestoes"("transacaoBancariaId", "status");

-- CreateIndex
CREATE INDEX "conciliacao_sugestoes_tituloId_status_idx" ON "public"."conciliacao_sugestoes"("tituloId", "status");

-- CreateIndex
CREATE INDEX "regras_categorizacao_empresaId_ativo_idx" ON "public"."regras_categorizacao"("empresaId", "ativo");

-- CreateIndex
CREATE INDEX "titulos_empresaId_status_dataVencimento_idx" ON "public"."titulos"("empresaId", "status", "dataVencimento");

-- CreateIndex
CREATE UNIQUE INDEX "baixas_transacaoBancariaId_key" ON "public"."baixas"("transacaoBancariaId");

-- CreateIndex
CREATE INDEX "baixas_tituloId_idx" ON "public"."baixas"("tituloId");

-- CreateIndex
CREATE UNIQUE INDEX "estorno_solicitacoes_baixaId_key" ON "public"."estorno_solicitacoes"("baixaId");

-- CreateIndex
CREATE INDEX "anexos_tituloId_idx" ON "public"."anexos"("tituloId");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_sigla_key" ON "public"."unidades_medida"("sigla");

-- CreateIndex
CREATE INDEX "insumos_empresaId_idx" ON "public"."insumos"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "fatores_conversao_unidade_insumoId_unidadeMedidaId_key" ON "public"."fatores_conversao_unidade"("insumoId", "unidadeMedidaId");

-- CreateIndex
CREATE UNIQUE INDEX "insumo_movimentos_tituloId_key" ON "public"."insumo_movimentos"("tituloId");

-- CreateIndex
CREATE INDEX "insumo_movimentos_insumoId_data_idx" ON "public"."insumo_movimentos"("insumoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "alerta_configs_empresaId_tipo_key" ON "public"."alerta_configs"("empresaId", "tipo");

-- CreateIndex
CREATE INDEX "alertas_disparados_empresaId_lidoEm_idx" ON "public"."alertas_disparados"("empresaId", "lidoEm");

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_sessions" ADD CONSTRAINT "refresh_sessions_activeMembershipId_fkey" FOREIGN KEY ("activeMembershipId") REFERENCES "public"."memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categoria_templates" ADD CONSTRAINT "categoria_templates_parentTemplateId_fkey" FOREIGN KEY ("parentTemplateId") REFERENCES "public"."categoria_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categorias" ADD CONSTRAINT "categorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categorias" ADD CONSTRAINT "categorias_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."centros_custo" ADD CONSTRAINT "centros_custo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clientes_fornecedores" ADD CONSTRAINT "clientes_fornecedores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contas_bancarias" ADD CONSTRAINT "contas_bancarias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bank_connections" ADD CONSTRAINT "bank_connections_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bank_account_links" ADD CONSTRAINT "bank_account_links_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "public"."bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bank_account_links" ADD CONSTRAINT "bank_account_links_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "public"."contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transacoes_bancarias" ADD CONSTRAINT "transacoes_bancarias_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "public"."contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transacoes_bancarias" ADD CONSTRAINT "transacoes_bancarias_categoriaSugeridaId_fkey" FOREIGN KEY ("categoriaSugeridaId") REFERENCES "public"."categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transacoes_bancarias" ADD CONSTRAINT "transacoes_bancarias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conciliacao_sugestoes" ADD CONSTRAINT "conciliacao_sugestoes_transacaoBancariaId_fkey" FOREIGN KEY ("transacaoBancariaId") REFERENCES "public"."transacoes_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conciliacao_sugestoes" ADD CONSTRAINT "conciliacao_sugestoes_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "public"."titulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."regras_categorizacao" ADD CONSTRAINT "regras_categorizacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."regras_categorizacao" ADD CONSTRAINT "regras_categorizacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."titulos" ADD CONSTRAINT "titulos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."titulos" ADD CONSTRAINT "titulos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."titulos" ADD CONSTRAINT "titulos_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "public"."centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."titulos" ADD CONSTRAINT "titulos_clienteFornecedorId_fkey" FOREIGN KEY ("clienteFornecedorId") REFERENCES "public"."clientes_fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."titulos" ADD CONSTRAINT "titulos_contaBancariaPrevistaId_fkey" FOREIGN KEY ("contaBancariaPrevistaId") REFERENCES "public"."contas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."titulos" ADD CONSTRAINT "titulos_recorrenciaId_fkey" FOREIGN KEY ("recorrenciaId") REFERENCES "public"."recorrencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."baixas" ADD CONSTRAINT "baixas_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "public"."titulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."baixas" ADD CONSTRAINT "baixas_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "public"."contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."baixas" ADD CONSTRAINT "baixas_transacaoBancariaId_fkey" FOREIGN KEY ("transacaoBancariaId") REFERENCES "public"."transacoes_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."estorno_solicitacoes" ADD CONSTRAINT "estorno_solicitacoes_baixaId_fkey" FOREIGN KEY ("baixaId") REFERENCES "public"."baixas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anexos" ADD CONSTRAINT "anexos_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "public"."titulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."insumos" ADD CONSTRAINT "insumos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."insumos" ADD CONSTRAINT "insumos_unidadeMedidaBaseId_fkey" FOREIGN KEY ("unidadeMedidaBaseId") REFERENCES "public"."unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fatores_conversao_unidade" ADD CONSTRAINT "fatores_conversao_unidade_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "public"."insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fatores_conversao_unidade" ADD CONSTRAINT "fatores_conversao_unidade_unidadeMedidaId_fkey" FOREIGN KEY ("unidadeMedidaId") REFERENCES "public"."unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."insumo_movimentos" ADD CONSTRAINT "insumo_movimentos_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "public"."insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."insumo_movimentos" ADD CONSTRAINT "insumo_movimentos_unidadeMedidaId_fkey" FOREIGN KEY ("unidadeMedidaId") REFERENCES "public"."unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."insumo_movimentos" ADD CONSTRAINT "insumo_movimentos_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "public"."centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."insumo_movimentos" ADD CONSTRAINT "insumo_movimentos_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "public"."titulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alerta_configs" ADD CONSTRAINT "alerta_configs_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alertas_disparados" ADD CONSTRAINT "alertas_disparados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
