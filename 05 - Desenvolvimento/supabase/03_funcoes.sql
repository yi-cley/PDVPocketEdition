-- =====================================================================
-- PDV de Bolso · Supabase · 03 Funções e views
-- As regras de negócio que precisam de mais de uma tabela ficam aqui,
-- dentro de uma transação: ou grava tudo, ou não grava nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- registrar_venda: o caixa envia a venda (feita online ou offline).
-- Formato do parâmetro (o mesmo objeto que o protótipo guarda):
-- {
--   "id": "uuid gerado no caixa",           RN-09
--   "numero_local": 12,
--   "caixa_id": "uuid do turno",             RN-01
--   "feita_em": "2026-11-26T10:15:00-03:00",
--   "itens": [ {"codigo": "7891025101106", "qtd": 2, "preco": 5.49} ],
--   "pagamentos": [ {"forma": "pix", "valor": 10}, {"forma": "dinheiro", "valor": 20} ]
-- }
-- Se a mesma venda chegar duas vezes, a segunda é ignorada (RNF-05).
-- ---------------------------------------------------------------------
create or replace function public.registrar_venda(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id        uuid := (p ->> 'id')::uuid;
  v_caixa     uuid := (p ->> 'caixa_id')::uuid;
  v_feita     timestamptz := coalesce((p ->> 'feita_em')::timestamptz, now());
  v_total     numeric(10,2);
  v_recebido  numeric(10,2);
  v_nao_din   numeric(10,2);
  v_numero    bigint;
  v_item      jsonb;
  v_prod      public.produtos%rowtype;
  v_saldo     integer;
begin
  if public.meu_perfil() not in ('admin', 'operador') or public.meu_perfil() is null then
    raise exception 'Seu perfil não pode registrar vendas.';                       -- RNF-07
  end if;
  if v_id is null then
    raise exception 'A venda precisa do id gerado no caixa (RN-09).';
  end if;

  -- Venda repetida (reenvio da fila): devolve a que já existe, sem duplicar (RNF-05)
  select numero into v_numero from public.vendas where id = v_id;
  if found then
    return jsonb_build_object('id', v_id, 'numero', v_numero, 'duplicada', true);
  end if;

  -- RN-01: o caixa precisa ser do operador e estar aberto na hora da venda
  if not exists (
    select 1 from public.caixas c
    where c.id = v_caixa and c.operador_id = auth.uid()
      and v_feita >= c.aberto_em and (c.fechado_em is null or v_feita <= c.fechado_em)
  ) then
    raise exception 'Não existe caixa aberto deste operador na hora da venda (RN-01).';
  end if;

  if jsonb_array_length(coalesce(p -> 'itens', '[]'::jsonb)) = 0 then
    raise exception 'A venda não tem itens.';
  end if;
  if jsonb_array_length(coalesce(p -> 'pagamentos', '[]'::jsonb)) = 0 then
    raise exception 'A venda não tem pagamento (RF-08).';
  end if;

  select round(sum((i ->> 'preco')::numeric * (i ->> 'qtd')::integer), 2)
    into v_total from jsonb_array_elements(p -> 'itens') i;
  select round(sum((g ->> 'valor')::numeric), 2),
         round(coalesce(sum((g ->> 'valor')::numeric) filter (where g ->> 'forma' <> 'dinheiro'), 0), 2)
    into v_recebido, v_nao_din
    from jsonb_array_elements(p -> 'pagamentos') g;

  if v_recebido < v_total then
    raise exception 'Pagamento menor que o total: falta R$ % (RN-03).', v_total - v_recebido;
  end if;
  if v_nao_din > v_total then
    raise exception 'PIX e cartão não podem passar do total; só o dinheiro gera troco (RF-09, RN-04).';
  end if;

  -- Grava a venda. "on conflict" cobre dois envios ao mesmo tempo (RNF-05).
  insert into public.vendas (id, numero_local, caixa_id, operador_id, feita_em, total, recebido, troco)
  values (v_id, (p ->> 'numero_local')::integer, v_caixa, auth.uid(), v_feita,
          v_total, v_recebido, v_recebido - v_total)
  on conflict (id) do nothing
  returning numero into v_numero;
  if v_numero is null then
    select numero into v_numero from public.vendas where id = v_id;
    return jsonb_build_object('id', v_id, 'numero', v_numero, 'duplicada', true);
  end if;

  for v_item in select * from jsonb_array_elements(p -> 'itens') loop
    select * into v_prod from public.produtos where codigo = v_item ->> 'codigo';
    if not found then
      raise exception 'Produto % não cadastrado.', v_item ->> 'codigo';
    end if;

    insert into public.venda_itens (venda_id, produto_id, codigo, nome, preco, qtd)
    values (v_id, v_prod.id, v_prod.codigo, v_prod.nome,
            (v_item ->> 'preco')::numeric, (v_item ->> 'qtd')::integer);

    insert into public.movimentacoes (produto_id, tipo, qtd, motivo, venda_id, usuario_id, feita_em)
    values (v_prod.id, 'venda', -((v_item ->> 'qtd')::integer),
            'Venda nº ' || v_numero, v_id, auth.uid(), v_feita);                      -- RF-11

    -- RN-02 bloqueia no caixa. Se uma venda offline deixar o saldo negativo
    -- (dois caixas vendendo o último item), o servidor aceita, porque a venda
    -- já aconteceu (RN-08), e registra o conflito para o admin ver (RF-36).
    select coalesce(sum(m.qtd), 0) into v_saldo from public.movimentacoes m where m.produto_id = v_prod.id;
    if v_saldo < 0 then
      insert into public.sync_log (tipo, descricao, valor_servidor, resolucao)
      values ('conflito',
              'Saldo negativo de ' || v_prod.nome || ' depois da venda nº ' || v_numero,
              jsonb_build_object('saldo', v_saldo),
              'Venda mantida (RN-08). Conferir a prateleira e lançar um ajuste de contagem.');
    end if;
  end loop;

  insert into public.venda_pagamentos (venda_id, forma, valor)
  select v_id, (g ->> 'forma')::public.forma_pagamento, (g ->> 'valor')::numeric
  from jsonb_array_elements(p -> 'pagamentos') g;

  return jsonb_build_object('id', v_id, 'numero', v_numero, 'total', v_total,
                            'troco', v_recebido - v_total, 'duplicada', false);
end $$;

-- ---------------------------------------------------------------------
-- Senha do supervisor (RF-39, RN-10). Guardada com hash bcrypt.
-- ---------------------------------------------------------------------
create or replace function public.definir_senha_supervisor(p_senha text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.meu_perfil() is distinct from 'admin' then
    raise exception 'Só o administrador define a senha do supervisor.';
  end if;
  if length(coalesce(p_senha, '')) < 4 then
    raise exception 'A senha precisa de pelo menos 4 caracteres.';
  end if;
  update public.configuracoes
     set senha_supervisor_hash = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         atualizada_em = now();
end $$;

-- Confere a senha no servidor e já registra a tentativa (RN-10).
create or replace function public.autorizar(p_acao text, p_senha text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text;
  v_ok   boolean;
begin
  if public.meu_perfil() not in ('admin', 'operador') or public.meu_perfil() is null then
    raise exception 'Seu perfil não pede autorização no caixa.';
  end if;
  select senha_supervisor_hash into v_hash from public.configuracoes;
  v_ok := v_hash is not null and extensions.crypt(coalesce(p_senha, ''), v_hash) = v_hash;
  insert into public.autorizacoes (operador_id, acao, autorizada) values (auth.uid(), p_acao, v_ok);
  return v_ok;
end $$;

-- ---------------------------------------------------------------------
-- Conferência de cada item vendido (RF-17, RF-36). A venda NÃO é recusada,
-- porque já aconteceu e o cliente já pagou (RN-08). Mas preço diferente do
-- cadastro ou produto inativo vira um conflito no sync_log para o admin.
-- ---------------------------------------------------------------------
create or replace function public.conferir_item_vendido()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_prod public.produtos%rowtype;
begin
  select * into v_prod from public.produtos where id = new.produto_id;
  if new.preco <> v_prod.preco then
    insert into public.sync_log (tipo, descricao, valor_local, valor_servidor, resolucao)
    values ('conflito', 'Preço diferente do cadastro em ' || v_prod.nome,
            jsonb_build_object('preco_vendido', new.preco, 'venda_id', new.venda_id),
            jsonb_build_object('preco_cadastro', v_prod.preco),
            'Venda mantida com o preço cobrado. Conferir se o preço mudou ou se foi alterado no caixa.');
  end if;
  if not v_prod.ativo then
    insert into public.sync_log (tipo, descricao, valor_local, resolucao)
    values ('conflito', 'Venda de produto inativo: ' || v_prod.nome,
            jsonb_build_object('venda_id', new.venda_id),
            'Venda mantida. Conferir se o produto foi inativado durante a venda.');
  end if;
  return new;
end $$;

create trigger venda_itens_conferir
  after insert on public.venda_itens
  for each row execute function public.conferir_item_vendido();

-- Ajuste não pode deixar o saldo negativo (RF-21).
create or replace function public.ajuste_sem_saldo_negativo()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_saldo integer;
begin
  if new.tipo = 'ajuste' then
    select coalesce(sum(qtd), 0) into v_saldo from public.movimentacoes where produto_id = new.produto_id;
    if v_saldo < 0 then
      raise exception 'O ajuste deixaria o saldo em % unidades. Informe a quantidade contada na prateleira.', v_saldo;
    end if;
  end if;
  return new;
end $$;

create trigger movimentacoes_ajuste_sem_negativo
  after insert on public.movimentacoes
  for each row execute function public.ajuste_sem_saldo_negativo();

-- ---------------------------------------------------------------------
-- Resumo do turno para o fechamento do caixa (RF-16)
-- ---------------------------------------------------------------------
create or replace function public.resumo_turno(p_caixa uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with v as (
    select * from public.vendas where caixa_id = p_caixa
  ), f as (
    select g.forma, sum(g.valor) as valor
    from public.venda_pagamentos g join v on v.id = g.venda_id group by g.forma
  )
  select jsonb_build_object(
    'vendas', (select count(*) from v),
    'total', coalesce((select sum(total) from v), 0),
    'dinheiro', coalesce((select valor from f where forma = 'dinheiro'), 0) - coalesce((select sum(troco) from v), 0),
    'pix', coalesce((select valor from f where forma = 'pix'), 0),
    'debito', coalesce((select valor from f where forma = 'debito'), 0),
    'credito', coalesce((select valor from f where forma = 'credito'), 0),
    'esperado_em_dinheiro',
      (select valor_inicial from public.caixas where id = p_caixa)
      + coalesce((select valor from f where forma = 'dinheiro'), 0) - coalesce((select sum(troco) from v), 0)
  )
$$;

-- ---------------------------------------------------------------------
-- Views para Estoque e Administração. "security_invoker" faz o RLS
-- valer também aqui: o operador só enxerga as próprias vendas.
-- O fuso é o do Ceará, onde estão os comerciantes ouvidos.
-- ---------------------------------------------------------------------
create view public.produtos_saldo with (security_invoker = true) as        -- RF-20, RF-24, RN-06, RN-08
select p.id, p.codigo, p.nome, p.categoria, p.preco, p.minimo, p.local, p.ativo,
       coalesce(sum(m.qtd), 0)::integer as saldo,
       case when not p.ativo                     then 'inativo'
            when coalesce(sum(m.qtd), 0) <= 0       then 'zerado'
            when coalesce(sum(m.qtd), 0) <= p.minimo then 'baixo'
            else 'normal' end as situacao
from public.produtos p
left join public.movimentacoes m on m.produto_id = p.id
group by p.id;

create view public.vendas_por_dia with (security_invoker = true) as        -- RF-27, RF-29
select (v.feita_em at time zone 'America/Fortaleza')::date as dia,
       v.operador_id,
       count(*) as vendas,
       sum(v.total) as total
from public.vendas v
group by 1, 2;

create view public.pagamentos_por_dia with (security_invoker = true) as    -- RF-25, RF-28
select (v.feita_em at time zone 'America/Fortaleza')::date as dia,
       v.operador_id, g.forma,
       count(distinct v.id) as vendas,
       sum(g.valor) as valor
from public.vendas v
join public.venda_pagamentos g on g.venda_id = v.id
group by 1, 2, 3;

create view public.produtos_vendidos_por_dia with (security_invoker = true) as  -- RF-30
select (v.feita_em at time zone 'America/Fortaleza')::date as dia,
       i.produto_id, i.nome,
       sum(i.qtd) as unidades,
       sum(i.subtotal) as valor
from public.vendas v
join public.venda_itens i on i.venda_id = v.id
group by 1, 2, 3;

-- ---------------------------------------------------------------------
-- Permissões das funções: só usuário logado chama.
-- ---------------------------------------------------------------------
revoke execute on function public.registrar_venda(jsonb)            from public, anon;
revoke execute on function public.definir_senha_supervisor(text)    from public, anon;
revoke execute on function public.autorizar(text, text)             from public, anon;
revoke execute on function public.resumo_turno(uuid)                from public, anon;
grant  execute on function public.registrar_venda(jsonb)            to authenticated;
grant  execute on function public.definir_senha_supervisor(text)    to authenticated;
grant  execute on function public.autorizar(text, text)             to authenticated;
grant  execute on function public.resumo_turno(uuid)                to authenticated;
revoke execute on function public.conferir_item_vendido()           from public, anon, authenticated;
revoke execute on function public.ajuste_sem_saldo_negativo()       from public, anon, authenticated;
revoke all on public.produtos_saldo, public.vendas_por_dia,
              public.pagamentos_por_dia, public.produtos_vendidos_por_dia from anon;

-- ---------------------------------------------------------------------
-- RF-35: avisar os outros aparelhos quando algo mudar (Supabase Realtime)
-- ---------------------------------------------------------------------
alter publication supabase_realtime
  add table public.produtos, public.movimentacoes, public.vendas;
