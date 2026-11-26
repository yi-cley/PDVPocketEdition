# 08 - Deploy

Acesso ao sistema para a demonstração.

| Versão | Link | Papel na demonstração |
| --- | --- | --- |
| **R**: React + Vite na Vercel, com Supabase | https://pdvpocketedition-web.vercel.app/ | Principal |
| **P**: protótipo em HTML, CSS e JS (PWA) no GitHub Pages | https://yi-cley.github.io/PDVPocketEdition/ | Plano B, instalável como app |

## Como cada parte é publicada

- **P:** os arquivos de `02 - mockup/prototipo/` ficam na branch `gh-pages`, servida pelo GitHub Pages.
- **R:** a Vercel publica a branch `main` (pasta `05 - Desenvolvimento/web/`) a cada mudança. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` ficam no painel da Vercel. A chave é pública; a segurança está nas regras de acesso (RLS) e nas funções do banco.
- **Banco:** projeto no Supabase. O passo a passo está em `05 - Desenvolvimento/supabase/PASSO-A-PASSO-SUPABASE.md`.

## Acesso para testar

- **P:** usuários de exemplo (Marta Alves, administradora; Ana Souza, caixa), senha `1234`. Senha do supervisor: `9999`.
- **R:** as contas de teste e as senhas ficam com a equipe, fora do repositório.

Se o R ficar fora do ar na hora da apresentação, a demonstração segue no P.
