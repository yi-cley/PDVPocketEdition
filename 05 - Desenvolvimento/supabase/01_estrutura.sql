-- =====================================================================
-- PDV de Bolso · Supabase · 01 Estrutura (tabelas)
-- Projeto futuro FUT-03. O protótipo de 26/11 continua no localStorage.
-- Rodar no SQL Editor do Supabase, nesta ordem: 01, 02, 03, 04.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create type public.perfil_usuario    as enum ('admin', 'operador', 'estoque');   -- mesmos valores do protótipo
create type public.tipo_movimentacao as enum ('entrada', 'venda', 'ajuste');
create type public.forma_pagamento   as enum ('dinheiro', 'pix', 'debito', 'credito');  -- RF-08

-- ---------------------------------------------------------------------
-- Perfis (RF-01, RF-02, RF-31). Login e senha ficam no Supabase Auth,
-- que guarda a senha com hash (RNF-06). Esta tabela guarda nome e perfil.
-- ---------------------------------------------------------------------
create table public.perfis (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),
  login     text not null unique check (length(login) >= 3),
  perfil    public.perfil_usuario not null default 'operador',
  ativo     boolean not null default false,          -- o administrador ativa (RF-31)
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Produtos (RF-17, RF-22, RF-40). A quantidade NÃO fica aqui:
-- o saldo é a soma das movimentações (RN-08). Veja a view produtos_saldo.
-- ---------------------------------------------------------------------
create table public.produtos (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique check (codigo ~ '^[0-9]{8,14}$'),   -- EAN (RF-17)
  nome           text not null check (length(trim(nome)) > 0),
  categoria      text not null default 'Geral',
  preco          numeric(10,2) not null check (preco > 0),
  minimo         integer not null default 0 check (minimo >= 0),          -- RN-06
  local          text,                                                    -- RF-22
  ativo          boolean not null default true,                           -- inativar, nunca apagar
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id) default auth.uid()
);

-- ---------------------------------------------------------------------
-- Turnos de caixa (RF-04, RF-16, RN-01). O id vem do aparelho (RN-09).
-- ---------------------------------------------------------------------
create table public.caixas (
  id            uuid primary key default gen_random_uuid(),
  operador_id   uuid not null references public.perfis (id) default auth.uid(),
  aberto_em     timestamptz not null default now(),
  valor_inicial numeric(10,2) not null check (valor_inicial >= 0),
  fechado_em    timestamptz,
  check (fechado_em is null or fechado_em >= aberto_em)
);

-- ---------------------------------------------------------------------
-- Vendas (RF-08 a RF-13, RN-03, RN-04). Só entram pela função
-- registrar_venda (arquivo 03), que valida tudo numa transação.
-- ---------------------------------------------------------------------
create table public.vendas (
  id                  uuid primary key,                                   -- gerado no caixa (RN-09)
  numero              bigint generated always as identity unique,         -- número oficial, dado pelo servidor
  numero_local        integer,                                            -- número mostrado no caixa offline
  caixa_id            uuid not null references public.caixas (id),        -- RN-01
  operador_id         uuid not null references public.perfis (id),
  feita_em            timestamptz not null,                               -- hora no caixa (RNF-08)
  recebida_em         timestamptz not null default now(),                 -- hora em que chegou ao servidor
  total               numeric(10,2) not null check (total > 0),
  recebido            numeric(10,2) not null,
  troco               numeric(10,2) not null default 0 check (troco >= 0),
  constraint rn03_pago_cobre_total check (recebido >= total),
  constraint rn04_troco            check (troco = recebido - total),
  -- RNF-08: a hora da venda não pode estar no futuro (10 min de tolerância para o relógio do aparelho)
  constraint rnf08_venda_nao_no_futuro check (feita_em <= recebida_em + interval '10 minutes')
  -- RN-05: venda finalizada não é apagada nem cancelada (cancelamento fora do escopo, decisão de 24/11/2026)
);

create table public.venda_itens (
  id         uuid primary key default gen_random_uuid(),
  venda_id   uuid not null references public.vendas (id) on delete restrict,
  produto_id uuid not null references public.produtos (id),
  codigo     text not null,                                   -- cópia do momento da venda (comprovante, RF-26)
  nome       text not null,
  preco      numeric(10,2) not null check (preco > 0),
  qtd        integer not null check (qtd between 1 and 999),  -- RF-41
  subtotal   numeric(12,2) generated always as (preco * qtd) stored
);

create table public.venda_pagamentos (                         -- RF-09: uma linha por forma
  id       uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas (id) on delete restrict,
  forma    public.forma_pagamento not null,
  valor    numeric(10,2) not null check (valor > 0)
);

-- ---------------------------------------------------------------------
-- Movimentações de estoque (RF-11, RF-18, RF-19, RF-21, RNF-08).
-- Nunca são alteradas nem apagadas: correção é uma nova movimentação.
-- ---------------------------------------------------------------------
create table public.movimentacoes (
  id          uuid primary key default gen_random_uuid(),     -- pode vir do aparelho (RN-09)
  produto_id  uuid not null references public.produtos (id),
  tipo        public.tipo_movimentacao not null,
  qtd         integer not null check (qtd <> 0),              -- positiva entra, negativa sai
  motivo      text,
  venda_id    uuid references public.vendas (id),
  usuario_id  uuid not null references public.perfis (id) default auth.uid(),
  feita_em    timestamptz not null default now(),
  recebida_em timestamptz not null default now(),
  check (tipo <> 'entrada' or qtd > 0),
  check (tipo <> 'venda'   or (qtd < 0 and venda_id is not null)),
  check (tipo <> 'ajuste'  or length(trim(coalesce(motivo, ''))) > 0)   -- RF-21: motivo obrigatório
);

-- ---------------------------------------------------------------------
-- Autorizações do supervisor (RF-39, RN-10): quem pediu, o quê, quando
-- e se a senha estava certa. Só a função autorizar() grava aqui.
-- ---------------------------------------------------------------------
create table public.autorizacoes (
  id          uuid primary key default gen_random_uuid(),
  operador_id uuid not null references public.perfis (id) default auth.uid(),
  acao        text not null,
  autorizada  boolean not null,
  feita_em    timestamptz not null default now()
);

-- Configuração única da loja. Guarda o HASH da senha do supervisor (RN-10).
-- Só o administrador lê; a senha é conferida no servidor pela função autorizar().
create table public.configuracoes (
  id                    boolean primary key default true check (id),   -- só uma linha
  senha_supervisor_hash text,
  atualizada_em         timestamptz not null default now()
);
insert into public.configuracoes default values;

-- ---------------------------------------------------------------------
-- Histórico de sincronização e conflitos (RF-33, RF-36).
-- ---------------------------------------------------------------------
create table public.sync_log (
  id          uuid primary key default gen_random_uuid(),
  dispositivo text,
  usuario_id  uuid references public.perfis (id) default auth.uid(),
  tipo        text not null check (tipo in ('envio', 'recebimento', 'conflito')),
  descricao   text not null,
  valor_local    jsonb,          -- RF-36: o que o aparelho tinha
  valor_servidor jsonb,          -- RF-36: o que o servidor tinha
  resolucao   text,              -- RF-36: como foi resolvido
  criado_em   timestamptz not null default now()
);

-- Índices para as telas de Estoque e Administração
create index on public.movimentacoes (produto_id);
create index on public.movimentacoes (venda_id);
create index on public.vendas (feita_em);
create index on public.vendas (operador_id);
create index on public.vendas (caixa_id);
create index on public.venda_itens (venda_id);
create index on public.venda_itens (produto_id);
create index on public.venda_pagamentos (venda_id);
create index on public.caixas (operador_id);

-- RN-01: um caixa aberto por operador de cada vez
create unique index caixas_um_aberto_por_operador on public.caixas (operador_id) where fechado_em is null;
