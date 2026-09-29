-- Row-Level Security multiempresa — ver docs/adr/0002-multi-tenancy-isolation.md
--
-- Convenção: a aplicação roda `SELECT set_config('app.current_empresa_id', $1, true)`
-- (true = escopo LOCAL, dura só a transação) no início de toda transação de
-- request autenticado, antes de qualquer query. As policies abaixo comparam
-- contra esse valor.
--
-- `current_setting(..., true)` com o segundo argumento `true` faz retornar
-- NULL em vez de lançar erro quando a variável não foi setada (ex.: uma
-- conexão administrativa/migration) — nesse caso a comparação com uma coluna
-- UUID nunca é verdadeira e a policy simplesmente não libera nenhuma linha,
-- em vez de quebrar a query.
--
-- FORCE ROW LEVEL SECURITY: garante que a policy vale mesmo para o dono da
-- tabela — sem isso, RLS não se aplicaria à própria role usada pela
-- aplicação se ela for a mesma que roda as migrations.
--
-- Tabelas de identidade (empresas, users, memberships, refresh_sessions) NÃO
-- usam RLS por current_empresa_id de propósito: o acesso a elas é inerentemente
-- "o que é meu" (minhas empresas, minhas sessões), não "o que pertence à
-- empresa ativa" — são filtradas na camada de serviço por userId, não por
-- tenant. RLS aqui é para dado operacional/financeiro, que é sempre 100%
-- de uma única empresa.

-- Tabelas com empresaId direto: policy simples.
DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'categorias',
    'centros_custo',
    'clientes_fornecedores',
    'contas_bancarias',
    'bank_connections',
    'titulos',
    'recorrencias',
    'insumos',
    'regras_categorizacao',
    'audit_logs',
    'alerta_configs',
    'alertas_disparados'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabela);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("empresaId" = current_setting(''app.current_empresa_id'', true)) WITH CHECK ("empresaId" = current_setting(''app.current_empresa_id'', true))',
      tabela
    );
  END LOOP;
END $$;

-- Tabelas sem empresaId direto: policy via subquery até a tabela-pai que já
-- tem empresaId (e já está protegida acima).

ALTER TABLE "transacoes_bancarias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transacoes_bancarias" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "transacoes_bancarias"
  USING (EXISTS (
    SELECT 1 FROM "contas_bancarias" cb
    WHERE cb.id = "transacoes_bancarias"."contaBancariaId"
      AND cb."empresaId" = current_setting('app.current_empresa_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "contas_bancarias" cb
    WHERE cb.id = "transacoes_bancarias"."contaBancariaId"
      AND cb."empresaId" = current_setting('app.current_empresa_id', true)
  ));

ALTER TABLE "bank_account_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_account_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bank_account_links"
  USING (EXISTS (
    SELECT 1 FROM "bank_connections" bc
    WHERE bc.id = "bank_account_links"."bankConnectionId"
      AND bc."empresaId" = current_setting('app.current_empresa_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "bank_connections" bc
    WHERE bc.id = "bank_account_links"."bankConnectionId"
      AND bc."empresaId" = current_setting('app.current_empresa_id', true)
  ));

ALTER TABLE "baixas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "baixas" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "baixas"
  USING (EXISTS (
    SELECT 1 FROM "titulos" t
    WHERE t.id = "baixas"."tituloId"
      AND t."empresaId" = current_setting('app.current_empresa_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "titulos" t
    WHERE t.id = "baixas"."tituloId"
      AND t."empresaId" = current_setting('app.current_empresa_id', true)
  ));

ALTER TABLE "estorno_solicitacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estorno_solicitacoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "estorno_solicitacoes"
  USING (EXISTS (
    SELECT 1 FROM "baixas" b
    JOIN "titulos" t ON t.id = b."tituloId"
    WHERE b.id = "estorno_solicitacoes"."baixaId"
      AND t."empresaId" = current_setting('app.current_empresa_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "baixas" b
    JOIN "titulos" t ON t.id = b."tituloId"
    WHERE b.id = "estorno_solicitacoes"."baixaId"
      AND t."empresaId" = current_setting('app.current_empresa_id', true)
  ));

ALTER TABLE "anexos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "anexos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "anexos"
  USING (EXISTS (
    SELECT 1 FROM "titulos" t
    WHERE t.id = "anexos"."tituloId"
      AND t."empresaId" = current_setting('app.current_empresa_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "titulos" t
    WHERE t.id = "anexos"."tituloId"
      AND t."empresaId" = current_setting('app.current_empresa_id', true)
  ));

ALTER TABLE "conciliacao_sugestoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conciliacao_sugestoes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "conciliacao_sugestoes"
  USING (EXISTS (
    SELECT 1 FROM "titulos" t
    WHERE t.id = "conciliacao_sugestoes"."tituloId"
      AND t."empresaId" = current_setting('app.current_empresa_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "titulos" t
    WHERE t.id = "conciliacao_sugestoes"."tituloId"
      AND t."empresaId" = current_setting('app.current_empresa_id', true)
  ));

ALTER TABLE "insumo_movimentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "insumo_movimentos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "insumo_movimentos"
  USING (EXISTS (
    SELECT 1 FROM "insumos" i
    WHERE i.id = "insumo_movimentos"."insumoId"
      AND i."empresaId" = current_setting('app.current_empresa_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "insumos" i
    WHERE i.id = "insumo_movimentos"."insumoId"
      AND i."empresaId" = current_setting('app.current_empresa_id', true)
  ));

ALTER TABLE "fatores_conversao_unidade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fatores_conversao_unidade" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fatores_conversao_unidade"
  USING (EXISTS (
    SELECT 1 FROM "insumos" i
    WHERE i.id = "fatores_conversao_unidade"."insumoId"
      AND i."empresaId" = current_setting('app.current_empresa_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "insumos" i
    WHERE i.id = "fatores_conversao_unidade"."insumoId"
      AND i."empresaId" = current_setting('app.current_empresa_id', true)
  ));
