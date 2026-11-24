# Design System — PDV de Bolso

> Versão 1 · 24/11/2026 · Responsável: função 2 (UX/UI)
> Base: paleta do mockup de UX, aprovada pela equipe em 24/11/2026. A única mudança foi a fonte: o sistema usa as fontes do próprio computador, para funcionar sem internet (offline-first).
> Aplicado em: `02 - mockup/prototipo/css/style.css` (variáveis CSS no começo do arquivo).

## 1. Ideia visual

- **Papel frio** no fundo, para cansar menos a vista num turno inteiro de caixa.
- **Azul-cobalto** para ações: botões principais, foco e item selecionado.
- **Amarelo de etiqueta de gôndola** no total da venda. É o número mais importante do caixa, e o amarelo lembra a etiqueta de preço do mercado.
- **Situação nunca só por cor:** estoque baixo, zerado, offline e pendente sempre têm texto junto da cor (RNF-11).

## 2. Cores

Os dois temas usam os mesmos nomes de variável. O tema muda com **Alt+T** ou no botão do topo (RF-38), e a escolha fica salva.

| Variável | Uso | Claro | Escuro |
| --- | --- | --- | --- |
| `--bg` | Fundo da página | `#f4f5fa` | `#0f1222` |
| `--surface` | Cartões e tabelas | `#ffffff` | `#171b30` |
| `--surface-2` | Campos, linhas alternadas | `#eceef6` | `#1f2440` |
| `--line` | Bordas e divisórias | `#d8dbe8` | `#2c3252` |
| `--ink` | Texto principal | `#151a30` | `#e8eaf6` |
| `--ink-2` | Texto secundário forte | `#2c3354` | `#c9cde4` |
| `--muted` | Rótulos e textos de apoio | `#586080` | `#9ca2c2` |
| `--accent` | Botão principal, item selecionado | `#2f4bd8` | `#8195ff` |
| `--accent-soft` | Fundo de item selecionado | `#e3e8ff` | `#252d5c` |
| `--accent-ink` | Texto sobre o botão principal | `#ffffff` | `#0b1030` |
| `--tag` | Total da venda (etiqueta) | `#ffd84d` | `#ffd84d` |
| `--tag-ink` | Texto sobre a etiqueta | `#1b1600` | `#1b1600` |
| `--tag-edge` | Borda da etiqueta | `#d9b100` | `#b89600` |
| `--ok` / `--ok-bg` | Normal, pago, troco, online | `#16784a` / `#dff3e8` | `#4fc787` / `#14321f` |
| `--warn` / `--warn-bg` | Estoque baixo, falta pagar, offline | `#975400` / `#fdf0d6` | `#f0ad48` / `#3a2a0e` |
| `--danger` / `--danger-bg` | Zerado, erro, remover | `#bf2638` / `#fbe2e6` | `#ff7486` / `#3d1820` |
| `--sidebar` | Barra lateral | `#151a30` | `#0a0d1a` |
| `--focus` | Contorno de foco do teclado | `#2f4bd8` | `#a9b6ff` |

**Cores dos gráficos** (`--serie-1` a `--serie-4`): azul `#2f4bd8`, verde-azulado `#0f8b8d`, amarelo `#d9a400` e roxo `#7a3fd0` no tema claro; `#8195ff`, `#4fc7c0`, `#ffd84d` e `#c3a2ff` no escuro. A cor de base das barras é `--serie-base`.

> O amarelo da etiqueta é o mesmo nos dois temas, de propósito: o total tem que chamar atenção de dia e de noite.

## 3. Tipografia

| Variável | Fontes | Uso |
| --- | --- | --- |
| `--font-ui` | Segoe UI, Roboto, Helvetica Neue, Arial, system-ui | Todo o texto da interface |
| `--font-num` | Cascadia Mono, Consolas, Roboto Mono, Courier New | Códigos de barras e comprovante |

- Nenhuma fonte é baixada da internet. O mockup de UX usava Google Fonts (Archivo, Public Sans, JetBrains Mono, Kalam), que **não carregam offline**. Por isso a equipe decidiu trocar só a fonte.
- Valores em dinheiro usam `font-variant-numeric: tabular-nums`, para os números ficarem alinhados nas colunas.

| Elemento | Tamanho | Peso |
| --- | --- | --- |
| Texto base | 14 px | 400 |
| Título de cartão (h2) | 12 px, maiúsculas | 700 |
| Campo de busca do caixa | 18 px | 400 |
| Total da venda | 34 px | 800 |

## 4. Componentes

| Componente | Como é | Onde |
| --- | --- | --- |
| **Etiqueta do total** | Fundo `--tag`, cantos 6/16 px, linha tracejada antes do total | Caixa (RF-07) |
| **Botão principal** | Fundo `--accent`, texto `--accent-ink`, tecla de atalho dentro | Finalizar, Adicionar, Novo produto |
| **Botão secundário** | Fundo `--surface`, borda `--line` | Lançar, Entrada, Importar |
| **Tecla de atalho (kbd)** | Fundo `--kbd-bg`, fonte mono, cantos 4 px | Em todos os botões com atalho (RF-15) |
| **Selo de situação (pill)** | Fundo claro + texto escuro da mesma cor, sempre com palavra | OK, Baixo, Zerado, Ativo, Inativo |
| **Formas de pagamento** | Grade 2×2; a escolhida tem borda `--accent` e fundo `--accent-soft` | Caixa (RF-08) |
| **Resumo do pagamento** | Dois blocos: Recebido e Falta (amarelo) ou Troco (verde) | Caixa (RF-09, RF-10) |
| **Alerta de estoque** | Fundo `--warn-bg`, ou `--danger-bg` quando zerado | Estoque (RF-20) |
| **Aviso (toast)** | Faixa escura no canto inferior direito, some sozinha | Todas as telas |

## 5. Acessibilidade (RNF-11)

- Foco do teclado sempre visível: contorno de 3 px na cor `--focus`.
- A venda inteira funciona só pelo teclado (RNF-01), e a legenda de atalhos fica sempre no rodapé (RF-15).
- Todo campo tem rótulo. Avisos e o resumo do pagamento são anunciados pelo leitor de tela (`aria-live`).
- **A fazer:** medir o contraste das combinações principais com uma ferramenta (meta: nível AA) e registrar o resultado aqui.

## 6. Origem e histórico

| Data | O que mudou |
| --- | --- |
| 23/11/2026 | Primeira versão do protótipo, com base no mockup de Administração (índigo e barra lateral escura) |
| 24/11/2026 | Equipe aprovou a paleta do mockup de UX (função 2), trocando só a fonte por fontes do sistema. Versões clara e escura aplicadas ao protótipo |
