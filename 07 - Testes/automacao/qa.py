"""Bateria de testes do protótipo do PDV de Bolso (HTML/CSS/JS), do zero, em navegador real."""
import json, re, sys, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
RES = []           # (id, descricao, ok, detalhe)
ERROS_JS = []


def T(id_, desc, ok, det=''):
    RES.append((id_, desc, bool(ok), str(det)))
    print(('PASSOU ' if ok else 'FALHOU ') + id_ + ' ' + desc + ('' if ok else '  -> ' + str(det)), flush=True)


def novo(browser, w=1366, h=768):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, accept_downloads=True, locale='pt-BR')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERROS_JS.append(str(e)))
    pg.on('console', lambda m: ERROS_JS.append('console.error: ' + m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_selector('#login-usuario')
    return ctx, pg


def D(pg):
    return pg.evaluate('JSON.parse(JSON.stringify(D))')


def toast(pg):
    return pg.evaluate("document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent")


def login(pg, nome, senha='1234'):
    val = pg.evaluate("n => { const o=[...document.querySelectorAll('#login-usuario option')].find(o=>o.textContent.startsWith(n)); return o && o.value }", nome)
    pg.select_option('#login-usuario', value=val)
    pg.fill('#login-senha', senha)
    pg.press('#login-senha', 'Enter')
    pg.wait_for_timeout(120)


def sair(pg):
    pg.click('[data-acao="sair"]')
    pg.wait_for_timeout(100)


def nav_visivel(pg):
    return pg.evaluate("[...document.querySelectorAll('#nav button')].filter(b=>!b.hidden).map(b=>b.dataset.tela)")


def modal_titulo(pg):
    return pg.evaluate("document.querySelector('#overlay').hidden ? '' : document.querySelector('#modal-titulo').textContent")


def modal_erro(pg):
    return pg.evaluate("document.querySelector('#modal-erro').hidden ? '' : document.querySelector('#modal-erro').textContent")


def modal_ok(pg):
    pg.click('#modal-acoes .btn-primary')
    pg.wait_for_timeout(100)


def modal_cancelar(pg):
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(80)


def abrir_caixa(pg, valor='100,00'):
    assert modal_titulo(pg) == 'Abrir caixa', modal_titulo(pg)
    pg.fill('#valor-inicial', valor)
    modal_ok(pg)


def add(pg, texto):
    pg.fill('#busca-produto', texto)
    pg.press('#busca-produto', 'Enter')
    pg.wait_for_timeout(60)


def supervisor(pg, senha):
    assert 'supervisor' in modal_titulo(pg).lower(), modal_titulo(pg)
    pg.fill('#senha-supervisor', senha)
    modal_ok(pg)


def total_txt(pg):
    return pg.inner_text('#venda-total')


def brl(x):
    return ('R$ {:,.2f}'.format(x)).replace(',', 'X').replace('.', ',').replace('X', '.')


def norm(s):
    return re.sub(r'\s+', ' ', s.replace(' ', ' ')).strip()


def limpar(pg, sel):
    pg.click(sel); pg.keyboard.press('Control+A'); pg.keyboard.press('Backspace')


def snap(pg, nome):
    pg.screenshot(path=f'/tmp/qa/img/{nome}.png')


with sync_playwright() as p:
    br = p.chromium.launch()

    # =====================================================================
    # A · LOGIN E PERFIS (começando sem nenhum dado salvo)
    # =====================================================================
    ctx, pg = novo(br)
    ini = D(pg)
    T('A-01', 'Primeiro acesso carrega 5 usuários e 16 produtos de exemplo', len(ini['usuarios']) == 5 and len(ini['produtos']) == 16, f"{len(ini['usuarios'])} usuários, {len(ini['produtos'])} produtos")
    INICIAL = {x['codigo']: x['qtd'] for x in ini['produtos']}
    N0 = len(ini['vendas']); M0 = len(ini['movimentacoes'])
    T('A-01b', 'Protótipo já traz vendas de exemplo anteriores a hoje (para os gráficos)', N0 > 0 and not any(pg.evaluate('v => mesmoDia(new Date(v.data), new Date())', v) for v in ini['vendas']), N0)
    T('A-02', 'Todo código de produto é numérico de 8 a 14 dígitos', all(re.fullmatch(r'\d{8,14}', x['codigo']) for x in ini['produtos']))
    T('A-03', 'Senhas não ficam em texto puro', all(u['senha'].startswith('demo$') and u['senha'] != '1234' for u in ini['usuarios']) and ini['config']['senhaSupervisor'].startswith('demo$'))
    login(pg, 'Ana Souza', 'errada')
    T('A-04', 'Senha errada é recusada com mensagem', pg.is_visible('#login-erro') and 'incorretos' in pg.inner_text('#login-erro') and pg.is_hidden('#app'), pg.inner_text('#login-erro'))
    login(pg, 'Pedro Rocha')
    T('A-05', 'Usuário desativado é bloqueado', pg.is_visible('#login-erro') and 'desativado' in pg.inner_text('#login-erro') and pg.is_hidden('#app'), pg.inner_text('#login-erro'))
    login(pg, 'Ana Souza')
    T('A-06', 'Operadora entra e vê só o Caixa', pg.is_visible('#app') and nav_visivel(pg) == ['caixa'], nav_visivel(pg))
    T('A-08', 'Nome e perfil aparecem no topo', pg.inner_text('#usuario-nome') == 'Ana Souza' and 'Operador' in pg.inner_text('#usuario-perfil'))

    # =====================================================================
    # B · CAIXA (Ana)
    # =====================================================================
    T('B-01', 'Ao entrar no Caixa sem turno aberto, pede para abrir o caixa', modal_titulo(pg) == 'Abrir caixa', modal_titulo(pg))
    pg.fill('#valor-inicial', '-5')
    modal_ok(pg)
    T('B-02', 'Valor inicial negativo é recusado', modal_titulo(pg) == 'Abrir caixa' and modal_erro(pg) != '', modal_erro(pg))
    pg.fill('#valor-inicial', '100,00')
    modal_ok(pg)
    d = D(pg)
    T('B-03', 'Caixa abre com R$ 100,00 e registra operador', d['caixa']['aberto'] and d['caixa']['valorInicial'] == 100 and d['caixa']['operador'] == 'Ana Souza', d['caixa'])
    pg.wait_for_timeout(1200)   # deixa passar o aviso de sincronização da abertura do caixa
    pg.keyboard.press('Alt+3')
    pg.wait_for_timeout(80)
    T('A-07', 'Operadora não abre Administração (Alt+3)', 'não tem acesso' in toast(pg) and pg.is_hidden('#tela-admin'), toast(pg))
    add(pg, '2*leite')
    add(pg, 'arroz')
    T('B-04', '2*leite + arroz = R$ 38,88 (RF-41)', norm(total_txt(pg)) == norm('R$ 38,88'), total_txt(pg))
    T('B-05', 'Itens: 3 unidades no resumo', pg.inner_text('#venda-qtd').strip() == '3', pg.inner_text('#venda-qtd'))
    add(pg, 'produtoinexistente')
    T('B-06', 'Produto inexistente avisa e não lança', 'não encontrado' in toast(pg).lower() and len(D(pg)['produtos']) == 16 and pg.inner_text('#venda-qtd').strip() == '3', toast(pg))
    add(pg, 'pão de forma')
    T('B-07', 'Produto zerado (Pão de Forma) bloqueia a venda (RN-02)', 'sem estoque' in toast(pg).lower() and pg.inner_text('#venda-qtd').strip() == '3', toast(pg))
    add(pg, '99*café')
    T('B-08', 'Quantidade acima do estoque (99 de 4 Cafés) é bloqueada', 'só há 4' in toast(pg), toast(pg))
    add(pg, '0*leite')
    T('B-09', 'Quantidade 0 é inválida', 'inválida' in toast(pg).lower(), toast(pg))
    add(pg, '1000*leite')
    T('B-10', 'Quantidade 1000 é inválida (máx. 999)', 'inválida' in toast(pg).lower(), toast(pg))
    add(pg, 'açúcar')
    T('B-11', 'Produto com estoque baixo avisa mas deixa vender (RN-02)', 'estoque baixo' in toast(pg).lower() and pg.inner_text('#venda-qtd').strip() == '4', toast(pg))
    add(pg, '7891025101106')
    T('B-12', 'Código de barras exato soma ao item existente (leite vai a 3)', pg.evaluate("venda.itens.find(i=>i.codigo==='7891025101106').qtd") == 3)
    pg.fill('#busca-produto', 'leit')
    T('B-13', 'Sugestões aparecem ao digitar parte do nome', pg.is_visible('#busca-sugestoes') and 'Leite' in pg.inner_text('#busca-sugestoes'))
    pg.press('#busca-produto', 'Escape')
    limpar(pg, '#busca-produto')
    pg.fill('#busca-produto', 'leit'); pg.keyboard.press('Home'); pg.keyboard.press('Delete'); pg.wait_for_timeout(100)
    T('B-13b', 'Delete dentro do texto da busca apaga uma letra (não abre a senha do supervisor)', pg.input_value('#busca-produto') == 'eit' and modal_titulo(pg) == '', (pg.input_value('#busca-produto'), modal_titulo(pg)))
    if modal_titulo(pg): modal_cancelar(pg)
    limpar(pg, '#busca-produto')
    snap(pg, 'caixa-com-itens')
    # selecionar e remover com senha
    pg.keyboard.press('ArrowUp')
    sel = pg.evaluate('venda.sel')
    pg.press('#busca-produto', 'Delete')
    T('B-14', 'Del pede a senha do supervisor (RF-39)', 'supervisor' in modal_titulo(pg).lower(), modal_titulo(pg))
    pg.fill('#senha-supervisor', '0000')
    modal_ok(pg)
    T('B-15', 'Senha do supervisor errada: item continua e erro aparece', modal_erro(pg) != '' and pg.evaluate('venda.itens.length') == 3 and 'supervisor' in modal_titulo(pg).lower(), modal_erro(pg))
    pg.fill('#senha-supervisor', '9999')
    modal_ok(pg)
    T('B-16', 'Senha certa remove o item', pg.evaluate('venda.itens.length') == 2 and 'removido' in toast(pg).lower(), toast(pg))
    a = D(pg)['autorizacoes']
    T('B-17', 'Autorizações registradas (1 recusada e 1 aceita) com operador e ação (RN-10)', len(a) >= 2 and a[0]['ok'] is True and a[1]['ok'] is False and a[0]['operador'] == 'Ana Souza' and 'Remover' in a[0]['acao'], a[:2])
    pg.press('#busca-produto', 'F4')
    T('B-18', 'F4 (alterar quantidade) pede a senha', 'supervisor' in modal_titulo(pg).lower(), modal_titulo(pg))
    supervisor(pg, '9999')
    T('B-19', 'Depois da senha abre "Nova quantidade"', 'quantidade' in modal_titulo(pg).lower(), modal_titulo(pg))
    pg.fill('#nova-qtd', '9999')
    modal_ok(pg)
    T('B-20', 'Nova quantidade acima do estoque é recusada', 'insuficiente' in modal_erro(pg).lower(), modal_erro(pg))
    pg.fill('#nova-qtd', '2')
    modal_ok(pg)
    T('B-21', 'Nova quantidade válida é aplicada', pg.evaluate('venda.itens[venda.sel].qtd') == 2, pg.evaluate('venda.itens.map(i=>i.nome+":"+i.qtd)'))
    pg.press('#busca-produto', 'Escape'); pg.wait_for_timeout(200)
    DBG = pg.evaluate("({sug: document.querySelector('#busca-sugestoes').hidden, foco: document.activeElement.id || document.activeElement.tagName, itens: venda.itens.length, valor: document.querySelector('#busca-produto').value})")
    T('B-22', 'Esc com itens pede a senha para cancelar a venda', 'supervisor' in modal_titulo(pg).lower(), (modal_titulo(pg), DBG))
    supervisor(pg, '9999')
    T('B-23', 'Venda cancelada: carrinho vazio e nada registrado no estoque', pg.evaluate('venda.itens.length') == 0 and len(D(pg)['vendas']) == N0 and not any(m['tipo'] == 'venda' and m['data'][:10] == time.strftime('%Y-%m-%d', time.gmtime()) for m in D(pg)['movimentacoes']))
    # F10 sem itens
    pg.press('#busca-produto', 'F10')
    T('B-24', 'F10 sem itens avisa e não cria venda', 'ao menos um item' in toast(pg).lower() and len(D(pg)['vendas']) == N0, toast(pg))

    # --- pagamento dividido
    add(pg, '2*leite'); add(pg, 'arroz')
    pg.keyboard.press('F8')
    T('B-25', 'F8 foca o valor já preenchido com o total (R$ 38,88)', pg.input_value('#valor-recebido') == '38,88', pg.input_value('#valor-recebido'))
    pg.fill('#valor-recebido', '20')
    pg.press('#valor-recebido', 'Enter')
    st = pg.evaluate('situacaoPagamento()')
    T('B-26', 'Lança R$ 20 em dinheiro: faltam R$ 18,88', st['falta'] == 18.88 and st['pago'] == 20 and not st['completo'], st)
    T('B-27', 'Campo já vem com o que falta (18,88)', pg.input_value('#valor-recebido') == '18,88', pg.input_value('#valor-recebido'))
    pg.press('#valor-recebido', 'ArrowRight')
    T('B-28', '→ troca a forma para PIX', pg.evaluate('venda.pagamento') == 'PIX' and 'PIX' in pg.inner_text('#rotulo-valor'), pg.evaluate('venda.pagamento'))
    pg.press('#valor-recebido', 'ArrowLeft'); pg.press('#valor-recebido', 'ArrowLeft')
    T('B-29', '← volta e dá a volta pela lista (Dinheiro → Crédito)', pg.evaluate('venda.pagamento') == 'Crédito', pg.evaluate('venda.pagamento'))
    pg.press('#valor-recebido', 'ArrowRight')
    pg.press('#valor-recebido', 'ArrowRight')
    pg.fill('#valor-recebido', '100')
    pg.press('#valor-recebido', 'Enter')
    T('B-30', 'PIX acima do que falta é recusado, sem troco (RN-04)', 'não gera troco' in toast(pg) and len(pg.evaluate('venda.pagamentos')) == 1, toast(pg))
    pg.fill('#valor-recebido', '0')
    pg.press('#valor-recebido', 'Enter')
    T('B-31', 'Valor zero é recusado', 'maior que zero' in toast(pg), toast(pg))
    pg.fill('#valor-recebido', '18,88')
    pg.press('#valor-recebido', 'Enter')
    st = pg.evaluate('situacaoPagamento()')
    T('B-32', 'PIX R$ 18,88 completa o pagamento, sem troco', st['completo'] and st['troco'] == 0, st)
    T('B-33', 'Lista mostra as duas formas lançadas', pg.evaluate("document.querySelectorAll('#pag-lista li').length") == 2)
    snap(pg, 'caixa-pagamento-dividido')
    # remover um pagamento
    pg.click('#pag-lista li:nth-child(2) .icone-x')
    st = pg.evaluate('situacaoPagamento()')
    T('B-34', 'Remover o pagamento PIX volta a faltar R$ 18,88', st['falta'] == 18.88 and not st['completo'], st)
    pg.fill('#valor-recebido', '18,88'); pg.press('#valor-recebido', 'ArrowRight'); pg.press('#valor-recebido', 'ArrowRight') if False else None
    pg.evaluate("escolherPagamento('PIX')")
    pg.fill('#valor-recebido', '18,88'); pg.press('#valor-recebido', 'Enter')
    # mudar o carrinho depois de pagar apaga os pagamentos
    add(pg, 'feijão')
    T('B-35', 'Mudar a venda depois de lançar pagamento apaga os pagamentos', pg.evaluate('venda.pagamentos.length') == 0 and 'mudou' in toast(pg).lower(), toast(pg))
    pg.press('#busca-produto', 'Delete'); supervisor(pg, '9999')   # remove o feijão
    T('B-36', 'Total volta a R$ 38,88', norm(total_txt(pg)) == norm('R$ 38,88'), total_txt(pg))
    # finalizar com dividido via F10 (lança o que estiver no campo)
    pg.evaluate("escolherPagamento('Dinheiro')")
    pg.keyboard.press('F8')
    pg.fill('#valor-recebido', '20'); pg.press('#valor-recebido', 'Enter')
    pg.press('#valor-recebido', 'ArrowRight')
    pg.press('#valor-recebido', 'F10')   # F10 lança 18,88 em PIX e finaliza
    pg.wait_for_timeout(150)
    d = D(pg)
    v1 = d['vendas'][-1] if d['vendas'] else None
    T('B-37', 'F10 lança o resto digitado e finaliza a venda dividida', v1 and v1['pagamento'] == 'Dinheiro + PIX' and v1['total'] == 38.88 and v1['troco'] == 0, v1 and (v1['pagamento'], v1['total'], v1['troco']))
    T('B-38', 'Comprovante abre com TOTAL e as duas formas', pg.is_visible('#overlay-comprovante') and 'COMPROVANTE NÃO FISCAL' in pg.inner_text('#comprovante-corpo') and 'Dinheiro' in pg.inner_text('#comprovante-corpo') and 'PIX' in pg.inner_text('#comprovante-corpo') and '38,88' in pg.inner_text('#comprovante-corpo'))
    snap(pg, 'comprovante')
    pg.keyboard.press('Enter')
    T('B-39', 'Enter fecha o comprovante e devolve o foco à busca', pg.is_hidden('#overlay-comprovante') and pg.evaluate("document.activeElement.id") == 'busca-produto')
    T('B-40', 'Estoque baixou: leite 46 e arroz 17', {p['codigo']: p['qtd'] for p in d['produtos']}['7891025101106'] == 46 and {p['codigo']: p['qtd'] for p in d['produtos']}['7891000100103'] == 17)
    mv = [m for m in d['movimentacoes'] if m['tipo'] == 'venda']
    T('B-41', 'Movimentações de venda registradas (negativas, com nº da venda)', len(mv) == 2 and all(m['qtd'] < 0 and f'Venda nº {N0 + 1}' in m['motivo'] for m in mv), mv)
    T('B-42', 'Carrinho e campos zerados após finalizar', pg.evaluate('venda.itens.length') == 0 and pg.input_value('#valor-recebido') == '' and pg.inner_text('#venda-total').strip().endswith('0,00'))

    # --- troco em dinheiro
    add(pg, 'arroz'); add(pg, 'água')
    pg.keyboard.press('F8'); pg.fill('#valor-recebido', '50'); pg.press('#valor-recebido', 'Enter')
    st = pg.evaluate('situacaoPagamento()')
    T('B-43', 'Dinheiro maior que o total gera troco (R$ 50 em R$ 30,40 = R$ 19,60)', st['completo'] and st['troco'] == 19.6, st)
    pg.keyboard.press('F10'); pg.wait_for_timeout(120)
    d = D(pg); v2 = d['vendas'][-1]
    T('B-44', 'Venda 2: troco gravado e comprovante mostra Troco', v2['troco'] == 19.6 and 'Troco' in pg.inner_text('#comprovante-corpo'), v2['troco'])
    pg.keyboard.press('Enter')
    # --- F10 sem digitar nada: recebe o total na forma escolhida
    add(pg, 'detergente')
    pg.evaluate("escolherPagamento('Crédito')")
    limpar(pg, '#valor-recebido')
    pg.press('#busca-produto', 'F10'); pg.wait_for_timeout(120)
    d = D(pg); v3 = d['vendas'][-1]
    T('B-45', 'F10 sem valor recebe o total na forma escolhida (Crédito)', v3['pagamento'] == 'Crédito' and v3['recebido'] == v3['total'], (v3['pagamento'], v3['recebido']))
    pg.keyboard.press('Enter')
    # --- pagamento incompleto bloqueia
    add(pg, 'café')
    pg.keyboard.press('F8'); pg.fill('#valor-recebido', '5'); pg.press('#valor-recebido', 'Enter')
    limpar(pg, '#valor-recebido'); pg.press('#valor-recebido', 'F10')
    T('B-46', 'Pagamento incompleto não finaliza (RN-03)', len(D(pg)['vendas']) == N0 + 3 and 'Falta receber' in toast(pg), toast(pg))
    pg.press('#valor-recebido', 'Escape'); supervisor(pg, '9999')
    # venda de 1 un. de café (estoque 4 -> 3)
    # --- fechar caixa
    add(pg, 'arroz')
    pg.keyboard.press('F9')
    T('B-47', 'F9 com venda em andamento não fecha o caixa', 'cancele' in toast(pg).lower() or 'finalize' in toast(pg).lower(), toast(pg))
    pg.press('#busca-produto', 'Escape'); supervisor(pg, '9999')
    pg.keyboard.press('F9')
    T('B-48', 'F9 abre o resumo do turno', 'Fechar caixa' in modal_titulo(pg), modal_titulo(pg))
    corpo = norm(pg.inner_text('#modal-corpo'))
    d = D(pg)
    turno = d['vendas'][N0:]
    tot = round(sum(v['total'] for v in turno), 2)
    din = round(sum(x['valor'] for v in turno for x in v['pagamentos'] if x['forma'] == 'Dinheiro') - sum(v['troco'] for v in turno), 2)
    esperado = round(100 + din, 2)
    T('B-49', f'Resumo: total vendido {brl(tot)} em 3 vendas e gaveta {brl(esperado)}', norm(brl(tot)) in corpo and norm(brl(esperado)) in corpo and '3 vendas' in corpo, corpo)
    snap(pg, 'fechar-caixa')
    modal_ok(pg)
    T('B-50', 'Caixa fechado e registrado na fila', D(pg)['caixa']['aberto'] is False and any('Fechamento de caixa' in f['descricao'] for f in D(pg)['fila'] + D(pg)['logSync']))
    add(pg, 'arroz')
    T('B-51', 'Com o caixa fechado, vender volta a pedir abertura (RN-01)', modal_titulo(pg) == 'Abrir caixa', modal_titulo(pg))
    pg.fill('#valor-inicial', '50,00'); modal_ok(pg)
    add(pg, 'arroz')
    T('B-52', 'Novo turno abre e a venda segue', pg.evaluate('venda.itens.length') == 1)
    pg.press('#busca-produto', 'Escape'); supervisor(pg, '9999')
    # sair com venda aberta
    add(pg, 'arroz')
    sair(pg)
    T('B-53', 'Sair com venda em andamento é bloqueado', 'antes de sair' in toast(pg).lower() and pg.is_visible('#app'), toast(pg))
    pg.press('#busca-produto', 'Escape'); supervisor(pg, '9999')

    # =====================================================================
    # C · ESTOQUE (Ana não acessa; Carlos opera)
    # =====================================================================
    pg.keyboard.press('Alt+2'); pg.wait_for_timeout(100)
    T('C-01', 'Operadora não abre o Estoque (Alt+2): o caixa só vê o Caixa', 'não tem acesso' in toast(pg) and pg.is_hidden('#tela-estoque'), toast(pg))
    pg.keyboard.press('F6'); pg.wait_for_timeout(60)
    T('C-02', 'Operadora não consegue abrir "Novo produto" pelo atalho', modal_titulo(pg) == '', modal_titulo(pg))
    sair(pg)

    login(pg, 'Carlos Melo')
    T('C-03', 'Estoquista entra direto no Estoque e só vê essa tela', nav_visivel(pg) == ['estoque'] and pg.is_visible('#tela-estoque'), nav_visivel(pg))
    pg.keyboard.press('Alt+1'); pg.wait_for_timeout(60)
    T('C-04', 'Estoquista não acessa o Caixa', 'não tem acesso' in toast(pg) and pg.is_hidden('#tela-caixa'), toast(pg))
    linhas = pg.evaluate("document.querySelectorAll('#tabela-estoque tr').length")
    T('C-05', 'Tabela lista os 16 produtos', linhas == 16, linhas)
    crit = [x for x in D(pg)['produtos'] if x['qtd'] <= x['minimo']]
    n_alertas = pg.evaluate("document.querySelectorAll('#alertas-estoque .alerta').length")
    T('C-06', f'Alertas listam os {len(crit)} produtos no mínimo ou abaixo (RF-20)', n_alertas == len(crit), (n_alertas, [c['nome'] for c in crit]))
    pg.fill('#filtro-estoque', 'leite')
    T('C-07', 'Filtro por texto "leite" mostra só o leite', pg.evaluate("document.querySelectorAll('#tabela-estoque tr').length") == 1)
    pg.fill('#filtro-estoque', '')
    pg.select_option('#filtro-situacao', index=2)   # segunda opção após "todas"
    sit = pg.evaluate("document.querySelector('#filtro-situacao').value")
    pill = set(pg.evaluate("[...document.querySelectorAll('#tabela-estoque .pill')].map(e=>e.textContent)"))
    T('C-08', f'Filtro de situação ({sit}) mostra só essa situação', pill == {sit} and len(pill) == 1, pill)
    pg.select_option('#filtro-situacao', index=0)
    # novo produto
    def novo_prod(codigo, nome, preco, qtd='0', minimo='1', local='E1'):
        pg.keyboard.press('F6'); pg.wait_for_timeout(60)
        pg.fill('#f-codigo', codigo); pg.fill('#f-nome', nome); pg.fill('#f-preco', preco)
        pg.fill('#f-minimo', minimo); pg.fill('#f-qtd', qtd); pg.fill('#f-local', local)
        modal_ok(pg)
    novo_prod('1234567', 'Curto', '5')
    T('C-09', 'Código com 7 dígitos é recusado', '8 a 14' in modal_erro(pg), modal_erro(pg)); modal_cancelar(pg)
    novo_prod('ABC12345', 'Letras', '5')
    T('C-10', 'Código com letras é recusado', '8 a 14' in modal_erro(pg), modal_erro(pg)); modal_cancelar(pg)
    novo_prod('7891025101106', 'Repetido', '5')
    T('C-11', 'Código repetido é recusado', 'já cadastrado' in modal_erro(pg), modal_erro(pg)); modal_cancelar(pg)
    novo_prod('7890000000011', 'Sem preço', '0')
    T('C-12', 'Preço zero é recusado', 'preço' in modal_erro(pg).lower(), modal_erro(pg)); modal_cancelar(pg)
    novo_prod('7890000000011', 'Negativo', '5', qtd='-3')
    T('C-13', 'Quantidade inicial negativa é recusada', 'negativ' in modal_erro(pg).lower(), modal_erro(pg)); modal_cancelar(pg)
    novo_prod('7890000000011', 'Biscoito Teste', '3,50', qtd='5', minimo='2', local='b4')
    d = D(pg); np_ = next((x for x in d['produtos'] if x['codigo'] == '7890000000011'), None)
    T('C-14', 'Produto válido é cadastrado (preço 3,50, local em maiúsculas)', np_ and np_['preco'] == 3.5 and np_['qtd'] == 5 and np_['local'] == 'B4', np_)
    T('C-15', 'Estoque inicial gera movimentação de entrada', any(m['codigo'] == '7890000000011' and m['tipo'] == 'entrada' and m['qtd'] == 5 for m in d['movimentacoes']))
    T('C-16', 'Painel do produto mostra histórico e a prateleira fica em destaque (RF-19, RF-23)', pg.is_visible('#painel-produto') and pg.evaluate("document.querySelectorAll('#mapa-armazem .destaque').length") == 1)
    # entrada
    pg.keyboard.press('F4'); pg.wait_for_timeout(60)
    pg.select_option('#e-produto', value='7896036090245'); pg.fill('#e-qtd', '0'); modal_ok(pg)
    T('C-17', 'Entrada com quantidade 0 é recusada', modal_erro(pg) != '', modal_erro(pg))
    pg.fill('#e-qtd', '10'); modal_ok(pg)
    T('C-18', 'Entrada de 10 óleos: estoque 30 → 40', {x['codigo']: x['qtd'] for x in D(pg)['produtos']}['7896036090245'] == 40)
    # ajuste
    pg.click('#tabela-estoque tr[data-codigo="7896036090245"]')
    pg.click('[data-acao="ajuste"]'); pg.wait_for_timeout(60)
    pg.fill('#a-qtd', '38'); modal_ok(pg)
    T('C-19', 'Ajuste sem motivo é recusado (RF-21)', 'motivo' in modal_erro(pg).lower(), modal_erro(pg))
    pg.select_option('#a-motivo', label='Perda'); modal_ok(pg)
    d = D(pg); aj = [m for m in d['movimentacoes'] if m['tipo'] == 'ajuste']
    T('C-20', 'Ajuste para 38 grava diferença -2 com motivo Perda', {x['codigo']: x['qtd'] for x in d['produtos']}['7896036090245'] == 38 and aj and aj[-1]['qtd'] == -2 and aj[-1]['motivo'] == 'Perda', aj)
    # editar
    pg.click('[data-acao="editar-produto"]'); pg.wait_for_timeout(60)
    ro = pg.evaluate("document.querySelector('#f-codigo').readOnly")
    pg.fill('#f-preco', '8,00'); modal_ok(pg)
    T('C-21', 'Editar produto: código bloqueado e novo preço salvo', ro and {x['codigo']: x['preco'] for x in D(pg)['produtos']}['7896036090245'] == 8.0)
    # CSV
    pg.keyboard.press('F7'); pg.wait_for_timeout(80)
    T('C-22', 'F7 abre a importação em lote', 'Importar' in modal_titulo(pg), modal_titulo(pg))
    with pg.expect_download() as dl:
        pg.click('[data-acao="baixar-modelo"]')
    nome_arq = dl.value.suggested_filename
    dl.value.save_as('/tmp/qa/modelo.csv')
    modelo = open('/tmp/qa/modelo.csv', encoding='utf-8-sig').read()
    T('C-23', 'Modelo .csv baixa com cabeçalho e exemplos', nome_arq.endswith('.csv') and modelo.startswith('codigo;nome;categoria;preco;quantidade;minimo;local') and modelo.count('\n') >= 3, nome_arq)
    csv = ('codigo;nome;categoria;preco;quantidade;minimo;local\r\n'
           '7896022204051;Macarrão 500g;Mercearia;4,99;30;10;A4\r\n'     # ok
           '7891000315507;Biscoito 130g;Mercearia;2,79;40;12;B3\r\n'     # ok
           '123;Código curto;Geral;1,00;1;1;X1\r\n'                       # código inválido
           '7891025101106;Leite repetido;Laticínios;5,00;1;1;B2\r\n'      # já cadastrado
           '7896022204051;Repetido na planilha;Geral;1,00;1;1;X2\r\n'     # repetido na planilha
           '7890000000099;Sem preço;Geral;;1;1;X3\r\n'                    # preço vazio
           '7890000000088;Qtd negativa;Geral;2,00;-4;1;X4\r\n')           # quantidade negativa
    open('/tmp/qa/lote.csv', 'w', encoding='utf-8').write(csv)
    pg.set_input_files('#arquivo-csv', '/tmp/qa/lote.csv'); pg.wait_for_timeout(250)
    prev = norm(pg.inner_text('#previa-importacao'))
    T('C-24', 'Prévia: 2 válidas e 5 recusadas, nada gravado ainda', '2 válidas' in prev and '5 recusadas' in prev and not any(x['codigo'] == '7896022204051' for x in D(pg)['produtos']), prev[:120])
    T('C-25', 'Cada erro tem o motivo certo', all(s in prev for s in ['8 a 14 números', 'já cadastrado', 'repetido na planilha', 'preço vazio', 'quantidade negativa']), prev)
    snap(pg, 'importacao-previa')
    modal_ok(pg)
    d = D(pg); codigos = {x['codigo'] for x in d['produtos']}
    T('C-26', 'Importa só as 2 válidas (19 produtos no total) com entrada de estoque', {'7896022204051', '7891000315507'} <= codigos and '123' not in codigos and '7890000000099' not in codigos and len(d['produtos']) == 19 and any('Importação em lote' in m['motivo'] for m in d['movimentacoes']), len(d['produtos']))
    pg.keyboard.press('F7'); pg.wait_for_timeout(60)
    open('/tmp/qa/ruim.csv', 'w').write('foo;bar\r\n1;2\r\n')
    pg.set_input_files('#arquivo-csv', '/tmp/qa/ruim.csv'); pg.wait_for_timeout(200)
    T('C-27', 'Planilha com cabeçalho inválido mostra erro claro', 'Cabeçalho inválido' in modal_erro(pg), modal_erro(pg))
    modal_ok(pg)
    T('C-28', 'Importar sem escolher arquivo é recusado', modal_erro(pg) != '' or modal_titulo(pg) != '', modal_erro(pg)); modal_cancelar(pg)
    sair(pg)

    # =====================================================================
    # D · ADMINISTRAÇÃO (Marta)
    # =====================================================================
    login(pg, 'Marta Alves')
    T('D-01', 'Administradora vê as 3 telas', nav_visivel(pg) == ['caixa', 'estoque', 'admin'], nav_visivel(pg))
    pg.keyboard.press('Alt+3'); pg.wait_for_timeout(120)
    d = D(pg)
    hoje = [v for v in d['vendas'] if pg.evaluate('x => mesmoDia(new Date(x.data), new Date())', v)]
    tot = round(sum(v['total'] for v in hoje), 2)
    kt = norm(pg.inner_text('#kpi-total'))
    T('D-02', f'KPI "vendido hoje" = {brl(tot)} e {len(hoje)} vendas', kt == norm(brl(tot)) and pg.inner_text('#kpi-qtd').startswith(str(len(hoje))), (kt, pg.inner_text('#kpi-qtd')))
    T('D-03', 'Ticket médio correto', norm(pg.inner_text('#kpi-ticket')) == norm(brl(round(sum(v['total'] for v in hoje) / len(hoje), 2))), pg.inner_text('#kpi-ticket'))
    crit = len([x for x in d['produtos'] if x['ativo'] and x['qtd'] <= x['minimo']])
    T('D-04', 'KPI de produtos críticos bate com o estoque', pg.inner_text('#kpi-critico').strip() == str(crit), (pg.inner_text('#kpi-critico'), crit))
    T('D-05', 'Gráfico de 7 dias e de formas de pagamento desenhados', pg.evaluate("document.querySelectorAll('#grafico-dias svg rect, #grafico-dias .coluna, #grafico-dias [class*=col]').length") > 0 and len(pg.inner_text('#grafico-pagamentos')) > 10, pg.inner_text('#grafico-pagamentos')[:60])
    snap(pg, 'admin')
    pg.select_option('#filtro-vendas-periodo', value='hoje')
    n_linhas = pg.evaluate("document.querySelectorAll('#tabela-vendas tr').length")
    T('D-06', 'Filtro "hoje" na lista de vendas mostra só as vendas de hoje', n_linhas == len(hoje), (n_linhas, len(hoje)))
    pg.select_option('#filtro-vendas-pagamento', label='PIX')
    n_pix = pg.evaluate("document.querySelectorAll('#tabela-vendas tr').length")
    esp_pix = len([v for v in hoje if any(x['forma'] == 'PIX' for x in v['pagamentos'])])
    T('D-07', f'Filtro PIX mostra só as {esp_pix} vendas com PIX (inclui dividida)', n_pix == esp_pix, n_pix)
    pg.select_option('#filtro-vendas-pagamento', index=0)
    pg.click('#tabela-vendas [data-comprovante]')
    T('D-08', 'Reemitir comprovante pela lista', pg.is_visible('#overlay-comprovante') and 'COMPROVANTE' in pg.inner_text('#comprovante-corpo'))
    pg.keyboard.press('Escape')
    rk = pg.inner_text('#ranking-produtos')
    d7 = D(pg); lim = pg.evaluate('ultimosDias(7)[0].toISOString()'); rkc = {}
    for v in d7['vendas']:
        if v['data'] >= lim:
            for i in v['itens']: rkc[i['nome']] = rkc.get(i['nome'], 0) + i['qtd']
    top = sorted(rkc.items(), key=lambda x: -x[1])[0]
    T('D-09', f'Ranking dos 7 dias: líder {top[0]} com {top[1]} un.', rk.strip().startswith(top[0]) and f'{top[1]} un.' in rk, rk[:70])
    aut = pg.inner_text('#tabela-autorizacoes')
    T('D-10', 'Registro de autorizações mostra aceitas e senhas incorretas', 'Autorizada' in aut and 'Senha incorreta' in aut)
    T('D-11', 'Log de sincronização lista os eventos', len(pg.inner_text('#log-sync')) > 20)
    # usuários
    pg.click('[data-acao="novo-usuario"]'); pg.wait_for_timeout(60)
    pg.fill('#u-nome', ''); pg.fill('#u-senha', '12'); modal_ok(pg)
    T('D-12', 'Novo usuário sem nome/senha curta é recusado', modal_erro(pg) != '', modal_erro(pg))
    pg.fill('#u-nome', 'ana souza'); pg.fill('#u-senha', 'abcd'); modal_ok(pg)
    T('D-13', 'Nome duplicado é recusado (sem diferenciar maiúsculas)', 'Já existe' in modal_erro(pg), modal_erro(pg))
    pg.fill('#u-nome', 'Teste QA'); pg.fill('#u-senha', 'qa123'); modal_ok(pg)
    d = D(pg); u = next((x for x in d['usuarios'] if x['nome'] == 'Teste QA'), None)
    T('D-14', 'Usuário criado como operador, ativo, senha com hash', u and u['perfil'] == 'operador' and u['ativo'] and u['senha'].startswith('demo$') and 'qa123' not in json.dumps(u), u)
    pg.click(f'[data-usuario-ativo="{u["id"]}"]')
    T('D-15', 'Desativar usuário', next(x for x in D(pg)['usuarios'] if x['nome'] == 'Teste QA')['ativo'] is False)
    pg.click(f'[data-usuario-ativo="{u["id"]}"]')
    pid = next(x for x in D(pg)['usuarios'] if x['nome'] == 'Marta Alves')['id']
    pg.click(f'[data-usuario-ativo="{pid}"]');
    T('D-16', 'Não desativa o único administrador (T-AD-10)', 'único administrador' in toast(pg) and next(x for x in D(pg)['usuarios'] if x['nome'] == 'Marta Alves')['ativo'], toast(pg))
    pg.select_option(f'[data-usuario-perfil="{pid}"]', value='operador'); pg.wait_for_timeout(80)
    T('D-17', 'Não rebaixa o único administrador', 'pelo menos um administrador' in toast(pg) and next(x for x in D(pg)['usuarios'] if x['nome'] == 'Marta Alves')['perfil'] == 'admin', toast(pg))
    # senha do supervisor
    pg.click('[data-acao="trocar-senha-supervisor"]'); pg.wait_for_timeout(60)
    pg.fill('#s-atual', 'xxxx'); pg.fill('#s-nova', '8888'); modal_ok(pg)
    T('D-18', 'Trocar senha do supervisor com senha atual errada é recusado', 'atual incorreta' in modal_erro(pg), modal_erro(pg))
    pg.fill('#s-atual', '9999'); pg.fill('#s-nova', '12'); modal_ok(pg)
    T('D-19', 'Nova senha curta é recusada', '4 ou mais' in modal_erro(pg), modal_erro(pg))
    pg.fill('#s-nova', '8888'); modal_ok(pg)
    T('D-20', 'Senha do supervisor trocada', 'alterada' in toast(pg).lower(), toast(pg))
    sair(pg)

    # --- novo usuário consegue entrar; senha antiga do supervisor deixa de valer
    login(pg, 'Teste QA', 'qa123')
    T('D-21', 'Usuário criado entra com a senha definida', pg.is_visible('#app') and pg.inner_text('#usuario-nome') == 'Teste QA')
    if modal_titulo(pg) == 'Abrir caixa': pg.fill('#valor-inicial', '10'); modal_ok(pg)
    add(pg, 'arroz')
    pg.press('#busca-produto', 'Delete'); pg.fill('#senha-supervisor', '9999'); modal_ok(pg)
    T('D-22', 'Senha antiga do supervisor (9999) deixa de funcionar', modal_erro(pg) != '' and pg.evaluate('venda.itens.length') == 1, modal_erro(pg))
    pg.fill('#senha-supervisor', '8888'); modal_ok(pg)
    T('D-23', 'Nova senha (8888) autoriza', pg.evaluate('venda.itens.length') == 0)
    sair(pg)

    # =====================================================================
    # E · OFFLINE E FILA
    # =====================================================================
    login(pg, 'Ana Souza')
    pg.wait_for_timeout(1500)
    pg.click('#status-rede'); pg.wait_for_timeout(80)
    T('E-01', 'Clicar em Online simula queda: aparece Offline', 'Offline' in pg.inner_text('#status-texto'), pg.inner_text('#status-texto'))
    if modal_titulo(pg) == 'Abrir caixa': pg.fill('#valor-inicial', '30'); modal_ok(pg)
    antes = len(D(pg)['vendas'])
    add(pg, 'arroz'); pg.keyboard.press('F10'); pg.wait_for_timeout(150)
    d = D(pg)
    T('E-02', 'Venda offline é gravada como pendente e entra na fila', len(d['vendas']) == antes + 1 and d['vendas'][-1]['status'] == 'pendente' and len(d['fila']) >= 1, (d['vendas'][-1]['status'], len(d['fila'])))
    T('E-03', 'Comprovante avisa que foi registrada offline', 'offline' in pg.inner_text('#comprovante-corpo').lower())
    T('E-04', 'Contador de pendentes aparece no topo', re.search(r'[1-9]\d* pendente', pg.inner_text('#status-texto')) is not None, pg.inner_text('#status-texto'))
    pg.keyboard.press('Enter')
    pg.click('#status-rede'); pg.wait_for_timeout(1800)
    d = D(pg)
    T('E-05', 'Ao voltar a internet a fila sincroniza sozinha e a venda vira "sincronizado"', len(d['fila']) == 0 and d['vendas'][-1]['status'] == 'sincronizado' and '0 pendentes' in pg.inner_text('#status-texto'), (len(d['fila']), d['vendas'][-1]['status']))
    pg.evaluate("D.fila.push({id:'x',tipo:'t',descricao:'teste manual',data:new Date().toISOString(),usuario:'qa'})")
    pg.click('#status-rede'); pg.wait_for_timeout(80); pg.click('[data-acao="sincronizar"]') if pg.query_selector('[data-acao="sincronizar"]') and pg.is_visible('[data-acao="sincronizar"]') else None
    pg.click('#status-rede'); pg.wait_for_timeout(1500)
    T('E-06', 'Estando offline nada é enviado; ao reconectar, tudo é', len(D(pg)['fila']) == 0)

    # =====================================================================
    # F · PERSISTÊNCIA, TEMA, PWA
    # =====================================================================
    n_vendas = len(D(pg)['vendas'])
    pg.reload(); pg.wait_for_selector('#login-usuario')
    d2 = D(pg)
    T('F-01', 'Dados persistem ao recarregar a página', len(d2['vendas']) == n_vendas and any(u['nome'] == 'Teste QA' for u in d2['usuarios']), (len(d2['vendas']), n_vendas))
    T('F-02', 'Depois de recarregar é preciso entrar de novo (sessão não persiste)', pg.is_visible('#tela-login') and pg.is_hidden('#app'))
    t0 = pg.evaluate("document.documentElement.dataset.theme")
    pg.keyboard.press('Alt+T'); t1 = pg.evaluate("document.documentElement.dataset.theme")
    T('F-03', 'Alt+T alterna o tema', t0 != t1, (t0, t1))
    pg.reload(); pg.wait_for_selector('#login-usuario')
    T('F-04', 'O tema escolhido é lembrado após recarregar', pg.evaluate("document.documentElement.dataset.theme") == t1)
    mf = pg.evaluate("document.querySelector('link[rel=manifest]') && document.querySelector('link[rel=manifest]').href")
    T('F-05', 'Manifesto PWA declarado', bool(mf), mf)
    pg.wait_for_timeout(1200)
    reg = pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)")
    T('F-06', 'Service worker registrado (funciona fora do navegador / offline)', reg)
    ctx.set_offline(True)
    try:
        pg.reload(); pg.wait_for_selector('#login-usuario', timeout=5000); ok = True
    except Exception as e:
        ok = False
    ctx.set_offline(False)
    T('F-07', 'Com a rede cortada, o app abre pelo cache', ok)

    # =====================================================================
    # G · INTEGRIDADE DOS DADOS
    # =====================================================================
    d = D(pg)
    bad = []
    for v in d['vendas']:
        if round(sum(i['preco'] * i['qtd'] for i in v['itens']), 2) != round(v['total'], 2): bad.append(('total', v['numero']))
        if round(sum(x['valor'] for x in v['pagamentos']) - v['troco'], 2) != round(v['total'], 2): bad.append(('pagamentos', v['numero']))
        if v['troco'] > 0 and not any(x['forma'] == 'Dinheiro' for x in v['pagamentos']): bad.append(('troco sem dinheiro', v['numero']))
    T('G-01', 'Em toda venda: itens = total e pagamentos − troco = total; troco só com dinheiro', not bad, bad)
    soma = {}
    for m in d['movimentacoes'][M0:]: soma[m['codigo']] = soma.get(m['codigo'], 0) + m['qtd']
    bad = [(x['nome'], x['qtd'], INICIAL.get(x['codigo'], 0) + soma.get(x['codigo'], 0)) for x in d['produtos'] if x['qtd'] != INICIAL.get(x['codigo'], 0) + soma.get(x['codigo'], 0)]
    T('G-02', 'Estoque de todo produto = estoque inicial + soma das movimentações (RN-08)', not bad, bad)
    T('G-03', 'Nenhum produto com estoque negativo', all(x['qtd'] >= 0 for x in d['produtos']))
    nums = [v['numero'] for v in d['vendas']]
    T('G-04', 'Números de venda sequenciais e ids únicos (RN-09)', nums == list(range(1, len(nums) + 1)) and len({v['id'] for v in d['vendas']}) == len(nums), nums)

    # =====================================================================
    # H · LAYOUT DO CAIXA (relato: botão de pagamento atrás do botão grande)
    # =====================================================================
    for (w, h, escala) in [(1366, 768, 1), (1280, 720, 1), (1100, 700, 1), (1024, 600, 1), (1920, 1080, 1), (1366, 768, 1.25), (1366, 768, 1.5), (1280, 720, 1.5), (1024, 768, 1.5)]:
        c2, p2 = novo(br, int(w / escala), int(h / escala))
        login(p2, 'Ana Souza'); p2.fill('#valor-inicial', '100'); modal_ok(p2)
        for t in ['arroz', 'feijão', 'leite', 'óleo']: add(p2, t)
        p2.keyboard.press('F8'); p2.fill('#valor-recebido', '10'); p2.press('#valor-recebido', 'Enter')
        p2.press('#valor-recebido', 'ArrowRight'); p2.fill('#valor-recebido', '10'); p2.press('#valor-recebido', 'Enter')
        p2.press('#valor-recebido', 'ArrowRight'); p2.fill('#valor-recebido', '10'); p2.press('#valor-recebido', 'Enter')
        caixas = p2.evaluate("""() => {
          const els = [...document.querySelectorAll('.caixa-dir > *')].map(e => { const r = e.getBoundingClientRect(); return {c: e.className || e.tagName, t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height, sh: e.scrollHeight, ch: e.clientHeight}; });
          const bad = [];
          for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
            const a = els[i], b = els[j];
            const ov = Math.min(a.b, b.b) - Math.max(a.t, b.t);
            const hx = Math.min(a.r, b.r) - Math.max(a.l, b.l);
            if (ov > 1 && hx > 1) bad.push([a.c, b.c, Math.round(ov)]);
          }
          const filhos = [...document.querySelectorAll('.pagamento button, .pagamento input, .btn-finalizar')].map(e => { const r = e.getBoundingClientRect(); const pai = e.closest('.card, .caixa-dir > *') .getBoundingClientRect(); return (r.right > pai.right + 1 || r.left < pai.left - 1) ? e.textContent.trim().slice(0, 20) : null }).filter(Boolean);
          const overflowPag = (() => { const c = document.querySelector('.pagamento'); return c.scrollHeight - c.clientHeight; })();
          return {bad, filhos, overflowPag, cols: els.length};
        }""")
        T(f'H-{w}x{h}@{escala}', f'Caixa {w}x{h} zoom {int(escala*100)}%: blocos da direita não se sobrepõem', not caixas['bad'] and not caixas['filhos'] and caixas['overflowPag'] <= 1, caixas)
        if (w, h, escala) in [(1366, 768, 1), (1024, 768, 1.5)]: snap(p2, f'caixa-layout-{w}x{h}-{escala}')
        c2.close()

    # =====================================================================
    # I · IMPRESSÃO DO COMPROVANTE (relato da Alice: 3 folhas)
    # =====================================================================
    c3, p3 = novo(br)
    login(p3, 'Ana Souza'); p3.fill('#valor-inicial', '100'); modal_ok(p3)
    add(p3, '2*leite'); add(p3, 'arroz'); p3.keyboard.press('F10'); p3.wait_for_timeout(150)
    p3.pdf(path='/tmp/qa/comprovante.pdf', prefer_css_page_size=True)
    npag = len(re.findall(rb'/Type\s*/Page[^s]', open('/tmp/qa/comprovante.pdf', 'rb').read()))
    T('I-01', 'Comprovante imprime em 1 folha', npag == 1, f'{npag} página(s)')
    p3.emulate_media(media='print')
    vis = p3.evaluate("[...document.querySelectorAll('#app, #tela-login')].map(e => getComputedStyle(e).display)")
    T('I-02', 'Na impressão o app some e só o comprovante aparece', all(x == 'none' for x in vis) and p3.is_visible('#comprovante-corpo'), vis)
    p3.emulate_media(media='screen')
    c3.close()

    # =====================================================================
    # J · CONTRASTE (meta AA do Design System)
    # =====================================================================
    def lum(c):
        r, g, b = [x / 255 for x in c]
        f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    def ratio(a, b):
        la, lb = sorted([lum(a), lum(b)], reverse=True)
        return (la + 0.05) / (lb + 0.05)
    c4, p4 = novo(br)
    login(p4, 'Marta Alves'); p4.fill('#valor-inicial', '100'); modal_ok(p4)
    add(p4, 'arroz'); p4.keyboard.press('F8'); p4.fill('#valor-recebido', '5'); p4.press('#valor-recebido', 'Enter')
    pares = p4.evaluate("""() => {
      const rgb = s => (s.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
      const fundo = e => { while (e) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c.slice(0, 3); e = e.parentElement; } return [255, 255, 255]; };
      const q = (sel, nome) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return {nome, fg: rgb(cs.color).slice(0, 3), bg: fundo(e), tam: parseFloat(cs.fontSize), peso: parseInt(cs.fontWeight)}; };
      return [q('#titulo-tela', 'Título'), q('#itens-venda td', 'Texto da tabela'), q('#itens-venda small', 'Texto auxiliar'), q('.muted', 'Texto discreto'), q('.btn-primary', 'Botão primário'), q('.total h2', 'Rótulo do total'), q('#venda-total', 'Total (etiqueta amarela)'), q('#pag-saldo span', 'Falta'), q('#pag-saldo-valor', 'Valor que falta'), q('th', 'Cabeçalho da tabela'), q('.kbd', 'Tecla'), q('#status-texto', 'Status de rede'), q('#nav button', 'Menu'), q('#atalhos', 'Barra de atalhos'), q('#usuario-nome', 'Nome do usuário')].filter(Boolean);
    }""")
    claro = {}
    for tema in ['light', 'dark']:
        p4.evaluate(f"aplicarTema('{tema}')"); p4.wait_for_timeout(250)
        pares = p4.evaluate("""() => {
          const rgb = s => (s.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
          const fundo = e => { while (e) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c.slice(0, 3); e = e.parentElement; } return [255, 255, 255]; };
          const q = (sel, nome) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return {nome, fg: rgb(cs.color).slice(0, 3), bg: fundo(e), tam: parseFloat(cs.fontSize), peso: parseInt(cs.fontWeight)}; };
          return [q('#titulo-tela', 'Título'), q('#itens-venda td', 'Texto da tabela'), q('#itens-venda small', 'Texto auxiliar'), q('.muted', 'Texto discreto'), q('.btn-primary', 'Botão primário'), q('#venda-total', 'Total (etiqueta amarela)'), q('#pag-saldo-valor', 'Valor que falta'), q('th', 'Cabeçalho da tabela'), q('#status-texto', 'Status de rede'), q('#nav button', 'Menu'), q('#atalhos', 'Barra de atalhos'), q('#usuario-nome', 'Nome do usuário')].filter(Boolean);
        }""")
        falhas = []
        for x in pares:
            r_ = ratio(x['fg'], x['bg']); grande = x['tam'] >= 24 or (x['tam'] >= 18.66 and x['peso'] >= 700)
            meta = 3.0 if grande else 4.5
            claro.setdefault(tema, []).append((x['nome'], round(r_, 2), meta))
            if r_ < meta: falhas.append((x['nome'], round(r_, 2), meta))
        T(f'J-{tema}', f'Contraste AA no tema {"claro" if tema == "light" else "escuro"} ({len(pares)} elementos medidos)', not falhas, falhas)
    c4.close()

    # =====================================================================
    # K · reset de dados de exemplo
    # =====================================================================
    c5, p5 = novo(br)
    login(p5, 'Marta Alves')
    if modal_titulo(p5) == 'Abrir caixa': p5.fill('#valor-inicial', '10'); modal_ok(p5)
    p5.keyboard.press('Alt+3'); p5.wait_for_timeout(80)
    p5.evaluate("D.vendas.push({id:'a',numero:1,data:new Date().toISOString(),operador:'x',itens:[],total:1,pagamento:'PIX',pagamentos:[{forma:'PIX',valor:1}],recebido:1,troco:0,status:'sincronizado'})")
    p5.click('[data-acao="resetar"] >> visible=true'); p5.wait_for_timeout(60); modal_ok(p5)
    T('K-01', 'Restaurar dados de exemplo apaga as vendas e volta ao login', len(D(p5)['vendas']) == N0 and p5.is_visible('#tela-login'))
    c5.close()

    T('Z-01', 'Nenhum erro de JavaScript no console durante toda a bateria', not ERROS_JS, ERROS_JS[:5])
    br.close()

ok = sum(1 for r in RES if r[2]); print(f'\nTOTAL {len(RES)} · passou {ok} · falhou {len(RES)-ok}')
json.dump(RES, open('/tmp/qa/resultado.json', 'w'), ensure_ascii=False, indent=1)
