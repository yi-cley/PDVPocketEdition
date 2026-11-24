# PDV de Bolso — Protótipo navegável (v0.1)

Protótipo do sistema de vendas e estoque **PDV de Bolso**, feito para o trabalho de ADS (UNINASSAU, Prof. Bruno Rodrigues).

**Acesse:** https://yi-cley.github.io/PDVPocketEdition/

## Como testar

| Usuário | Perfil | Senha |
| --- | --- | --- |
| Ana Souza | Operadora de caixa (Caixa e consulta ao Estoque) | `1234` |
| João Lima | Operador de caixa | `1234` |
| Carlos Melo | Estoquista (Estoque) | `1234` |
| Marta Alves | Administradora (Caixa, Estoque, Administração) | `1234` |
| Pedro Rocha | Operador **desativado** (testa o bloqueio de login) | `1234` |

Usuários e produtos são os mesmos do mockup de UX (decisão da equipe em 24/11/2026). O código dos produtos é o código de barras numérico (ex.: Leite Integral 1L = `7891025101106`).

Senha do supervisor para excluir ou alterar a venda (RF-39): `9999`.

### Roteiro rápido (≈ 1 minuto)

1. Entre como **Ana Souza** e abra o caixa (Enter).
2. Digite `2*leite`, Enter, e depois `arroz`, Enter → total **R$ 38,88**.
3. Tecle **Del** num item → o sistema pede a senha do supervisor (`9999`).
4. **F8** vai para o pagamento. **← →** trocam a forma. Digite `20` em Dinheiro e Enter; troque para PIX com **→**: o campo já vem com o que falta. **F10** finaliza; o comprovante mostra as duas formas.
5. Clique em **Online** no topo para simular queda de internet, faça outra venda e veja o contador de pendentes.
6. Clique de novo para "voltar a internet": a fila sincroniza sozinha.
7. **Alt+2** abre o Estoque, **Alt+3** a Administração (entre como Marta Alves), **Alt+T** troca o tema.
8. No Estoque, **F7** abre a importação em lote: baixe o modelo, importe o próprio arquivo e veja a prévia antes de gravar.

## Atalhos

| Tela | Teclas |
| --- | --- |
| Geral | Alt+1/2/3 trocar tela · Alt+T tema claro/escuro |
| Caixa | F2 buscar · Enter adicionar · ↑↓ selecionar · F4 alterar qtd* · Del remover* · 5\*código lança várias unidades · F8 pagamento · ← → forma · Enter lança o valor · F10 finalizar · Esc cancelar* · F9 fechar caixa |
| Estoque | F2 buscar · F4 entrada · F6 novo produto · F7 importar planilha |

\* pede a senha do supervisor.

## O que o protótipo cobre

- **Caixa:** abertura com valor inicial, busca por código ou nome, carrinho, 4 formas de pagamento com **pagamento dividido (RF-09)**, troco só em dinheiro, comprovante não fiscal (WhatsApp e impressão), cancelamento, fechamento com resumo do turno, senha do supervisor para exclusões e alterações.
- **Estoque:** cadastro e edição de produtos, **importação em lote por planilha CSV (RF-40)** com modelo para baixar e prévia de validação, entrada de mercadoria, ajuste com motivo, histórico de movimentações, alertas de estoque baixo, mapa do armazém, filtros.
- **Administração:** vendas do dia, ticket médio, gráfico de vendas por dia, gráfico de formas de pagamento, ranking de produtos, lista de vendas com reemissão de comprovante, gestão de usuários e perfis, registro de autorizações do supervisor, registro de sincronização, configuração da senha do supervisor.
- **Regra de estoque (RN-02):** o caixa avisa quando o produto chega ao estoque mínimo e bloqueia a venda quando ele acaba.
- **Offline:** funciona sem internet depois do primeiro acesso (service worker), fila de pendências e sincronização ao reconectar.
- **Tema claro e escuro** em todas as telas, com a escolha salva, na paleta do Design System (`03 - Designer System/`).

## Limites do protótipo

- Os dados ficam **só no navegador** (localStorage). No sistema final, o banco local será o IndexedDB (Dexie.js) e o servidor, Express + Prisma + PostgreSQL.
- A "sincronização" é simulada: nada é enviado a um servidor de verdade.
- As senhas usam um hash de demonstração. No sistema final, bcrypt ou argon2.
- O comprovante é **não fiscal** (RN-07).

## Estrutura

```
index.html            telas e modais
css/style.css         estilos e temas claro/escuro
js/dados.js           dados de exemplo e armazenamento local
js/app.js             lógica das telas, atalhos e sincronização
sw.js                 service worker (funcionar offline)
manifest.webmanifest  instalação como app (PWA)
img/icon.svg          ícone
```
