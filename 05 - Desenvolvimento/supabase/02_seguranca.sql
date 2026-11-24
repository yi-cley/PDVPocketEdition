-- =====================================================================
-- PDV de Bolso · Supabase · 02 Segurança (perfis e RLS)
-- RNF-07: cada tela valida o perfil também no servidor. Aqui isso é
-- feito com Row Level Security: o banco recusa o que o perfil não pode.
-- =====================================================================

-- Perfil do usuário logado. Devolve null se ele estiver desativado,
-- e aí nenhuma regra abaixo libera nada (RF-31).
create or replace function public.meu_perfil()
returns public.perfil_usuario
language sql stable security definer set search_path = ''
as $$
  select p.perfil from public.perfis p where p.id = auth.uid() and p.ativo
$$;

-- Todo usuário criado no Supabase Auth ganha uma linha em perfis,
-- como Operador e DESATIVADO. O administrador ativa e escolhe o perfil.
-- O login é a parte do e-mail antes do @ (ana.souza@pdvdebolso.local -> ana.souza).
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, login)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
          lower(split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- O administrador não pode tirar o próprio perfil nem se desativar
-- (senão a loja fica sem ninguém para gerenciar usuários).
create or replace function public.proteger_proprio_admin()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id = auth.uid() and (new.perfil <> 'admin' or not new.ativo) then
    raise exception 'Você não pode tirar o seu próprio perfil de administrador nem se desativar.';
  end if;
  if new.login <> old.login then
    raise exception 'O login não pode ser alterado.';
  end if;
  return new;
end $$;

create trigger perfis_proteger_admin
  before update on public.perfis
  for each row execute function public.proteger_proprio_admin();

-- Data da última alteração do produto
create or replace function public.marcar_atualizacao_produto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), old.atualizado_por);
  return new;
end $$;

create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.marcar_atualizacao_produto();

-- Fechar o caixa só muda fechado_em, e só uma vez (RF-16).
create or replace function public.caixa_so_fecha()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.fechado_em is not null then
    raise exception 'Este caixa já foi fechado.';
  end if;
  if new.operador_id <> old.operador_id or new.aberto_em <> old.aberto_em
     or new.valor_inicial <> old.valor_inicial then
    raise exception 'Só é possível informar o fechamento do caixa.';
  end if;
  return new;
end $$;

create trigger caixas_so_fecha
  before update on public.caixas
  for each row execute function public.caixa_so_fecha();

-- ---------------------------------------------------------------------
-- Liga o RLS em todas as tabelas
-- ---------------------------------------------------------------------
alter table public.perfis           enable row level security;
alter table public.produtos         enable row level security;
alter table public.caixas           enable row level security;
alter table public.vendas           enable row level security;
alter table public.venda_itens      enable row level security;
alter table public.venda_pagamentos enable row level security;
alter table public.movimentacoes    enable row level security;
alter table public.autorizacoes     enable row level security;
alter table public.configuracoes    enable row level security;
alter table public.sync_log         enable row level security;

-- Perfis: cada um vê o seu; o administrador vê e edita todos (RF-31).
create policy "perfis: ver o próprio ou admin" on public.perfis
  for select to authenticated
  using (id = (select auth.uid()) or (select public.meu_perfil()) = 'admin');
create policy "perfis: admin edita" on public.perfis
  for update to authenticated
  using ((select public.meu_perfil()) = 'admin') with check ((select public.meu_perfil()) = 'admin');

-- Produtos: todo usuário ativo consulta (operador consulta o estoque);
-- só estoquista e admin cadastram e editam. Não existe apagar (inativar).
create policy "produtos: ativos consultam" on public.produtos
  for select to authenticated using ((select public.meu_perfil()) is not null);
create policy "produtos: estoque e admin cadastram" on public.produtos
  for insert to authenticated with check ((select public.meu_perfil()) in ('admin', 'estoque'));
create policy "produtos: estoque e admin editam" on public.produtos
  for update to authenticated
  using ((select public.meu_perfil()) in ('admin', 'estoque'))
  with check ((select public.meu_perfil()) in ('admin', 'estoque'));

-- Movimentações: todos consultam o histórico (RF-19). Estoquista e admin
-- lançam entrada e ajuste em nome próprio, só em produto ativo (RF-17, RF-18).
-- Venda só entra pela função do arquivo 03. Não há update nem delete.
create policy "movimentacoes: ativos consultam" on public.movimentacoes
  for select to authenticated using ((select public.meu_perfil()) is not null);
create policy "movimentacoes: entrada e ajuste" on public.movimentacoes
  for insert to authenticated
  with check ((select public.meu_perfil()) in ('admin', 'estoque')
              and tipo in ('entrada', 'ajuste')
              and usuario_id = (select auth.uid())
              and exists (select 1 from public.produtos p where p.id = produto_id and p.ativo));

-- Caixas: o operador abre e fecha o próprio; o admin vê todos.
create policy "caixas: ver o próprio ou admin" on public.caixas
  for select to authenticated
  using (operador_id = (select auth.uid()) or (select public.meu_perfil()) = 'admin');
create policy "caixas: abrir" on public.caixas
  for insert to authenticated
  with check ((select public.meu_perfil()) in ('admin', 'operador') and operador_id = (select auth.uid()));
create policy "caixas: fechar o próprio" on public.caixas
  for update to authenticated
  using (operador_id = (select auth.uid()) and (select public.meu_perfil()) in ('admin', 'operador'))
  with check (operador_id = (select auth.uid()));

-- Vendas: o operador vê as próprias (reemitir comprovante); o admin vê
-- todas (RF-25, RF-26). Ninguém grava direto: só pela função.
create policy "vendas: ver as próprias ou admin" on public.vendas
  for select to authenticated
  using ((select public.meu_perfil()) is not null
         and (operador_id = (select auth.uid()) or (select public.meu_perfil()) = 'admin'));
create policy "venda_itens: ver se vê a venda" on public.venda_itens
  for select to authenticated
  using (exists (select 1 from public.vendas v where v.id = venda_id));
create policy "venda_pagamentos: ver se vê a venda" on public.venda_pagamentos
  for select to authenticated
  using (exists (select 1 from public.vendas v where v.id = venda_id));

-- Autorizações (RN-10): só a função autorizar() grava (ninguém insere direto,
-- então não dá para registrar uma autorização "aprovada" sem a senha).
-- Só o admin lê o histórico.
create policy "autorizacoes: admin lê" on public.autorizacoes
  for select to authenticated using ((select public.meu_perfil()) = 'admin');

-- Configurações: só o admin lê. O hash da senha do supervisor não vai para
-- o caixa; a senha é conferida no servidor (RN-10). Só muda por função.
create policy "configuracoes: admin lê" on public.configuracoes
  for select to authenticated using ((select public.meu_perfil()) = 'admin');

-- Log de sincronização (RF-36): qualquer usuário ativo registra; admin lê.
create policy "sync_log: registrar" on public.sync_log
  for insert to authenticated
  with check ((select public.meu_perfil()) is not null and usuario_id = (select auth.uid()));
create policy "sync_log: admin lê" on public.sync_log
  for select to authenticated using ((select public.meu_perfil()) = 'admin');

-- Visitante sem login (anon) não acessa nada.
revoke all on all tables in schema public from anon;
revoke execute on function public.criar_perfil_novo_usuario() from public, anon, authenticated;
revoke execute on function public.meu_perfil() from public, anon;
grant  execute on function public.meu_perfil() to authenticated;

-- Projetos novos do Supabase não dão acesso automático às tabelas.
-- Cada permissão abaixo acompanha uma política acima; a RLS decide quais linhas.
grant select                 on public.autorizacoes      to authenticated;
grant select, insert, update on public.caixas            to authenticated;
grant select                 on public.configuracoes     to authenticated;
grant select, insert         on public.movimentacoes     to authenticated;
grant select, update         on public.perfis            to authenticated;
grant select, insert, update on public.produtos          to authenticated;
grant select, insert         on public.sync_log          to authenticated;
grant select                 on public.venda_itens       to authenticated;
grant select                 on public.venda_pagamentos  to authenticated;
grant select                 on public.vendas            to authenticated;
