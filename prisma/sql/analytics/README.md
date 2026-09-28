# Camada analítica — SQL

Este diretório concentra o SQL nomeado da camada analítica (schema
`analytics`), conforme [ADR 0004](../../../docs/adr/0004-analytical-layer-modeling.md).
Cada arquivo é aplicado por uma migration Prisma (`migration.sql` chamando
estes arquivos via `\i` ou copiados no corpo da migration) e tem um teste de
integração correspondente em `apps/api/test/analytics/` rodando contra o seed
de 12 meses.

Convenção de nomes: `dim_*.sql` para dimensões (views simples), `fact_*.sql`
para fatos (materialized views, sempre com índice único para suportar
`REFRESH MATERIALIZED VIEW CONCURRENTLY`).

Os arquivos abaixo são o primeiro exemplo do padrão (implementados de fato na
Fase 6); os demais fatos/dimensões seguem a mesma estrutura.

- `dim_categoria.sql` — view com o `path` materializado da hierarquia de
  categorias, ex.: `"Despesas > Operacional > Aluguel"`.
- `fact_lancamento_realizado.sql` — grão: uma baixa. Regime de caixa. Base do
  fluxo de caixa realizado e do burn rate/runway.
