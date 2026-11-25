/* Login por usuário e senha (RF-01). O usuário vira o e-mail interno
   usuario@pdvdebolso.local no Supabase Auth, que guarda a senha com hash (RNF-06). */
import { useState } from 'react';
import { Kbd } from '../componentes/ui.jsx';
import { emailDoLogin, mensagemErro, supabase } from '../lib/supabase.js';

export default function Login({ erroExterno, limparErroExterno, onTema }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    limparErroExterno();
    const usuario = login.trim().toLowerCase();
    if (!usuario || !senha) { setErro('Informe o usuário e a senha.'); return; }
    if (!navigator.onLine) { setErro('Sem internet. Conecte o computador para entrar.'); return; }
    setOcupado(true);
    setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email: emailDoLogin(usuario), password: senha });
    setOcupado(false);
    if (error) {
      setSenha('');
      // mesma mensagem para usuário inexistente e senha errada (LOG-02, LOG-03)
      setErro(/invalid/i.test(error.message) ? 'Usuário ou senha incorretos.' : mensagemErro(error));
    }
  }

  const mensagem = erro || erroExterno;

  return (
    <section className="login-wrap">
      <form className="card login" autoComplete="off" onSubmit={entrar}>
        <div className="brand brand-lg"><span className="brand-dot"></span>PDV de Bolso</div>
        <p className="muted">Entre com seu usuário para abrir as telas do seu perfil.</p>

        <label htmlFor="login-usuario">Usuário</label>
        <input id="login-usuario" className="field" autoFocus placeholder="ex.: ana.souza"
          value={login} onChange={e => setLogin(e.target.value)} />

        <label htmlFor="login-senha">Senha</label>
        <input id="login-senha" className="field" type="password"
          value={senha} onChange={e => setSenha(e.target.value)} />

        {mensagem && <p className="erro" role="alert">{mensagem}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={ocupado}>
          {ocupado ? 'Entrando…' : 'Entrar'} <Kbd>Enter</Kbd>
        </button>

        <div className="login-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onTema}>Tema <Kbd>Alt+T</Kbd></button>
        </div>
      </form>
    </section>
  );
}
