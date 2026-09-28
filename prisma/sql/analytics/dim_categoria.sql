-- Dimensão de categoria: expõe o plano de contas com o caminho hierárquico já
-- concatenado (evita recursão repetida em toda query analítica).
create or replace view analytics.dim_categoria as
with recursive arvore as (
  select
    c.id,
    c.empresa_id,
    c.nome,
    c.tipo,
    c.parent_id,
    c.nome::text as caminho
  from public.categorias c
  where c.parent_id is null

  union all

  select
    c.id,
    c.empresa_id,
    c.nome,
    c.tipo,
    c.parent_id,
    (a.caminho || ' > ' || c.nome)::text
  from public.categorias c
  join arvore a on c.parent_id = a.id
)
select
  id as categoria_key,
  empresa_id,
  nome,
  tipo,
  caminho
from arvore;
