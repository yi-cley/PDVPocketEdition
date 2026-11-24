-- =====================================================================
-- PDV de Bolso · Supabase · 05 Testes automáticos do banco
-- Roda tudo dentro de uma transação e desfaz no fim (rollback):
-- não deixa usuário, produto nem venda de teste no banco.
-- Resultado: uma linha "OK T-DB-xx" por teste na aba de mensagens.
-- Se algum falhar, o script para e mostra "FALHOU T-DB-xx".
-- =====================================================================
begin;

-- Troca o "usuário logado" (como o Supabase faz a cada requisição)
create function public._t_como(p_usuario uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;
create function public._t_sair() returns void
language sql as $$
  select set_config('role', 'none', true), set_config('request.jwt.claims', '{}', true);
$$;

-- Usuários de teste (o gatilho cria os perfis desativados)
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'teste.admin@pdvdebolso.local'),
  ('00000000-0000-4000-8000-00000000000b', 'teste.operador@pdvdebolso.local'),
  ('00000000-0000-4000-8000-00000000000c', 'teste.estoque@pdvdebolso.local'),
  ('00000000-0000-4000-8000-00000000000d', 'teste.inativo@pdvdebolso.local');
update public.perfis set ativo = true, perfil = 'admin'    where id = '00000000-0000-4000-8000-00000000000a';
update public.perfis set ativo = true, perfil = 'operador' where id = '00000000-0000-4000-8000-00000000000b';
update public.perfis set ativo = true, perfil = 'estoque'  where id = '00000000-0000-4000-8000-00000000000c';

do $$
declare
  ADM constant uuid := '00000000-0000-4000-8000-00000000000a';
  OPE constant uuid := '00000000-0000-4000-8000-00000000000b';
  EST constant uuid := '00000000-0000-4000-8000-00000000000c';
  INA constant uuid := '00000000-0000-4000-8000-00000000000d';
  CX  constant uuid := '00000000-0000-4000-8000-0000000000c1';
  V1  constant uuid := '00000000-0000-4000-8000-0000000000e1';
  r jsonb; n integer; s integer; t text; erro boolean;
begin
  -- Estoquista cadastra um produto e dá entrada de 10 unidades (RF-17, RF-18)
  perform public._t_como(EST);
  insert into public.produtos (codigo, nome, categoria, preco, minimo) values ('7899999000011', 'Produto Teste', 'Teste', 5.49, 3);
  insert into public.movimentacoes (produto_id, tipo, qtd, motivo, usuario_id)
    select id, 'entrada', 10, 'Entrada de teste', EST from public.produtos where codigo = '7899999000011';
  insert into public.produtos (codigo, nome, categoria, preco, minimo) values ('7899999000035', 'Produto Inativo', 'Teste', 4.00, 0);
  insert into public.movimentacoes (produto_id, tipo, qtd, motivo, usuario_id)
    select id, 'entrada', 5, 'Entrada de teste', EST from public.produtos where codigo = '7899999000035';
  update public.produtos set ativo = false where codigo = '7899999000035';
  perform public._t_sair();

  -- T-DB-01 · RNF-07: operador não cadastra produto
  erro := false;
  begin
    perform public._t_como(OPE);
    insert into public.produtos (codigo, nome, preco) values ('7899999000028', 'Indevido', 1);
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-01: operador cadastrou produto'; end if;
  raise notice 'OK T-DB-01 operador não cadastra produto';

  -- T-DB-02 · RF-17: código de barras com letras é recusado
  erro := false;
  begin
    perform public._t_como(EST);
    insert into public.produtos (codigo, nome, preco) values ('ABC123', 'Código ruim', 1);
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-02: aceitou código com letras'; end if;
  raise notice 'OK T-DB-02 código fora do padrão EAN recusado';

  -- T-DB-03 · RN-01: venda sem caixa aberto é recusada
  erro := false;
  begin
    perform public._t_como(OPE);
    perform public.registrar_venda(jsonb_build_object('id', V1, 'caixa_id', CX,
      'itens', '[{"codigo":"7899999000011","qtd":1,"preco":5.49}]'::jsonb,
      'pagamentos', '[{"forma":"pix","valor":5.49}]'::jsonb));
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-03: vendeu sem caixa aberto'; end if;
  raise notice 'OK T-DB-03 venda sem caixa aberto recusada';

  -- Operador abre o caixa (RF-04)
  perform public._t_como(OPE);
  insert into public.caixas (id, valor_inicial, aberto_em) values (CX, 100, now() - interval '1 hour');
  perform public._t_sair();

  -- T-DB-04 · RN-03: pagamento menor que o total é recusado
  erro := false;
  begin
    perform public._t_como(OPE);
    perform public.registrar_venda(jsonb_build_object('id', V1, 'caixa_id', CX,
      'itens', '[{"codigo":"7899999000011","qtd":3,"preco":5.49}]'::jsonb,
      'pagamentos', '[{"forma":"pix","valor":10}]'::jsonb));
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-04: aceitou pagamento menor que o total'; end if;
  raise notice 'OK T-DB-04 pagamento menor que o total recusado';

  -- T-DB-05 · RF-09 / RN-04: PIX acima do total é recusado
  erro := false;
  begin
    perform public._t_como(OPE);
    perform public.registrar_venda(jsonb_build_object('id', V1, 'caixa_id', CX,
      'itens', '[{"codigo":"7899999000011","qtd":3,"preco":5.49}]'::jsonb,
      'pagamentos', '[{"forma":"pix","valor":20}]'::jsonb));
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-05: PIX gerou troco'; end if;
  raise notice 'OK T-DB-05 PIX acima do total recusado';

  -- T-DB-06 · RF-09, RF-10, RF-11: R$ 10 no PIX + R$ 20 em dinheiro para 16,47 => troco 13,53 e baixa de 3 un
  perform public._t_como(OPE);
  r := public.registrar_venda(jsonb_build_object('id', V1, 'numero_local', 1, 'caixa_id', CX,
    'itens', '[{"codigo":"7899999000011","qtd":3,"preco":5.49}]'::jsonb,
    'pagamentos', '[{"forma":"pix","valor":10},{"forma":"dinheiro","valor":20}]'::jsonb));
  select saldo into s from public.produtos_saldo where codigo = '7899999000011';
  perform public._t_sair();
  if (r ->> 'troco')::numeric <> 13.53 or s <> 7 then
    raise exception 'FALHOU T-DB-06: troco % e saldo % (esperado 13.53 e 7)', r ->> 'troco', s;
  end if;
  raise notice 'OK T-DB-06 venda dividida com troco 13,53 e saldo 7';

  -- T-DB-07 · RNF-05 / RN-09: reenviar a mesma venda não duplica
  perform public._t_como(OPE);
  r := public.registrar_venda(jsonb_build_object('id', V1, 'caixa_id', CX,
    'itens', '[{"codigo":"7899999000011","qtd":3,"preco":5.49}]'::jsonb,
    'pagamentos', '[{"forma":"dinheiro","valor":20}]'::jsonb));
  select count(*) into n from public.vendas where id = V1;
  select saldo into s from public.produtos_saldo where codigo = '7899999000011';
  perform public._t_sair();
  if (r ->> 'duplicada')::boolean is not true or n <> 1 or s <> 7 then
    raise exception 'FALHOU T-DB-07: venda duplicada (linhas %, saldo %)', n, s;
  end if;
  raise notice 'OK T-DB-07 reenvio da mesma venda não duplica';

  -- T-DB-08 · RF-41: quantidade acima de 999 é recusada
  erro := false;
  begin
    perform public._t_como(OPE);
    perform public.registrar_venda(jsonb_build_object('id', gen_random_uuid(), 'caixa_id', CX,
      'itens', '[{"codigo":"7899999000011","qtd":1000,"preco":5.49}]'::jsonb,
      'pagamentos', '[{"forma":"dinheiro","valor":6000}]'::jsonb));
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-08: aceitou 1000 unidades'; end if;
  raise notice 'OK T-DB-08 quantidade acima de 999 recusada';

  -- T-DB-09 · RNF-07: estoquista não enxerga vendas
  perform public._t_como(EST);
  select count(*) into n from public.vendas;
  perform public._t_sair();
  if n <> 0 then raise exception 'FALHOU T-DB-09: estoquista viu % vendas', n; end if;
  raise notice 'OK T-DB-09 estoquista não vê vendas';

  -- T-DB-10 · RN-10: senha do supervisor errada não autoriza e fica registrada
  perform public._t_como(ADM);
  t := gen_random_uuid()::text;                       -- senha aleatória, só para o teste
  perform public.definir_senha_supervisor(t);
  perform public._t_sair();
  perform public._t_como(OPE);
  if public.autorizar('Remover item (teste)', 'senha-errada') then
    perform public._t_sair(); raise exception 'FALHOU T-DB-10: autorizou com senha errada';
  end if;
  if not public.autorizar('Remover item (teste)', t) then
    perform public._t_sair(); raise exception 'FALHOU T-DB-10: recusou a senha certa';
  end if;
  perform public._t_sair();
  select count(*) into n from public.autorizacoes where operador_id = OPE;
  if n <> 2 then raise exception 'FALHOU T-DB-10: % tentativas registradas (esperado 2)', n; end if;
  raise notice 'OK T-DB-10 senha do supervisor confere e registra as tentativas';

  -- T-DB-11 · RF-31: usuário desativado não acessa nada
  perform public._t_como(INA);
  select count(*) into n from public.produtos;
  perform public._t_sair();
  if n <> 0 then raise exception 'FALHOU T-DB-11: usuário desativado viu % produtos', n; end if;
  raise notice 'OK T-DB-11 usuário desativado não vê dados';

  -- T-DB-12 · RNF-08: movimentações não podem ser alteradas nem apagadas
  n := 0; s := 0;
  begin
    perform public._t_como(ADM);
    update public.movimentacoes set qtd = 999 where tipo = 'entrada';
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  begin
    perform public._t_como(ADM);
    delete from public.movimentacoes;
    get diagnostics s = row_count;
  exception when insufficient_privilege then s := 0;
  end;
  perform public._t_sair();
  if n <> 0 or s <> 0 then raise exception 'FALHOU T-DB-12: alterou % e apagou % movimentações', n, s; end if;
  raise notice 'OK T-DB-12 histórico de movimentações não muda';

  -- T-DB-13 · RF-21: ajuste sem motivo é recusado
  erro := false;
  begin
    perform public._t_como(EST);
    insert into public.movimentacoes (produto_id, tipo, qtd, usuario_id)
      select id, 'ajuste', -1, EST from public.produtos where codigo = '7899999000011';
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-13: aceitou ajuste sem motivo'; end if;
  raise notice 'OK T-DB-13 ajuste sem motivo recusado';

  -- T-DB-14 · RF-36: preço diferente do cadastro e produto inativo viram conflito para o admin
  perform public._t_como(OPE);
  perform public.registrar_venda(jsonb_build_object('id', gen_random_uuid(), 'caixa_id', CX,
    'itens', '[{"codigo":"7899999000011","qtd":1,"preco":0.01},{"codigo":"7899999000035","qtd":1,"preco":4.00}]'::jsonb,
    'pagamentos', '[{"forma":"pix","valor":4.01}]'::jsonb));
  perform public._t_sair();
  select count(*) into n from public.sync_log
   where descricao in ('Preço diferente do cadastro em Produto Teste', 'Venda de produto inativo: Produto Inativo');
  if n <> 2 then raise exception 'FALHOU T-DB-14: % conflitos (esperado 2)', n; end if;
  raise notice 'OK T-DB-14 preço adulterado e produto inativo viram conflito no sync_log';

  -- T-DB-15 · RN-10: o caixa não grava autorização direto nem lê o hash da senha
  erro := false;
  begin
    perform public._t_como(OPE);
    insert into public.autorizacoes (acao, autorizada) values ('Remover item', true);
  exception when others then erro := true;
  end;
  perform public._t_como(OPE);
  select count(*) into n from public.configuracoes;
  perform public._t_sair();
  if not erro or n <> 0 then
    raise exception 'FALHOU T-DB-15: autorização direta % / hash visível em % linha(s)', not erro, n;
  end if;
  raise notice 'OK T-DB-15 autorização só pela função e hash escondido do caixa';

  -- T-DB-16 · RF-18: entrada em produto inativo é recusada
  erro := false;
  begin
    perform public._t_como(EST);
    insert into public.movimentacoes (produto_id, tipo, qtd, motivo, usuario_id)
      select id, 'entrada', 3, 'x', EST from public.produtos where codigo = '7899999000035';
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-16: entrada em produto inativo'; end if;
  raise notice 'OK T-DB-16 entrada em produto inativo recusada';

  -- T-DB-17 · RN-01: um caixa aberto por operador
  erro := false;
  begin
    perform public._t_como(OPE);
    insert into public.caixas (valor_inicial) values (50);
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-17: abriu dois caixas'; end if;
  raise notice 'OK T-DB-17 um caixa aberto por operador';

  -- T-DB-18 · RNF-08: venda com data no futuro é recusada
  erro := false;
  begin
    perform public._t_como(OPE);
    perform public.registrar_venda(jsonb_build_object('id', gen_random_uuid(), 'caixa_id', CX,
      'feita_em', (now() + interval '30 days')::text,
      'itens', '[{"codigo":"7899999000011","qtd":1,"preco":5.49}]'::jsonb,
      'pagamentos', '[{"forma":"pix","valor":5.49}]'::jsonb));
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-18: aceitou venda no futuro'; end if;
  raise notice 'OK T-DB-18 venda com data no futuro recusada';

  -- T-DB-19 · RF-21: ajuste que deixa o saldo negativo é recusado
  erro := false;
  begin
    perform public._t_como(EST);
    insert into public.movimentacoes (produto_id, tipo, qtd, motivo, usuario_id)
      select id, 'ajuste', -50, 'Perda', EST from public.produtos where codigo = '7899999000011';
  exception when others then erro := true;
  end;
  perform public._t_sair();
  if not erro then raise exception 'FALHOU T-DB-19: ajuste deixou saldo negativo'; end if;
  raise notice 'OK T-DB-19 ajuste não deixa saldo negativo';

  raise notice 'Todos os 19 testes passaram.';
end $$;

rollback;
