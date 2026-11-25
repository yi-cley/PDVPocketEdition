# Passo a passo: publicar o PDV de Bolso no Vercel

Antes de começar, confirme duas coisas:

- A pasta do app React (`web/`, com `package.json`, `src/` e `index.html`) já está no GitHub, dentro de `05 - Desenvolvimento/`. Abra o repositório no navegador e veja se a pasta aparece. Se não aparecer, o Vercel não tem o que construir.
- O Supabase está pronto (projeto PDVdeBolso, usuários criados e produtos carregados).

## 1. Testar o app no seu computador (opcional, 3 minutos)

Dentro da pasta `web/`:

```
cp ../.env.example .env.local
npm install
npm run build
```

Se o `npm run build` terminar sem erro, o Vercel vai conseguir construir também. Se der erro, resolva aqui antes, porque a mensagem é a mesma que apareceria no Vercel.

## 2. Criar o projeto no Vercel

1. Entre em vercel.com com a conta do GitHub e clique em **Add New → Project**.
2. Em **Import Git Repository**, escolha `yi-cley/PDVPocketEdition`. Se não aparecer, clique em *Adjust GitHub App Permissions* e libere o repositório.
3. Em **Configure Project**:
   - **Project Name:** `pdv-de-bolso`.
   - **Framework Preset:** `Vite`.
   - **Root Directory:** clique em *Edit* e escolha `05 - Desenvolvimento/web`. Esse é o campo mais importante: na raiz do repositório o build falha.
   - **Build Command:** `npm run build` (já vem preenchido).
   - **Output Directory:** `dist` (já vem preenchido).
4. Abra **Environment Variables** e adicione as duas:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://kxsbyiupbxysbrpgjahs.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_fGk8RnRZccdFF416qtgPuw_32beZqLh` |

   Essa é a chave pública, feita para ir no navegador. A chave `service_role` nunca entra aqui nem no GitHub.
5. Clique em **Deploy** e espere o build terminar (1 a 2 minutos).

## 3. Rotas do React (só se der 404)

Se ao recarregar uma página interna aparecer 404, crie o arquivo `vercel.json` dentro de `web/` com:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Faça commit e push. O Vercel publica de novo sozinho.

## 4. Avisar o Supabase do endereço novo

1. No Supabase, abra **Authentication → URL Configuration**.
2. Em **Site URL**, coloque o endereço do Vercel (por exemplo `https://pdv-de-bolso.vercel.app`).
3. Em **Redirect URLs**, adicione o mesmo endereço.

## 5. Testar de ponta a ponta

1. Abra o endereço do Vercel.
2. Entre com `marta.alves` (administradora) e veja se os 16 produtos aparecem.
3. Defina a senha do supervisor (só a administradora faz isso).
4. Entre com `ana.souza`, abra o caixa e faça uma venda com pagamento dividido (PIX + dinheiro).
5. Volte ao estoque e confira que o saldo baixou.
6. Entre com `pedro.rocha`: o acesso deve ser recusado, porque ele está desativado.

## Se algo der errado

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Build falha com "no package.json" | Root Directory errado | Settings → General → Root Directory |
| Tela branca ou "supabaseUrl is required" | Variáveis não entraram no build | Conferir os nomes (começam com `VITE_`) e fazer **Redeploy** |
| Login diz "Invalid login credentials" | E-mail ou senha errados | O e-mail termina em `@pdvdebolso.local` |
| Login funciona, mas as listas vêm vazias | Perfil desativado | No Supabase, `select login, ativo from public.perfis;` |
| 404 ao recarregar | Faltou o `vercel.json` | Passo 3 |

## Depois do deploy

Cada `git push` na `main` gera um deploy novo. Pull requests ganham um endereço de teste próprio, útil para a equipe revisar antes de juntar.
