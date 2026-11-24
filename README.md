# PDV de Bolso (PDVPocketEdition)

Sistema de vendas e estoque para pequenos comércios, feito para o trabalho **"Da ideia à entrega: Jornada de Vibe Coding com IA"** do curso de ADS da UNINASSAU (Prof. Me. Bruno Rodrigues). Usamos vibe coding e muita fé, mas toda saída da IA passa por revisão humana.

**[▶ Abrir o protótipo](https://yi-cley.github.io/PDVPocketEdition/)** · usuários **Ana Souza** (caixa) ou **Marta Alves** (administração), senha `1234` · senha do supervisor `9999`

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
| Construção: banco no Supabase e front-end em React na Vercel, com IA | 🔄 Banco preparado e testado (`05 - Desenvolvimento/supabase/`) |
| Entrega: testes, deploy e apresentação | ⏳ A começar |

Dos 51 requisitos ativos (41 funcionais e 10 não funcionais), **44 já funcionam no protótipo**. O protótipo é só a parte visual: os dados ficam no navegador e a sincronização com o servidor é simulada.

## Atalhos do protótipo

| Tela | Teclas |
| --- | --- |
| Geral | `Alt+1/2/3` trocar tela · `Alt+T` tema claro/escuro |
| Caixa | `F2` buscar · `Enter` adicionar · `5*` + código lança 5 unidades · `F4` alterar quantidade* · `Del` remover item* · `F8` pagamento · `← →` forma · `Enter` lança o valor · `F10` finalizar · `Esc` cancelar* · `F9` fechar caixa |
| Estoque | `F2` buscar · `F4` entrada · `F6` novo produto · `F7` importar planilha |

\* pede a senha do supervisor.

## Tecnologias

| Parte | Entregue em 26/11 | Próxima versão |
| --- | --- | --- |
| Tela (front-end) | HTML, CSS e JavaScript puros, PWA instalável | **React + Vite**, PWA, ligado ao banco pela biblioteca `supabase-js` e publicado na **Vercel**. As telas do protótipo viram componentes |
| Dados | `localStorage` do navegador | **Supabase**: PostgreSQL, login (Auth), regras de acesso por perfil (RLS), funções SQL e Realtime |
| Publicação | GitHub Pages | Vercel (tela) + Supabase (banco) |

Não usamos Docker: banco e publicação são serviços prontos na nuvem. A venda é gravada pela função `registrar_venda`, que recebe o UUID gerado no caixa e ignora reenvios, e o estoque é a soma das movimentações.

## Estrutura do repositório

```
01 - Requisitos/      especificação: RF, RNF, regras de negócio, rastreabilidade
02 - mockup/          mockup da tela de Administração e código do protótipo (prototipo/)
03 - Designer System/ cores, tipografia e componentes (tema claro e escuro)
05 - Desenvolvimento/ banco no Supabase (SQL, regras de acesso e 19 testes) e passo a passo do GitHub
10 - Apresentacao/    slides no template do professor (.pptx e .pdf)
README.md
```

O protótipo publicado fica na branch `gh-pages`. As próximas pastas seguem o roteiro do professor: `04 - Prompt`, `07 - Testes`, `08 - Deploy` e `09 - Melhorias`. A pasta `06 - Docker` não será usada (sem Docker, decisão de 24/11/2026).

## Documentação da equipe

O diário de bordo, os prompts usados com a IA, os 50 casos de teste, os desafios e as métricas ficam no Notion do projeto (acesso restrito à equipe).

## Equipe

| Papel | Integrante |
| --- | --- |
| Requisitos e liderança | Cley Coelho |
| UX/UI | [nome] |
| Desenvolvimento | [nome] |
| DevOps e qualidade | [nome] |
| IA e documentação | Alice Gomes |

Apresentação e entrega: quinta-feira, 26/11/2026.
