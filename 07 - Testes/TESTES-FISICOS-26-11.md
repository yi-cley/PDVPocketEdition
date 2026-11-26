# Testes físicos de 26/11/2026 (Rerisson)

Teste manual feito no protótipo (arquivo único). Situação de cada ponto e o que foi feito.

| Requisito | Resultado do teste | Situação agora |
| --- | --- | --- |
| RF-17 (Alta) | Cadastra e edita produto, mas não há como inativar | **Corrigido** (P e R): caixa de seleção "Produto ativo" na edição e filtro "Ver inativos" no Estoque. Produto inativo some do Caixa e do Estoque |
| RF-25 (Alta) | Filtra por período e forma de pagamento, mas não por operador | **Corrigido** (P e R): seletor "Todos os operadores" na lista de vendas |
| RNF-09 | O arquivo único não tem `manifest` e `sw.js`, então não instala | **Não é falha**: publicado (GitHub Pages ou Vercel) junto com esses arquivos, instala |
| RF-27 | Indicadores só do dia | **Corrigido no R**: indicador "Vendas dos últimos 7 dias", além do seletor de período da lista. No P, continua só o dia |
| RF-30 | Estoque baixo só como número na Administração | **Corrigido no R**: o indicador lista os produtos críticos (até 5). No P, os alertas já ficam na tela de Estoque |
| RF-36 | Mostra o que foi enviado, mas não os conflitos | **Em parte**: o R mostra o indicador e o registro de conflitos. O P não |
| RNF-06 | Hash de demonstração | **Em parte**: no R a senha é guardada pelo Supabase Auth. No P é hash de demonstração |
| RF-35 | Baixar dados de outros aparelhos | **Não implementado**: depende do servidor (FUT-03). Ver `09 - Melhorias` |

Regressão: `automacao/qa.py` com 143 de 146 (as mesmas 3 falhas de antes: B-46 e D-17 por tempo do aviso na tela, Z-01 por fonte do Google bloqueada no ambiente de teste). vitest 29 de 29 e build do React ok.

Fora do git (não alterado): criação de usuário pela tela, que precisa de função no Supabase. Está em `09 - Melhorias`.
