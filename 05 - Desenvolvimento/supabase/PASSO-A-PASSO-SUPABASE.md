# Passo a passo: subir o banco do PDV de Bolso no Supabase

> Para quem nunca usou o Supabase. Leva cerca de 20 minutos.
> Tudo é feito pelo navegador, no painel do Supabase. Não precisa instalar nada nem usar Docker.
> Arquivos usados: `01_estrutura.sql`, `02_seguranca.sql`, `03_funcoes.sql`, `04_dados_exemplo.sql` e `05_testes.sql`, desta pasta.

---

## Antes de começar

- [ ] Ter os 5 arquivos `.sql` desta pasta no computador (baixe do GitHub ou use a cópia clonada).
- [ ] Ter um gerenciador de senhas, ou outro lugar seguro **fora do GitHub**, para guardar duas senhas: a do banco e a da administradora.
- [ ] Rodar os arquivos **na ordem** e **uma vez só**. Se rodar um arquivo de novo, aparece o erro *already exists*. Nesse caso, não force: siga para o próximo passo.

---

## Passo 1 · Criar o projeto

1. Entre em **supabase.com** e faça login (dá para usar a conta do GitHub).
2. Clique em **New project**.
3. Preencha:
   - **Name:** `pdv-de-bolso`
   - **Database Password:** clique em **Generate a password** e **guarde essa senha** no gerenciador de senhas. Ela não vai para o GitHub (RNF-06).
   - **Region:** **South America (São Paulo)**, a mais perto do Ceará.
   - **Plan:** Free.
4. Clique em **Create new project** e espere 1 a 2 minutos até o painel abrir.

## Passo 2 · Rodar a estrutura do banco

No menu da esquerda, abra **SQL Editor**. Para cada arquivo abaixo, **nesta ordem**:

1. Clique em **New query** (ou no **+**).
2. Abra o arquivo no VS Code ou no Bloco de Notas, copie **tudo** (Ctrl+A, Ctrl+C) e cole no editor.
3. Clique em **Run** (ou Ctrl+Enter).
4. Confira se embaixo aparece **Success. No rows returned**.

| Ordem | Arquivo | O que cria |
| --- | --- | --- |
| 1º | `01_estrutura.sql` | Tabelas: perfis, produtos, caixas, vendas, itens, pagamentos, movimentações, autorizações, configurações e log de sincronização |
| 2º | `02_seguranca.sql` | Regras de acesso por perfil (RLS) e gatilhos de proteção |
| 3º | `03_funcoes.sql` | Função que grava a venda, conferência da senha do supervisor, gatilhos de conferência e as views das telas |

> **Se der erro:** leia a primeira linha da mensagem. *already exists* quer dizer que o arquivo já tinha rodado, então siga em frente. Qualquer outro erro: pare, tire um print e mande no grupo antes de continuar.

**Conferir:** abra **Table Editor** no menu. Devem aparecer 10 tabelas, todas com o selo **RLS enabled** (ou sem o aviso vermelho *Unrestricted*).

## Passo 3 · Configurar o login

No menu, vá em **Authentication**:

1. Em **Sign In / Providers** (ou **Providers → Email**):
   - **Desligue** *Allow new users to sign up*. Só a administradora cria contas (RF-31).
   - **Desligue** *Confirm email*. Os e-mails da loja são fictícios, então ninguém receberia a confirmação.
2. Clique em **Save**.

## Passo 4 · Criar os usuários

Em **Authentication → Users → Add user → Create new user**, crie um de cada vez:

| E-mail | Vai virar | Perfil |
| --- | --- | --- |
| `marta.alves@pdvdebolso.local` | `marta.alves` | Administradora |
| `ana.souza@pdvdebolso.local` | `ana.souza` | Operadora de caixa |
| `joao.lima@pdvdebolso.local` | `joao.lima` | Operador de caixa |
| `carlos.melo@pdvdebolso.local` | `carlos.melo` | Estoquista |
| `pedro.rocha@pdvdebolso.local` | `pedro.rocha` | Operador **desativado** (testa o bloqueio) |

Para cada um:

- **Password:** uma senha de pelo menos 6 caracteres. Para a demonstração, use a mesma senha combinada com a equipe. Guarde a da Marta no gerenciador de senhas.
- Marque **Auto Confirm User**.
- Clique em **Create user**.

> O login no sistema é a parte do e-mail antes do @. Se o Supabase recusar o final `.local`, use `@pdvdebolso.com.br`: o login continua o mesmo.

Todo usuário novo nasce como **Operador desativado**. Volte ao **SQL Editor**, abra uma **New query**, cole e rode:

```sql
update public.perfis set nome = 'Marta Alves', perfil = 'admin',    ativo = true where login = 'marta.alves';
update public.perfis set nome = 'Ana Souza',   perfil = 'operador', ativo = true where login = 'ana.souza';
update public.perfis set nome = 'João Lima',   perfil = 'operador', ativo = true where login = 'joao.lima';
update public.perfis set nome = 'Carlos Melo', perfil = 'estoque',  ativo = true where login = 'carlos.melo';
update public.perfis set nome = 'Pedro Rocha'                                    where login = 'pedro.rocha';  -- continua desativado

select login, nome, perfil, ativo from public.perfis order by login;
```

**Conferir:** a tabela do resultado mostra os 5 usuários, com Marta `admin`, Carlos `estoque`, Ana e João `operador` ativos, e Pedro com `ativo = false`.

## Passo 5 · Carregar os produtos de exemplo

1. **New query**, cole o `04_dados_exemplo.sql` inteiro e clique em **Run**.
2. Para conferir, rode:

```sql
select nome, saldo, situacao from public.produtos_saldo order by nome;
```

**Esperado:** 16 produtos, com o mesmo estoque do protótipo. Quatro aparecem fora do normal: Açúcar (9, baixo), Café (4, baixo), Detergente (5, baixo) e Pão de Forma (0, zerado).

> Se aparecer *Crie e ative o administrador antes...*, o Passo 4 não ativou a Marta. Rode de novo o `update` dela.

## Passo 6 · Definir a senha do supervisor

A senha do supervisor (RF-39) fica guardada só como hash e é conferida no servidor. Rode no SQL Editor, **trocando `SUA-SENHA` pela senha combinada com a equipe**:

```sql
update public.configuracoes
   set senha_supervisor_hash = extensions.crypt('SUA-SENHA', extensions.gen_salt('bf')),
       atualizada_em = now();
```

- **Não salve essa query** com a senha dentro. Depois de rodar, apague o texto ou feche a aba sem salvar.
- A senha também **não** vai para o GitHub nem para o README.
- Quando o app existir, a administradora troca a senha pela tela, usando a função `definir_senha_supervisor`.

## Passo 7 · Rodar os testes automáticos

1. **New query**, cole o `05_testes.sql` inteiro e clique em **Run**.
2. **Passou** se terminar com **Success**. O script cria usuários e vendas de teste e desfaz tudo no final.
3. Se algum teste falhar, aparece um erro começando com **`FALHOU T-DB-xx`** e o motivo. Tire um print e mande no grupo.

> O SQL Editor às vezes não mostra as mensagens `OK T-DB-01` a `OK T-DB-19`. O que vale é terminar com **Success**: se um teste falhasse, o script pararia com erro.

**Print para a apresentação (slide 15):** tire um print da tela com o **Success** do `05_testes.sql`. É a evidência de que os 19 testes do banco passaram.

## Passo 8 · Conferir a segurança

1. No menu, abra **Advisors → Security Advisor** (às vezes fica em **Database → Advisors**).
2. Clique em **Refresh** ou **Rerun linter**.
3. **Esperado:** nenhum erro vermelho nas tabelas do PDV de Bolso. Avisos amarelos sobre configurações gerais do projeto podem aparecer. Anote quais apareceram e mande no grupo, para a função 3 avaliar.

## Passo 9 · Pegar as chaves para o app

Em **Project Settings → API** (ou **Data API**), copie:

| No painel | Vai para | Pode aparecer no navegador? |
| --- | --- | --- |
| **Project URL** | `VITE_SUPABASE_URL` | Sim |
| **anon public** (ou **Publishable key**, `sb_publishable_...`) | `VITE_SUPABASE_ANON_KEY` | Sim, porque todas as tabelas têm RLS |
| **service_role** (ou **Secret key**, `sb_secret_...`) | **lugar nenhum** | **Nunca**. O app não usa essa chave |

Essas duas variáveis vão:

- no arquivo `05 - Desenvolvimento/web/.env.local` (que o `.gitignore` não deixa subir), para rodar o React no computador;
- em **Vercel → Settings → Environment Variables**, para o site publicado.

## Passo 10 · Registrar (para a avaliação)

- [ ] **Diário de Bordo:** data, quem subiu, quanto tempo levou, IA usada e o resultado dos testes.
- [ ] **Testes** (Notion): criar ou marcar T-DB-01 a T-DB-19 como "Aprovado", com a data.
- [ ] **Demonstração** (Notion): anotar que o banco está no ar, **sem** colar senhas nem chaves.
- [ ] Guardar o print do **Success** dos testes para o slide 15.

---

## Problemas comuns

| O que aparece | O que fazer |
| --- | --- |
| `type "perfil_usuario" already exists` (ou outro *already exists*) | O arquivo já tinha rodado. Siga para o próximo |
| `relation "public.produtos" does not exist` | Pulou um arquivo. Rode o `01_estrutura.sql` antes |
| `Crie e ative o administrador antes de rodar este arquivo` | Faltou o Passo 4: ative a Marta com o `update` |
| O Pão de Forma aparece com saldo 0 | Está certo: ele fica zerado de propósito, para testar o bloqueio de estoque (RN-02) |
| `FALHOU T-DB-xx` | Algum arquivo não rodou inteiro ou rodou fora de ordem. Mande o print no grupo |
| Quero começar do zero | **Project Settings → General → Delete project** e repita o guia. Nunca edite um arquivo que já rodou |
| Alguém subiu uma chave `service_role` no GitHub | Em **Project Settings → API**, gere uma chave nova na hora. Apagar o arquivo não basta, porque ela continua no histórico |
