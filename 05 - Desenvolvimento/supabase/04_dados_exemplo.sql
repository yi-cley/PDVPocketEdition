-- =====================================================================
-- PDV de Bolso · Supabase · 04 Dados de exemplo (fictícios)
-- Os mesmos 16 produtos do protótipo (02 - mockup/prototipo/js/dados.js).
-- Rode DEPOIS de criar e ativar o administrador (passo 3 do guia).
-- Não grava senha nenhuma: a senha do supervisor é definida à parte.
-- =====================================================================

do $$
declare
  v_admin uuid;
begin
  select id into v_admin from public.perfis where perfil = 'admin' and ativo limit 1;
  if v_admin is null then
    raise exception 'Crie e ative o administrador antes de rodar este arquivo (passo 3 do guia).';
  end if;

  insert into public.produtos (codigo, nome, categoria, preco, minimo, local, atualizado_por)
  values
    ('7891000100103', 'Arroz Tipo 1 5kg',          'Mercearia',  27.90, 10, 'A1', v_admin),
    ('7896005800012', 'Feijão Carioca 1kg',        'Mercearia',   8.49, 12, 'A2', v_admin),
    ('7891910000197', 'Açúcar Refinado 1kg',       'Mercearia',   4.99, 10, 'A3', v_admin),
    ('7896036090245', 'Óleo de Soja 900ml',        'Mercearia',   7.29, 12, 'A4', v_admin),
    ('7891000053508', 'Café Torrado e Moído 500g', 'Mercearia',  18.90,  6, 'B1', v_admin),
    ('7891025101106', 'Leite Integral 1L',         'Laticínios',  5.49, 24, 'B2', v_admin),
    ('7891097000123', 'Manteiga com Sal 200g',     'Laticínios', 11.90,  5, 'B3', v_admin),
    ('7896004006156', 'Pão de Forma 500g',         'Padaria',     9.99,  6, 'B4', v_admin),
    ('7896004006200', 'Ovos Brancos 12un',         'Padaria',    12.49,  6, 'C1', v_admin),
    ('7894900011517', 'Refrigerante Cola 2L',      'Bebidas',    10.99, 12, 'C2', v_admin),
    ('7894900530018', 'Água Mineral 500ml',        'Bebidas',     2.50, 24, 'C3', v_admin),
    ('7896045104482', 'Cerveja Lata 350ml',        'Bebidas',     4.29, 48, 'C4', v_admin),
    ('7891024134702', 'Sabão em Pó 1kg',           'Limpeza',    14.90,  6, 'D1', v_admin),
    ('7891024132906', 'Detergente 500ml',          'Limpeza',     2.79, 10, 'D2', v_admin),
    ('7896098900208', 'Papel Higiênico 12un',      'Higiene',    21.90,  8, 'D3', v_admin),
    ('7891150037876', 'Creme Dental 90g',          'Higiene',     4.49, 10, 'D4', v_admin)
  on conflict (codigo) do nothing;

  -- Estoque inicial como movimentação de entrada (RN-08: saldo = soma das movimentações)
  insert into public.movimentacoes (produto_id, tipo, qtd, motivo, usuario_id)
  select p.id, 'entrada', e.qtd, 'Estoque inicial (dados de exemplo)', v_admin
  from (values
    ('7891000100103', 18), ('7896005800012', 24), ('7891910000197',  9), ('7896036090245', 30),
    ('7891000053508',  4), ('7891025101106', 48), ('7891097000123',  7),
    ('7896004006200', 14), ('7894900011517', 36), ('7894900530018', 60), ('7896045104482', 96),
    ('7891024134702', 12), ('7891024132906',  5), ('7896098900208', 15), ('7891150037876', 22)
  ) as e (codigo, qtd)
  join public.produtos p on p.codigo = e.codigo
  where not exists (select 1 from public.movimentacoes m where m.produto_id = p.id);
  -- O Pão de Forma fica sem entrada (saldo 0) para testar o bloqueio da RN-02.
end $$;
