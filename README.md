# PDV de Bolso (PDVPocketEdition)

Sistema de vendas e estoque para pequenos comércios, feito para o trabalho **"Da ideia à entrega: Jornada de Vibe Coding com IA"** do curso de ADS da UNINASSAU (Prof. Me. Bruno Rodrigues). Usamos vibe coding e muita fé, mas toda saída da IA passa por revisão humana.

**[▶ Abrir o protótipo](https://yi-cley.github.io/PDVPocketEdition/)** · usuário **Ana**, senha `1234` · senha do supervisor `9999`

---

## O problema

Bodegas, mercadinhos e lojas de bairro costumam controlar o estoque no caderno ou de cabeça. O produto acaba sem ninguém perceber e não se sabe o que entrou e saiu. Os sistemas de PDV do mercado são caros, complexos e dependem de internet.

Validamos a ideia em 24/11/2026 com dois comerciantes, o dono de uma bodega e uma vendedora de roupas online. Os dois aprovaram a proposta.

## A solução

Um **PDV (Ponto de Venda) offline-first** com três telas:

| Tela | O que faz |
| --- | --- |
| **Caixa** | Venda operada só pelo teclado, 4 formas de pagamento, troco, comprovante não fiscal, senha do supervisor para excluir ou alterar a venda |
| **Estoque** | Cadastro e importação de produtos por planilha CSV, entrada de mercadoria, ajuste com motivo, alertas de estoque baixo e mapa do armazém |
| **Administração** | Vendas do dia, gráficos de vendas e de formas de pagamento, ranking de produtos, usuários e perfis, registro das autorizações |

O sistema também tem **funcionamento sem internet** (fila de sincronização), **tema claro e escuro** e acesso por perfil: administrador, operador de caixa e estoquista.

## Situação atual

| Fase | Status |
| --- | --- |
| Descoberta: problema, requisitos e validação | ✅ Concluída |
| Desenho: protótipo navegável das 4 telas | ✅ Concluída, validada pela equipe em 23/11/2026 |
| Construção: React, API e banco com IA | ⏳ A começar |
| Entrega: testes, deploy e apresentação | ⏳ A começar |

Dos 51 requisitos (40 funcionais e 11 não funcionais), **42 já funcionam no protótipo**. O protótipo é só a parte visual: os dados ficam no navegador e a sincronização com o servidor é simulada.

## Atalhos do protótipo

| Tela | Teclas |
| --- | --- |
| Geral | `Alt+1/2/3` trocar tela · `Alt+T` tema claro/escuro |
| Caixa | `F2` buscar · `Enter` adicionar · `F4` alterar quantidade* · `Del` remover item* · `F8` pagamento · `1–4` forma · `F10` finalizar · `Esc` cancelar* · `F9` fechar caixa |
| Estoque | `F2` buscar · `F4` entrada · `F6` novo produto · `F7` importar planilha |

\* pede a senha do supervisor.

## Stack planejada para o sistema final

TypeScript · React + Vite · PWA · IndexedDB com Dexie.js (banco local) · Node.js + Express · Prisma · PostgreSQL · Docker Compose

A sincronização usa uma fila de saída: cada registro ganha um UUID gerado no aparelho, a API ignora UUIDs repetidos e o estoque é recalculado pelas movimentações.

## Estrutura do repositório

```
01 - Requisitos/      especificação: RF, RNF, regras de negócio, rastreabilidade
02 - mockup/          mockup da tela de Administração e código do protótipo (prototipo/)
10 - Apresentacao/    slides no template do professor (.pptx e .pdf)
README.md
```

O protótipo publicado fica na branch `gh-pages`. As próximas pastas seguem o roteiro do professor: `03 - Designer System`, `04 - Prompt`, `05 - Desenvolvimento`, `06 - Docker`, `07 - Testes`, `08 - Deploy` e `09 - Melhorias`.

## Documentação da equipe

O diário de bordo, os prompts usados com a IA, os 50 casos de teste, os desafios e as métricas ficam no Notion do projeto (acesso restrito à equipe).

## Equipe

| Papel | Integrante |
| --- | --- |
| Requisitos e liderança | Cley Coelho |
| [papel a confirmar] | Alice Gomes |
| UX/UI | [nome] |
| Desenvolvimento | [nome] |
| DevOps e qualidade | [nome] |
| IA e documentação | [nome] |
