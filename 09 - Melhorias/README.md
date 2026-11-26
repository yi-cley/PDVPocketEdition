# 09 - Melhorias

Backlog de próximas versões e aprendizados do projeto.

## Próximas melhorias

| Prioridade | Melhoria | Categoria | Justificativa |
| --- | --- | --- | --- |
| 1 | Importar produtos e entrada de mercadoria pelo **XML da nota fiscal do fornecedor (NF-e)** | Nova funcionalidade | Surgiu da pergunta do professor sobre cadastro em lote (23/11). No MVP o lote é por CSV (RF-40). O XML resolve cadastro e entrada de uma vez, mas exige ler o layout da NF-e e casar os códigos do fornecedor |
| 2 | **Integração com a maquininha de cartão** (FUT-02) | Nova funcionalidade | Pedido de um comerciante de celulares e acessórios (24/11). Depende do kit de cada operadora e da homologação |
| 3 | **Versão em nuvem completa** (FUT-03): tela em React ligada ao Supabase | Dívida técnica | A versão React está no ar, mas falta fechar o teste manual e a sincronização offline com fila |

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
