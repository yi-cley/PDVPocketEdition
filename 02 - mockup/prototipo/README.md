# PDV de Bolso — Protótipo navegável (v0.1)

Protótipo do sistema de vendas e estoque **PDV de Bolso**, feito para o trabalho de ADS (UNINASSAU, Prof. Bruno Rodrigues).

**Acesse:** https://yi-cley.github.io/PDVPocketEdition/

## Como testar

| Usuário | Perfil | Senha |
| --- | --- | --- |
| Ana | Administrador (Caixa, Estoque, Administração) | `1234` |
| Bruno | Operador de caixa (Caixa e consulta ao Estoque) | `1234` |
| Carla | Estoquista (Estoque) | `1234` |
| Diego | Operador **desativado** (testa o bloqueio de login) | `1234` |

Senha do supervisor para excluir ou alterar a venda (RF-39): `9999`.

### Roteiro rápido (≈ 1 minuto)

1. Entre como **Ana** e abra o caixa (Enter).
2. Digite `P001`, Enter; `P001`, Enter; `P002`, Enter → total **R$ 60,30**.
3. Tecle **Del** num item → o sistema pede a senha do supervisor (`9999`).
4. **F10** finaliza; o comprovante não fiscal aparece. Enter fecha.
5. Clique em **Online** no topo para simular queda de internet, faça outra venda e veja o contador de pendentes.
6. Clique de novo para "voltar a internet": a fila sincroniza sozinha.
7. **Alt+2** abre o Estoque, **Alt+3** a Administração, **Alt+T** troca o tema.
8. No Estoque, **F7** abre a importação em lote: baixe o modelo, importe o próprio arquivo e veja a prévia antes de gravar.

## Atalhos

| Tela | Teclas |
| --- | --- |
| Geral | Alt+1/2/3 trocar tela · Alt+T tema claro/escuro |
| Caixa | F2 buscar · Enter adicionar · ↑↓ selecionar · F4 alterar qtd* · Del remover* · F8 pagamento · 1–4 forma · F10 finalizar · Esc cancelar* · F9 fechar caixa |
| Estoque | F2 buscar · F4 entrada · F6 novo produto · F7 importar planilha |

\* pede a senha do supervisor.

## O que o protótipo cobre

- **Caixa:** abertura com valor inicial, busca por código ou nome, carrinho, 4 formas de pagamento, troco, comprovante não fiscal (WhatsApp e impressão), cancelamento, fechamento com resumo do turno, senha do supervisor para exclusões e alterações.
- **Estoque:** cadastro e edição de produtos, **importação em lote por planilha CSV (RF-40)** com modelo para baixar e prévia de validação, entrada de mercadoria, ajuste com motivo, histórico de movimentações, alertas de estoque baixo, mapa do armazém, filtros.
- **Administração:** vendas do dia, ticket médio, gráfico de vendas por dia, gráfico de formas de pagamento, ranking de produtos, lista de vendas com reemissão de comprovante, gestão de usuários e perfis, registro de autorizações do supervisor, registro de sincronização, configuração da senha do supervisor.
- **Regra de estoque (RN-02):** o caixa avisa quando o produto chega ao estoque mínimo e bloqueia a venda quando ele acaba.
- **Offline:** funciona sem internet depois do primeiro acesso (service worker), fila de pendências e sincronização ao reconectar.
- **Tema claro e escuro** em todas as telas, com a escolha salva.

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
