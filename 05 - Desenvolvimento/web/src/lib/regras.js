/* =========================================================
   PDV de Bolso · regras de negócio do caixa (sem tela e sem banco)
   As mesmas regras do protótipo v0.1. O servidor confere tudo de novo
   na função registrar_venda (05 - Desenvolvimento/supabase/03_funcoes.sql).
   ========================================================= */

export const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = txt => parseFloat(String(txt || '').replace(/\./g, '').replace(',', '.')) || 0;
export const r2 = n => Math.round(n * 100) / 100;
export const emReais = n => r2(n).toFixed(2).replace('.', ',');
export const dataHora = iso => (iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');
export const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const mesmoDia = (a, b) => a.toDateString() === b.toDateString();

export const CODIGO_VALIDO = /^\d{8,14}$/;          // código de barras numérico (EAN), igual ao banco
export const QTD_MAXIMA = 999;                       // RF-41, igual ao banco (venda_itens.qtd)

/* Formas de pagamento: "id" é o valor do enum forma_pagamento no banco (RF-08) */
export const FORMAS = [
  { id: 'dinheiro', nome: 'Dinheiro' },
  { id: 'pix', nome: 'PIX' },
  { id: 'debito', nome: 'Débito' },
  { id: 'credito', nome: 'Crédito' },
];
export const nomeForma = id => (FORMAS.find(f => f.id === id) || { nome: id }).nome;

export const PERFIS = {
  admin:    { nome: 'Administrador',     telas: ['caixa', 'estoque', 'admin'] },
  operador: { nome: 'Operador de caixa', telas: ['caixa'] },   // só o Caixa, sem ver o Estoque
  estoque:  { nome: 'Estoquista',        telas: ['estoque'] },
};

/* Situação do produto vinda da view produtos_saldo */
export const SITUACOES = {
  normal:  { nome: 'OK',      classe: 'pill-ok' },
  baixo:   { nome: 'Baixo',   classe: 'pill-warn' },
  zerado:  { nome: 'Zerado',  classe: 'pill-danger' },
  inativo: { nome: 'Inativo', classe: 'pill-info' },
};

/* Quantidade antes do produto (RF-41): "5*7891025101106" ou "5*leite" lança 5 unidades */
export function separarQtd(valor) {
  const m = String(valor ?? '').match(/^\s*(-?\d+)\s*\*\s*(.*)$/);
  if (m) return { qtd: parseInt(m[1], 10), termo: m[2] };
  const semNumero = String(valor ?? '').match(/^\s*\*\s*(.*)$/);
  if (semNumero) return { qtd: NaN, termo: semNumero[1] };
  return { qtd: 1, termo: String(valor ?? '') };
}

/* Busca por código (começo) ou nome (qualquer parte), só produtos ativos (RF-05) */
export function buscarProdutos(produtos, valor, limite = 6) {
  const t = separarQtd(valor).termo.trim().toLowerCase();
  if (!t) return [];
  return produtos
    .filter(p => p.ativo && (p.codigo.startsWith(t) || p.nome.toLowerCase().includes(t)))
    .slice(0, limite);
}

/* Produto escolhido a partir do texto digitado: sugestão marcada, código exato ou único resultado */
export function escolherProduto(produtos, valor, indiceSugestao = -1) {
  const achados = buscarProdutos(produtos, valor);
  const termo = separarQtd(valor).termo.trim().toLowerCase();
  return achados[indiceSugestao]
    || produtos.find(p => p.ativo && p.codigo === termo)
    || (achados.length === 1 ? achados[0] : null);
}

/* RN-02: pode lançar "qtd" unidades do produto, sabendo que já há "noCarrinho" na venda?
   Bloqueia sem estoque; avisa quando a venda leva o saldo ao mínimo ou abaixo. */
export function validarAdicao(produto, qtd, noCarrinho = 0) {
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > QTD_MAXIMA) {
    return { ok: false, erro: `Quantidade inválida. Use de 1 a ${QTD_MAXIMA} (ex.: 5*leite).` };
  }
  if (noCarrinho + qtd > QTD_MAXIMA) {
    return { ok: false, erro: `Cada item aceita no máximo ${QTD_MAXIMA} unidades.` };
  }
  const disponivel = produto.saldo - noCarrinho;
  if (disponivel <= 0) {
    return { ok: false, erro: `${produto.nome}: sem estoque disponível. Venda bloqueada.` };
  }
  if (qtd > disponivel) {
    return { ok: false, erro: `${produto.nome}: só há ${disponivel} disponível(is). Venda de ${qtd} bloqueada.` };
  }
  const restante = produto.saldo - noCarrinho - qtd;
  const aviso = restante <= produto.minimo
    ? `Atenção: estoque baixo de ${produto.nome} (ficam ${restante}, mínimo ${produto.minimo}).`
    : null;
  return { ok: true, aviso };
}

export const totalItens = itens => r2(itens.reduce((s, it) => s + it.preco * it.qtd, 0));

/* Pagamento em uma ou várias formas (RF-08, RF-09); troco só em dinheiro (RF-10, RN-04) */
export function situacaoPagamento(itens, pagamentos) {
  const total = totalItens(itens);
  const pago = r2(pagamentos.reduce((s, p) => s + p.valor, 0));
  return {
    total,
    pago,
    falta: Math.max(0, r2(total - pago)),
    troco: Math.max(0, r2(pago - total)),
    completo: total > 0 && pago >= total - 0.001,
  };
}

/* Pode lançar "valor" na forma escolhida? (RN-04: só dinheiro passa do que falta) */
export function validarPagamento(itens, pagamentos, forma, valor) {
  if (!itens.length) return { ok: false, erro: 'Adicione ao menos um item antes do pagamento.' };
  const st = situacaoPagamento(itens, pagamentos);
  if (st.completo) return { ok: false, erro: 'O pagamento já está completo. Tecle F10 para finalizar.' };
  if (!(valor > 0)) return { ok: false, erro: 'Digite um valor maior que zero.' };
  if (forma !== 'dinheiro' && valor > st.falta + 0.001) {
    return { ok: false, erro: `${nomeForma(forma)} não gera troco. O máximo aqui é ${brl(st.falta)}.` };
  }
  return { ok: true };
}

/* Objeto que a função registrar_venda do banco recebe (03_funcoes.sql).
   O id é gerado no caixa e reaproveitado em cada nova tentativa: se a
   resposta se perder, o servidor reconhece a venda e não duplica (RNF-05). */
export function montarVenda({ id, caixaId, numeroLocal, itens, pagamentos, feitaEm = new Date() }) {
  return {
    id,
    numero_local: numeroLocal,
    caixa_id: caixaId,
    feita_em: feitaEm.toISOString(),
    itens: itens.map(it => ({ codigo: it.codigo, qtd: it.qtd, preco: it.preco })),
    pagamentos: pagamentos.map(p => ({ forma: p.forma, valor: p.valor })),
  };
}

/* Texto do comprovante para o WhatsApp (RF-14) */
export function textoComprovante(v) {
  return [
    'PocketSell · Comprovante não fiscal',
    `Venda nº ${v.numero} · ${new Date(v.feita_em).toLocaleString('pt-BR')}`,
    ...v.itens.map(it => `${it.qtd}x ${it.nome} · ${brl(it.qtd * it.preco)}`),
    `TOTAL: ${brl(v.total)}`,
    ...v.pagamentos.map(p => `${nomeForma(p.forma)}: ${brl(p.valor)}`),
    ...(v.troco > 0 ? [`Troco: ${brl(v.troco)}`] : []),
  ].join('\n');
}

/* Últimos n dias, de hoje para trás, começando à meia-noite */
export function ultimosDias(n, hoje = new Date()) {
  const dias = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    dias.push(d);
  }
  return dias;
}

/* Regra do último administrador ativo: a mudança deixaria a loja sem admin? */
export function deixariaSemAdmin(usuarios, id, mudanca) {
  const depois = usuarios.map(u => (u.id === id ? { ...u, ...mudanca } : u));
  return !depois.some(u => u.perfil === 'admin' && u.ativo);
}
