/* =========================================================
   ESTOQUE (RF-17 a RF-24, RF-40)
   O saldo vem da view produtos_saldo (soma das movimentações, RN-08).
   Operador de caixa não acessa esta tela; estoquista e admin cadastram (RLS no banco).
   ========================================================= */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Kbd, Modal, janelaAberta, useTeclado, useToast } from '../componentes/ui.jsx';
import { CODIGO_VALIDO, SITUACOES, brl, dataHora, num } from '../lib/regras.js';
import { COLUNAS_CSV, lerCSV, textoModeloCSV, validarImportacao } from '../lib/csv.js';
import { mensagemErro, supabase } from '../lib/supabase.js';

const NOME_TIPO = { entrada: 'Entrada', venda: 'Venda', ajuste: 'Ajuste' };

export default function Estoque({ sessao, ativa, online, produtos, recarregarProdutos }) {
  const toast = useToast();
  const [filtro, setFiltro] = useState('');
  const [situacao, setSituacao] = useState('');
  const [selecionado, setSelecionado] = useState(null);       // id do produto
  const [historico, setHistorico] = useState([]);
  const [dialogo, setDialogo] = useState(null);
  const [verInativos, setVerInativos] = useState(false);
  const filtroRef = useRef();
  const somenteConsulta = sessao.perfil === 'operador';

  const ativos = useMemo(() => produtos.filter(p => p.ativo), [produtos]);
  const lista = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    return (verInativos ? produtos : ativos).filter(p => (!t || `${p.codigo} ${p.nome} ${p.categoria}`.toLowerCase().includes(t))
      && (!situacao || p.situacao === situacao));
  }, [ativos, produtos, verInativos, filtro, situacao]);
  const criticos = ativos.filter(p => p.situacao === 'baixo' || p.situacao === 'zerado');   // RF-20
  const produto = produtos.find(p => p.id === selecionado) || null;

  useEffect(() => {
    if (ativa && !dialogo) filtroRef.current?.focus();
  }, [ativa, dialogo]);

  /* histórico do produto escolhido (RF-19); recarrega quando o saldo muda */
  useEffect(() => {
    if (!selecionado) { setHistorico([]); return undefined; }
    let vivo = true;
    supabase.from('movimentacoes')
      .select('id, tipo, qtd, motivo, feita_em, usuario:perfis(nome)')
      .eq('produto_id', selecionado).order('feita_em', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) toast(mensagemErro(error)); else setHistorico(data);
      });
    return () => { vivo = false; };
  }, [selecionado, produto?.saldo, toast]);

  function abrir(tipo) {
    if (somenteConsulta) return;
    if (!online) { toast('Sem internet: cadastros ficam bloqueados até a conexão voltar.'); return; }
    setDialogo({ tipo });
  }

  function concluir(msg, idProduto) {
    setDialogo(null);
    if (idProduto) setSelecionado(idProduto);
    recarregarProdutos();
    if (msg) toast(msg, 3000);
  }

  useTeclado(e => {
    if (!ativa || janelaAberta()) return;
    if (e.key === 'F2') { e.preventDefault(); filtroRef.current.focus(); return; }
    if (e.key === 'F4') { e.preventDefault(); abrir('entrada'); return; }
    if (e.key === 'F6') { e.preventDefault(); abrir('novo'); return; }
    if (e.key === 'F7') { e.preventDefault(); abrir('importar'); }
  });

  const destaque = produto?.local;
  const ocupados = new Set(ativos.map(p => p.local));

  return (
    <section className="tela" hidden={!ativa}>
      <div className="estoque">
        <div className="card">
          <div className="toolbar">
            <input ref={filtroRef} className="field" placeholder="Buscar por nome, código ou categoria… (F2)"
              value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Buscar produto" />
            <select className="field field-sm" value={situacao} onChange={e => setSituacao(e.target.value)} aria-label="Situação">
              <option value="">Todas as situações</option>
              <option value="normal">OK</option>
              <option value="baixo">Baixo</option>
              <option value="zerado">Zerado</option>
            </select>
            <label className="check-inline"><input type="checkbox" checked={verInativos} onChange={e => setVerInativos(e.target.checked)} /> Ver inativos</label>
            {!somenteConsulta && <>
              <button type="button" className="btn" onClick={() => abrir('entrada')}>+ Entrada <Kbd>F4</Kbd></button>
              <button type="button" className="btn" onClick={() => abrir('importar')}>Importar planilha <Kbd>F7</Kbd></button>
              <button type="button" className="btn btn-primary" onClick={() => abrir('novo')}>+ Novo produto <Kbd>F6</Kbd></button>
            </>}
          </div>
          <div className="tabela-rolagem">
            <table className="tabela-estoque">
              <thead>
                <tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Local</th><th className="num">Preço</th><th className="num">Qtd</th><th className="num">Mín.</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {lista.length === 0 && <tr><td colSpan={8} className="muted">Nenhum produto encontrado.</td></tr>}
                {lista.map(p => (
                  <tr key={p.id} className={p.id === selecionado ? 'selecionado' : ''} onClick={() => setSelecionado(p.id)}>
                    <td><small>{p.codigo}</small></td><td>{p.nome}</td><td>{p.categoria}</td><td>{p.local || '—'}</td>
                    <td className="num">{brl(p.preco)}</td><td className="num"><b>{p.saldo}</b></td><td className="num">{p.minimo}</td>
                    <td>{p.ativo
                      ? <span className={'pill ' + SITUACOES[p.situacao].classe}>{SITUACOES[p.situacao].nome}</span>
                      : <span className="pill pill-danger">Inativo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="estoque-lado">
          <div className="card bloco">
            <h2>Alertas de estoque baixo</h2>
            {criticos.length === 0 ? <p className="muted">Nenhum produto abaixo do mínimo.</p> : criticos.map(p => (
              <div key={p.id} className={'alerta' + (p.saldo <= 0 ? ' zerado' : '')}><span>{p.nome}</span><b>{p.saldo} / mín. {p.minimo}</b></div>
            ))}
          </div>
          <div className="card bloco">
            <h2>Mapa do armazém</h2>
            <div className="mapa">
              {['A', 'B', 'C', 'D'].flatMap(c => [1, 2, 3, 4].map(n => {
                const loc = c + n;
                return <div key={loc} className={'prateleira' + (ocupados.has(loc) ? ' ocupada' : '') + (loc === destaque ? ' destaque' : '')}>{loc}</div>;
              }))}
            </div>
            <p className="muted pequeno">Clique num produto da tabela para ver onde ele fica.</p>
          </div>
          {produto && (
            <div className="card bloco">
              <h2>{produto.codigo} · {produto.nome}</h2>
              {!somenteConsulta && (
                <div className="painel-acoes">
                  <button type="button" className="btn btn-sm" onClick={() => abrir('editar')}>Editar</button>
                  <button type="button" className="btn btn-sm" onClick={() => abrir('ajuste')}>Ajuste de estoque</button>
                </div>
              )}
              <h3>Histórico de movimentações</h3>
              <ul className="historico">
                {historico.length === 0 && <li className="muted">Sem movimentações.</li>}
                {historico.map(m => (
                  <li key={m.id}>
                    <span>{NOME_TIPO[m.tipo]}<small>{dataHora(m.feita_em)} · {m.usuario?.nome || '—'} · {m.motivo || ''}</small></span>
                    <b>{m.qtd > 0 ? '+' : ''}{m.qtd}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {dialogo?.tipo === 'novo' && (
        <FormProduto produtos={produtos} onSalvo={(id, nome) => concluir(`${nome} cadastrado.`, id)} onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'editar' && produto && (
        <FormProduto produto={produto} produtos={produtos} onSalvo={id => concluir('Produto atualizado.', id)} onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'entrada' && (
        <Entrada produtos={ativos} inicial={selecionado} onSalvo={(id, msg) => concluir(msg, id)} onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'ajuste' && produto && (
        <Ajuste produto={produto} onSalvo={msg => concluir(msg, produto.id)} onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'importar' && (
        <Importar produtos={produtos} onSalvo={msg => concluir(msg)} onCancelar={() => setDialogo(null)} />
      )}
    </section>
  );
}

/* ---------- cadastro e edição (RF-17, RF-22) ---------- */
function FormProduto({ produto, produtos, onSalvo, onCancelar }) {
  const [f, setF] = useState(() => ({
    codigo: produto?.codigo || '', nome: produto?.nome || '', categoria: produto?.categoria || '',
    preco: produto ? String(produto.preco).replace('.', ',') : '', minimo: String(produto?.minimo ?? 1),
    local: produto?.local || '', qtd: '0', ativo: produto ? produto.ativo : true,
  }));
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const campo = nome => ({ value: f[nome], onChange: e => setF({ ...f, [nome]: e.target.value }) });

  async function salvar() {
    const codigo = f.codigo.replace(/\s/g, '');
    const nome = f.nome.trim();
    const preco = num(f.preco);
    const minimo = parseInt(f.minimo, 10);
    const qtd = produto ? 0 : parseInt(f.qtd, 10);
    if (!codigo || !nome) { setErro('Preencha código e nome.'); return; }
    if (!CODIGO_VALIDO.test(codigo)) { setErro('O código de barras deve ter de 8 a 14 números.'); return; }
    if (!produto && produtos.some(p => p.codigo === codigo)) { setErro('Código já cadastrado.'); return; }   // EST-05
    if (!f.preco.trim() || preco <= 0) { setErro('Informe um preço maior que zero.'); return; }
    if (isNaN(minimo) || minimo < 0 || isNaN(qtd) || qtd < 0) { setErro('Quantidades não podem ser negativas.'); return; }
    const dados = { nome, categoria: f.categoria.trim() || 'Geral', preco, minimo, local: f.local.trim().toUpperCase() || null };
    if (produto) dados.ativo = f.ativo;   // RF-17: inativar em vez de apagar

    setOcupado(true);
    let id = produto?.id;
    if (produto) {
      const { error } = await supabase.from('produtos').update(dados).eq('id', produto.id);
      if (error) { setOcupado(false); setErro(mensagemErro(error)); return; }
    } else {
      const { data, error } = await supabase.from('produtos').insert({ ...dados, codigo }).select('id').single();
      if (error) { setOcupado(false); setErro(mensagemErro(error)); return; }
      id = data.id;
      if (qtd > 0) {
        const r = await supabase.from('movimentacoes').insert({ produto_id: id, tipo: 'entrada', qtd, motivo: 'Estoque inicial' });
        if (r.error) { setOcupado(false); setErro(`Produto criado, mas o estoque inicial falhou: ${mensagemErro(r.error)}`); return; }
      }
    }
    setOcupado(false);
    onSalvo(id, nome);
  }

  return (
    <Modal titulo={produto ? `Editar ${produto.codigo}` : 'Novo produto'} erro={erro} ocupado={ocupado}
      onConfirmar={salvar} onCancelar={onCancelar}>
      <div className="grade-campos">
        <div><label htmlFor="f-codigo">Código de barras</label>
          <input id="f-codigo" className="field" inputMode="numeric" placeholder="8 a 14 números" readOnly={!!produto} {...campo('codigo')} /></div>
        <div><label htmlFor="f-local">Local (ex.: A1)</label><input id="f-local" className="field" {...campo('local')} /></div>
      </div>
      <label htmlFor="f-nome">Nome</label><input id="f-nome" className="field" {...campo('nome')} />
      <label htmlFor="f-categoria">Categoria</label><input id="f-categoria" className="field" {...campo('categoria')} />
      <div className="grade-campos">
        <div><label htmlFor="f-preco">Preço (R$)</label><input id="f-preco" className="field" inputMode="decimal" {...campo('preco')} /></div>
        <div><label htmlFor="f-minimo">Estoque mínimo</label><input id="f-minimo" className="field" type="number" min="0" {...campo('minimo')} /></div>
      </div>
      {produto && (
        <label className="check-inline" htmlFor="f-ativo">
          <input id="f-ativo" type="checkbox" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} /> Produto ativo (desmarque para inativar; some do Caixa e do Estoque)
        </label>
      )}
      {!produto && <><label htmlFor="f-qtd">Quantidade inicial</label><input id="f-qtd" className="field" type="number" min="0" {...campo('qtd')} /></>}
    </Modal>
  );
}

/* ---------- entrada de mercadoria (RF-18) ---------- */
function Entrada({ produtos, inicial, onSalvo, onCancelar }) {
  const [id, setId] = useState(inicial || produtos[0]?.id || '');
  const [qtd, setQtd] = useState('10');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar() {
    const q = parseInt(qtd, 10);
    const p = produtos.find(x => x.id === id);
    if (!p) { setErro('Escolha um produto.'); return; }
    if (!q || q < 1) { setErro('Informe uma quantidade de 1 ou mais.'); return; }
    setOcupado(true);
    const { error } = await supabase.from('movimentacoes').insert({ produto_id: id, tipo: 'entrada', qtd: q, motivo: 'Entrada de mercadoria' });
    setOcupado(false);
    if (error) { setErro(mensagemErro(error)); return; }
    onSalvo(id, `${p.nome}: estoque agora é ${p.saldo + q}.`);
  }
  return (
    <Modal titulo="Entrada de mercadoria" erro={erro} ocupado={ocupado} onConfirmar={salvar} onCancelar={onCancelar}>
      <label htmlFor="e-produto">Produto</label>
      <select id="e-produto" className="field" value={id} onChange={e => setId(e.target.value)}>
        {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nome} ({p.saldo} un.)</option>)}
      </select>
      <label htmlFor="e-qtd">Quantidade recebida</label>
      <input id="e-qtd" className="field" type="number" min="1" value={qtd} onChange={e => setQtd(e.target.value)} />
    </Modal>
  );
}

/* ---------- ajuste com motivo (RF-21) ---------- */
function Ajuste({ produto, onSalvo, onCancelar }) {
  const [contada, setContada] = useState(String(produto.saldo));
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar() {
    const q = parseInt(contada, 10);
    if (isNaN(q) || q < 0) { setErro('Informe uma quantidade válida.'); return; }
    if (!motivo) { setErro('O motivo é obrigatório.'); return; }
    const diferenca = q - produto.saldo;
    if (diferenca === 0) { onCancelar(); return; }
    setOcupado(true);
    const { error } = await supabase.from('movimentacoes').insert({ produto_id: produto.id, tipo: 'ajuste', qtd: diferenca, motivo });
    setOcupado(false);
    if (error) { setErro(mensagemErro(error)); return; }
    onSalvo(`Ajuste de ${diferenca > 0 ? '+' : ''}${diferenca} em ${produto.nome}.`);
  }
  return (
    <Modal titulo={`Ajuste de estoque · ${produto.codigo}`} erro={erro} ocupado={ocupado} onConfirmar={salvar} onCancelar={onCancelar}>
      <p className="muted">Quantidade atual no sistema: <b>{produto.saldo}</b></p>
      <label htmlFor="a-qtd">Quantidade contada</label>
      <input id="a-qtd" className="field" type="number" min="0" value={contada} onChange={e => setContada(e.target.value)} />
      <label htmlFor="a-motivo">Motivo (obrigatório)</label>
      <select id="a-motivo" className="field" value={motivo} onChange={e => setMotivo(e.target.value)}>
        <option value="">Selecione…</option><option>Contagem</option><option>Perda</option><option>Avaria</option><option>Vencimento</option>
      </select>
    </Modal>
  );
}

/* ---------- importação em lote (RF-40) ---------- */
function baixarModelo() {
  const blob = new Blob(['﻿' + textoModeloCSV()], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'modelo-produtos-pdv-de-bolso.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function Importar({ produtos, onSalvo, onCancelar }) {
  const [importacao, setImportacao] = useState(null);     // { arquivo, linhas }
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  function carregar(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      setErro('');
      try {
        const codigos = new Set(produtos.map(p => p.codigo));
        setImportacao({ arquivo: arquivo.name, linhas: validarImportacao(lerCSV(String(leitor.result)), codigos) });
      } catch (err) {
        setImportacao(null);
        setErro(err.message);
      }
    };
    leitor.readAsText(arquivo, 'UTF-8');
  }

  async function importar() {
    if (!importacao) { setErro('Escolha um arquivo CSV para ver a prévia.'); return; }
    const validas = importacao.linhas.filter(l => !l.erros.length);
    if (!validas.length) { setErro('Nenhuma linha válida para importar. Corrija a planilha e tente de novo.'); return; }
    setOcupado(true);
    const { data, error } = await supabase.from('produtos')
      .insert(validas.map(({ dados: { qtd, ...d } }) => d)).select('id, codigo');
    if (error) { setOcupado(false); setErro(mensagemErro(error)); return; }
    const idPorCodigo = Object.fromEntries(data.map(p => [p.codigo, p.id]));
    const entradas = validas.filter(l => l.dados.qtd > 0).map(l => ({
      produto_id: idPorCodigo[l.dados.codigo], tipo: 'entrada', qtd: l.dados.qtd, motivo: `Importação em lote (${importacao.arquivo})`,
    }));
    if (entradas.length) {
      const r = await supabase.from('movimentacoes').insert(entradas);
      if (r.error) { setOcupado(false); setErro(`Produtos criados, mas o estoque inicial falhou: ${mensagemErro(r.error)}`); return; }
    }
    setOcupado(false);
    const recusadas = importacao.linhas.length - validas.length;
    onSalvo(`${validas.length} importado${validas.length === 1 ? '' : 's'}, ${recusadas} recusado${recusadas === 1 ? '' : 's'}.`);
  }

  const validas = importacao ? importacao.linhas.filter(l => !l.erros.length).length : 0;
  const recusadas = importacao ? importacao.linhas.length - validas : 0;

  return (
    <Modal titulo="Importar produtos em lote (CSV)" largo erro={erro} ocupado={ocupado}
      onConfirmar={importar} textoConfirmar="Importar válidas" onCancelar={onCancelar}>
      <ol className="importar-passos">
        <li>Baixe o modelo e preencha uma linha por produto: <code>{COLUNAS_CSV.join(';')}</code></li>
        <li>Salve como CSV (no Excel: <i>Salvar como → CSV UTF-8</i>) e escolha o arquivo abaixo.</li>
        <li>Confira a prévia: linhas com erro são recusadas e não entram no estoque.</li>
      </ol>
      <button type="button" className="btn btn-sm" onClick={baixarModelo}>Baixar modelo (.csv)</button>
      <label htmlFor="arquivo-csv">Arquivo CSV</label>
      <input id="arquivo-csv" className="field campo-arquivo" type="file" accept=".csv,text/csv" onChange={e => carregar(e.target.files[0])} />
      {importacao && <>
        <div className="previa-resumo">
          <span className="pill pill-info">{importacao.arquivo}</span>
          <span className="pill pill-ok">{validas} válida{validas === 1 ? '' : 's'}</span>
          <span className={'pill ' + (recusadas ? 'pill-danger' : 'pill-ok')}>{recusadas} recusada{recusadas === 1 ? '' : 's'}</span>
        </div>
        <div className="previa-tabela">
          <table>
            <thead><tr><th>Linha</th><th>Código</th><th>Produto</th><th className="num">Preço</th><th className="num">Qtd</th><th className="num">Mín.</th><th>Local</th><th>Situação</th></tr></thead>
            <tbody>
              {importacao.linhas.map(l => (
                <tr key={l.linha} className={l.erros.length ? 'recusada' : ''}>
                  <td>{l.linha}</td><td>{l.dados.codigo}</td><td>{l.dados.nome}</td>
                  <td className="num">{l.dados.preco > 0 ? brl(l.dados.preco) : '—'}</td>
                  <td className="num">{Number.isFinite(l.dados.qtd) ? l.dados.qtd : '—'}</td>
                  <td className="num">{Number.isFinite(l.dados.minimo) ? l.dados.minimo : '—'}</td>
                  <td>{l.dados.local || '—'}</td>
                  <td>{l.erros.length ? <span className="previa-motivo">{l.erros.join('; ')}</span> : <span className="pill pill-ok">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted pequeno">Nada foi gravado ainda. Só as linhas válidas serão importadas.</p>
      </>}
    </Modal>
  );
}
