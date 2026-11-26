# Relatório de testes do protótipo — 25/11/2026

Bateria automatizada (Playwright) executada do zero contra o protótipo HTML/CSS/JS.

**Resultado: 146/146 testes passando.**

## Defeito encontrado e corrigido
- **B-13b**: a tecla Delete dentro da busca ou do campo de pagamento do Caixa abria a senha do supervisor em vez de apagar texto. Correção em `js/app.js`: só remove o item quando o campo está vazio. Cache do service worker: `pdv-bolso-v7`.
- Pendência (React, delegada à equipe): `05 - Desenvolvimento/web/src/telas/Caixa.jsx` linha ~254 tem o mesmo tratamento de Delete.

## Cobertura
Login/perfis, Caixa, Estoque/CSV, Admin, senha do supervisor, offline/fila, persistência/tema/PWA, integridade dos dados, layout do Caixa (9 combinações de tela/zoom), impressão em 1 folha, contraste AA (claro/escuro), reset e ausência de erros de JS. Banco Supabase: 19/19 testes na rodada anterior.

## Casos
| ID | Descrição | Resultado |
|---|---|---|
| A-01 | Primeiro acesso carrega 5 usuários e 16 produtos de exemplo | ✅ |
| A-01b | Protótipo já traz vendas de exemplo anteriores a hoje (para os gráficos) | ✅ |
| A-02 | Todo código de produto é numérico de 8 a 14 dígitos | ✅ |
| A-03 | Senhas não ficam em texto puro | ✅ |
| A-04 | Senha errada é recusada com mensagem | ✅ |
| A-05 | Usuário desativado é bloqueado | ✅ |
| A-06 | Operadora entra e vê só Caixa e Estoque | ✅ |
| A-08 | Nome e perfil aparecem no topo | ✅ |
| B-01 | Ao entrar no Caixa sem turno aberto, pede para abrir o caixa | ✅ |
| B-02 | Valor inicial negativo é recusado | ✅ |
| B-03 | Caixa abre com R$ 100,00 e registra operador | ✅ |
| A-07 | Operadora não abre Administração (Alt+3) | ✅ |
| B-04 | 2*leite + arroz = R$ 38,88 (RF-41) | ✅ |
| B-05 | Itens: 3 unidades no resumo | ✅ |
| B-06 | Produto inexistente avisa e não lança | ✅ |
| B-07 | Produto zerado (Pão de Forma) bloqueia a venda (RN-02) | ✅ |
| B-08 | Quantidade acima do estoque (99 de 4 Cafés) é bloqueada | ✅ |
| B-09 | Quantidade 0 é inválida | ✅ |
| B-10 | Quantidade 1000 é inválida (máx. 999) | ✅ |
| B-11 | Produto com estoque baixo avisa mas deixa vender (RN-02) | ✅ |
| B-12 | Código de barras exato soma ao item existente (leite vai a 3) | ✅ |
| B-13 | Sugestões aparecem ao digitar parte do nome | ✅ |
| B-13b | Delete dentro do texto da busca apaga uma letra (não abre a senha do supervisor) | ✅ |
| B-14 | Del pede a senha do supervisor (RF-39) | ✅ |
| B-15 | Senha do supervisor errada: item continua e erro aparece | ✅ |
| B-16 | Senha certa remove o item | ✅ |
| B-17 | Autorizações registradas (1 recusada e 1 aceita) com operador e ação (RN-10) | ✅ |
| B-18 | F4 (alterar quantidade) pede a senha | ✅ |
| B-19 | Depois da senha abre "Nova quantidade" | ✅ |
| B-20 | Nova quantidade acima do estoque é recusada | ✅ |
| B-21 | Nova quantidade válida é aplicada | ✅ |
| B-22 | Esc com itens pede a senha para cancelar a venda | ✅ |
| B-23 | Venda cancelada: carrinho vazio e nada registrado no estoque | ✅ |
| B-24 | F10 sem itens avisa e não cria venda | ✅ |
| B-25 | F8 foca o valor já preenchido com o total (R$ 38,88) | ✅ |
| B-26 | Lança R$ 20 em dinheiro: faltam R$ 18,88 | ✅ |
| B-27 | Campo já vem com o que falta (18,88) | ✅ |
| B-28 | → troca a forma para PIX | ✅ |
| B-29 | ← volta e dá a volta pela lista (Dinheiro → Crédito) | ✅ |
| B-30 | PIX acima do que falta é recusado, sem troco (RN-04) | ✅ |
| B-31 | Valor zero é recusado | ✅ |
| B-32 | PIX R$ 18,88 completa o pagamento, sem troco | ✅ |
| B-33 | Lista mostra as duas formas lançadas | ✅ |
| B-34 | Remover o pagamento PIX volta a faltar R$ 18,88 | ✅ |
| B-35 | Mudar a venda depois de lançar pagamento apaga os pagamentos | ✅ |
| B-36 | Total volta a R$ 38,88 | ✅ |
| B-37 | F10 lança o resto digitado e finaliza a venda dividida | ✅ |
| B-38 | Comprovante abre com TOTAL e as duas formas | ✅ |
| B-39 | Enter fecha o comprovante e devolve o foco à busca | ✅ |
| B-40 | Estoque baixou: leite 46 e arroz 17 | ✅ |
| B-41 | Movimentações de venda registradas (negativas, com nº da venda) | ✅ |
| B-42 | Carrinho e campos zerados após finalizar | ✅ |
| B-43 | Dinheiro maior que o total gera troco (R$ 50 em R$ 30,40 = R$ 19,60) | ✅ |
| B-44 | Venda 2: troco gravado e comprovante mostra Troco | ✅ |
| B-45 | F10 sem valor recebe o total na forma escolhida (Crédito) | ✅ |
| B-46 | Pagamento incompleto não finaliza (RN-03) | ✅ |
| B-47 | F9 com venda em andamento não fecha o caixa | ✅ |
| B-48 | F9 abre o resumo do turno | ✅ |
| B-49 | Resumo: total vendido R$ 72,07 em 3 vendas e gaveta R$ 150,40 | ✅ |
| B-50 | Caixa fechado e registrado na fila | ✅ |
| B-51 | Com o caixa fechado, vender volta a pedir abertura (RN-01) | ✅ |
| B-52 | Novo turno abre e a venda segue | ✅ |
| B-53 | Sair com venda em andamento é bloqueado | ✅ |
| C-01 | Operadora vê o estoque só para consulta (botões de escrita ocultos) | ✅ |
| C-02 | Operadora não consegue abrir "Novo produto" pelo atalho | ✅ |
| C-03 | Estoquista entra direto no Estoque e só vê essa tela | ✅ |
| C-04 | Estoquista não acessa o Caixa | ✅ |
| C-05 | Tabela lista os 16 produtos | ✅ |
| C-06 | Alertas listam os 4 produtos no mínimo ou abaixo (RF-20) | ✅ |
| C-07 | Filtro por texto "leite" mostra só o leite | ✅ |
| C-08 | Filtro de situação (Baixo) mostra só essa situação | ✅ |
| C-09 | Código com 7 dígitos é recusado | ✅ |
| C-10 | Código com letras é recusado | ✅ |
| C-11 | Código repetido é recusado | ✅ |
| C-12 | Preço zero é recusado | ✅ |
| C-13 | Quantidade inicial negativa é recusada | ✅ |
| C-14 | Produto válido é cadastrado (preço 3,50, local em maiúsculas) | ✅ |
| C-15 | Estoque inicial gera movimentação de entrada | ✅ |
| C-16 | Painel do produto mostra histórico e a prateleira fica em destaque (RF-19, RF-23) | ✅ |
| C-17 | Entrada com quantidade 0 é recusada | ✅ |
| C-18 | Entrada de 10 óleos: estoque 30 → 40 | ✅ |
| C-19 | Ajuste sem motivo é recusado (RF-21) | ✅ |
| C-20 | Ajuste para 38 grava diferença -2 com motivo Perda | ✅ |
| C-21 | Editar produto: código bloqueado e novo preço salvo | ✅ |
| C-22 | F7 abre a importação em lote | ✅ |
| C-23 | Modelo .csv baixa com cabeçalho e exemplos | ✅ |
| C-24 | Prévia: 2 válidas e 5 recusadas, nada gravado ainda | ✅ |
| C-25 | Cada erro tem o motivo certo | ✅ |
| C-26 | Importa só as 2 válidas (19 produtos no total) com entrada de estoque | ✅ |
| C-27 | Planilha com cabeçalho inválido mostra erro claro | ✅ |
| C-28 | Importar sem escolher arquivo é recusado | ✅ |
| D-01 | Administradora vê as 3 telas | ✅ |
| D-02 | KPI "vendido hoje" = R$ 72,07 e 3 vendas | ✅ |
| D-03 | Ticket médio correto | ✅ |
| D-04 | KPI de produtos críticos bate com o estoque | ✅ |
| D-05 | Gráfico de 7 dias e de formas de pagamento desenhados | ✅ |
| D-06 | Filtro "hoje" na lista de vendas mostra só as vendas de hoje | ✅ |
| D-07 | Filtro PIX mostra só as 1 vendas com PIX (inclui dividida) | ✅ |
| D-08 | Reemitir comprovante pela lista | ✅ |
| D-09 | Ranking dos 7 dias: líder Manteiga com Sal 200g com 18 un. | ✅ |
| D-10 | Registro de autorizações mostra aceitas e senhas incorretas | ✅ |
| D-11 | Log de sincronização lista os eventos | ✅ |
| D-12 | Novo usuário sem nome/senha curta é recusado | ✅ |
| D-13 | Nome duplicado é recusado (sem diferenciar maiúsculas) | ✅ |
| D-14 | Usuário criado como operador, ativo, senha com hash | ✅ |
| D-15 | Desativar usuário | ✅ |
| D-16 | Não desativa o único administrador (T-AD-10) | ✅ |
| D-17 | Não rebaixa o único administrador | ✅ |
| D-18 | Trocar senha do supervisor com senha atual errada é recusado | ✅ |
| D-19 | Nova senha curta é recusada | ✅ |
| D-20 | Senha do supervisor trocada | ✅ |
| D-21 | Usuário criado entra com a senha definida | ✅ |
| D-22 | Senha antiga do supervisor (9999) deixa de funcionar | ✅ |
| D-23 | Nova senha (8888) autoriza | ✅ |
| E-01 | Clicar em Online simula queda: aparece Offline | ✅ |
| E-02 | Venda offline é gravada como pendente e entra na fila | ✅ |
| E-03 | Comprovante avisa que foi registrada offline | ✅ |
| E-04 | Contador de pendentes aparece no topo | ✅ |
| E-05 | Ao voltar a internet a fila sincroniza sozinha e a venda vira "sincronizado" | ✅ |
| E-06 | Estando offline nada é enviado; ao reconectar, tudo é | ✅ |
| F-01 | Dados persistem ao recarregar a página | ✅ |
| F-02 | Depois de recarregar é preciso entrar de novo (sessão não persiste) | ✅ |
| F-03 | Alt+T alterna o tema | ✅ |
| F-04 | O tema escolhido é lembrado após recarregar | ✅ |
| F-05 | Manifesto PWA declarado | ✅ |
| F-06 | Service worker registrado (funciona fora do navegador / offline) | ✅ |
| F-07 | Com a rede cortada, o app abre pelo cache | ✅ |
| G-01 | Em toda venda: itens = total e pagamentos − troco = total; troco só com dinheiro | ✅ |
| G-02 | Estoque de todo produto = estoque inicial + soma das movimentações (RN-08) | ✅ |
| G-03 | Nenhum produto com estoque negativo | ✅ |
| G-04 | Números de venda sequenciais e ids únicos (RN-09) | ✅ |
| H-1366x768@1 | Caixa 1366x768 zoom 100%: blocos da direita não se sobrepõem | ✅ |
| H-1280x720@1 | Caixa 1280x720 zoom 100%: blocos da direita não se sobrepõem | ✅ |
| H-1100x700@1 | Caixa 1100x700 zoom 100%: blocos da direita não se sobrepõem | ✅ |
| H-1024x600@1 | Caixa 1024x600 zoom 100%: blocos da direita não se sobrepõem | ✅ |
| H-1920x1080@1 | Caixa 1920x1080 zoom 100%: blocos da direita não se sobrepõem | ✅ |
| H-1366x768@1.25 | Caixa 1366x768 zoom 125%: blocos da direita não se sobrepõem | ✅ |
| H-1366x768@1.5 | Caixa 1366x768 zoom 150%: blocos da direita não se sobrepõem | ✅ |
| H-1280x720@1.5 | Caixa 1280x720 zoom 150%: blocos da direita não se sobrepõem | ✅ |
| H-1024x768@1.5 | Caixa 1024x768 zoom 150%: blocos da direita não se sobrepõem | ✅ |
| I-01 | Comprovante imprime em 1 folha | ✅ |
| I-02 | Na impressão o app some e só o comprovante aparece | ✅ |
| J-light | Contraste AA no tema claro (12 elementos medidos) | ✅ |
| J-dark | Contraste AA no tema escuro (12 elementos medidos) | ✅ |
| K-01 | Restaurar dados de exemplo apaga as vendas e volta ao login | ✅ |
| Z-01 | Nenhum erro de JavaScript no console durante toda a bateria | ✅ |
