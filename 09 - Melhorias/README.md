# 09 - Melhorias

Backlog de próximas versões e aprendizados do projeto.

## Próximas melhorias

| Prioridade | Melhoria | Categoria | Justificativa |
| --- | --- | --- | --- |
| 1 | Importar produtos e entrada de mercadoria pelo **XML da nota fiscal do fornecedor (NF-e)** | Nova funcionalidade | Surgiu da pergunta do professor sobre cadastro em lote (23/11). No MVP o lote é por CSV (RF-40). O XML resolve cadastro e entrada de uma vez, mas exige ler o layout da NF-e e casar os códigos do fornecedor |
| 2 | **Integração com a maquininha de cartão** (FUT-02) | Nova funcionalidade | Pedido de um comerciante de celulares e acessórios (24/11). Depende do kit de cada operadora e da homologação |
| 4 | **Criar funcionário pela tela** (botão "+ Novo usuário" do React) | Nova funcionalidade | Hoje a conta é criada no painel do Supabase, de propósito: a chave de administrador não pode ir para o navegador. A solução segura é uma função no servidor (Edge Function) que confere se quem chama é administrador e cria a conta. Apontado nos testes físicos de 26/11 |
| 5 | **Baixar dados de outros aparelhos** (RF-35) | Nova funcionalidade | Não implementado: depende do servidor (FUT-03). O React já tem servidor, mas falta a tela e a regra de resolução |
| 6 | **Conflitos de sincronização no protótipo** (RF-36) e **hash real de senha** (RNF-06) | Dívida técnica | O protótipo mostra só o que foi enviado e usa hash de demonstração. No React os conflitos aparecem na Administração e a senha é guardada pelo Supabase Auth |
| 3 | **Versão em nuvem completa** (FUT-03): tela em React ligada ao Supabase | Dívida técnica | A versão React está no ar, mas falta fechar o teste manual e a sincronização offline com fila |

## Resolvido depois dos testes físicos (26/11)

Do relato do Rerisson, foram feitos no protótipo e no React: **inativar produto** (RF-17), **filtro de vendas por operador** (RF-25), **indicadores dos últimos 7 dias** (RF-27, React) e **lista dos produtos em estoque crítico** na Administração (RF-30, React). Detalhes em `07 - Testes/TESTES-FISICOS-26-11.md`.

## Aprendizados

**Técnicos**
- Juntar as 4 telas num protótipo PWA único permitiu validar os fluxos de teclado antes da migração para React.
- A leitura do código pela IA não achou o conflito da tecla Delete. A bateria automatizada de 146 verificações achou.
- Um prompt mestre com os requisitos aprovados reduziu erros da IA e acelerou código, banco e testes.

**Humanos**
- A revisão humana sobre a IA é indispensável: ela deixou uma brecha de regra de negócio na tela de Administração.
- Conversar com comerciantes reais (24/11, Maracanaú) separou o que cabia no MVP do que ficou para depois.
- Notion com diário, prompts e requisitos permitiu trabalho em paralelo sem perder o escopo.

O histórico completo fica no Notion (página Evolução e Lições).
