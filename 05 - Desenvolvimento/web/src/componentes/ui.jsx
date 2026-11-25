/* Peças de tela usadas em todo o sistema: tecla, aviso (toast) e janela (modal). */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const Kbd = ({ children }) => <span className="kbd">{children}</span>;

/* ---------- aviso rápido (toast) ---------- */
const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const toast = useCallback((texto, ms = 2200) => {
    setMsg(texto);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast" role="status" aria-live="polite" hidden={!msg}>{msg}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- bloqueio dos atalhos enquanto uma janela está aberta ---------- */
let janelasAbertas = 0;
export const janelaAberta = () => janelasAbertas > 0;
export function useBloqueioAtalhos() {
  useEffect(() => {
    janelasAbertas++;
    return () => { janelasAbertas--; };
  }, []);
}

/* Registra um tratador de teclado que sempre enxerga o estado mais novo da tela */
export function useTeclado(tratador) {
  const ref = useRef(tratador);
  ref.current = tratador;
  useEffect(() => {
    const f = e => ref.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
}

/* ---------- janela (modal) ----------
   Enter confirma (é um formulário), Esc cancela. */
export function Modal({
  titulo, children, erro, largo = false, ocupado = false,
  onConfirmar, textoConfirmar = 'Confirmar', onCancelar, textoCancelar = 'Cancelar',
}) {
  useBloqueioAtalhos();
  const ref = useRef();

  useEffect(() => {
    const el = ref.current?.querySelector('input:not([type=file]):not([readonly]), select, textarea')
      || ref.current?.querySelector('button[type=submit]');
    el?.focus();
    if (el?.select) el.select();
  }, []);

  useTeclado(e => {
    if (e.key === 'Escape' && onCancelar) { e.preventDefault(); onCancelar(); }
  });

  function aoTeclar(e) {     // Enter num <select> também confirma
    if (e.key === 'Enter' && e.target.tagName === 'SELECT') { e.preventDefault(); ref.current.requestSubmit(); }
  }

  return (
    <div className="overlay">
      <form
        ref={ref}
        className={'modal card' + (largo ? ' modal-largo' : '')}
        role="dialog" aria-modal="true" aria-label={titulo}
        onKeyDown={aoTeclar}
        onSubmit={e => { e.preventDefault(); if (!ocupado && onConfirmar) onConfirmar(); }}
      >
        <h2>{titulo}</h2>
        {children}
        {erro && <p className="erro">{erro}</p>}
        <div className="modal-acoes">
          {onCancelar && (
            <button type="button" className="btn btn-ghost" onClick={onCancelar}>{textoCancelar} <Kbd>Esc</Kbd></button>
          )}
          {onConfirmar && (
            <button type="submit" className="btn btn-primary" disabled={ocupado}>
              {ocupado ? 'Aguarde…' : textoConfirmar} <Kbd>Enter</Kbd>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
