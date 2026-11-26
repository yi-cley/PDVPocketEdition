# 04 - Prompt

Prompts usados com a IA (Claude, com apoio do Prompt Cowboy), decisões e revisões humanas. O registro completo, com o texto de cada prompt, a resposta e o que a equipe corrigiu, fica na base **Prompts** do Notion do projeto (acesso restrito à equipe). Esta pasta resume o que foi feito e onde está cada coisa.

| # | Prompt | Etapa | O que gerou |
| --- | --- | --- | --- |
| 1 | Documentação de Descoberta e Requisitos | Requisitos (21/11) | Requisitos separados em [FATO], [HIPÓTESE] e [DÚVIDA]: base de `01 - Requisitos/` |
| 2 | Análise e Estruturação | Requisitos (21/11) | Análise de negócio, fluxos e escopo do MVP |
| 3 | Documentação do MVP | Requisitos (21/11) | Descrição das telas e do funcionamento do MVP |
| 4 | Tela Administração (claro e escuro) | Protótipo (22/11) | Especificação e protótipo da Administração |
| 5 | Plano e bateria de testes de QA (offline-first e funcional) | Testes (24/11) | Plano de QA e a bateria de testes automatizada (`07 - Testes/`) |

## Revisão humana (exemplos)

- Na tela de Administração, a IA bloqueou a exclusão do último administrador ativo, mas deixou rebaixar o perfil dele para Operador. A equipe achou a brecha na revisão.
- A leitura do código pela IA não achou o conflito da tecla Delete com a senha do supervisor. A bateria de testes automatizada achou, e o defeito foi corrigido (relatório em `07 - Testes/`).
- A proposta de stack da IA (Express, Prisma, Dexie e Docker) foi trocada pela equipe por React + Vite, Supabase e Vercel, sem Docker (decisão de 24/11/2026).
