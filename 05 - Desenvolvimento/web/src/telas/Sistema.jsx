/* Estrutura das telas: menu lateral, barra do topo e rodapé de atalhos.
   As telas ficam montadas e só são escondidas, para a venda em andamento
   não se perder ao trocar de tela (Alt+1/2/3). */
import { useRef, useState } from 'react';
import { Kbd, janelaAberta, useTeclado, useToast } from '../componentes/ui.jsx';
import { PERFIS } from '../lib/regras.js';
import { useOnline, useProdutos } from '../lib/hooks.js';
import { supabase } from '../lib/supabase.js';
import Caixa from './Caixa.jsx';
import Estoque from './Estoque.jsx';
import Admin from './Admin.jsx';

const TITULOS = {
  caixa:   ['Caixa', 'Venda rápida pelo teclado'],
  estoque: ['Estoque', 'Produtos, entradas, alertas e localização'],
  admin:   ['Administração', 'Vendas, gráficos, usuários e auditoria'],
};
const ORDEM = ['caixa', 'estoque', 'admin'];
const NOMES = { caixa: 'Caixa', estoque: 'Estoque', admin: 'Administração' };

const ATALHOS = {
  caixa: [['F2', 'buscar'], ['Enter', 'adicionar'], ['5*', 'lançar 5 un.'], ['↑ ↓', 'selecionar item'], ['F4', 'alterar qtd*'],
    ['Del', 'remover item*'], ['F8', 'pagamento'], ['← →', 'forma'], ['F10', 'finalizar'], ['Esc', 'cancelar venda*'],
    ['F9', 'fechar caixa'], ['Alt+1/2/3', 'trocar tela'], ['Alt+T', 'tema'], ['*', 'pede senha do supervisor']],
  estoque: [['F2', 'buscar'], ['F4', 'entrada'], ['F6', 'novo produto'], ['F7', 'importar planilha'], ['Alt+1/2/3', 'trocar tela'], ['Alt+T', 'tema']],
  admin: [['Alt+1/2/3', 'trocar tela'], ['Alt+T', 'tema']],
};

export default function Sistema({ sessao, tema, onTema }) {
  const toast = useToast();
  const telas = PERFIS[sessao.perfil].telas;
  const [tela, setTela] = useState(telas[0]);
  const online = useOnline();
  const estoque = useProdutos();
  const vendaAberta = useRef(false);

  function irPara(t) {
    if (!telas.includes(t)) { toast('Seu perfil não tem acesso a esta tela.'); return; }   // RF-02, LOG-08
    setTela(t);
  }

  async function sair() {
    if (vendaAberta.current) { toast('Finalize ou cancele a venda atual antes de sair.'); return; }
    await supabase.auth.signOut();
  }

  useTeclado(e => {
    if (janelaAberta()) return;
    if (e.altKey && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      e.preventDefault();
      irPara(ORDEM[+e.code.slice(-1) - 1]);
    }
  });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand"><span className="brand-dot"></span>PDV de Bolso</div>
        </div>
        <nav className="nav">
          {ORDEM.filter(t => telas.includes(t)).map(t => (
            <button key={t} type="button" aria-current={t === tela ? 'page' : undefined} onClick={() => irPara(t)}>
              {NOMES[t]} <Kbd>Alt+{ORDEM.indexOf(t) + 1}</Kbd>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{sessao.nome}</div>
          <div className="sidebar-user-role">{PERFIS[sessao.perfil].nome} · {sessao.login}</div>
          <button type="button" className="btn btn-ghost btn-sm sidebar-sair" onClick={sair}>Sair / trocar operador</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{TITULOS[tela][0]}</h1>
            <p className="muted">{TITULOS[tela][1]}</p>
          </div>
          <div className="topbar-actions">
            <span className={'status' + (online ? '' : ' offline')} title="Situação da conexão com o servidor">
              <span className="led"></span>{online ? 'Online' : 'Sem internet'}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onTema} title="Alternar tema (RF-38)">
              {tema === 'dark' ? '☀' : '☾'} <Kbd>Alt+T</Kbd>
            </button>
          </div>
        </header>

        {!online && (
          <div className="aviso-rede" role="alert">
            Sem internet: vendas e cadastros ficam bloqueados até a conexão voltar. A venda na tela não se perde.
          </div>
        )}
        {estoque.erro && <div className="aviso-rede" role="alert">Não foi possível carregar os produtos: {estoque.erro}</div>}

        <main className="content">
          {telas.includes('caixa') && (
            <Caixa sessao={sessao} ativa={tela === 'caixa'} online={online}
              produtos={estoque.produtos} recarregarProdutos={estoque.carregar} vendaAberta={vendaAberta} />
          )}
          {telas.includes('estoque') && (
            <Estoque sessao={sessao} ativa={tela === 'estoque'} online={online}
              produtos={estoque.produtos} recarregarProdutos={estoque.carregar} />
          )}
          {telas.includes('admin') && (
            <Admin sessao={sessao} ativa={tela === 'admin'} online={online} produtos={estoque.produtos} />
          )}
        </main>

        <footer className="atalhos">
          {ATALHOS[tela].map(([k, t]) => <span key={k + t}><Kbd>{k}</Kbd> {t}</span>)}
        </footer>
      </div>
    </div>
  );
}
