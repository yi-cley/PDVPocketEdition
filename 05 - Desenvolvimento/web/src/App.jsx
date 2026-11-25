/* =========================================================
   PDV de Bolso · React + Vite + Supabase (FUT-03)
   Sessão, tema e escolha entre o login e o sistema.
   ========================================================= */
import { useCallback, useEffect, useState } from 'react';
import { ToastProvider, useTeclado, useToast } from './componentes/ui.jsx';
import Login from './telas/Login.jsx';
import Sistema from './telas/Sistema.jsx';
import { configurado, mensagemErro, supabase } from './lib/supabase.js';

export default function App() {
  return <ToastProvider><Raiz /></ToastProvider>;
}

function lerTema() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function Raiz() {
  const toast = useToast();
  const [tema, setTema] = useState(lerTema);
  const [sessao, setSessao] = useState(undefined);      // undefined = carregando; null = sem login
  const [erroLogin, setErroLogin] = useState('');

  /* tema claro/escuro (RF-38), salvo no aparelho */
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try { localStorage.setItem('pdv-tema', tema); } catch { /* sem localStorage: vale só nesta visita */ }
  }, [tema]);
  const alternarTema = useCallback(() => {
    setTema(t => {
      const novo = t === 'dark' ? 'light' : 'dark';
      toast(novo === 'dark' ? 'Tema escuro' : 'Tema claro', 1200);
      return novo;
    });
  }, [toast]);
  useTeclado(e => {
    if (e.altKey && (e.code === 'KeyT' || e.key.toLowerCase() === 't')) { e.preventDefault(); alternarTema(); }
  });

  /* sessão do Supabase Auth + perfil do usuário (tabela perfis) */
  useEffect(() => {
    if (!configurado) return undefined;
    let vivo = true;

    async function carregarPerfil(user) {
      if (!user) { if (vivo) setSessao(null); return; }
      const { data, error } = await supabase.from('perfis')
        .select('id, nome, login, perfil, ativo').eq('id', user.id).maybeSingle();
      if (!vivo) return;
      if (error || !data || !data.ativo) {
        // LOG-04: usuário desativado (ou ainda não ativado pelo admin) não entra
        setErroLogin(error ? mensagemErro(error)
          : 'Este usuário está desativado ou ainda não foi ativado. Procure o administrador.');
        await supabase.auth.signOut();
        setSessao(null);
        return;
      }
      setErroLogin('');
      setSessao(data);
    }

    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'SIGNED_OUT') { setSessao(null); return; }
      if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') {
        // fora do callback, como a documentação do supabase-js recomenda
        setTimeout(() => carregarPerfil(s?.user), 0);
      }
    });
    return () => { vivo = false; data.subscription.unsubscribe(); };
  }, []);

  if (!configurado) {
    return (
      <section className="login-wrap">
        <div className="card login">
          <div className="brand brand-lg"><span className="brand-dot"></span>PDV de Bolso</div>
          <p className="erro">Faltam as chaves do Supabase.</p>
          <p className="muted pequeno">
            Copie <code>05 - Desenvolvimento/.env.example</code> para <code>web/.env.local</code> e
            preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>. Na Vercel,
            cadastre as duas em Settings › Environment Variables.
          </p>
        </div>
      </section>
    );
  }

  if (sessao === undefined) return <section className="login-wrap"><p className="muted">Carregando…</p></section>;

  if (!sessao) {
    return <Login erroExterno={erroLogin} limparErroExterno={() => setErroLogin('')} onTema={alternarTema} />;
  }

  return <Sistema sessao={sessao} tema={tema} onTema={alternarTema} />;
}
