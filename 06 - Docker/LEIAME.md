# 06 - Docker: não usado

Esta pasta existe só para registrar uma decisão. A equipe **não usa Docker** neste projeto.

- **Decisão:** 24/11/2026 (requisito RNF-10 retirado).
- **Motivo:** banco e publicação são serviços prontos na nuvem. O banco roda no Supabase (PostgreSQL) e a tela é publicada na Vercel. Não há servidor próprio nem contêiner para manter.
- **Como rodar o sistema sem Docker:** veja o `README.md` da raiz e o `README.md` de `05 - Desenvolvimento/web/`.

A proposta inicial (21/11/2026) usava React, Node.js/Express, Prisma, PostgreSQL e Docker Compose. Ela está registrada no histórico de decisões do Notion (página Arquitetura e Tecnologias).
