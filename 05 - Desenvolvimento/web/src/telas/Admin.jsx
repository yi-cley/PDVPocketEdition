/* =========================================================
   ADMINISTRAÇÃO (RF-25 a RF-31, RF-36, RF-39)
   Só o perfil admin chega aqui, e o RLS só entrega estes dados ao admin.
   ========================================================= */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, useToast } from '../componentes/ui.jsx';
import Comprovante from '../componentes/Comprovante.jsx';
import { DOMINIO_LOGIN, mensagemErro, supabase } from '../lib/supabase.js';
import { FORMAS, PERFIS, brl, dataHora, deixariaSemAdmin, mesmoDia, nomeForma, ultimosDias } from '../lib/regras.js';

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const COR_FORMA = { pix: 'var(--serie-1)', dinheiro: 'var(--serie-3)', debito: 'var(--serie-2)', credito: 'var(--serie-4)' };
const formasDaVenda = v => [...new Set(v.venda_pagamentos.map(p => p.forma))];

export default function Admin({ sessao, ativa, online, produtos }) {
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [periodo, setPeriodo] = useState('hoje');
  const [forma, setForma] = useState('');
  const [operador, setOperador] = useState('');
  const [dialogo, setDialogo] = useState(null);

  const carregar = useCallback(async () => {
    const [vendas, usuarios, autorizacoes, sync, config] = await Promise.all([
      supabase.from('vendas')
        .select('id, numero, feita_em, total, troco, operador:perfis(nome), venda_itens(codigo, nome, preco, qtd), venda_pagamentos(forma, valor)')
        .order('feita_em', { ascending: false }).limit(500),
      supabase.from('perfis').select('id, nome, login, perfil, ativo').order('nome'),
      supabase.from('autorizacoes').select('id, acao, autorizada, feita_em, operador:perfis(nome)').order('feita_em', { ascending: false }).limit(100),
      supabase.from('sync_log').select('id, tipo, descricao, resolucao, criado_em').order('criado_em', { ascending: false }).limit(50),
      // só pergunta se a senha existe: o hash nunca vem para o navegador (SEG-20)
      supabase.from('configuracoes').select('atualizada_em').not('senha_supervisor_hash', 'is', null).maybeSingle(),
    ]);
    const falha = [vendas, usuarios, autorizacoes, sync, config].find(r => r.error);
    if (falha) { setErro(mensagemErro(falha.error)); return; }
    setErro('');
    setDados({
      vendas: vendas.data.map(v => ({ ...v, total: Number(v.total), troco: Number(v.troco),
        venda_itens: v.venda_itens.map(i => ({ ...i, preco: Number(i.preco) })),
        venda_pagamentos: v.venda_pagamentos.map(p => ({ ...p, valor: Number(p.valor) })) })),
      usuarios: usuarios.data,
      autorizacoes: autorizacoes.data,
      sync: sync.data,
      senhaDefinida: Boolean(config.data),
    });
  }, []);

  useEffect(() => { if (ativa) carregar(); }, [ativa, carregar]);

  /* vendas novas de qualquer caixa atualizam os números (RF-35) */
  useEffect(() => {
    if (!ativa) return undefined;
    let timer;
    const canal = supabase.channel('admin-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vendas' }, () => { clearTimeout(timer); timer = setTimeout(carregar, 800); })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [ativa, carregar]);

  const calc = useMemo(() => {
    if (!dados) return null;
    const hoje = new Date();
    const dias = ultimosDias(7, hoje);
    const vendasHoje = dados.vendas.filter(v => mesmoDia(new Date(v.feita_em), hoje));
    const totalHoje = vendasHoje.reduce((s, v) => s + v.total, 0);
    const vendas7 = dados.vendas.filter(v => new Date(v.feita_em) >= dias[0]);
    const ranking = {};
    vendas7.forEach(v => v.venda_itens.forEach(it => { ranking[it.nome] = (ranking[it.nome] || 0) + it.qtd; }));
    return {
      totalHoje,
      qtdHoje: vendasHoje.length,
      total7: vendas7.reduce((s, v) => s + v.total, 0),
      qtd7: vendas7.length,
      ticket: vendasHoje.length ? totalHoje / vendasHoje.length : 0,
      porDia: dias.map((d, i) => ({
        rotulo: `${NOMES_DIA[d.getDay()]} ${d.getDate()}`,
        valor: dados.vendas.filter(v => mesmoDia(new Date(v.feita_em), d)).reduce((s, v) => s + v.total, 0),
        destaque: i === dias.length - 1,
      })),
      porForma: FORMAS.map(f => ({ rotulo: f.nome, cor: COR_FORMA[f.id], valor: vendas7.filter(v => formasDaVenda(v).includes(f.id)).length }))
        .sort((a, b) => b.valor - a.valor),
      ranking: Object.entries(ranking).sort((a, b) => b[1] - a[1]).slice(0, 6),
      conflitos: dados.sync.filter(s => s.tipo === 'conflito' && new Date(s.criado_em) >= dias[0]).length,
      inicio7: dias[0],
    };
  }, [dados]);

  const criticos = produtos.filter(p => p.ativo && (p.situacao === 'baixo' || p.situacao === 'zerado')).length;

  /* ---------- usuários (RF-31) ---------- */
  async function mudarUsuario(u, mudanca) {
    if (u.id === sessao.id && (mudanca.ativo === false || (mudanca.perfil && mudanca.perfil !== 'admin'))) {
      toast('Você não pode tirar o seu próprio perfil de administrador nem se desativar.', 3500);   // SEG-01, SEG-02
      return;
    }
    if (deixariaSemAdmin(dados.usuarios, u.id, mudanca)) {
      toast('O sistema precisa de pelo menos um administrador ativo.', 3500);
      return;
    }
    if (!online) { toast('Sem internet: a alteração não foi feita.'); return; }
    const { error } = await supabase.from('perfis').update(mudanca).eq('id', u.id);
    if (error) { toast(mensagemErro(error), 4000); carregar(); return; }
    toast(mudanca.perfil ? `${u.nome} agora é ${PERFIS[mudanca.perfil].nome}.` : `${u.nome} ${mudanca.ativo ? 'ativado' : 'desativado'}.`);
    carregar();
  }

  if (!ativa) return <section className="tela" hidden />;
  if (erro) return <section className="tela"><div className="card bloco"><p className="erro">{erro}</p><button type="button" className="btn btn-sm" onClick={carregar}>Tentar de novo</button></div></section>;
  if (!dados || !calc) return <section className="tela"><p className="muted">Carregando…</p></section>;

  const limite = calc.inicio7;
  const vendasFiltradas = dados.vendas.filter(v => {
    const d = new Date(v.feita_em);
    if (periodo === 'hoje' && !mesmoDia(d, new Date())) return false;
    if (periodo === '7' && d < limite) return false;
    if (operador && (v.operador?.nome || '—') !== operador) return false;   // RF-25
    return !forma || formasDaVenda(v).includes(forma);
  });
  const operadores = [...new Set(dados.vendas.map(v => v.operador?.nome || '—'))].sort();
  const listaCriticos = produtos.filter(p => p.ativo && (p.situacao === 'baixo' || p.situacao === 'zerado'));   // RF-30

  return (
    <section className="tela">
      <div className="kpis">
        <div className="card kpi"><span>Vendas de hoje</span><b>{brl(calc.totalHoje)}</b><small className="muted">{calc.qtdHoje} venda{calc.qtdHoje === 1 ? '' : 's'}</small></div>
        <div className="card kpi"><span>Vendas dos últimos 7 dias</span><b>{brl(calc.total7)}</b><small className="muted">{calc.qtd7} venda{calc.qtd7 === 1 ? '' : 's'}</small></div>
        <div className="card kpi"><span>Ticket médio</span><b>{brl(calc.ticket)}</b></div>
        <div className="card kpi"><span>Estoque crítico</span><b className="txt-alerta">{criticos}</b><small className="muted">produtos no mínimo ou abaixo</small>
          {listaCriticos.length > 0 && <ul className="criticos">{listaCriticos.slice(0, 5).map(p => <li key={p.id}>{p.nome} <span>{p.saldo}/{p.minimo}</span></li>)}{listaCriticos.length > 5 && <li className="muted">e mais {listaCriticos.length - 5}…</li>}</ul>}</div>
        <div className="card kpi"><span>Conflitos (7 dias)</span><b className={calc.conflitos ? 'txt-alerta' : ''}>{calc.conflitos}</b>
          <small className="muted">no registro de sincronização</small>
          <button type="button" className="btn btn-sm" onClick={carregar}>Atualizar</button></div>
      </div>

      <div className="grade-2">
        <div className="card bloco"><h2>Vendas dos últimos 7 dias (R$)</h2><div className="grafico"><GraficoColunas dados={calc.porDia} /></div></div>
        <div className="card bloco"><h2>Formas de pagamento mais usadas (nº de vendas, 7 dias)</h2><div className="grafico"><GraficoBarras dados={calc.porForma} /></div></div>
      </div>

      <div className="grade-2">
        <div className="card bloco">
          <div className="bloco-topo">
            <h2>Vendas</h2>
            <div className="filtros">
              <select className="field field-sm" value={periodo} onChange={e => setPeriodo(e.target.value)} aria-label="Período">
                <option value="hoje">Hoje</option><option value="7">7 dias</option><option value="todos">Todas</option>
              </select>
              <select className="field field-sm" value={forma} onChange={e => setForma(e.target.value)} aria-label="Forma de pagamento">
                <option value="">Todas as formas</option>
                {FORMAS.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <select className="field field-sm" value={operador} onChange={e => setOperador(e.target.value)} aria-label="Operador">
                <option value="">Todos os operadores</option>
                {operadores.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="tabela-rolagem tabela-curta">
            <table>
              <thead><tr><th>Nº</th><th>Data</th><th>Operador</th><th>Pagamento</th><th className="num">Valor</th><th></th></tr></thead>
              <tbody>
                {vendasFiltradas.length === 0 && <tr><td colSpan={6} className="muted">Nenhuma venda no filtro escolhido.</td></tr>}
                {vendasFiltradas.map(v => (
                  <tr key={v.id}>
                    <td>{v.numero}</td><td>{dataHora(v.feita_em)}</td><td>{v.operador?.nome || '—'}</td>
                    <td>{formasDaVenda(v).map(nomeForma).join(' + ')}</td><td className="num">{brl(v.total)}</td>
                    <td><button type="button" className="btn btn-sm btn-ghost" onClick={() => setDialogo({ tipo: 'comprovante', venda: v })}>Comprovante</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card bloco">
          <h2>Produtos mais vendidos (7 dias)</h2>
          <ol className="ranking">
            {calc.ranking.length === 0 && <li className="muted">Sem vendas no período.</li>}
            {calc.ranking.map(([nome, q]) => <li key={nome}>{nome} <span>{q} un.</span></li>)}
          </ol>
        </div>
      </div>

      <div className="grade-2">
        <div className="card bloco">
          <div className="bloco-topo">
            <h2>Usuários</h2>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialogo({ tipo: 'novo-usuario' })}>+ Novo usuário</button>
          </div>
          <table>
            <thead><tr><th>Nome</th><th>Perfil</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {dados.usuarios.map(u => (
                <tr key={u.id}>
                  <td>{u.nome}<br /><small className="muted">{u.login}</small></td>
                  <td>
                    <select className="field field-sm" value={u.perfil} aria-label={`Perfil de ${u.nome}`}
                      onChange={e => mudarUsuario(u, { perfil: e.target.value })}>
                      {Object.entries(PERFIS).map(([k, p]) => <option key={k} value={k}>{p.nome}</option>)}
                    </select>
                  </td>
                  <td><span className={'pill ' + (u.ativo ? 'pill-ok' : 'pill-danger')}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td><button type="button" className={'btn btn-sm' + (u.ativo ? ' btn-perigo' : '')}
                    onClick={() => mudarUsuario(u, { ativo: !u.ativo })}>{u.ativo ? 'Desativar' : 'Ativar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card bloco">
          <h2>Autorizações do supervisor (RF-39)</h2>
          <div className="tabela-rolagem tabela-curta">
            <table>
              <thead><tr><th>Data</th><th>Operador</th><th>Ação</th><th>Resultado</th></tr></thead>
              <tbody>
                {dados.autorizacoes.length === 0 && <tr><td colSpan={4} className="muted">Nenhuma autorização registrada ainda.</td></tr>}
                {dados.autorizacoes.map(a => (
                  <tr key={a.id}><td>{dataHora(a.feita_em)}</td><td>{a.operador?.nome || '—'}</td><td>{a.acao}</td>
                    <td><span className={'pill ' + (a.autorizada ? 'pill-ok' : 'pill-danger')}>{a.autorizada ? 'Autorizada' : 'Senha incorreta'}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grade-2">
        <div className="card bloco">
          <h2>Registro de sincronização e conflitos (RF-36)</h2>
          <ul className="historico">
            {dados.sync.length === 0 && <li className="muted">Nada registrado.</li>}
            {dados.sync.map(s => (
              <li key={s.id}>
                <span>{s.descricao}<small>{dataHora(s.criado_em)}{s.resolucao ? ` · ${s.resolucao}` : ''}</small></span>
                <span className={'pill ' + (s.tipo === 'conflito' ? 'pill-warn' : 'pill-ok')}>{s.tipo}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card bloco">
          <h2>Configurações</h2>
          <p className="muted pequeno">Regra de estoque (RN-02): o caixa avisa quando o produto chega ao estoque mínimo e bloqueia a venda quando ele acaba.</p>
          <label className="opcao">
            <span>Senha de autorização do supervisor{' '}
              <span className={'pill ' + (dados.senhaDefinida ? 'pill-ok' : 'pill-danger')}>{dados.senhaDefinida ? 'definida' : 'não definida'}</span>
            </span>
            <button type="button" className="btn btn-sm" onClick={() => setDialogo({ tipo: 'senha' })}>
              {dados.senhaDefinida ? 'Alterar senha' : 'Definir senha'}
            </button>
          </label>
        </div>
      </div>

      {dialogo?.tipo === 'comprovante' && (
        <Comprovante onFechar={() => setDialogo(null)} venda={{
          numero: dialogo.venda.numero, feita_em: dialogo.venda.feita_em, operador: dialogo.venda.operador?.nome || '—',
          itens: dialogo.venda.venda_itens, pagamentos: dialogo.venda.venda_pagamentos,
          total: dialogo.venda.total, troco: dialogo.venda.troco,
        }} />
      )}
      {dialogo?.tipo === 'senha' && (
        <SenhaSupervisor onSalvo={() => { setDialogo(null); toast('Senha do supervisor salva.'); carregar(); }} onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'novo-usuario' && <NovoUsuario onFechar={() => { setDialogo(null); carregar(); }} />}
    </section>
  );
}

/* ---------- gráficos (RF-28, RF-29) ---------- */
function GraficoColunas({ dados }) {
  const W = 560, H = 230, L = 52, R = 10, T = 22, B = 30;
  const max = Math.max(500, Math.ceil(Math.max(...dados.map(d => d.valor)) / 500) * 500);
  const larg = (W - L - R) / dados.length;
  const y = v => T + (H - T - B) * (1 - v / max);
  const linhas = [0, 1, 2, 3, 4].map(i => (max / 4) * i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vendas por dia">
      {linhas.map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--line)' }} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end">{v.toLocaleString('pt-BR')}</text>
        </g>
      ))}
      {dados.map((d, i) => {
        const x = L + i * larg + larg * 0.2, w = larg * 0.6;
        const classe = d.destaque ? 'rotulo-forte' : '';
        return (
          <g key={d.rotulo}>
            <rect x={x} y={y(d.valor)} width={w} height={y(0) - y(d.valor)} rx="4"
              style={{ fill: d.destaque ? 'var(--serie-1)' : 'var(--serie-base)' }}><title>{d.rotulo}: {brl(d.valor)}</title></rect>
            <text x={x + w / 2} y={y(d.valor) - 6} textAnchor="middle" className={classe}>{Math.round(d.valor).toLocaleString('pt-BR')}</text>
            <text x={x + w / 2} y={H - 10} textAnchor="middle" className={classe}>{d.rotulo}</text>
          </g>
        );
      })}
    </svg>
  );
}

function GraficoBarras({ dados }) {
  const W = 460, L = 82, R = 40, alt = 30, gap = 10;
  const H = dados.length * (alt + gap) + 6;
  const max = Math.max(1, ...dados.map(d => d.valor));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Formas de pagamento">
      {dados.map((d, i) => {
        const y = 4 + i * (alt + gap), w = Math.max(2, (d.valor / max) * (W - L - R));
        return (
          <g key={d.rotulo}>
            <text x={L - 10} y={y + alt / 2 + 4} textAnchor="end">{d.rotulo}</text>
            <rect x={L} y={y} width={w} height={alt} rx="5" style={{ fill: d.cor }}><title>{d.rotulo}: {d.valor} vendas</title></rect>
            <text x={L + w + 6} y={y + alt / 2 + 4} className="rotulo-forte">{d.valor}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- senha do supervisor (RN-10): o banco guarda só o hash ---------- */
function SenhaSupervisor({ onSalvo, onCancelar }) {
  const [nova, setNova] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar() {
    if (nova.length < 4) { setErro('A senha precisa ter 4 ou mais caracteres.'); return; }
    if (nova !== repetir) { setErro('As duas senhas não são iguais.'); return; }
    setOcupado(true);
    const { error } = await supabase.rpc('definir_senha_supervisor', { p_senha: nova });
    setOcupado(false);
    if (error) { setErro(mensagemErro(error)); return; }
    onSalvo();
  }
  return (
    <Modal titulo="Senha do supervisor" erro={erro} ocupado={ocupado} onConfirmar={salvar} onCancelar={onCancelar}>
      <p className="muted pequeno">Vale na hora para todos os caixas. Não anote esta senha em nenhum arquivo do projeto.</p>
      <label htmlFor="s-nova">Nova senha</label>
      <input id="s-nova" className="field" type="password" autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} />
      <label htmlFor="s-repetir">Repita a nova senha</label>
      <input id="s-repetir" className="field" type="password" autoComplete="new-password" value={repetir} onChange={e => setRepetir(e.target.value)} />
    </Modal>
  );
}

/* Contas novas são criadas no painel do Supabase (o cadastro aberto fica desligado
   e a chave de administrador nunca vai para o navegador). Aqui o admin ativa e escolhe o perfil. */
function NovoUsuario({ onFechar }) {
  return (
    <Modal titulo="Novo usuário" onConfirmar={onFechar} textoConfirmar="Entendi" onCancelar={onFechar} textoCancelar="Fechar">
      <ol className="importar-passos">
        <li>No painel do Supabase, abra <b>Authentication › Users › Add user</b>.</li>
        <li>E-mail: <code>login@{DOMINIO_LOGIN}</code> (ex.: <code>joao.lima@{DOMINIO_LOGIN}</code>) e uma senha inicial.</li>
        <li>Volte aqui e tecle <b>Entendi</b>: o usuário aparece na lista como Operador e <b>Inativo</b>.</li>
        <li>Escolha o perfil e clique em <b>Ativar</b>. O login no sistema é a parte antes do @.</li>
      </ol>
    </Modal>
  );
}
