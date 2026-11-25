/* =========================================================
   CAIXA (RF-04 a RF-16, RF-39, RF-41, RN-01 a RN-04)
   A venda é montada na tela e gravada de uma vez pela função
   registrar_venda do banco, que confere tudo numa transação.
   ========================================================= */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Kbd, Modal, janelaAberta, useTeclado, useToast } from '../componentes/ui.jsx';
import Comprovante from '../componentes/Comprovante.jsx';
import {
  FORMAS, brl, buscarProdutos, emReais, escolherProduto, hora, montarVenda, nomeForma, num, r2,
  separarQtd, situacaoPagamento, validarAdicao, validarPagamento,
} from '../lib/regras.js';
import { mensagemErro, supabase } from '../lib/supabase.js';

const novaVenda = () => ({ id: crypto.randomUUID(), itens: [], sel: -1, forma: 'dinheiro', pagamentos: [] });

export default function Caixa({ sessao, ativa, online, produtos, recarregarProdutos, vendaAberta }) {
  const toast = useToast();
  const [caixa, setCaixa] = useState(undefined);        // undefined = carregando; null = fechado
  const [venda, setVenda] = useState(novaVenda);
  const [busca, setBusca] = useState('');
  const [sugestao, setSugestao] = useState(0);
  const [sugestoesFechadas, setSugestoesFechadas] = useState(false);
  const [valor, setValor] = useState('');
  const [dialogo, setDialogo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [comprovante, setComprovante] = useState(null);
  const [vendasNoTurno, setVendasNoTurno] = useState(0);
  const buscaRef = useRef();
  const valorRef = useRef();
  const finalizarRef = useRef();

  const st = situacaoPagamento(venda.itens, venda.pagamentos);
  const achados = useMemo(() => buscarProdutos(produtos, busca), [produtos, busca]);
  const sugestoesAbertas = !sugestoesFechadas && achados.length > 0;
  vendaAberta.current = venda.itens.length > 0;

  /* turno de caixa aberto deste operador (RN-01) */
  useEffect(() => {
    let vivo = true;
    supabase.from('caixas').select('*').eq('operador_id', sessao.id).is('fechado_em', null).maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) toast(mensagemErro(error), 4000);
        setCaixa(data || null);
      });
    return () => { vivo = false; };
  }, [sessao.id, toast]);

  /* pede para abrir o caixa quando a tela abre com ele fechado (RF-04) */
  useEffect(() => {
    if (ativa && caixa === null) setDialogo(d => d || { tipo: 'abrir' });
  }, [ativa, caixa]);

  useEffect(() => {
    if (ativa && !dialogo && !comprovante) buscaRef.current?.focus();
  }, [ativa, dialogo, comprovante]);

  /* ---------- itens ---------- */
  function trocarItens(itens, sel) {
    const limparPagamentos = venda.pagamentos.length > 0;
    setVenda({ ...venda, itens, sel, pagamentos: limparPagamentos ? [] : venda.pagamentos });
    if (limparPagamentos) {
      setValor('');
      toast('A venda mudou: os pagamentos lançados foram apagados.');
    }
  }

  function adicionarProduto(p, qtd) {
    if (!caixa) { setDialogo({ tipo: 'abrir' }); return false; }                 // RN-01
    const existente = venda.itens.find(it => it.codigo === p.codigo);
    const r = validarAdicao(p, qtd, existente ? existente.qtd : 0);              // RN-02, RF-41
    if (!r.ok) { toast(r.erro, 3500); return false; }
    if (r.aviso) toast(r.aviso, 3500);
    else if (qtd > 1) toast(`${qtd}x ${p.nome} adicionados.`);
    if (existente) {
      trocarItens(venda.itens.map(it => (it === existente ? { ...it, qtd: it.qtd + qtd } : it)), venda.itens.indexOf(existente));
    } else {
      const itens = [...venda.itens, { codigo: p.codigo, nome: p.nome, preco: p.preco, qtd }];
      trocarItens(itens, itens.length - 1);
    }
    return true;
  }

  function adicionarDaBusca(indice = sugestoesAbertas ? sugestao : -1) {
    const { qtd, termo } = separarQtd(busca);
    const p = escolherProduto(produtos, busca, indice);
    if (!p) {
      if (termo.trim()) toast('Produto não encontrado.');                        // CX-03
      else if (busca.includes('*')) toast('Digite o código ou o nome depois do *. Ex.: 5*leite');
      return;
    }
    if (!adicionarProduto(p, qtd)) return;                                       // mantém o texto se não lançou
    setBusca('');
    setSugestao(0);
  }

  function itemSelecionado() {
    const it = venda.itens[venda.sel];
    if (!it) toast('Selecione um item com ↑ ↓.');
    return it;
  }

  function alterarQuantidade() {                                                 // RF-06 + RF-39
    const it = itemSelecionado();
    if (!it) return;
    setDialogo({ tipo: 'supervisor', acao: `Alterar a quantidade de "${it.nome}" (atual: ${it.qtd})`, depois: { tipo: 'qtd', item: it } });
  }

  function removerItem() {                                                       // RF-06 + RF-39
    const it = itemSelecionado();
    if (!it) return;
    setDialogo({ tipo: 'supervisor', acao: `Remover "${it.nome}" da venda`, depois: { tipo: 'remover', item: it } });
  }

  function cancelarVenda() {                                                     // RF-12 + RF-39 (venda ainda não gravada)
    if (!venda.itens.length) return;
    setDialogo({ tipo: 'supervisor', acao: `Cancelar a venda em andamento (${brl(st.total)})`, depois: { tipo: 'cancelar' } });
  }

  function aposAutorizar(depois) {
    if (depois.tipo === 'qtd') { setDialogo(depois); return; }
    setDialogo(null);
    if (depois.tipo === 'remover') {
      const itens = venda.itens.filter(it => it !== depois.item);
      trocarItens(itens, Math.min(venda.sel, itens.length - 1));
      toast('Item removido.');
    }
    if (depois.tipo === 'cancelar') {
      setVenda(novaVenda());
      setValor('');
      toast('Venda cancelada. Nada foi registrado.');
    }
  }

  /* ---------- pagamento (RF-08 a RF-10) ---------- */
  function prepararValor(situacao = st) {
    setValor(situacao.total > 0 && !situacao.completo ? emReais(situacao.falta) : '');
    setTimeout(() => { valorRef.current?.focus(); valorRef.current?.select(); }, 0);
  }

  function trocarForma(passo) {                                                  // ← → (decisão de 24/11/2026)
    const i = FORMAS.findIndex(f => f.id === venda.forma);
    setVenda({ ...venda, forma: FORMAS[(i + passo + FORMAS.length) % FORMAS.length].id });
    prepararValor();
  }

  function escolherForma(forma) {
    setVenda({ ...venda, forma });
    prepararValor();
  }

  /* devolve a lista nova de pagamentos, ou null se não lançou */
  function lancarPagamento() {
    const v = r2(num(valor));
    const r = validarPagamento(venda.itens, venda.pagamentos, venda.forma, v);
    if (!r.ok) {
      toast(r.erro, 3200);
      valorRef.current?.focus();
      valorRef.current?.select();
      return null;
    }
    const pagamentos = [...venda.pagamentos, { forma: venda.forma, valor: v }];
    setVenda({ ...venda, pagamentos });
    const depois = situacaoPagamento(venda.itens, pagamentos);
    if (depois.completo) {
      setValor('');
      toast(depois.troco > 0 ? `Pagamento completo. Troco: ${brl(depois.troco)}. Tecle F10.` : 'Pagamento completo. Tecle F10 para finalizar.', 3000);
      setTimeout(() => finalizarRef.current?.focus(), 0);
    } else {
      prepararValor(depois);
    }
    return pagamentos;
  }

  function removerPagamento(i) {
    const pagamentos = venda.pagamentos.filter((_, k) => k !== i);
    setVenda({ ...venda, pagamentos });
    prepararValor(situacaoPagamento(venda.itens, pagamentos));
  }

  /* ---------- finalizar (RF-11, RF-13) ---------- */
  async function finalizarVenda() {
    if (enviando) return;                                                        // OFF-04: F10 repetido
    if (!caixa) { setDialogo({ tipo: 'abrir' }); return; }
    if (!venda.itens.length) { toast('Adicione ao menos um item.'); return; }

    let pagamentos = venda.pagamentos;
    // F10 lança o valor do campo. Sem pagamento e sem valor, recebe o total na forma escolhida.
    if (!pagamentos.length && !valor.trim()) {
      pagamentos = [{ forma: venda.forma, valor: st.total }];
      setVenda({ ...venda, pagamentos });
    } else if (valor.trim() && !st.completo) {
      pagamentos = lancarPagamento();
      if (!pagamentos) return;
    }
    const s = situacaoPagamento(venda.itens, pagamentos);
    if (!s.completo) {                                                           // RN-03
      toast(`Falta receber ${brl(s.falta)}. Lance o resto em outra forma (← →).`, 3200);
      prepararValor(s);
      return;
    }
    if (!navigator.onLine) {                                                     // OFF-01
      toast('Sem internet: a venda ainda não foi registrada. Os itens continuam na tela; tecle F10 quando a conexão voltar.', 4500);
      return;
    }

    const feitaEm = new Date();
    setEnviando(true);
    const { data, error } = await supabase.rpc('registrar_venda', {
      p: montarVenda({ id: venda.id, caixaId: caixa.id, numeroLocal: vendasNoTurno + 1, itens: venda.itens, pagamentos, feitaEm }),
    });
    setEnviando(false);
    if (error) {
      // o id da venda continua o mesmo: tentar de novo não duplica (OFF-03, RNF-05)
      toast(`A venda não foi registrada: ${mensagemErro(error)}`, 5000);
      return;
    }

    setVendasNoTurno(n => n + 1);
    setComprovante({
      numero: data.numero, feita_em: feitaEm.toISOString(), operador: sessao.nome,
      itens: venda.itens, pagamentos, total: s.total, troco: s.troco,
    });
    setVenda(novaVenda());
    setValor('');
    recarregarProdutos();
  }

  function fecharCaixa() {                                                       // RF-16
    if (!caixa) { toast('O caixa já está fechado.'); return; }
    if (venda.itens.length) { toast('Finalize ou cancele a venda atual antes de fechar o caixa.'); return; }
    setDialogo({ tipo: 'fechar' });
  }

  /* ---------- atalhos (RF-15, RNF-01) ---------- */
  useTeclado(e => {
    if (!ativa || janelaAberta()) return;
    const tecla = e.key;
    const alvo = e.target;
    const noCampo = alvo.matches('input, select, textarea');

    if (tecla === 'F2') { e.preventDefault(); buscaRef.current.focus(); buscaRef.current.select(); return; }
    if (tecla === 'F4') { e.preventDefault(); alterarQuantidade(); return; }
    if (tecla === 'F8') { e.preventDefault(); prepararValor(); return; }
    if (tecla === 'F9') { e.preventDefault(); fecharCaixa(); return; }
    if (tecla === 'F10') { e.preventDefault(); finalizarVenda(); return; }
    if (tecla === 'Escape') {
      e.preventDefault();
      if (sugestoesAbertas) { setSugestoesFechadas(true); return; }
      cancelarVenda();
      return;
    }
    if (tecla === 'Delete') {
      if (e.target.matches?.('input, textarea') && e.target.value) return;
      e.preventDefault(); removerItem(); return;
    }

    if (alvo === buscaRef.current) {
      if (tecla === 'Enter') { e.preventDefault(); adicionarDaBusca(); return; }
      if (sugestoesAbertas && (tecla === 'ArrowDown' || tecla === 'ArrowUp')) {
        e.preventDefault();
        const n = achados.length;
        setSugestao(i => (i + (tecla === 'ArrowDown' ? 1 : -1) + n) % n);
        return;
      }
    }
    if (!sugestoesAbertas && (tecla === 'ArrowDown' || tecla === 'ArrowUp') && venda.itens.length) {
      e.preventDefault();
      const sel = Math.max(0, Math.min(venda.itens.length - 1, venda.sel + (tecla === 'ArrowDown' ? 1 : -1)));
      setVenda({ ...venda, sel });
      return;
    }
    if (tecla === 'ArrowLeft' || tecla === 'ArrowRight') {                       // ← → trocam a forma
      const c = valorRef.current;
      const tudoSelecionado = alvo === c && (c.value === '' || (c.selectionStart === 0 && c.selectionEnd === c.value.length));
      if (!noCampo || tudoSelecionado) { e.preventDefault(); trocarForma(tecla === 'ArrowRight' ? 1 : -1); return; }
    }
    if (alvo === valorRef.current && tecla === 'Enter') { e.preventDefault(); lancarPagamento(); }
  });

  /* ---------- tela ---------- */
  const qtdItens = venda.itens.reduce((s, it) => s + it.qtd, 0);
  const temTroco = st.completo && st.troco > 0;

  return (
    <section className="tela" hidden={!ativa}>
      <div className="caixa">
        <div className="caixa-esq">
          <div className="card busca">
            <Kbd>F2</Kbd>
            <div className="busca-campo">
              <input ref={buscaRef} className="field field-lg" autoComplete="off" aria-label="Buscar produto"
                placeholder="Código de barras ou nome  ·  5*leite lança 5 un."
                value={busca}
                onChange={e => { setBusca(e.target.value); setSugestao(0); setSugestoesFechadas(false); }} />
              {sugestoesAbertas && (
                <ul className="sugestoes">
                  {achados.map((p, i) => (
                    <li key={p.id} className={i === sugestao ? 'ativo' : ''}
                      onMouseDown={e => { e.preventDefault(); adicionarDaBusca(i); }}>
                      <span>{p.nome} <small>{p.codigo}</small></span>
                      <span>{brl(p.preco)} <small>· {p.saldo} un.</small></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => adicionarDaBusca()}>Adicionar <Kbd>Enter</Kbd></button>
          </div>

          <div className="card itens">
            <table>
              <thead>
                <tr><th>#</th><th>Produto</th><th className="num">Qtd</th><th className="num">Unit.</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {venda.itens.length === 0 ? (
                  <tr className="vazio"><td colSpan={5}>Nenhum item. Digite um código ou nome e tecle Enter (F2).</td></tr>
                ) : venda.itens.map((it, i) => (
                  <tr key={it.codigo} className={i === venda.sel ? 'selecionado' : ''} onClick={() => setVenda({ ...venda, sel: i })}>
                    <td>{i + 1}</td>
                    <td>{it.nome}<br /><small className="muted">{it.codigo}</small></td>
                    <td className="num"><b>{it.qtd}</b></td>
                    <td className="num">{brl(it.preco)}</td>
                    <td className="num"><b>{brl(it.preco * it.qtd)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="caixa-dir">
          <div className="card total">
            <h2>Venda atual</h2>
            <div className="linha"><span>Itens</span><span>{qtdItens}</span></div>
            <div className="linha"><span>Subtotal</span><span>{brl(st.total)}</span></div>
            <div className="linha-total"><span>TOTAL</span><b>{brl(st.total)}</b></div>
          </div>

          <div className="card pagamento">
            <h2>Pagamento <Kbd>F8</Kbd></h2>
            <div className="pag-grade" role="radiogroup" aria-label="Forma de pagamento">
              {FORMAS.map(f => (
                <button key={f.id} type="button" role="radio" aria-checked={venda.forma === f.id}
                  className={venda.forma === f.id ? 'ativo' : ''} onClick={() => escolherForma(f.id)}>{f.nome}</button>
              ))}
            </div>
            <p className="muted pequeno"><Kbd>←</Kbd> <Kbd>→</Kbd> troca a forma · <Kbd>Enter</Kbd> lança o valor. Para dividir, lance uma parte e depois o resto em outra forma.</p>
            <label htmlFor="valor-recebido">Valor em {nomeForma(venda.forma)}</label>
            <div className="pag-linha">
              <input id="valor-recebido" ref={valorRef} className="field" inputMode="decimal" placeholder="0,00" autoComplete="off"
                value={valor} onChange={e => setValor(e.target.value)} />
              <button type="button" className="btn" onClick={lancarPagamento}>Lançar</button>
            </div>
            <ul className="pag-lista">
              {venda.pagamentos.map((p, i) => (
                <li key={i}><span>{nomeForma(p.forma)}</span><b>{brl(p.valor)}</b>
                  <button type="button" className="icone-x" aria-label={`Remover pagamento em ${nomeForma(p.forma)}`} onClick={() => removerPagamento(i)}>×</button>
                </li>
              ))}
            </ul>
            <div className="pag-resumo" aria-live="polite">
              <div><span>Recebido</span><b>{brl(st.pago)}</b></div>
              <div id="pag-saldo" className={st.completo ? 'ok' : (st.total > 0 ? 'falta' : '')}>
                <span>{st.completo ? (temTroco ? 'Troco' : 'Pago') : 'Falta'}</span>
                <b>{brl(st.completo ? (temTroco ? st.troco : st.pago) : st.falta)}</b>
              </div>
            </div>
          </div>

          <button type="button" ref={finalizarRef} className="btn btn-primary btn-finalizar" disabled={enviando} onClick={finalizarVenda}>
            {enviando ? 'Registrando…' : 'Finalizar venda'} <Kbd>F10</Kbd>
          </button>
          <div className="caixa-botoes">
            <button type="button" className="btn btn-ghost" onClick={cancelarVenda}>Cancelar venda <Kbd>Esc</Kbd></button>
            <button type="button" className="btn btn-ghost" onClick={fecharCaixa}>Fechar caixa <Kbd>F9</Kbd></button>
          </div>
          <p className="muted pequeno">
            {caixa ? `Caixa aberto às ${hora(caixa.aberto_em)} · inicial ${brl(caixa.valor_inicial)}` : caixa === null ? 'Caixa fechado' : 'Carregando caixa…'}
            {!online && ' · sem internet'}
          </p>
        </div>
      </div>

      {dialogo?.tipo === 'abrir' && (
        <AbrirCaixa onAberto={c => { setCaixa(c); setVendasNoTurno(0); setDialogo(null); }} onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'supervisor' && (
        <Supervisor acao={dialogo.acao} onAutorizado={() => aposAutorizar(dialogo.depois)} onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'qtd' && (
        <NovaQuantidade item={dialogo.item} produto={produtos.find(p => p.codigo === dialogo.item.codigo)}
          onSalvar={q => {
            trocarItens(venda.itens.map(it => (it === dialogo.item ? { ...it, qtd: q } : it)), venda.sel);
            setDialogo(null);
          }}
          onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'fechar' && (
        <FecharCaixa caixa={caixa}
          onFechado={() => { setCaixa(null); setDialogo(null); toast('Caixa fechado. Bom descanso!'); }}
          onCancelar={() => setDialogo(null)} />
      )}
      {comprovante && <Comprovante venda={comprovante} onFechar={() => setComprovante(null)} />}
    </section>
  );
}

/* ---------- janelas do caixa ---------- */

function AbrirCaixa({ onAberto, onCancelar }) {                                  // RF-04, RN-01
  const [valor, setValor] = useState('100,00');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function abrir() {
    const v = num(valor);
    if (v < 0 || !valor.trim()) { setErro('Informe um valor válido.'); return; }
    setOcupado(true);
    const { data, error } = await supabase.from('caixas').insert({ valor_inicial: r2(v) }).select().single();
    setOcupado(false);
    if (error) {
      setErro(/caixas_um_aberto_por_operador/.test(error.message)
        ? 'Você já tem um caixa aberto em outro computador. Feche aquele antes.' : mensagemErro(error));
      return;
    }
    onAberto(data);
  }
  return (
    <Modal titulo="Abrir caixa" erro={erro} ocupado={ocupado} onConfirmar={abrir} textoConfirmar="Abrir caixa"
      onCancelar={onCancelar} textoCancelar="Agora não">
      <p className="muted">Informe o valor em dinheiro que está na gaveta para começar o turno.</p>
      <label htmlFor="valor-inicial">Valor inicial (R$)</label>
      <input id="valor-inicial" className="field" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} />
    </Modal>
  );
}

/* Senha do supervisor, conferida no servidor pela função autorizar() (RF-39, RN-10).
   A tentativa fica registrada em "autorizacoes", certa ou errada. */
function Supervisor({ acao, onAutorizado, onCancelar }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef();
  async function conferir() {
    if (!senha) { setErro('Digite a senha do supervisor.'); return; }
    setOcupado(true);
    const { data, error } = await supabase.rpc('autorizar', { p_acao: acao, p_senha: senha });
    setOcupado(false);
    if (error) { setErro(mensagemErro(error)); return; }
    if (!data) {
      setErro('Senha incorreta. A ação não foi feita.');
      setSenha('');
      campo.current?.focus();
      return;
    }
    onAutorizado();
  }
  return (
    <Modal titulo="Autorização do supervisor" erro={erro} ocupado={ocupado}
      onConfirmar={conferir} textoConfirmar="Autorizar" onCancelar={onCancelar}>
      <p className="aviso">{acao}</p>
      <label htmlFor="senha-supervisor">Senha de autorização</label>
      <input id="senha-supervisor" ref={campo} className="field" type="password" autoComplete="off"
        placeholder="Senha do supervisor" value={senha} onChange={e => setSenha(e.target.value)} />
    </Modal>
  );
}

function NovaQuantidade({ item, produto, onSalvar, onCancelar }) {               // RF-06
  const [qtd, setQtd] = useState(String(item.qtd));
  const [erro, setErro] = useState('');
  function salvar() {
    const q = parseInt(qtd, 10);
    if (!q || q < 1 || q > 999) { setErro('Informe uma quantidade de 1 a 999.'); return; }
    if (produto && q > produto.saldo) { setErro(`Estoque insuficiente (${produto.saldo} disponíveis).`); return; }   // RN-02
    onSalvar(q);
  }
  return (
    <Modal titulo="Nova quantidade" erro={erro} onConfirmar={salvar} onCancelar={onCancelar}>
      <label htmlFor="nova-qtd">{item.nome}</label>
      <input id="nova-qtd" className="field" type="number" min="1" max="999" value={qtd} onChange={e => setQtd(e.target.value)} />
    </Modal>
  );
}

function FecharCaixa({ caixa, onFechado, onCancelar }) {                         // RF-16
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    supabase.rpc('resumo_turno', { p_caixa: caixa.id }).then(({ data, error }) => {
      if (error) setErro(mensagemErro(error)); else setResumo(data);
    });
  }, [caixa.id]);
  async function fechar() {
    setOcupado(true);
    const { error } = await supabase.from('caixas').update({ fechado_em: new Date().toISOString() }).eq('id', caixa.id);
    setOcupado(false);
    if (error) { setErro(mensagemErro(error)); return; }
    onFechado();
  }
  return (
    <Modal titulo="Fechar caixa · resumo do turno" erro={erro} ocupado={ocupado || !resumo}
      onConfirmar={fechar} textoConfirmar="Fechar caixa" onCancelar={onCancelar} textoCancelar="Voltar">
      {!resumo ? <p className="muted">Calculando o resumo…</p> : (
        <table>
          <tbody>
            {FORMAS.map(f => <tr key={f.id}><td>{f.nome}</td><td className="num">{brl(resumo[f.id])}</td></tr>)}
            <tr><td><b>Total vendido ({resumo.vendas} vendas)</b></td><td className="num"><b>{brl(resumo.total)}</b></td></tr>
            <tr><td>Dinheiro esperado na gaveta</td><td className="num"><b>{brl(resumo.esperado_em_dinheiro)}</b></td></tr>
          </tbody>
        </table>
      )}
    </Modal>
  );
}
