# Passo a passo: subir o código (Supabase + Vercel) para o GitHub

> PDV de Bolso · repositório `yi-cley/PDVPocketEdition` · 24/11/2026
> Para quem já tem o **GitHub Desktop** e o **VS Code** instalados, com o repositório clonado.

---

## 0. Antes de começar: o que vai para onde

| Parte | Onde fica no repositório | Para onde vai depois |
| --- | --- | --- |
| Banco: estrutura, segurança, funções, dados de exemplo e testes (`01` a `05`) | `05 - Desenvolvimento/supabase/` | Supabase (SQL Editor) |
| Edge Functions | **não existem**: as regras ficam nas funções SQL (`registrar_venda`, `autorizar` etc.), chamadas pelo app com `supabase.rpc(...)` | — |
| Tela do sistema em **React + Vite**, quando existir | `05 - Desenvolvimento/web/` | Vercel |
| Protótipo atual | `02 - mockup/prototipo/` + branch `gh-pages` | GitHub Pages (**não mexer**) |

> A pasta `05 - Desenvolvimento` é a que o roteiro do professor sugere para o código. Assim o protótipo do GitHub Pages continua funcionando para a demonstração de 26/11. O README do banco chama isto de **FUT-03** (próxima versão).

Estrutura esperada:

```
05 - Desenvolvimento/
├── .gitignore
├── .env.example               nomes das variáveis, SEM valores reais
├── supabase/
│   ├── README.md              guia do banco
│   ├── 01_estrutura.sql
│   ├── 02_seguranca.sql
│   ├── 03_funcoes.sql
│   ├── 04_dados_exemplo.sql
│   └── 05_testes.sql          19 testes automáticos
└── web/                       React + Vite (quando existir)
```

## 1. Atualizar o repositório no computador

1. Abra o **GitHub Desktop**.
2. Confira se **Current repository** está em `PDVPocketEdition`.
3. Em **Current branch**, escolha `main`.
4. Clique em **Fetch origin** e depois em **Pull origin**, se aparecer.

> Sempre comece do `main` atualizado. Assim você não sobrescreve o que a equipe já subiu.

## 2. Criar um branch só para o código

1. Em **Current branch**, clique em **New branch**.
2. Dê o nome `dev/supabase-vercel` e clique em **Create branch**.
3. Clique em **Publish branch**.

> Trabalhar num branch separado protege o `main` e o protótipo. Se algo der errado, é só descartar o branch.

## 3. Copiar os arquivos para a pasta certa

1. No GitHub Desktop: **Repository → Show in Explorer**.
2. Crie a pasta `05 - Desenvolvimento` (se ainda não existir).
3. Crie dentro dela a pasta `supabase/` e copie os 5 arquivos `.sql` e o `README.md`. Se já houver um front-end, copie a pasta `web/` também.
4. **Não copie** estas pastas e arquivos: `node_modules/`, `.env`, `.env.local`, `dist/`, `.vercel/`, `supabase/.temp/`, `supabase/.branches/`.

## 4. Criar o `.gitignore` (impede de subir senha e lixo)

Dentro de `05 - Desenvolvimento/`, crie um arquivo chamado `.gitignore` com:

```gitignore
# dependências e builds
node_modules/
dist/
build/
.next/
.vercel/

# variáveis com senhas e chaves (NUNCA sobem)
.env
.env.*
!.env.example

# arquivos locais do Supabase
supabase/.temp/
supabase/.branches/

# sistema
.DS_Store
Thumbs.db
```

E um `.env.example` só com os **nomes** das variáveis:

```env
# Valores em: Supabase > Project Settings > API
# No Vite, só variáveis que começam com VITE_ chegam ao navegador
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 5. Conferir se não tem chave secreta nos arquivos ⚠️

Este é o passo mais importante. Uma chave secreta no GitHub fica pública para sempre no histórico, mesmo se você apagar depois.

No VS Code, abra o repositório e use **Ctrl+Shift+F** (buscar em todos os arquivos). Procure, um de cada vez:

| Buscar | O que é | Pode subir? |
| --- | --- | --- |
| `service_role` | chave de administrador do Supabase | **Não** |
| `sb_secret_` | chave secreta (formato novo do Supabase) | **Não** |
| `eyJ` | começo de qualquer chave JWT; confira qual é | Só se for a chave **anon** |
| `postgres://` ou `postgresql://` | senha do banco | **Não** |
| `password` / `senha` | senha escrita no código | **Não** (exceto usuários fictícios de teste) |

- A chave **anon** (ou `sb_publishable_`) pode ficar no front-end. Ela é pública **desde que todas as tabelas tenham RLS ativo**.
- A chave **service_role** nunca aparece no código nem no front-end. Este banco não precisa dela: o app usa só a URL e a chave anon, e as regras ficam nas funções SQL.

> Se achou uma chave secreta: **não faça commit**. Mova o valor para o `.env` (que está no `.gitignore`). Se ela já chegou a ser enviada ao GitHub alguma vez, gere uma nova no painel do Supabase (Project Settings → API).

## 6. Conferir os SQL antes de subir

Os arquivos já foram revisados em 24/11 (todos rodaram sem erro e os 19 testes passaram). Antes de subir, só confira:

- [ ] Estão os **5** arquivos `.sql` (01 a 05) e o `README.md`.
- [ ] Nenhum arquivo tem senha real, nem a senha do banco, nem a do supervisor (o README pede que ela seja definida pelo app).
- [ ] O `README.md` da pasta `supabase/` está junto: ele é o guia de quem for rodar.

## 7. Fazer o commit e enviar

1. Volte ao **GitHub Desktop**. Na aba **Changes**, os arquivos novos aparecem à esquerda.
2. Confira a lista: **não pode** aparecer `.env`, `node_modules` nem `.vercel`. Se aparecer, revise o passo 4.
3. Em **Summary**, escreva, por exemplo: `Código: banco Supabase, edge functions e front-end`.
4. Em **Description**, diga o que entrou e quais requisitos cobre (ex.: `RF-05, RF-08, RF-09, RF-11, RF-17 a RF-20`).
5. Clique em **Commit to dev/supabase-vercel**.
6. Clique em **Push origin**.

## 8. Abrir o Pull Request e juntar ao `main`

1. No GitHub Desktop, clique em **Create Pull Request** (abre o navegador).
2. Título: o mesmo do commit. Na descrição, liste o que foi testado pelo QA.
3. Peça a revisão de alguém da equipe (função 4, DevOps e qualidade). Isso conta como evidência de revisão humana.
4. Depois da aprovação, clique em **Merge pull request** e depois em **Confirm merge**.
5. De volta ao GitHub Desktop: mude para o `main` e clique em **Pull origin**.

---

## 9. Publicar o banco no Supabase

Siga o `README.md` da pasta `supabase/`. Resumo, no **SQL Editor** do painel, nesta ordem:

1. `01_estrutura.sql` → `02_seguranca.sql` → `03_funcoes.sql`
2. Criar e ativar a administradora `marta.alves` (passo 3 do README)
3. `04_dados_exemplo.sql` (opcional)
4. `05_testes.sql`: deve terminar com *Success* (19 testes)

> Cada arquivo roda **uma vez só**. Se precisar refazer do zero, apague e recrie o projeto, ou crie um arquivo novo `06_...sql` com as mudanças. Nunca edite um arquivo que já rodou no banco de produção.

Não há Edge Functions para publicar. Se um dia existirem, ficam em `supabase/functions/<nome>/index.ts` e sobem com `npx supabase functions deploy <nome>`.

## 10. Publicar o front-end na Vercel (quando existir)

> Hoje o zip só tem o banco. Este passo vale quando a pasta `web/` existir.

1. Em vercel.com: **Add New → Project → Import** o repositório `PDVPocketEdition`.
2. Em **Root Directory**, clique em **Edit** e escolha `05 - Desenvolvimento/web`.
3. Em **Environment Variables**, adicione as do `.env.example` com os valores reais:
   - `VITE_SUPABASE_URL` = URL do projeto (Project Settings → API)
   - `VITE_SUPABASE_ANON_KEY` = chave anon / publishable
   - Em **Framework Preset**, a Vercel reconhece o **Vite** sozinha (build: `npm run build`, saída: `dist`)
4. Clique em **Deploy**.
5. A partir daí, cada push no `main` publica uma nova versão sozinho. Pushes em outros branches viram uma prévia com link próprio.

> **Nunca** coloque a `service_role` nas variáveis da Vercel. Ela só existe no Supabase.

---

## 11. Registrar (para a avaliação)

- [ ] Link da Vercel no `README.md` principal e na página **Demonstração** do Notion.
- [ ] Entrada no **Diário de Bordo**: data, quem subiu, o que entrou, tempo gasto e IA usada.
- [ ] Prompts usados no Claude Code na tabela **Prompts**.
- [ ] Resultado dos testes de QA na tabela **Testes**.
- [ ] Conferir se a página **Arquitetura e Tecnologias** e o slide 10 mostram a stack atual: React + Vite na Vercel + Supabase, sem Docker (decisão de 24/11).

## Problemas comuns

| Problema | Solução |
| --- | --- |
| O GitHub Desktop mostra milhares de arquivos | Faltou o `.gitignore`: `node_modules` entrou. Crie o arquivo (passo 4) antes do commit |
| Push recusado (*rejected*) | Alguém subiu antes. Clique em **Fetch origin**, depois em **Pull origin**, e envie de novo |
| A Vercel não acha o `package.json` | O **Root Directory** está errado. Aponte para `05 - Desenvolvimento/web` |
| A tela carrega mas não mostra dados | Variáveis da Vercel faltando, ou RLS sem `policy` de leitura |
| SQL Editor mostra "already exists" | O arquivo já tinha rodado. Não rode de novo: siga para o próximo |
| Subiu uma chave secreta por engano | Gere uma chave nova no Supabase na hora. Apagar o arquivo não basta, porque ela continua no histórico |
