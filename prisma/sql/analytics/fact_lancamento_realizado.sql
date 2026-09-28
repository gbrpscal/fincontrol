-- Fato de caixa realizado (grão: uma baixa). Regime de caixa — base do fluxo
-- de caixa realizado e do burn rate/runway (decisão confirmada: burn rate é
-- calculado sobre caixa realizado, não sobre o DRE por competência).
--
-- Índice único obrigatório em `baixa_id` para permitir REFRESH ... CONCURRENTLY
-- (ver docs/adr/0004-analytical-layer-modeling.md).
create materialized view analytics.fact_lancamento_realizado as
select
  b.id as baixa_id,
  t.empresa_id,
  b.data::date as data_key,
  t.categoria_id as categoria_key,
  t.centro_custo_id as centro_custo_key,
  b.conta_bancaria_id as conta_bancaria_key,
  t.cliente_fornecedor_id as cliente_fornecedor_key,
  t.tipo as titulo_tipo, -- PAGAR | RECEBER
  -- Fluxo de caixa: saída é negativa, entrada é positiva.
  case when t.tipo = 'PAGAR' then -(b.valor_pago + b.juros + b.multa - b.desconto)
       else (b.valor_pago + b.juros + b.multa - b.desconto)
  end as valor_liquido
from public.baixas b
join public.titulos t on t.id = b.titulo_id
where b.estornada_em is null
with data;

create unique index if not exists fact_lancamento_realizado_baixa_id_idx
  on analytics.fact_lancamento_realizado (baixa_id);

create index if not exists fact_lancamento_realizado_empresa_data_idx
  on analytics.fact_lancamento_realizado (empresa_id, data_key);
