/* =========================================================
   PDV de Bolso — Protótipo v0.1
   Lógica das telas: login, Caixa, Estoque e Administração.
   Os comentários indicam o requisito (RF/RNF/RN) atendido.
   ========================================================= */

/* ---------- estado ---------- */
let D = carregarDados();               // dados persistidos (produtos, vendas, usuários…)
let sessao = null;                     // usuário logado
let telaAtual = null;
let offlineSimulado = false;           // botão de status (RF-34)
let venda = novaVenda();
let sugestaoAtiva = -1;
let produtoSelecionado = null;         // tela de Estoque
let modalAtual = null;                 // { aoConfirmar, aoCancelar }
let ultimaVendaComprovante = null;

const PERFIS = {
  admin:    { nome: 'Administrador',     telas: ['caixa', 'estoque', 'admin'] },
  operador: { nome: 'Operador de caixa', telas: ['caixa', 'estoque'] },   // estoque só consulta
  estoque:  { nome: 'Estoquista',        telas: ['estoque'] },
};
const TITULOS = {
  caixa:   ['Caixa', 'Venda rápida pelo teclado'],
  estoque: ['Estoque', 'Produtos, entradas, alertas e localização'],
  admin:   ['Administração', 'Vendas, gráficos, usuários e sincronização'],
};
const ATALHOS = {
  login:   [['Enter', 'entrar'], ['Alt+T', 'tema']],
  caixa:   [['F2', 'buscar'], ['Enter', 'adicionar'], ['5*', 'lançar 5 un.'], ['↑ ↓', 'selecionar item'], ['F4', 'alterar qtd*'], ['Del', 'remover item*'],
            ['F8', 'pagamento'], ['← →', 'forma'], ['F10', 'finalizar'], ['Esc', 'cancelar venda*'], ['F9', 'fechar caixa'],
            ['Alt+1/2/3', 'trocar tela'], ['Alt+T', 'tema'], ['*', 'pede senha do supervisor']],
  estoque: [['F2', 'buscar'], ['F4', 'entrada'], ['F6', 'novo produto'], ['F7', 'importar planilha'], ['Alt+1/2/3', 'trocar tela'], ['Alt+T', 'tema']],
  admin:   [['Alt+1/2/3', 'trocar tela'], ['Alt+T', 'tema']],
};
const FORMAS = ['Dinheiro', 'PIX', 'Débito', 'Crédito'];

/* ---------- utilidades ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CODIGO_VALIDO = /^\d{8,14}$/;                 // código de barras numérico (EAN), decisão de 24/11/2026
const num = txt => parseFloat(String(txt || '').replace(/\./g, '').replace(',', '.')) || 0;
const esc = txt => String(txt ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataHora = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const mesmoDia = (a, b) => a.toDateString() === b.toDateString();
const produto = codigo => D.produtos.find(p => p.codigo === codigo);
const salvar = () => salvarDados(D);

function novaVenda() {
  return { itens: [], sel: -1, pagamento: 'Dinheiro', pagamentos: [], totalPagamentos: null };
}

/* formas usadas numa venda (vendas antigas tinham só uma) */
const formasDaVenda = v => (v.pagamentos && v.pagamentos.length ? v.pagamentos.map(p => p.forma) : [v.pagamento]);
const valorNaForma = (v, f) => (v.pagamentos && v.pagamentos.length
  ? v.pagamentos.filter(p => p.forma === f).reduce((s, p) => s + p.valor, 0) - (f === 'Dinheiro' ? (v.troco || 0) : 0)
  : (v.pagamento === f ? v.total : 0));
const r2 = n => Math.round(n * 100) / 100;
const emReais = n => r2(n).toFixed(2).replace('.', ',');

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}

function situacao(p) {
  if (p.qtd <= 0) return 'Zerado';
  if (p.qtd <= p.minimo) return 'Baixo';          // RN-06
  return 'OK';
}

/* ---------- tema (RF-38) ---------- */
function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  $('#icone-tema').textContent = tema === 'dark' ? '☀' : '☾';
}
function alternarTema() {
  const novo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  aplicarTema(novo);
  salvarTema(novo);
  toast(novo === 'dark' ? 'Tema escuro' : 'Tema claro', 1200);
  if (telaAtual === 'admin') renderAdmin();
}

/* ---------- rede e sincronização (RF-32 a RF-37) ---------- */
const estaOnline = () => navigator.onLine && !offlineSimulado;

function registrarNaFila(tipo, descricao) {        // RF-33
  D.fila.push({ id: gerarUUID(), tipo, descricao, data: new Date().toISOString(), usuario: sessao ? sessao.nome : '—' });
  salvar();
  atualizarStatusRede();
  if (estaOnline()) setTimeout(sincronizar, 700);
}

function sincronizar(manual = false) {              // RF-33, RF-37
  if (!estaOnline()) {
    if (manual) toast('Sem conexão: os dados continuam salvos no aparelho.');
    return;
  }
  if (!D.fila.length) {
    if (manual) toast('Nada pendente. Tudo sincronizado.');
    return;
  }
  const enviados = D.fila.length;
  const agora = new Date().toISOString();
  D.fila.forEach(item => D.logSync.unshift({ ...item, enviadoEm: agora, resultado: 'enviado' }));   // RF-36
  D.logSync = D.logSync.slice(0, 60);
  D.fila = [];
  D.vendas.forEach(v => { if (v.status === 'pendente') v.status = 'sincronizado'; });
  D.ultimaSync = agora;
  salvar();
  atualizarStatusRede();
  toast(`${enviados} registro(s) sincronizado(s) com o servidor.`);
  if (telaAtual === 'admin') renderAdmin();
}

function atualizarStatusRede() {
  const online = estaOnline();
  const pend = D.fila.length;
  const botao = $('#status-rede');
  botao.classList.toggle('offline', !online);
  $('#status-texto').textContent = `${online ? 'Online' : 'Offline'} · ${pend} pendente${pend === 1 ? '' : 's'}`;
}

/* ---------- modais ---------- */
function abrirModal({ titulo, corpo, botoes, aoAbrir, aoConfirmar, aoCancelar, largo = false }) {
  $('#modal').classList.toggle('modal-largo', largo);
  $('#modal-titulo').textContent = titulo;
  $('#modal-corpo').innerHTML = corpo;
  $('#modal-erro').hidden = true;
  const acoes = $('#modal-acoes');
  acoes.innerHTML = '';
  (botoes || [{ texto: 'Cancelar', tipo: 'cancelar' }, { texto: 'Confirmar', tipo: 'confirmar', primario: true }]).forEach(b => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn' + (b.primario ? ' btn-primary' : ' btn-ghost');
    el.innerHTML = esc(b.texto) + (b.primario ? ' <span class="kbd">Enter</span>' : b.tipo === 'cancelar' ? ' <span class="kbd">Esc</span>' : '');
    el.onclick = () => (b.tipo === 'confirmar' ? confirmarModal() : fecharModal(true));
    acoes.appendChild(el);
  });
  modalAtual = { aoConfirmar, aoCancelar };
  $('#overlay').hidden = false;
  const primeiro = $('#modal-corpo').querySelector('input, select');
  (primeiro || acoes.querySelector('.btn-primary') || acoes.querySelector('button')).focus();
  if (aoAbrir) aoAbrir();
}

function erroModal(msg) {
  const e = $('#modal-erro');
  e.textContent = msg;
  e.hidden = false;
}

function confirmarModal() {
  if (!modalAtual) return;
  const ok = modalAtual.aoConfirmar ? modalAtual.aoConfirmar() : true;
  if (ok !== false) fecharModal(false);
}

function fecharModal(cancelado) {
  const m = modalAtual;
  modalAtual = null;
  $('#overlay').hidden = true;
  if (cancelado && m && m.aoCancelar) m.aoCancelar();
  focoPadrao();
}

function confirmar(titulo, texto, aoConfirmar) {
  abrirModal({
    titulo,
    corpo: `<p class="muted">${esc(texto)}</p>`,
    aoConfirmar: () => { aoConfirmar(); return true; },
  });
}

/* Senha do supervisor para excluir ou alterar a venda (RF-39, RN-10). */
function autorizar(acao, aoAutorizar) {
  abrirModal({
    titulo: 'Autorização do supervisor',
    corpo: `
      <p class="aviso">${esc(acao)}</p>
      <label for="senha-supervisor">Senha de autorização</label>
      <input id="senha-supervisor" class="field" type="password" autocomplete="off" placeholder="Senha do supervisor">`,
    botoes: [{ texto: 'Cancelar', tipo: 'cancelar' }, { texto: 'Autorizar', tipo: 'confirmar', primario: true }],
    aoConfirmar: () => {
      const senha = $('#senha-supervisor').value;
      const ok = hashSenha(senha) === D.config.senhaSupervisor;
      D.autorizacoes.unshift({ id: gerarUUID(), data: new Date().toISOString(), operador: sessao.nome, acao, ok });
      D.autorizacoes = D.autorizacoes.slice(0, 100);
      salvar();
      if (!ok) {
        erroModal('Senha incorreta. A ação não foi feita.');
        $('#senha-supervisor').value = '';
        $('#senha-supervisor').focus();
        return false;
      }
      setTimeout(aoAutorizar, 0);
      return true;
    },
  });
}

/* ---------- login e navegação (RF-01 a RF-03) ---------- */
function mostrarLogin() {
  sessao = null;
  telaAtual = null;
  $('#app').hidden = true;
  $('#tela-login').hidden = false;
  const sel = $('#login-usuario');
  sel.innerHTML = D.usuarios.map(u =>
    `<option value="${u.id}">${esc(u.nome)} — ${PERFIS[u.perfil].nome}${u.ativo ? '' : ' (inativo)'}</option>`).join('');
  $('#login-erro').hidden = true;
  $('#login-senha').value = '1234';
  $('#login-senha').focus();
  $('#login-senha').select();
  renderAtalhos('login');
}

function entrar(e) {
  e.preventDefault();
  const u = D.usuarios.find(x => x.id === $('#login-usuario').value);
  const erro = $('#login-erro');
  if (!u || hashSenha($('#login-senha').value) !== u.senha) {
    erro.textContent = 'Usuário ou senha incorretos.';
    erro.hidden = false;
    return;
  }
  if (!u.ativo) {
    erro.textContent = 'Este usuário está desativado. Procure o administrador.';
    erro.hidden = false;
    return;
  }
  sessao = u;
  $('#tela-login').hidden = true;
  $('#app').hidden = false;
  $('#usuario-nome').textContent = u.nome;
  $('#usuario-perfil').textContent = PERFIS[u.perfil].nome;
  $$('#nav button').forEach(b => { b.hidden = !PERFIS[u.perfil].telas.includes(b.dataset.tela); });
  irPara(PERFIS[u.perfil].telas[0]);
}

function sair() {
  if (venda.itens.length) {
    toast('Finalize ou cancele a venda atual antes de sair.');
    return;
  }
  mostrarLogin();
}

function irPara(tela) {
  if (!sessao) return;
  if (!PERFIS[sessao.perfil].telas.includes(tela)) {          // RF-02, RNF-07
    toast('Seu perfil não tem acesso a esta tela.');
    return;
  }
  telaAtual = tela;
  $$('.tela').forEach(s => { s.hidden = s.id !== 'tela-' + tela; });
  $$('#nav button').forEach(b => b.toggleAttribute('aria-current', b.dataset.tela === tela));
  $$('#nav button').forEach(b => { if (b.dataset.tela === tela) b.setAttribute('aria-current', 'page'); });
  $('#titulo-tela').textContent = TITULOS[tela][0];
  $('#subtitulo-tela').textContent = TITULOS[tela][1];
  renderAtalhos(tela);
  atualizarStatusRede();
  if (tela === 'caixa') { renderCaixa(); verificarCaixaAberto(); }
  if (tela === 'estoque') renderEstoque();
  if (tela === 'admin') renderAdmin();
  focoPadrao();
}

function focoPadrao() {
  if (modalAtual || !$('#overlay-comprovante').hidden) return;
  if (telaAtual === 'caixa') $('#busca-produto').focus();
  if (telaAtual === 'estoque') $('#filtro-estoque').focus();
}

function renderAtalhos(tela) {
  $('#atalhos').innerHTML = ATALHOS[tela].map(([k, t]) => `<span><span class="kbd">${k}</span> ${t}</span>`).join('');
}

/* =========================================================
   CAIXA
   ========================================================= */
function verificarCaixaAberto() {                    // RF-04, RN-01
  if (D.caixa && D.caixa.aberto) return;
  abrirModal({
    titulo: 'Abrir caixa',
    corpo: `
      <p class="muted">Informe o valor em dinheiro que está na gaveta para começar o turno.</p>
      <label for="valor-inicial">Valor inicial (R$)</label>
      <input id="valor-inicial" class="field" inputmode="decimal" value="100,00">`,
    botoes: [{ texto: 'Abrir caixa', tipo: 'confirmar', primario: true }],
    aoConfirmar: () => {
      const valor = num($('#valor-inicial').value);
      if (valor < 0) { erroModal('Informe um valor válido.'); return false; }
      D.caixa = { aberto: true, abertura: new Date().toISOString(), valorInicial: valor, operador: sessao.nome };
      salvar();
      registrarNaFila('caixa', `Abertura de caixa com ${brl(valor)}`);
      renderCaixa();
      return true;
    },
  });
}

function totalVenda() {
  return venda.itens.reduce((s, it) => s + it.preco * it.qtd, 0);
}

function renderCaixa() {
  const corpo = $('#itens-venda');
  if (!venda.itens.length) {
    corpo.innerHTML = '<tr class="vazio"><td colspan="5">Nenhum item. Digite um código ou nome e tecle Enter (F2).</td></tr>';
  } else {
    corpo.innerHTML = venda.itens.map((it, i) => `
      <tr class="${i === venda.sel ? 'selecionado' : ''}" data-indice="${i}">
        <td>${i + 1}</td>
        <td>${esc(it.nome)}<br><small class="muted">${esc(it.codigo)}</small></td>
        <td class="num"><b>${it.qtd}</b></td>
        <td class="num">${brl(it.preco)}</td>
        <td class="num"><b>${brl(it.preco * it.qtd)}</b></td>
      </tr>`).join('');
  }
  const total = totalVenda();
  $('#venda-qtd').textContent = venda.itens.reduce((s, it) => s + it.qtd, 0);
  $('#venda-subtotal').textContent = brl(total);
  $('#venda-total').textContent = brl(total);
  if (venda.pagamentos.length && venda.totalPagamentos !== r2(total)) {         // a venda mudou depois de lançar
    venda.pagamentos = [];
    venda.totalPagamentos = null;
    $('#valor-recebido').value = '';
    toast('A venda mudou: os pagamentos lançados foram apagados.');
  }
  renderPagamento();
  $('#info-caixa').textContent = D.caixa && D.caixa.aberto
    ? `Caixa aberto às ${hora(D.caixa.abertura)} por ${D.caixa.operador} · inicial ${brl(D.caixa.valorInicial)}`
    : 'Caixa fechado';
}

/* quantidade antes do produto (RF-41): "5*7891025101106" ou "5*leite" lança 5 unidades */
function separarQtd(valor) {
  const m = String(valor).match(/^\s*(\d+)\s*\*\s*(.*)$/);
  return m ? { qtd: parseInt(m[1], 10), termo: m[2] } : { qtd: 1, termo: String(valor) };
}

/* busca com sugestões (RF-05) */
function buscarProdutos(valor) {
  const t = separarQtd(valor).termo.trim().toLowerCase();
  if (!t) return [];
  return D.produtos
    .filter(p => p.ativo && (p.codigo.toLowerCase().startsWith(t) || p.nome.toLowerCase().includes(t)))
    .slice(0, 6);
}

function renderSugestoes() {
  const lista = $('#busca-sugestoes');
  const achados = buscarProdutos($('#busca-produto').value);
  if (!achados.length) { lista.hidden = true; sugestaoAtiva = -1; return; }
  if (sugestaoAtiva >= achados.length) sugestaoAtiva = achados.length - 1;
  lista.innerHTML = achados.map((p, i) => `
    <li class="${i === sugestaoAtiva ? 'ativo' : ''}" data-codigo="${p.codigo}">
      <span>${esc(p.nome)} <small>${p.codigo}</small></span>
      <span>${brl(p.preco)} <small>· ${p.qtd} un.</small></span>
    </li>`).join('');
  lista.hidden = false;
}

function adicionarDaBusca() {
  const campo = $('#busca-produto');
  const achados = buscarProdutos(campo.value);
  const { qtd, termo } = separarQtd(campo.value);
  let p = achados[sugestaoAtiva] || null;
  if (!p) p = D.produtos.find(x => x.ativo && x.codigo.toLowerCase() === termo.trim().toLowerCase()) || (achados.length === 1 ? achados[0] : null);
  if (!p) {
    if (termo.trim()) toast('Produto não encontrado.');                        // T-CX-03
    else if (campo.value.includes('*')) toast('Digite o código ou o nome depois do *. Ex.: 5*leite');
    return;
  }
  if (!adicionarProduto(p, qtd)) return;                                       // mantém o texto se não lançou
  campo.value = '';
  sugestaoAtiva = -1;
  renderSugestoes();
}

function adicionarProduto(p, qtd = 1) {
  if (!D.caixa || !D.caixa.aberto) { verificarCaixaAberto(); return false; }    // RN-01
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > 999) {                          // RF-41
    toast('Quantidade inválida. Use de 1 a 999 (ex.: 5*leite).');
    return false;
  }
  const existente = venda.itens.find(it => it.codigo === p.codigo);
  const noCarrinho = existente ? existente.qtd : 0;
  const disponivel = p.qtd - noCarrinho;
  if (disponivel <= 0) {                                                       // RN-02: estoque zerado bloqueia
    toast(`${p.nome}: sem estoque disponível. Venda bloqueada.`);
    return false;
  }
  if (qtd > disponivel) {                                                      // RN-02 + RF-41
    toast(`${p.nome}: só há ${disponivel} disponível(is). Venda de ${qtd} bloqueada.`, 3500);
    return false;
  }
  if (p.qtd <= p.minimo) {                                                      // RN-02: avisa antes de acabar
    toast(`Atenção: estoque baixo de ${p.nome} (${p.qtd} em estoque, mínimo ${p.minimo}).`, 3000);
  }
  if (existente) {
    existente.qtd += qtd;
    venda.sel = venda.itens.indexOf(existente);
  } else {
    venda.itens.push({ codigo: p.codigo, nome: p.nome, preco: p.preco, qtd });
    venda.sel = venda.itens.length - 1;
  }
  if (qtd > 1) toast(`${qtd}x ${p.nome} adicionados.`);
  renderCaixa();
  return true;
}

function alterarQuantidade() {                        // RF-06 + RF-39
  const it = venda.itens[venda.sel];
  if (!it) { toast('Selecione um item com ↑ ↓.'); return; }
  autorizar(`Alterar a quantidade de "${it.nome}" (atual: ${it.qtd})`, () => {
    abrirModal({
      titulo: 'Nova quantidade',
      corpo: `<label for="nova-qtd">${esc(it.nome)}</label><input id="nova-qtd" class="field" type="number" min="1" value="${it.qtd}">`,
      aoConfirmar: () => {
        const q = parseInt($('#nova-qtd').value, 10);
        const p = produto(it.codigo);
        if (!q || q < 1) { erroModal('Informe uma quantidade de 1 ou mais.'); return false; }
        if (p && q > p.qtd) {                                                 // RN-02, T-CX-06
          erroModal(`Estoque insuficiente (${p.qtd} disponíveis).`);
          return false;
        }
        it.qtd = q;
        renderCaixa();
        return true;
      },
    });
  });
}

function removerItem() {                              // RF-06 + RF-39
  const it = venda.itens[venda.sel];
  if (!it) { toast('Selecione um item com ↑ ↓.'); return; }
  autorizar(`Remover "${it.nome}" da venda`, () => {
    venda.itens.splice(venda.sel, 1);
    venda.sel = Math.min(venda.sel, venda.itens.length - 1);
    renderCaixa();
    toast('Item removido.');
  });
}

function cancelarVenda() {                            // RF-12 + RF-39
  if (!venda.itens.length) return;
  autorizar(`Cancelar a venda em andamento (${brl(totalVenda())})`, () => {
    venda = novaVenda();
    $('#valor-recebido').value = '';
    renderCaixa();
    toast('Venda cancelada. Nada foi registrado.');
  });
}

/* pagamento: uma ou várias formas (RF-08, RF-09); troco só em dinheiro (RF-10, RN-04) */
function situacaoPagamento() {
  const total = r2(totalVenda());
  const pago = r2(venda.pagamentos.reduce((s, p) => s + p.valor, 0));
  return { total, pago, falta: Math.max(0, r2(total - pago)), troco: Math.max(0, r2(pago - total)),
    completo: total > 0 && pago >= total - 0.001 };
}

function renderPagamento() {
  const st = situacaoPagamento();
  $$('#pag-grade button').forEach(b => {
    const ativo = b.dataset.pag === venda.pagamento;
    b.classList.toggle('ativo', ativo);
    b.setAttribute('aria-checked', String(ativo));
  });
  $('#rotulo-valor').textContent = `Valor em ${venda.pagamento}`;
  $('#pag-lista').innerHTML = venda.pagamentos.map((p, i) => `
    <li><span>${p.forma}</span><b>${brl(p.valor)}</b>
      <button class="icone-x" data-acao="remover-pagamento" data-i="${i}" aria-label="Remover pagamento em ${p.forma}">×</button></li>`).join('');
  $('#pag-recebido').textContent = brl(st.pago);
  const temTroco = st.completo && st.troco > 0;
  $('#pag-saldo').className = st.completo ? 'ok' : (st.total > 0 ? 'falta' : '');
  $('#pag-saldo-rotulo').textContent = st.completo ? (temTroco ? 'Troco' : 'Pago') : 'Falta';
  $('#pag-saldo-valor').textContent = brl(st.completo ? (temTroco ? st.troco : st.pago) : st.falta);
}

function escolherPagamento(forma, focar = true) {     // RF-08
  venda.pagamento = forma;
  renderPagamento();
  if (focar) prepararValor();
}

function trocarForma(passo) {                         // ← → (decisão da equipe em 24/11/2026)
  const i = FORMAS.indexOf(venda.pagamento);
  escolherPagamento(FORMAS[(i + passo + FORMAS.length) % FORMAS.length]);
}

/* foco no valor, já preenchido com o que falta e selecionado (assim ← → continuam trocando a forma) */
function prepararValor() {
  const campo = $('#valor-recebido');
  const st = situacaoPagamento();
  campo.value = st.total > 0 && !st.completo ? emReais(st.falta) : '';
  campo.focus();
  campo.select();
}

function lancarPagamento() {                          // RF-09
  if (!venda.itens.length) { toast('Adicione ao menos um item antes do pagamento.'); return false; }
  const st = situacaoPagamento();
  if (st.completo) { toast('O pagamento já está completo. Tecle F10 para finalizar.'); return false; }
  const campo = $('#valor-recebido');
  const valor = r2(num(campo.value));
  if (!(valor > 0)) { toast('Digite um valor maior que zero.'); campo.focus(); return false; }
  if (venda.pagamento !== 'Dinheiro' && valor > st.falta + 0.001) {             // RN-04
    toast(`${venda.pagamento} não gera troco. O máximo aqui é ${brl(st.falta)}.`, 3200);
    campo.focus(); campo.select();
    return false;
  }
  venda.pagamentos.push({ forma: venda.pagamento, valor });
  venda.totalPagamentos = st.total;
  const depois = situacaoPagamento();
  renderPagamento();
  if (depois.completo) {
    campo.value = '';
    toast(depois.troco > 0 ? `Pagamento completo. Troco: ${brl(depois.troco)}. Tecle F10.` : 'Pagamento completo. Tecle F10 para finalizar.', 3000);
    $('.btn-finalizar').focus();
  } else {
    prepararValor();
  }
  return true;
}

function removerPagamento(i) {
  venda.pagamentos.splice(i, 1);
  if (!venda.pagamentos.length) venda.totalPagamentos = null;
  renderPagamento();
  prepararValor();
}

function finalizarVenda() {                           // RF-11, RF-13
  if (!D.caixa || !D.caixa.aberto) { verificarCaixaAberto(); return; }
  if (!venda.itens.length) { toast('Adicione ao menos um item.'); return; }      // T-CX-10
  const total = r2(totalVenda());
  /* F10 lança o valor que estiver no campo. Sem nenhum pagamento e sem valor, recebe o total na forma escolhida. */
  const digitado = $('#valor-recebido').value.trim();
  if (!venda.pagamentos.length && !digitado) { venda.pagamentos.push({ forma: venda.pagamento, valor: total }); venda.totalPagamentos = total; }
  else if (digitado && !situacaoPagamento().completo && !lancarPagamento()) return;
  const st = situacaoPagamento();
  if (!st.completo) {                                                           // RN-03
    toast(`Falta receber ${brl(st.falta)}. Lance o resto em outra forma (← →).`, 3200);
    prepararValor();
    return;
  }
  const formas = [...new Set(venda.pagamentos.map(p => p.forma))];
  const registro = {
    id: gerarUUID(),                                                             // RN-09
    numero: D.vendas.length + 1,
    data: new Date().toISOString(),
    operador: sessao.nome,
    itens: venda.itens.map(it => ({ ...it })),
    total,
    pagamento: formas.join(' + '),
    pagamentos: venda.pagamentos.map(p => ({ ...p })),                          // RF-09
    recebido: st.pago,
    troco: st.troco,                                                              // RF-10: só de dinheiro
    status: 'pendente',                                                          // vira 'sincronizado' ao enviar
  };
  D.vendas.push(registro);
  registro.itens.forEach(it => {                                                // baixa de estoque
    const p = produto(it.codigo);
    if (p) p.qtd = Math.max(0, p.qtd - it.qtd);
    D.movimentacoes.push({ id: gerarUUID(), codigo: it.codigo, tipo: 'venda', qtd: -it.qtd,
      motivo: `Venda nº ${registro.numero}`, usuario: sessao.nome, data: registro.data });  // RNF-08
  });
  salvar();
  registrarNaFila('venda', `Venda nº ${registro.numero} · ${brl(total)} · ${registro.pagamento}`);
  venda = novaVenda();
  $('#valor-recebido').value = '';
  renderCaixa();
  mostrarComprovante(registro);
}

function fecharCaixa() {                              // RF-16
  if (!D.caixa || !D.caixa.aberto) { toast('O caixa já está fechado.'); return; }
  if (venda.itens.length) { toast('Finalize ou cancele a venda atual antes de fechar o caixa.'); return; }
  const desde = new Date(D.caixa.abertura);
  const doTurno = D.vendas.filter(v => new Date(v.data) >= desde);
  const porForma = FORMAS.map(f => [f, r2(doTurno.reduce((s, v) => s + valorNaForma(v, f), 0))]);
  const dinheiro = porForma.find(([f]) => f === 'Dinheiro')[1];
  abrirModal({
    titulo: 'Fechar caixa — resumo do turno',
    corpo: `
      <table>
        ${porForma.map(([f, v]) => `<tr><td>${f}</td><td class="num">${brl(v)}</td></tr>`).join('')}
        <tr><td><b>Total vendido (${doTurno.length} vendas)</b></td><td class="num"><b>${brl(doTurno.reduce((s, v) => s + v.total, 0))}</b></td></tr>
        <tr><td>Dinheiro esperado na gaveta</td><td class="num"><b>${brl(D.caixa.valorInicial + dinheiro)}</b></td></tr>
      </table>`,
    botoes: [{ texto: 'Voltar', tipo: 'cancelar' }, { texto: 'Fechar caixa', tipo: 'confirmar', primario: true }],
    aoConfirmar: () => {
      registrarNaFila('caixa', `Fechamento de caixa · ${doTurno.length} vendas`);
      D.caixa = { aberto: false };
      salvar();
      renderCaixa();
      toast('Caixa fechado. Bom descanso!');
      return true;
    },
  });
}

/* comprovante não fiscal (RF-13, RF-14, RN-07) */
function mostrarComprovante(v) {
  ultimaVendaComprovante = v;
  const linhas = v.itens.map(it => `
    <div>${esc(it.nome)}</div>
    <div class="lin"><span>${it.qtd} x ${brl(it.preco)}</span><span>${brl(it.qtd * it.preco)}</span></div>`).join('');
  $('#comprovante-corpo').innerHTML = `
    <h3>PDV DE BOLSO</h3>
    <div class="centro">Mercadinho Exemplo</div>
    <div class="centro"><b>COMPROVANTE NÃO FISCAL</b></div>
    <hr>${linhas}<hr>
    <div class="lin"><b>TOTAL</b><b>${brl(v.total)}</b></div>
    ${(v.pagamentos && v.pagamentos.length ? v.pagamentos : [{ forma: v.pagamento, valor: v.recebido || v.total }])
      .map(p => `<div class="lin"><span>${p.forma}</span><span>${brl(p.valor)}</span></div>`).join('')}
    ${v.troco > 0 ? `<div class="lin"><b>Troco</b><b>${brl(v.troco)}</b></div>` : ''}
    <hr>
    <div>${new Date(v.data).toLocaleString('pt-BR')}</div>
    <div>Operador: ${esc(v.operador)} · Venda nº ${v.numero}</div>
    <div>${estaOnline() ? 'Enviada ao servidor' : 'Registrada offline · será enviada ao reconectar'}</div>`;
  $('#overlay-comprovante').hidden = false;
  $('#overlay-comprovante [data-acao="comprovante-fechar"]').focus();
}

function textoComprovante(v) {
  return [`PDV de Bolso — Comprovante não fiscal`, `Venda nº ${v.numero} · ${new Date(v.data).toLocaleString('pt-BR')}`,
    ...v.itens.map(it => `${it.qtd}x ${it.nome} — ${brl(it.qtd * it.preco)}`),
    `TOTAL: ${brl(v.total)} (${v.pagamento})`].join('\n');
}

function fecharComprovante() {
  $('#overlay-comprovante').hidden = true;
  focoPadrao();
}

/* =========================================================
   ESTOQUE
   ========================================================= */
const somenteConsulta = () => sessao && sessao.perfil === 'operador';

function renderEstoque() {
  const termo = $('#filtro-estoque').value.trim().toLowerCase();
  const sit = $('#filtro-situacao').value;
  const lista = D.produtos.filter(p =>
    p.ativo &&
    (!termo || `${p.codigo} ${p.nome} ${p.categoria}`.toLowerCase().includes(termo)) &&
    (!sit || situacao(p) === sit));

  $('#tabela-estoque').innerHTML = lista.map(p => {
    const s = situacao(p);
    const classe = s === 'OK' ? 'pill-ok' : s === 'Baixo' ? 'pill-warn' : 'pill-danger';
    return `<tr data-codigo="${p.codigo}" class="${produtoSelecionado === p.codigo ? 'selecionado' : ''}">
      <td><small>${p.codigo}</small></td><td>${esc(p.nome)}</td><td>${esc(p.categoria)}</td><td>${esc(p.local)}</td>
      <td class="num">${brl(p.preco)}</td><td class="num"><b>${p.qtd}</b></td><td class="num">${p.minimo}</td>
      <td><span class="pill ${classe}">${s}</span></td></tr>`;
  }).join('') || '<tr><td colspan="8" class="muted">Nenhum produto encontrado.</td></tr>';

  const criticos = D.produtos.filter(p => p.ativo && p.qtd <= p.minimo);   // RF-20
  $('#alertas-estoque').innerHTML = criticos.length
    ? criticos.map(p => `<div class="alerta ${p.qtd <= 0 ? 'zerado' : ''}"><span>${esc(p.nome)}</span><b>${p.qtd} / mín. ${p.minimo}</b></div>`).join('')
    : '<p class="muted">Nenhum produto abaixo do mínimo.</p>';

  const ocupados = new Set(D.produtos.filter(p => p.ativo).map(p => p.local));   // RF-22, RF-23
  const destaque = produtoSelecionado ? (produto(produtoSelecionado) || {}).local : null;
  $('#mapa-armazem').innerHTML = ['A', 'B', 'C', 'D'].flatMap(c => [1, 2, 3, 4].map(n => {
    const loc = c + n;
    return `<div class="prateleira ${ocupados.has(loc) ? 'ocupada' : ''} ${loc === destaque ? 'destaque' : ''}">${loc}</div>`;
  })).join('');

  $$('[data-acao="entrada"], [data-acao="novo-produto"], [data-acao="importar-planilha"]').forEach(b => { b.hidden = somenteConsulta(); });
  renderPainelProduto();
}

function renderPainelProduto() {                      // RF-19
  const painel = $('#painel-produto');
  const p = produtoSelecionado && produto(produtoSelecionado);
  if (!p) { painel.hidden = true; return; }
  painel.hidden = false;
  $('#painel-produto-titulo').textContent = `${p.codigo} · ${p.nome}`;
  painel.querySelector('.painel-acoes').hidden = somenteConsulta();
  const movs = D.movimentacoes.filter(m => m.codigo === p.codigo).slice().reverse().slice(0, 30);
  $('#historico-produto').innerHTML = movs.map(m => `
    <li><span>${m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'venda' ? 'Venda' : 'Ajuste'}
      <small>${dataHora(m.data)} · ${esc(m.usuario)} · ${esc(m.motivo)}</small></span>
      <b>${m.qtd > 0 ? '+' : ''}${m.qtd}</b></li>`).join('') || '<li class="muted">Sem movimentações.</li>';
}

function formularioProduto(p) {
  const v = p || { codigo: '', nome: '', categoria: '', preco: '', qtd: 0, minimo: 1, local: '' };
  return `
    <div class="grade-campos">
      <div><label for="f-codigo">Código de barras</label><input id="f-codigo" class="field" inputmode="numeric" placeholder="8 a 14 números" value="${esc(v.codigo)}" ${p ? 'readonly' : ''}></div>
      <div><label for="f-local">Local (ex.: A1)</label><input id="f-local" class="field" value="${esc(v.local)}"></div>
    </div>
    <label for="f-nome">Nome</label><input id="f-nome" class="field" value="${esc(v.nome)}">
    <label for="f-categoria">Categoria</label><input id="f-categoria" class="field" value="${esc(v.categoria)}">
    <div class="grade-campos">
      <div><label for="f-preco">Preço (R$)</label><input id="f-preco" class="field" inputmode="decimal" value="${p ? String(v.preco).replace('.', ',') : ''}"></div>
      <div><label for="f-minimo">Estoque mínimo</label><input id="f-minimo" class="field" type="number" value="${v.minimo}"></div>
    </div>
    ${p ? '' : '<label for="f-qtd">Quantidade inicial</label><input id="f-qtd" class="field" type="number" value="0">'}`;
}

function salvarFormularioProduto(existente) {         // RF-17
  const codigo = $('#f-codigo').value.replace(/\s/g, '');
  const nome = $('#f-nome').value.trim();
  const preco = num($('#f-preco').value);
  const minimo = parseInt($('#f-minimo').value, 10);
  const qtd = existente ? existente.qtd : parseInt($('#f-qtd').value, 10);
  if (!codigo || !nome) { erroModal('Preencha código e nome.'); return false; }
  if (!CODIGO_VALIDO.test(codigo)) { erroModal('O código de barras deve ter de 8 a 14 números.'); return false; }
  if (!existente && produto(codigo)) { erroModal('Código já cadastrado.'); return false; }             // T-ES-02
  if (!$('#f-preco').value.trim() || preco <= 0) { erroModal('Informe um preço maior que zero.'); return false; }   // T-ES-03
  if (isNaN(qtd) || qtd < 0 || isNaN(minimo) || minimo < 0) { erroModal('Quantidades não podem ser negativas.'); return false; }
  const dados = { codigo, nome, categoria: $('#f-categoria').value.trim() || 'Geral', preco, minimo,
    local: $('#f-local').value.trim().toUpperCase() || '—' };
  if (existente) {
    Object.assign(existente, dados);
    registrarNaFila('produto', `Produto ${codigo} editado`);
  } else {
    D.produtos.push({ ...dados, qtd, ativo: true });
    if (qtd > 0) D.movimentacoes.push({ id: gerarUUID(), codigo, tipo: 'entrada', qtd, motivo: 'Estoque inicial', usuario: sessao.nome, data: new Date().toISOString() });
    registrarNaFila('produto', `Produto ${codigo} cadastrado`);
  }
  produtoSelecionado = codigo;
  salvar();
  renderEstoque();
  toast(existente ? 'Produto atualizado.' : 'Produto cadastrado.');
  return true;
}

function novoProduto() {
  if (somenteConsulta()) return;
  abrirModal({ titulo: 'Novo produto', corpo: formularioProduto(null), aoConfirmar: () => salvarFormularioProduto(null) });
}

function editarProduto() {
  const p = produto(produtoSelecionado);
  if (!p) return;
  abrirModal({ titulo: `Editar ${p.codigo}`, corpo: formularioProduto(p), aoConfirmar: () => salvarFormularioProduto(p) });
}

function entradaMercadoria() {                        // RF-18
  if (somenteConsulta()) return;
  const opcoes = D.produtos.filter(p => p.ativo).map(p =>
    `<option value="${p.codigo}" ${p.codigo === produtoSelecionado ? 'selected' : ''}>${p.codigo} · ${esc(p.nome)} (${p.qtd} un.)</option>`).join('');
  abrirModal({
    titulo: 'Entrada de mercadoria',
    corpo: `<label for="e-produto">Produto</label><select id="e-produto" class="field">${opcoes}</select>
            <label for="e-qtd">Quantidade recebida</label><input id="e-qtd" class="field" type="number" min="1" value="10">`,
    aoConfirmar: () => {
      const p = produto($('#e-produto').value);
      const q = parseInt($('#e-qtd').value, 10);
      if (!q || q < 1) { erroModal('Informe uma quantidade de 1 ou mais.'); return false; }
      p.qtd += q;
      D.movimentacoes.push({ id: gerarUUID(), codigo: p.codigo, tipo: 'entrada', qtd: q, motivo: 'Entrada de mercadoria', usuario: sessao.nome, data: new Date().toISOString() });
      produtoSelecionado = p.codigo;
      salvar();
      registrarNaFila('estoque', `Entrada de ${q} un. em ${p.codigo}`);
      renderEstoque();
      toast(`${p.nome}: estoque agora é ${p.qtd}.`);
      return true;
    },
  });
}

function ajusteEstoque() {                            // RF-21
  const p = produto(produtoSelecionado);
  if (!p) return;
  abrirModal({
    titulo: `Ajuste de estoque · ${p.codigo}`,
    corpo: `<p class="muted">Quantidade atual no sistema: <b>${p.qtd}</b></p>
      <label for="a-qtd">Quantidade contada</label><input id="a-qtd" class="field" type="number" min="0" value="${p.qtd}">
      <label for="a-motivo">Motivo (obrigatório)</label>
      <select id="a-motivo" class="field"><option value="">Selecione…</option><option>Contagem</option><option>Perda</option><option>Avaria</option><option>Vencimento</option></select>`,
    aoConfirmar: () => {
      const q = parseInt($('#a-qtd').value, 10);
      const motivo = $('#a-motivo').value;
      if (isNaN(q) || q < 0) { erroModal('Informe uma quantidade válida.'); return false; }
      if (!motivo) { erroModal('O motivo é obrigatório.'); return false; }       // T-ES-05
      const diferenca = q - p.qtd;
      p.qtd = q;
      D.movimentacoes.push({ id: gerarUUID(), codigo: p.codigo, tipo: 'ajuste', qtd: diferenca, motivo, usuario: sessao.nome, data: new Date().toISOString() });
      salvar();
      registrarNaFila('estoque', `Ajuste de ${p.codigo} (${diferenca >= 0 ? '+' : ''}${diferenca}) · ${motivo}`);
      renderEstoque();
      return true;
    },
  });
}

/* ---------- importação em lote por planilha CSV (RF-40) ---------- */
let importacao = null;   // { linhas: [{ dados, erros }] }

const COLUNAS_CSV = ['codigo', 'nome', 'categoria', 'preco', 'quantidade', 'minimo', 'local'];
const APELIDOS_CSV = { codigo: 'codigo', cod: 'codigo', nome: 'nome', produto: 'nome', descricao: 'nome',
  categoria: 'categoria', preco: 'preco', valor: 'preco', quantidade: 'quantidade', qtd: 'quantidade',
  estoque: 'quantidade', minimo: 'minimo', estoqueminimo: 'minimo', local: 'local', localizacao: 'local' };

function textoModeloCSV() {
  return [
    'codigo;nome;categoria;preco;quantidade;minimo;local',
    '7896022204051;Macarrão Espaguete 500g;Mercearia;4,99;30;10;A4',
    '7891000315507;Biscoito Recheado 130g;Mercearia;2,79;40;12;B3',
    '7891024035009;Desinfetante 2L;Limpeza;9,49;24;8;D1',
  ].join('\r\n');
}

function baixarModeloCSV() {
  const blob = new Blob(['﻿' + textoModeloCSV()], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'modelo-produtos-pdv-de-bolso.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function normalizarCabecalho(txt) {
  return String(txt).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

function dividirLinhaCSV(linha, sep) {
  const campos = [];
  let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (ch === sep && !aspas) {
      campos.push(atual.trim()); atual = '';
    } else atual += ch;
  }
  campos.push(atual.trim());
  return campos;
}

function lerCSV(texto) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) throw new Error('A planilha precisa do cabeçalho e de pelo menos 1 produto.');
  const sep = linhas[0].includes(';') ? ';' : ',';
  const cabecalho = dividirLinhaCSV(linhas[0], sep).map(c => APELIDOS_CSV[normalizarCabecalho(c)] || null);
  if (!cabecalho.includes('codigo') || !cabecalho.includes('nome') || !cabecalho.includes('preco')) {
    throw new Error('Cabeçalho inválido. Use o modelo: ' + COLUNAS_CSV.join(';'));
  }
  return linhas.slice(1).map((linha, i) => {
    const valores = dividirLinhaCSV(linha, sep);
    const obj = { linha: i + 2 };
    cabecalho.forEach((col, k) => { if (col) obj[col] = valores[k] ?? ''; });
    return obj;
  });
}

function validarImportacao(registros) {             // mesmas regras do cadastro individual (RF-17)
  const vistos = new Set();
  return registros.map(r => {
    const erros = [];
    const codigo = String(r.codigo || '').replace(/\s/g, '');
    const nome = String(r.nome || '').trim();
    const precoTxt = String(r.preco || '').trim();
    const preco = num(precoTxt.replace(/^R\$\s*/i, ''));
    const qtdTxt = String(r.quantidade ?? '').trim();
    const qtd = qtdTxt === '' ? 0 : Number(qtdTxt.replace(',', '.'));
    const minTxt = String(r.minimo ?? '').trim();
    const minimo = minTxt === '' ? 0 : Number(minTxt.replace(',', '.'));

    if (!codigo) erros.push('código vazio');
    else if (!CODIGO_VALIDO.test(codigo)) erros.push('código deve ter de 8 a 14 números');
    else if (produto(codigo)) erros.push('código já cadastrado');
    else if (vistos.has(codigo)) erros.push('código repetido na planilha');
    if (!nome) erros.push('nome vazio');
    if (!precoTxt || !(preco > 0)) erros.push('preço vazio ou inválido');
    if (!Number.isInteger(qtd) || qtd < 0) erros.push('quantidade negativa ou inválida');
    if (!Number.isInteger(minimo) || minimo < 0) erros.push('mínimo negativo ou inválido');
    if (codigo) vistos.add(codigo);

    return {
      linha: r.linha,
      erros,
      dados: { codigo, nome, categoria: String(r.categoria || '').trim() || 'Geral', preco, qtd, minimo,
        local: String(r.local || '').trim().toUpperCase() || '—', ativo: true },
    };
  });
}

function renderPreviaImportacao() {
  const alvo = $('#previa-importacao');
  if (!importacao) { alvo.innerHTML = ''; return; }
  const validas = importacao.linhas.filter(l => !l.erros.length).length;
  const recusadas = importacao.linhas.length - validas;
  alvo.innerHTML = `
    <div class="previa-resumo">
      <span class="pill pill-info">${esc(importacao.arquivo)}</span>
      <span class="pill pill-ok">${validas} válida${validas === 1 ? '' : 's'}</span>
      <span class="pill ${recusadas ? 'pill-danger' : 'pill-ok'}">${recusadas} recusada${recusadas === 1 ? '' : 's'}</span>
    </div>
    <div class="previa-tabela">
      <table>
        <thead><tr><th>Linha</th><th>Código</th><th>Produto</th><th class="num">Preço</th><th class="num">Qtd</th><th class="num">Mín.</th><th>Local</th><th>Situação</th></tr></thead>
        <tbody>${importacao.linhas.map(l => `
          <tr class="${l.erros.length ? 'recusada' : ''}">
            <td>${l.linha}</td><td>${esc(l.dados.codigo)}</td><td>${esc(l.dados.nome)}</td>
            <td class="num">${l.dados.preco > 0 ? brl(l.dados.preco) : '—'}</td>
            <td class="num">${Number.isFinite(l.dados.qtd) ? l.dados.qtd : '—'}</td>
            <td class="num">${Number.isFinite(l.dados.minimo) ? l.dados.minimo : '—'}</td>
            <td>${esc(l.dados.local)}</td>
            <td>${l.erros.length ? `<span class="previa-motivo">${esc(l.erros.join('; '))}</span>` : '<span class="pill pill-ok">OK</span>'}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted pequeno">Nada foi gravado ainda. Só as linhas válidas serão importadas.</p>`;
}

function carregarArquivoCSV(arquivo) {
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    $('#modal-erro').hidden = true;
    try {
      importacao = { arquivo: arquivo.name, linhas: validarImportacao(lerCSV(String(leitor.result))) };
    } catch (err) {
      importacao = null;
      erroModal(err.message);
    }
    renderPreviaImportacao();
  };
  leitor.readAsText(arquivo, 'UTF-8');
}

function importarPlanilha() {                         // RF-40
  if (somenteConsulta()) return;
  importacao = null;
  abrirModal({
    titulo: 'Importar produtos em lote (CSV)',
    largo: true,
    corpo: `
      <ol class="importar-passos">
        <li>Baixe o modelo e preencha uma linha por produto: <code>${COLUNAS_CSV.join(';')}</code></li>
        <li>Salve como CSV (no Excel: <i>Salvar como → CSV UTF-8</i>) e escolha o arquivo abaixo.</li>
        <li>Confira a prévia: linhas com erro são recusadas e não entram no estoque.</li>
      </ol>
      <button type="button" class="btn btn-sm" data-acao="baixar-modelo">Baixar modelo (.csv)</button>
      <label for="arquivo-csv">Arquivo CSV</label>
      <input id="arquivo-csv" class="field campo-arquivo" type="file" accept=".csv,text/csv">
      <div id="previa-importacao"></div>`,
    botoes: [{ texto: 'Cancelar', tipo: 'cancelar' }, { texto: 'Importar válidas', tipo: 'confirmar', primario: true }],
    aoCancelar: () => { importacao = null; },
    aoConfirmar: () => {
      if (!importacao) { erroModal('Escolha um arquivo CSV para ver a prévia.'); return false; }
      const validas = importacao.linhas.filter(l => !l.erros.length);
      const recusadas = importacao.linhas.length - validas.length;
      if (!validas.length) { erroModal('Nenhuma linha válida para importar. Corrija a planilha e tente de novo.'); return false; }
      const agora = new Date().toISOString();
      validas.forEach(({ dados }) => {
        D.produtos.push({ ...dados });
        if (dados.qtd > 0) {
          D.movimentacoes.push({ id: gerarUUID(), codigo: dados.codigo, tipo: 'entrada', qtd: dados.qtd,
            motivo: `Importação em lote (${importacao.arquivo})`, usuario: sessao.nome, data: agora });
        }
      });
      produtoSelecionado = validas[0].dados.codigo;
      salvar();
      registrarNaFila('produto', `Importação em lote: ${validas.length} produto(s) de ${importacao.arquivo}`);
      importacao = null;
      renderEstoque();
      toast(`${validas.length} importado${validas.length === 1 ? '' : 's'}, ${recusadas} recusado${recusadas === 1 ? '' : 's'}.`, 3200);
      return true;
    },
  });
}

/* =========================================================
   ADMINISTRAÇÃO
   ========================================================= */
function ultimosDias(n) {
  const dias = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    dias.push(d);
  }
  return dias;
}

function cor(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

function graficoColunas(dados) {                      // RF-29
  const W = 560, H = 230, L = 52, R = 10, T = 22, B = 30;
  const max = Math.max(500, Math.ceil(Math.max(...dados.map(d => d.valor)) / 500) * 500);
  const larg = (W - L - R) / dados.length;
  const y = v => T + (H - T - B) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vendas por dia">`;
  for (let v = 0; v <= max; v += max / 4) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${cor('--line')}"/>`;
    s += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v.toLocaleString('pt-BR')}</text>`;
  }
  dados.forEach((d, i) => {
    const x = L + i * larg + larg * 0.2, w = larg * 0.6;
    s += `<rect x="${x}" y="${y(d.valor)}" width="${w}" height="${y(0) - y(d.valor)}" rx="4" fill="${d.destaque ? cor('--serie-1') : cor('--serie-base')}"><title>${d.rotulo}: ${brl(d.valor)}</title></rect>`;
    s += `<text x="${x + w / 2}" y="${y(d.valor) - 6}" text-anchor="middle" class="${d.destaque ? 'rotulo-forte' : ''}">${Math.round(d.valor).toLocaleString('pt-BR')}</text>`;
    s += `<text x="${x + w / 2}" y="${H - 10}" text-anchor="middle" class="${d.destaque ? 'rotulo-forte' : ''}">${d.rotulo}</text>`;
  });
  return s + '</svg>';
}

function graficoBarras(dados) {                       // RF-28
  const W = 460, L = 82, R = 40, alt = 30, gap = 10;
  const H = dados.length * (alt + gap) + 6;
  const max = Math.max(1, ...dados.map(d => d.valor));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Formas de pagamento">`;
  dados.forEach((d, i) => {
    const y = 4 + i * (alt + gap), w = Math.max(2, (d.valor / max) * (W - L - R));
    s += `<text x="${L - 10}" y="${y + alt / 2 + 4}" text-anchor="end">${d.rotulo}</text>`;
    s += `<rect x="${L}" y="${y}" width="${w}" height="${alt}" rx="5" fill="${cor(d.cor)}"><title>${d.rotulo}: ${d.valor} vendas</title></rect>`;
    s += `<text x="${L + w + 6}" y="${y + alt / 2 + 4}" class="rotulo-forte">${d.valor}</text>`;
  });
  return s + '</svg>';
}

function renderAdmin() {
  const hoje = new Date();
  const vendasHoje = D.vendas.filter(v => mesmoDia(new Date(v.data), hoje));
  const totalHoje = vendasHoje.reduce((s, v) => s + v.total, 0);
  $('#kpi-total').textContent = brl(totalHoje);                                        // RF-27
  $('#kpi-qtd').textContent = `${vendasHoje.length} venda${vendasHoje.length === 1 ? '' : 's'}`;
  $('#kpi-ticket').textContent = brl(vendasHoje.length ? totalHoje / vendasHoje.length : 0);
  $('#kpi-critico').textContent = D.produtos.filter(p => p.ativo && p.qtd <= p.minimo).length;
  $('#kpi-sync').textContent = `${D.fila.length} pendente${D.fila.length === 1 ? '' : 's'}`;
  $('#kpi-sync-hora').textContent = `${estaOnline() ? 'Online' : 'Offline · dados locais'} · última sincronização ${dataHora(D.ultimaSync)}`;

  const dias = ultimosDias(7);
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  $('#grafico-dias').innerHTML = graficoColunas(dias.map((d, i) => ({
    rotulo: `${nomes[d.getDay()]} ${d.getDate()}`,
    valor: D.vendas.filter(v => mesmoDia(new Date(v.data), d)).reduce((s, v) => s + v.total, 0),
    destaque: i === dias.length - 1,
  })));

  const inicio7 = dias[0];
  const vendas7 = D.vendas.filter(v => new Date(v.data) >= inicio7);
  const cores = { 'PIX': '--serie-1', 'Dinheiro': '--serie-3', 'Débito': '--serie-2', 'Crédito': '--serie-4' };
  $('#grafico-pagamentos').innerHTML = graficoBarras(
    FORMAS.map(f => ({ rotulo: f, valor: vendas7.filter(v => formasDaVenda(v).includes(f)).length, cor: cores[f] }))
      .sort((a, b) => b.valor - a.valor));

  renderTabelaVendas();

  const ranking = {};                                                                   // RF-30
  vendas7.forEach(v => v.itens.forEach(it => { ranking[it.nome] = (ranking[it.nome] || 0) + it.qtd; }));
  $('#ranking-produtos').innerHTML = Object.entries(ranking).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([nome, q]) => `<li>${esc(nome)} <span>${q} un.</span></li>`).join('') || '<li class="muted">Sem vendas no período.</li>';

  $('#tabela-usuarios').innerHTML = D.usuarios.map(u => `
    <tr>
      <td>${esc(u.nome)}</td>
      <td><select class="field field-sm" data-usuario-perfil="${u.id}">
        ${Object.entries(PERFIS).map(([k, p]) => `<option value="${k}" ${u.perfil === k ? 'selected' : ''}>${p.nome}</option>`).join('')}
      </select></td>
      <td><span class="pill ${u.ativo ? 'pill-ok' : 'pill-danger'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td><button class="btn btn-sm ${u.ativo ? 'btn-perigo' : ''}" data-usuario-ativo="${u.id}">${u.ativo ? 'Desativar' : 'Reativar'}</button></td>
    </tr>`).join('');

  $('#tabela-autorizacoes').innerHTML = D.autorizacoes.map(a => `
    <tr><td>${dataHora(a.data)}</td><td>${esc(a.operador)}</td><td>${esc(a.acao)}</td>
    <td><span class="pill ${a.ok ? 'pill-ok' : 'pill-danger'}">${a.ok ? 'Autorizada' : 'Senha incorreta'}</span></td></tr>`).join('')
    || '<tr><td colspan="4" class="muted">Nenhuma autorização registrada ainda.</td></tr>';

  const pendentes = D.fila.map(f => `<li><span>${esc(f.descricao)}<small>${dataHora(f.data)} · ${esc(f.usuario)}</small></span><span class="pill pill-warn">pendente</span></li>`);
  const enviados = D.logSync.slice(0, 20).map(f => `<li><span>${esc(f.descricao)}<small>feito ${dataHora(f.data)} · enviado ${dataHora(f.enviadoEm)}</small></span><span class="pill pill-ok">enviado</span></li>`);
  $('#log-sync').innerHTML = [...pendentes, ...enviados].join('') || '<li class="muted">Nada para mostrar.</li>';

}

function renderTabelaVendas() {                       // RF-25, RF-26
  const periodo = $('#filtro-vendas-periodo').value;
  const forma = $('#filtro-vendas-pagamento').value;
  const hoje = new Date();
  const limite = ultimosDias(7)[0];
  const lista = D.vendas.filter(v => {
    const d = new Date(v.data);
    if (periodo === 'hoje' && !mesmoDia(d, hoje)) return false;
    if (periodo === '7' && d < limite) return false;
    return !forma || formasDaVenda(v).includes(forma);
  }).slice().reverse();
  $('#tabela-vendas').innerHTML = lista.map(v => `
    <tr><td>${dataHora(v.data)}${v.status === 'pendente' ? ' <span class="pill pill-warn">pendente</span>' : ''}</td>
    <td>${esc(v.operador)}</td><td>${v.pagamento}</td><td class="num">${brl(v.total)}</td>
    <td><button class="btn btn-sm btn-ghost" data-comprovante="${v.id}">Comprovante</button></td></tr>`).join('')
    || '<tr><td colspan="5" class="muted">Nenhuma venda no filtro escolhido.</td></tr>';
}

function novoUsuario() {                              // RF-31
  abrirModal({
    titulo: 'Novo usuário',
    corpo: `<label for="u-nome">Nome</label><input id="u-nome" class="field">
      <label for="u-perfil">Perfil</label>
      <select id="u-perfil" class="field">${Object.entries(PERFIS).map(([k, p]) => `<option value="${k}" ${k === 'operador' ? 'selected' : ''}>${p.nome}</option>`).join('')}</select>
      <label for="u-senha">Senha inicial</label><input id="u-senha" class="field" type="password">`,
    aoConfirmar: () => {
      const nome = $('#u-nome').value.trim();
      const senha = $('#u-senha').value;
      if (!nome || senha.length < 4) { erroModal('Informe o nome e uma senha com 4 ou mais caracteres.'); return false; }
      if (D.usuarios.some(u => u.nome.toLowerCase() === nome.toLowerCase())) { erroModal('Já existe um usuário com esse nome.'); return false; }
      D.usuarios.push({ id: gerarUUID(), nome, perfil: $('#u-perfil').value, senha: hashSenha(senha), ativo: true });   // RNF-06
      salvar();
      registrarNaFila('usuario', `Usuário ${nome} criado`);
      renderAdmin();
      toast(`Usuário ${nome} criado.`);
      return true;
    },
  });
}

function alternarUsuario(id) {
  const u = D.usuarios.find(x => x.id === id);
  if (!u) return;
  const adminsAtivos = D.usuarios.filter(x => x.perfil === 'admin' && x.ativo);
  if (u.ativo && u.perfil === 'admin' && adminsAtivos.length === 1) {                   // T-AD-10
    toast('Não é possível desativar o único administrador ativo.');
    return;
  }
  u.ativo = !u.ativo;
  salvar();
  registrarNaFila('usuario', `Usuário ${u.nome} ${u.ativo ? 'reativado' : 'desativado'}`);
  renderAdmin();
}

function mudarPerfil(id, perfil) {
  const u = D.usuarios.find(x => x.id === id);
  if (!u) return;
  const adminsAtivos = D.usuarios.filter(x => x.perfil === 'admin' && x.ativo);
  if (u.perfil === 'admin' && perfil !== 'admin' && u.ativo && adminsAtivos.length === 1) {
    toast('O sistema precisa de pelo menos um administrador ativo.');
    renderAdmin();
    return;
  }
  u.perfil = perfil;
  salvar();
  registrarNaFila('usuario', `Perfil de ${u.nome} alterado para ${PERFIS[perfil].nome}`);
  toast(`${u.nome} agora é ${PERFIS[perfil].nome}.`);
  if (u.id === sessao.id) { toast('Seu perfil mudou. Entre novamente.'); mostrarLogin(); }
}

function trocarSenhaSupervisor() {
  abrirModal({
    titulo: 'Alterar senha do supervisor',
    corpo: `<label for="s-atual">Senha atual</label><input id="s-atual" class="field" type="password">
      <label for="s-nova">Nova senha</label><input id="s-nova" class="field" type="password">`,
    aoConfirmar: () => {
      if (hashSenha($('#s-atual').value) !== D.config.senhaSupervisor) { erroModal('Senha atual incorreta.'); return false; }
      if ($('#s-nova').value.length < 4) { erroModal('A nova senha precisa ter 4 ou mais caracteres.'); return false; }
      D.config.senhaSupervisor = hashSenha($('#s-nova').value);
      salvar();
      toast('Senha do supervisor alterada.');
      return true;
    },
  });
}

function resetarDados() {
  confirmar('Restaurar dados de exemplo', 'Isso apaga vendas, produtos e usuários criados neste navegador e volta aos dados iniciais do protótipo.', () => {
    D = dadosIniciais();
    salvar();
    venda = novaVenda();
    produtoSelecionado = null;
    toast('Dados de exemplo restaurados.');
    mostrarLogin();
  });
}

/* =========================================================
   EVENTOS
   ========================================================= */
const ACOES = {
  tema: alternarTema,
  sair,
  resetar: resetarDados,
  adicionar: adicionarDaBusca,
  finalizar: finalizarVenda,
  'cancelar-venda': cancelarVenda,
  'fechar-caixa': fecharCaixa,
  entrada: entradaMercadoria,
  'novo-produto': novoProduto,
  'editar-produto': editarProduto,
  ajuste: ajusteEstoque,
  'importar-planilha': importarPlanilha,
  'baixar-modelo': baixarModeloCSV,
  sincronizar: () => sincronizar(true),
  'novo-usuario': novoUsuario,
  'trocar-senha-supervisor': trocarSenhaSupervisor,
  'comprovante-fechar': fecharComprovante,
  'comprovante-imprimir': () => window.print(),
  'comprovante-whatsapp': () => {
    if (!ultimaVendaComprovante) return;
    window.open('https://wa.me/?text=' + encodeURIComponent(textoComprovante(ultimaVendaComprovante)), '_blank', 'noopener');
  },
};

document.addEventListener('click', e => {
  const alvo = e.target.closest('[data-acao]');
  if (alvo && alvo.dataset.acao === 'remover-pagamento') { removerPagamento(+alvo.dataset.i); return; }
  if (alvo && alvo.dataset.acao === 'lancar-pagamento') { lancarPagamento(); return; }
  if (alvo && ACOES[alvo.dataset.acao]) { ACOES[alvo.dataset.acao](); return; }

  const tela = e.target.closest('#nav [data-tela]');
  if (tela) { irPara(tela.dataset.tela); return; }

  const pag = e.target.closest('#pag-grade [data-pag]');
  if (pag) { escolherPagamento(pag.dataset.pag); return; }

  const sug = e.target.closest('#busca-sugestoes li');
  if (sug) { if (!adicionarProduto(produto(sug.dataset.codigo), separarQtd($('#busca-produto').value).qtd)) return; $('#busca-produto').value = ''; renderSugestoes(); focoPadrao(); return; }

  const linhaItem = e.target.closest('#itens-venda tr[data-indice]');
  if (linhaItem) { venda.sel = +linhaItem.dataset.indice; renderCaixa(); return; }

  const linhaProd = e.target.closest('#tabela-estoque tr[data-codigo]');
  if (linhaProd) { produtoSelecionado = linhaProd.dataset.codigo; renderEstoque(); return; }

  const comp = e.target.closest('[data-comprovante]');
  if (comp) { mostrarComprovante(D.vendas.find(v => v.id === comp.dataset.comprovante)); return; }

  const usu = e.target.closest('[data-usuario-ativo]');
  if (usu) { alternarUsuario(usu.dataset.usuarioAtivo); return; }

  if (e.target.closest('#status-rede')) {
    offlineSimulado = !offlineSimulado;
    atualizarStatusRede();
    toast(estaOnline() ? 'Conexão de volta. Sincronizando…' : 'Sem internet: tudo continua funcionando e fica salvo no aparelho.');
    if (estaOnline()) setTimeout(sincronizar, 600);
    if (telaAtual === 'admin') renderAdmin();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'arquivo-csv') carregarArquivoCSV(e.target.files[0]);
  if (e.target.matches('[data-usuario-perfil]')) mudarPerfil(e.target.dataset.usuarioPerfil, e.target.value);
  if (e.target.id === 'filtro-situacao') renderEstoque();
  if (e.target.id === 'filtro-vendas-periodo' || e.target.id === 'filtro-vendas-pagamento') renderTabelaVendas();
});

document.addEventListener('input', e => {
  if (e.target.id === 'busca-produto') { sugestaoAtiva = 0; renderSugestoes(); }
  if (e.target.id === 'filtro-estoque') renderEstoque();
});

$('#form-login').addEventListener('submit', entrar);

/* Atalhos de teclado (RF-15, RNF-01) */
document.addEventListener('keydown', e => {
  const tecla = e.key;

  if (e.altKey && (e.code === 'KeyT' || tecla.toLowerCase() === 't')) { e.preventDefault(); alternarTema(); return; }

  if (!$('#overlay-comprovante').hidden) {
    if (tecla === 'Enter' || tecla === 'Escape') { e.preventDefault(); fecharComprovante(); }
    return;
  }

  if (modalAtual) {
    if (tecla === 'Escape') { e.preventDefault(); fecharModal(true); }
    else if (tecla === 'Enter' && !e.target.matches('button, input[type="file"]')) { e.preventDefault(); confirmarModal(); }
    return;
  }

  if (!sessao) {
    if (tecla === 'Enter' && e.target.id === 'login-usuario') { e.preventDefault(); $('#form-login').requestSubmit(); }
    return;
  }

  if (e.altKey && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
    e.preventDefault();
    irPara(['caixa', 'estoque', 'admin'][+e.code.slice(-1) - 1]);
    return;
  }

  const noCampo = e.target.matches('input, select, textarea');

  if (telaAtual === 'caixa') {
    const sugestoesAbertas = !$('#busca-sugestoes').hidden;
    if (tecla === 'F2') { e.preventDefault(); $('#busca-produto').focus(); $('#busca-produto').select(); return; }
    if (tecla === 'F4') { e.preventDefault(); alterarQuantidade(); return; }
    if (tecla === 'F8') { e.preventDefault(); prepararValor(); return; }
    if (tecla === 'F9') { e.preventDefault(); fecharCaixa(); return; }
    if (tecla === 'F10') { e.preventDefault(); finalizarVenda(); return; }
    if (tecla === 'Escape') {
      e.preventDefault();
      if (sugestoesAbertas) { $('#busca-sugestoes').hidden = true; return; }
      cancelarVenda();
      return;
    }
    if (tecla === 'Delete') { if (e.target.matches && e.target.matches('input, textarea') && e.target.value) return; e.preventDefault(); removerItem(); return; }
    if (e.target.id === 'busca-produto') {
      if (tecla === 'Enter') { e.preventDefault(); adicionarDaBusca(); return; }
      if (sugestoesAbertas && (tecla === 'ArrowDown' || tecla === 'ArrowUp')) {
        e.preventDefault();
        const n = buscarProdutos($('#busca-produto').value).length;
        sugestaoAtiva = (sugestaoAtiva + (tecla === 'ArrowDown' ? 1 : -1) + n) % n;
        renderSugestoes();
        return;
      }
    }
    if (!sugestoesAbertas && (tecla === 'ArrowDown' || tecla === 'ArrowUp') && venda.itens.length) {
      e.preventDefault();
      venda.sel = Math.max(0, Math.min(venda.itens.length - 1, venda.sel + (tecla === 'ArrowDown' ? 1 : -1)));
      renderCaixa();
      return;
    }
    if (tecla === 'ArrowLeft' || tecla === 'ArrowRight') {                       // ← → trocam a forma (RF-15)
      const c = e.target;
      const tudoSelecionado = c.id === 'valor-recebido' && (c.value === '' || (c.selectionStart === 0 && c.selectionEnd === c.value.length));
      if (!noCampo || tudoSelecionado) { e.preventDefault(); trocarForma(tecla === 'ArrowRight' ? 1 : -1); return; }
    }
    if (e.target.id === 'valor-recebido' && tecla === 'Enter') { e.preventDefault(); lancarPagamento(); return; }
  }

  if (telaAtual === 'estoque') {
    if (tecla === 'F2') { e.preventDefault(); $('#filtro-estoque').focus(); return; }
    if (tecla === 'F4') { e.preventDefault(); entradaMercadoria(); return; }
    if (tecla === 'F6') { e.preventDefault(); novoProduto(); return; }
    if (tecla === 'F7') { e.preventDefault(); importarPlanilha(); return; }
  }
});

window.addEventListener('online', () => { atualizarStatusRede(); toast('Internet de volta. Sincronizando…'); setTimeout(sincronizar, 600); });
window.addEventListener('offline', () => { atualizarStatusRede(); toast('Sem internet: o sistema continua funcionando.'); });

/* ---------- início ---------- */
aplicarTema(carregarTema() || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
salvar();
atualizarStatusRede();
mostrarLogin();

/* PWA: funciona sem internet depois do primeiro acesso (RF-32, RNF-09) */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* protótipo continua funcionando sem cache */ });
}
