# PDV de Bolso no Supabase (FUT-03)

Preparação do banco na nuvem para a **próxima versão**. O protótipo entregue em 26/11 continua igual, salvando no localStorage. Nada aqui muda o site publicado.

Função responsável: 3 · Desenvolvimento.

## Arquivos

| Arquivo | O que faz | Requisitos |
| --- | --- | --- |
| `01_estrutura.sql` | Cria as tabelas, os tipos e as regras de validação de cada campo | RF-04, RF-08 a RF-11, RF-17 a RF-22, RF-31, RF-41, RN-01, RN-03, RN-04, RN-09, RNF-08 |
| `02_seguranca.sql` | Cria os perfis e as regras de acesso (RLS): cada perfil só lê e grava o que pode | RF-02, RF-18, RF-31, RN-10, RNF-06, RNF-07, RNF-08 |
| `03_funcoes.sql` | Funções que gravam a venda e conferem a senha do supervisor, gatilhos de conferência (preço, produto inativo, ajuste sem saldo negativo) e as views das telas de Estoque e Administração | RF-09 a RF-11, RF-16, RF-20, RF-21, RF-24 a RF-30, RF-35, RF-36, RF-39, RN-02 a RN-04, RN-08, RN-10, RNF-05 |
| `04_dados_exemplo.sql` | Os mesmos 16 produtos fictícios do protótipo, com o estoque inicial | Apoio para demonstração |
| `05_testes.sql` | 19 testes automáticos do banco (T-DB-01 a T-DB-19). Roda e desfaz tudo no fim | Evidência de teste |

## Passo a passo

1. **Criar o projeto.** No [supabase.com](https://supabase.com), crie um projeto (região São Paulo). Guarde a senha do banco num gerenciador de senhas, **nunca no Git** (RNF-06).
2. **Rodar a estrutura.** Em *SQL Editor*, cole e rode `01_estrutura.sql`, depois `02_seguranca.sql`, depois `03_funcoes.sql`. Cada um deve terminar com *Success*. Rode cada arquivo **uma vez só**: rodar de novo dá erro de "already exists".
3. **Criar o administrador.**
   - Em *Authentication › Sign In / Providers*, desligue **Allow new users to sign up** (só o admin cria contas) e desligue **Confirm email** (os e-mails são fictícios).
   - Em *Authentication › Users › Add user*, crie o dono: e-mail `marta.alves@pdvdebolso.local` e uma senha forte. O login no sistema vira `marta.alves`.
   - No *SQL Editor*, ative o administrador:
     ```sql
     update public.perfis set perfil = 'admin', ativo = true where login = 'marta.alves';
     ```
   - Crie os outros usuários do mesmo jeito. Eles nascem como Operador e **desativados**; o admin ativa e escolhe o perfil (RF-31).
4. **Dados de exemplo (opcional).** Rode `04_dados_exemplo.sql`.
5. **Testar.** Rode `05_testes.sql` (19 testes). Se cada um terminar com *Success*, todos os testes passaram (quando o editor mostra as mensagens, aparece uma linha `OK T-DB-xx` por teste). Se algum falhar, aparece um erro `FALHOU T-DB-xx` com o motivo. O script desfaz tudo o que criou.
6. **Senha do supervisor (RN-10).** Precisa ser definida por alguém logado como admin, pelo aplicativo, chamando `definir_senha_supervisor`. Não grave essa senha em nenhum arquivo do repositório.
7. **Chaves no app.** O app usa só a *Project URL* e a chave *anon/publishable* (*Project Settings › API*). A chave *service_role* nunca vai para o navegador nem para o Git.

## Do localStorage para as tabelas

| No protótipo (`dados.js`) | No Supabase | Diferença |
| --- | --- | --- |
| `usuarios` (nome, perfil, senha com hash de demonstração) | Supabase Auth + `perfis` | Senha com bcrypt no Auth. Login = parte do e-mail antes do @ |
| `produtos` (com `qtd`) | `produtos` + view `produtos_saldo` | A quantidade sai da tabela: o saldo é a soma das movimentações (RN-08) |
| `vendas` (itens e pagamentos dentro) | `vendas` + `venda_itens` + `venda_pagamentos` | `numero` passa a ser dado pelo servidor; o do caixa fica em `numero_local` |
| `movimentacoes` | `movimentacoes` | Ganha `venda_id`; nunca é alterada nem apagada |
| `caixa` | `caixas` | Cada turno vira uma linha, com abertura e fechamento |
| `autorizacoes` | `autorizacoes` | Igual |
| `config.senhaSupervisor` | `configuracoes.senha_supervisor_hash` | bcrypt em vez do hash de demonstração |
| `fila` | continua no aparelho | A fila é local por natureza; o servidor recebe pelo `registrar_venda` |
| `logSync` | `sync_log` | Ganha os campos de diferença e resolução do RF-36 |

## Decisões tomadas aqui (a equipe pode mudar)

- **RN-02 no servidor:** o caixa bloqueia a venda sem estoque. Mas, se dois caixas venderem o último item ao mesmo tempo, a venda já aconteceu: o servidor aceita (RN-08) e registra um conflito em `sync_log` para o admin conferir (RF-36).
- **Itens da venda guardam preço e nome do momento da venda**, para o comprovante reemitido (RF-26) não mudar se o produto for editado depois.
- **Fuso horário dos relatórios:** `America/Fortaleza`.
- **`local` continua um texto** (`A1`, como no protótipo), e não corredor/prateleira/posição separados.

## Revisão de 24/11/2026

Os arquivos foram rodados num PostgreSQL 16 com o mesmo esquema de papéis do Supabase (`anon`, `authenticated`, `auth.uid()`). Todos executaram sem erro e os **19 testes passaram**. A versão original tinha 15 testes; a revisão fechou 6 brechas, juntou as correções nos arquivos 01 a 03 e acrescentou os testes T-DB-14 a T-DB-19:

| O que acontecia | Como ficou | Teste |
| --- | --- | --- |
| O preço de cada item vinha do caixa sem conferência: dava para vender um arroz de R$ 27,90 por R$ 0,01 | A venda é mantida, mas a diferença vira um conflito no `sync_log` para o admin (RF-36) | T-DB-14 |
| Produto inativo podia ser vendido e receber entrada | Entrada recusada; venda vira conflito no `sync_log` | T-DB-14, T-DB-16 |
| O operador podia gravar direto uma autorização "aprovada", sem senha, e todo usuário lia o hash da senha do supervisor | Só a função `autorizar()` grava autorizações e só o admin lê o hash. A senha é sempre conferida no servidor (RN-10) | T-DB-15 |
| O mesmo operador podia abrir dois caixas ao mesmo tempo | Um caixa aberto por operador (RN-01) | T-DB-17 |
| Venda com data no futuro era aceita | Recusada (tolerância de 10 minutos para o relógio do aparelho) | T-DB-18 |
| Um ajuste podia deixar o saldo negativo | Recusado, com mensagem para informar a quantidade contada | T-DB-19 |

Também por decisão da equipe em 24/11/2026:

- **Cancelamento de venda finalizada (RN-05) retirado:** saíram a função `cancelar_venda`, o status da venda e o tipo de movimentação "estorno". Venda finalizada não é apagada nem cancelada.
- **Sem Docker:** o banco roda no Supabase e o front-end na Vercel.
- **"Offline" no projeto** quer dizer o app instalado, funcionando fora do navegador (PWA). Por isso a senha do supervisor não precisa ficar no aparelho.

Não existem **Edge Functions**, e por enquanto elas não são necessárias: as regras ficam nas funções SQL, que o app chama com `supabase.rpc('registrar_venda', { p: venda })`.

## Sugestões para a equipe decidir

- **Vários computadores (ponto aberto no requisitos.md, item 9).** O banco já aceita vários caixas ao mesmo tempo. A resposta continua definindo o tamanho do RF-35 e do RF-36 no app.
