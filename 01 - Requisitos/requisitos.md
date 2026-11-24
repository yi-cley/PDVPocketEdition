# Especificação de Requisitos — PDV de Bolso (PDV Pocket Edition)

> Trabalho de ADS — UNINASSAU · Jornada de Vibe Coding com IA · Prof. Bruno Rodrigues
> Versão inicial: 21/11/2026 · Status: a revisar com a equipe

---

## 1. Visão do produto

**Categoria:** sistema de **PDV (Ponto de Venda)** com **retaguarda** e **funcionamento offline-first**: frente de caixa e gestão de estoque, como uma versão simplificada de um mini-ERP de varejo. Não é um e-commerce: no e-commerce o próprio cliente compra pela internet, e aqui quem registra a venda é o operador no balcão.

| Item | Descrição |
| --- | --- |
| **Problema** | Pequenos comércios perdem o controle do estoque e do que entra e sai, porque usam caderno, planilha solta ou nenhum registro. Os sistemas de mercado costumam ser caros, complexos e dependentes de internet. |
| **Público-alvo** | Pequenos comércios (mercadinho, loja de bairro, conveniência) com 1 a 3 operadores e um dono ou gerente |
| **Objetivo** | Registrar vendas rápido pelo teclado, manter o estoque atualizado automaticamente e dar ao dono uma visão simples de vendas e estoque, mesmo sem internet |
| **Valor** | Organização do estoque · controle de entradas e saídas · porta de entrada para o comércio adotar um sistema · simplicidade |

**Escopo do MVP:** três telas (Caixa, Estoque e Administração), login por perfil, operação offline e sincronização com a nuvem quando a internet voltar.

---

## 2. Perfis de usuário

| Perfil | Caixa | Estoque | Administração |
| --- | --- | --- | --- |
| Operador de caixa | Sim | Apenas consulta | Não |
| Estoquista | Não | Sim | Não |
| Administrador (dono/gerente) | Sim | Sim | Sim |

---

## 3. Funções da equipe

Cada requisito tem uma função responsável: a pessoa que garante que ele vai da especificação até a evidência de teste. Isso não quer dizer que ela programa sozinha.

| Nº | Função | Total |
| --- | --- | --- |
| 1 | Requisitos e liderança | 10 |
| 2 | UX/UI | 12 |
| 3 | Desenvolvimento | 14 |
| 4 | DevOps e qualidade | 10 |
| 5 | IA e documentação | 6 |

---

## 4. Requisitos funcionais

Prioridade: **Alta** = obrigatório no MVP · **Média** = entra se der tempo · **Baixa** = versão futura.

### 4.1 Acesso

| Código | Requisito | Prioridade | Função |
| --- | --- | --- | --- |
| RF-01 | O sistema deve permitir login com usuário e senha | Alta | 1 |
| RF-02 | O sistema deve liberar as telas conforme o perfil do usuário logado | Alta | 1 |
| RF-03 | O sistema deve permitir logout e troca de operador sem fechar o programa | Média | 1 |

### 4.2 Caixa

| Código | Requisito | Prioridade | Função |
| --- | --- | --- | --- |
| RF-04 | O operador deve abrir o caixa informando o valor inicial em dinheiro | Alta | 1 |
| RF-05 | O operador deve adicionar produtos à venda pelo código (digitado ou lido por leitor de código de barras) ou pela busca por nome | Alta | 3 |
| RF-06 | O operador deve poder alterar a quantidade de um item e remover itens da venda, mediante autorização do supervisor (RF-39) | Alta | 3 |
| RF-07 | O sistema deve mostrar em tempo real os itens, o subtotal e o total da venda | Alta | 2 |
| RF-08 | O operador deve registrar a forma de pagamento: dinheiro, PIX, cartão de débito ou cartão de crédito | Alta | 3 |
| RF-09 | O sistema deve permitir dividir o pagamento em mais de uma forma (ex.: parte em dinheiro, parte no PIX) | Média | 3 |
| RF-10 | O sistema deve calcular o troco quando o pagamento for em dinheiro | Alta | 3 |
| RF-11 | Ao finalizar a venda, o sistema deve baixar automaticamente as quantidades do estoque | Alta | 3 |
| RF-12 | O operador deve poder cancelar uma venda em andamento, mediante autorização do supervisor (RF-39) | Alta | 3 |
| RF-13 | O sistema deve gerar um comprovante de venda com itens, valores, forma de pagamento, data, hora e operador | Alta | 5 |
| RF-14 | O comprovante deve poder ser enviado virtualmente (link, PDF ou WhatsApp) ou impresso | Média | 5 |
| RF-15 | Todas as ações do caixa devem ter atalho de teclado, com a legenda dos atalhos visível na tela (ex.: F2 buscar produto, F4 quantidade, F8 pagamento, F10 finalizar, Esc cancelar) | Alta | 2 |
| RF-39 | Sempre que o operador for excluir ou alterar qualquer coisa na venda (remover item, alterar quantidade, cancelar a venda), o sistema deve pedir a senha de autorização do administrador, que fica com o supervisor. Sem a senha correta, a ação não é feita. | Alta | 1 |
| RF-41 | Ao adicionar um produto à venda, o operador pode informar a quantidade antes do código ou do nome (ex.: `5*P001` ou `5*arroz`), lançando várias unidades de uma vez, sem senha do supervisor. Vale de 1 a 999 unidades e respeita a RN-02 (bloqueia se a quantidade passar do estoque disponível). *(Pedido de um comerciante em 24/11/2026.)* | Alta | 3 |
| RF-16 | O operador deve fechar o caixa e ver o resumo do turno: total vendido por forma de pagamento e valor esperado em dinheiro | Média | 1 |

### 4.3 Estoque

| Código | Requisito | Prioridade | Função |
| --- | --- | --- | --- |
| RF-17 | O estoquista deve cadastrar, editar e inativar produtos (nome, código, preço, categoria, quantidade, estoque mínimo) | Alta | 3 |
| RF-18 | O sistema deve registrar entradas de mercadoria (quantidade, data, responsável) | Alta | 3 |
| RF-19 | O sistema deve manter o histórico de movimentações de cada produto (entrada, venda, ajuste) | Alta | 3 |
| RF-20 | O sistema deve alertar quando um produto ficar abaixo do estoque mínimo | Alta | 3 |
| RF-21 | O estoquista deve poder fazer ajuste manual de estoque informando o motivo (perda, avaria, contagem) | Média | 1 |
| RF-22 | O sistema deve registrar a localização de cada produto no armazém (corredor, prateleira, posição) | Média | 3 |
| RF-23 | O sistema deve exibir um mapa simples do armazém, destacando onde fica o produto buscado | Baixa | 2 |
| RF-24 | O usuário deve buscar e filtrar produtos por nome, código, categoria e situação do estoque | Alta | 2 |
| RF-40 | O sistema deve permitir cadastrar produtos em lote por importação de planilha CSV. Oferece um modelo para baixar (código, nome, categoria, preço, quantidade, mínimo, local), mostra uma prévia antes de gravar separando linhas válidas e linhas com erro (código duplicado no sistema ou na planilha, preço vazio ou inválido, quantidade negativa) e grava só as válidas, registrando a entrada inicial no histórico | Alta | 3 |

### 4.4 Administração

| Código | Requisito | Prioridade | Função |
| --- | --- | --- | --- |
| RF-25 | O administrador deve ver a lista de vendas com filtro por período, operador e forma de pagamento | Alta | 1 |
| RF-26 | O administrador deve ver os detalhes de cada venda e reemitir o comprovante | Média | 5 |
| RF-27 | O sistema deve exibir indicadores do período: total vendido, número de vendas e ticket médio | Alta | 2 |
| RF-28 | O sistema deve exibir um gráfico das formas de pagamento mais usadas | Alta | 2 |
| RF-29 | O sistema deve exibir um gráfico de vendas por dia | Média | 2 |
| RF-30 | O sistema deve exibir um gráfico ou ranking dos produtos mais vendidos e a lista de produtos com estoque baixo | Média | 2 |
| RF-31 | O administrador deve criar, editar e desativar usuários, definindo o perfil de cada um | Alta | 1 |

### 4.5 Offline e sincronização

| Código | Requisito | Prioridade | Função |
| --- | --- | --- | --- |
| RF-32 | O sistema deve funcionar sem internet (vender, consultar e movimentar estoque), salvando os dados localmente | Alta | 4 |
| RF-33 | O sistema deve guardar numa fila as alterações feitas offline e enviá-las ao servidor quando a conexão voltar | Alta | 4 |
| RF-34 | O sistema deve mostrar o status da conexão (online/offline) e a quantidade de registros pendentes de envio | Alta | 4 |
| RF-35 | O sistema deve baixar do servidor as alterações feitas em outros dispositivos (espelhamento nos dois sentidos) | Média | 4 |
| RF-36 | O sistema deve mostrar as diferenças entre os dados locais e os do servidor e registrar como cada conflito foi resolvido | Média | 5 |
| RF-37 | O administrador deve poder forçar uma sincronização manual | Baixa | 4 |

### 4.6 Interface

| Código | Requisito | Prioridade | Função |
| --- | --- | --- | --- |
| RF-38 | O sistema deve oferecer tema claro e tema escuro em todas as telas (Caixa, Estoque, Administração e login). O usuário alterna com um botão e um atalho de teclado, e a escolha fica salva para os próximos acessos. | Média | 2 |

---

## 5. Requisitos não funcionais

| Código | Categoria | Requisito (com critério verificável) | Prioridade | Função |
| --- | --- | --- | --- | --- |
| RNF-01 | Usabilidade | A tela de Caixa deve permitir concluir uma venda completa sem usar o mouse | Alta | 2 |
| RNF-02 | Usabilidade | Um operador novo deve conseguir fazer uma venda depois de no máximo 5 minutos de explicação | Média | 2 |
| RNF-03 | Desempenho | Adicionar um item à venda deve levar menos de 1 segundo, online ou offline | Alta | 4 |
| RNF-04 | Disponibilidade | Caixa e Estoque devem continuar funcionando 100% sem internet. A Administração pode mostrar apenas os dados locais enquanto estiver offline. | Alta | 4 |
| RNF-05 | Confiabilidade | Nenhuma venda registrada offline pode ser perdida ou duplicada na sincronização. Isso deve ser comprovado por teste de desligar e religar a rede. | Alta | 4 |
| RNF-06 | Segurança | Senhas devem ser guardadas com hash. Credenciais e chaves não podem ir para o repositório Git. | Alta | 5 |
| RNF-07 | Segurança | Cada tela deve validar o perfil do usuário, também no servidor | Alta | 1 |
| RNF-08 | Rastreabilidade | Vendas e movimentações de estoque devem registrar usuário, data e hora | Alta | 5 |
| RNF-09 | Compatibilidade | O sistema deve rodar em navegador atual (Chrome/Edge) no computador, podendo ser instalado como app (PWA) | Alta | 4 |
| RNF-10 | Portabilidade | O ambiente deve subir com `docker compose up` em outro computador, seguindo o README | Alta | 4 |
| RNF-11 | Acessibilidade | Os textos devem ter contraste adequado e o foco do teclado deve ser sempre visível | Média | 2 |

---

## 6. Entregáveis de projeto

Itens que a equipe precisa produzir para o trabalho, além das funções do sistema.

| Código | Entregável | Prioridade | Função |
| --- | --- | --- | --- |
| EP-01 | Mockup navegável (Figma ou HTML) das telas de login, Caixa, Estoque e Administração, com dados fictícios, tema claro e escuro (RF-38) e legenda de atalhos de teclado (RF-15). Deve cobrir os RFs de prioridade Alta e ser validado com pelo menos 1 usuário, registrando o feedback. Fica salvo na pasta `02 - mockup`. | Alta | 2 |

---

## 7. Regras de negócio

| Código | Regra |
| --- | --- |
| RN-01 | Só é possível vender com o caixa aberto |
| RN-02 | O caixa **avisa** quando o produto vendido está no estoque mínimo ou abaixo dele (estoque baixo) e **bloqueia** a venda quando o estoque acaba ou quando a quantidade pedida é maior que a disponível. *(Decidido em 24/11/2026.)* |
| RN-03 | A venda só é finalizada quando a soma dos pagamentos for igual ou maior que o total |
| RN-04 | O troco só existe para pagamento em dinheiro: troco = valor recebido − total |
| RN-05 | Uma venda finalizada não é apagada. Para desfazê-la, o administrador registra o cancelamento com motivo, e as quantidades voltam ao estoque. |
| RN-06 | O alerta de estoque baixo dispara quando a quantidade fica igual ou menor que o estoque mínimo do produto |
| RN-07 | O comprovante gerado é **não fiscal**. A nota fiscal eletrônica (NFC-e) exige integração com a SEFAZ e fica fora do escopo do trabalho. |
| RN-08 | Na sincronização, vendas nunca são sobrescritas, apenas somadas. No estoque, o saldo é recalculado pelas movimentações, e não pelo último valor salvo. |
| RN-09 | Cada registro criado offline recebe um identificador único (UUID) gerado no próprio dispositivo, para evitar duplicidade ao sincronizar |
| RN-10 | Exclusões e alterações na venda só são feitas com a senha de autorização do administrador, que fica sob a guarda do supervisor. O sistema registra quem autorizou, a ação feita, a data e a hora (RNF-08). A senha também precisa funcionar offline, validada pelo hash salvo no aparelho. |

---

## 8. Rastreabilidade (problema → requisitos)

| Problema | Requisitos que resolvem |
| --- | --- |
| Organização de estoque | RF-17, RF-20, RF-22, RF-23, RF-24, RF-40 |
| Controle do que sai e entra | RF-11, RF-41, RF-18, RF-19, RF-21, RF-39, RN-05, RN-08, RN-10 |
| Porta de entrada para um sistema | RF-01, RF-02, RF-31, RF-40, RNF-02, RNF-09 |
| Simplicidade | RF-15, RNF-01, RNF-02, RNF-03 |
| Funcionar sem internet | RF-32 a RF-37, RNF-04, RNF-05 |

---

## 9. Pontos a confirmar com a equipe

- [x] Qual comércio real vai ser ouvido para validar o problema? → 24/11/2026: dono de uma bodega e uma vendedora de roupas online; os dois aprovaram a ideia.
- [ ] O sistema vai rodar num computador só ou em vários ao mesmo tempo? Essa resposta define o tamanho do RF-35 e do RF-36.
- [x] Produto com estoque zerado: bloquear a venda ou só avisar (RN-02)? → avisa no estoque baixo e bloqueia quando acaba.
- [ ] Envio do comprovante: link, PDF ou WhatsApp (RF-14)?
- [x] O mapa do armazém (RF-23) entra no MVP ou fica para a próxima versão? → já está no protótipo.
- [ ] Vai haver leitor de código de barras ou só digitação (RF-05)?

---

## 10. Projetos futuros (fora do MVP)

| Código | Ideia | Categoria | Por que fica para depois |
| --- | --- | --- | --- |
| FUT-01 | Importação de produtos e entrada de mercadoria pelo **XML da nota fiscal do fornecedor (NF-e)**: o comerciante importa o arquivo da nota de compra, o sistema cadastra os produtos novos e soma a quantidade dos que já existem | Nova funcionalidade | Surgiu da pergunta do professor sobre cadastro em lote (23/11/2026). No MVP, o lote é feito por planilha CSV (RF-40). O XML exige ler o layout da NF-e e casar os códigos do fornecedor com os do sistema |
