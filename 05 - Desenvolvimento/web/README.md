# PDV de Bolso · front-end em React + Vite (FUT-03)

As telas do protótipo (`02 - mockup/prototipo/`) refeitas em **React + Vite**, ligadas ao banco do **Supabase** (`05 - Desenvolvimento/supabase/`) e prontas para publicar na **Vercel**. Os mesmos atalhos de teclado, as mesmas cores e as mesmas regras do protótipo. A diferença é que os dados agora ficam no servidor.

## Como rodar no computador

Precisa do [Node.js](https://nodejs.org) (versão LTS).

```bash
cd "05 - Desenvolvimento/web"
npm install          # só na primeira vez
npm run dev          # abre em http://localhost:5173
```

As chaves do Supabase ficam em `web/.env.local`, copiado de `05 - Desenvolvimento/.env.example`. Esse arquivo não sobe para o GitHub.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sistema no navegador, recarregando a cada mudança no código |
| `npm test` | Testes das regras do caixa (camada 1 do plano de QA) |
| `npm run build` | Gera a versão publicada em `dist/` (é o que a Vercel roda) |
| `npm run preview` | Abre a versão de `dist/`, com o app instalável funcionando |

## Login

O login é o usuário criado no Supabase Auth, sem o `@pdvdebolso.local`. Exemplo: a conta `marta.alves@pdvdebolso.local` entra como `marta.alves`. A senha é a cadastrada no painel do Supabase.

Usuário novo nasce **desativado**. O administrador ativa e escolhe o perfil na tela de Administração.

Antes do primeiro teste do caixa, o admin precisa **definir a senha do supervisor** em *Administração › Configurações*. Sem ela, remover item, alterar quantidade e cancelar a venda em andamento ficam bloqueados.

## Publicar na Vercel

1. Em *Add New › Project*, importe o repositório e, em **Root Directory**, escolha `05 - Desenvolvimento/web`.
2. A Vercel reconhece o Vite sozinha: build `npm run build`, saída `dist`.
3. Em *Settings › Environment Variables*, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Cada `git push` na `main` publica uma versão nova. O app instalado passa para ela na próxima abertura.

## Onde está cada coisa

```
index.html                  página base e tema salvo (RF-38)
public/manifest.webmanifest app instalável no computador (P-05)
public/sw.js                service worker: rede primeiro, versão salva sem internet
src/App.jsx                 sessão, perfil e tema
src/telas/Login.jsx         login por usuário e senha (RF-01)
src/telas/Sistema.jsx       menu, barra do topo, atalhos Alt+1/2/3
src/telas/Caixa.jsx         venda, pagamento dividido, supervisor, fechamento
src/telas/Estoque.jsx       produtos, entrada, ajuste, importação CSV, mapa
src/telas/Admin.jsx         KPIs, gráficos, usuários, autorizações, conflitos
src/componentes/            janela (modal), aviso, comprovante
src/lib/regras.js           regras do caixa sem tela, testadas em regras.test.js
src/lib/csv.js              leitura e validação da planilha (RF-40)
src/lib/supabase.js         conexão e mensagens de erro em português
src/lib/hooks.js            produtos com saldo em tempo real e situação da rede
```

## O que mudou em relação ao protótipo

| Protótipo | React + Supabase |
| --- | --- |
| Lista de usuários no login, senha `1234` | Campo de usuário e senha conferida pelo Supabase Auth |
| Senha do supervisor conferida no navegador | Conferida no servidor pela função `autorizar()`, que também grava a tentativa |
| Botão "Online" que simulava a queda | Mostra a conexão real. Sem internet, a venda fica na tela e não é gravada (P-05) |
| Fila de sincronização | Não existe mais: cada venda vai direto para `registrar_venda`, com um id gerado no caixa. Reenviar não duplica |
| Saldo guardado no produto | Saldo calculado pelas movimentações (view `produtos_saldo`) e atualizado em tempo real entre caixas |
| "Novo usuário" criava a conta | A conta é criada no painel do Supabase; o app ativa e escolhe o perfil |
| Card "Sincronização" na Administração | Card "Conflitos" com o registro do RF-36 (preço diferente, produto inativo, saldo negativo) |
| "Restaurar dados de exemplo" | Saiu: os dados de exemplo vêm do `04_dados_exemplo.sql` |
