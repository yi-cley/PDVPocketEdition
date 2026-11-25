/* Comprovante não fiscal (RF-13, RF-14, RF-26, RN-07). Enter ou Esc fecha. */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { brl, nomeForma, textoComprovante } from '../lib/regras.js';
import { Kbd, useBloqueioAtalhos, useTeclado } from './ui.jsx';

export default function Comprovante({ venda, onFechar }) {
  useBloqueioAtalhos();
  const botao = useRef();
  useEffect(() => { botao.current?.focus(); }, []);
  useTeclado(e => {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onFechar(); }
  });

  const whatsapp = () => window.open('https://wa.me/?text=' + encodeURIComponent(textoComprovante(venda)), '_blank', 'noopener');

  return createPortal(
    <div className="overlay" id="overlay-comprovante">
      <div className="comprovante" role="dialog" aria-modal="true" aria-label="Comprovante de venda">
        <h3>PDV DE BOLSO</h3>
        <div className="centro"><b>COMPROVANTE NÃO FISCAL</b></div>
        <hr />
        {venda.itens.map((it, i) => (
          <div key={i}>
            <div>{it.nome}</div>
            <div className="lin"><span>{it.qtd} x {brl(it.preco)}</span><span>{brl(it.qtd * it.preco)}</span></div>
          </div>
        ))}
        <hr />
        <div className="lin"><b>TOTAL</b><b>{brl(venda.total)}</b></div>
        {venda.pagamentos.map((p, i) => (
          <div className="lin" key={i}><span>{nomeForma(p.forma)}</span><span>{brl(p.valor)}</span></div>
        ))}
        {venda.troco > 0 && <div className="lin"><b>Troco</b><b>{brl(venda.troco)}</b></div>}
        <hr />
        <div>{new Date(venda.feita_em).toLocaleString('pt-BR')}</div>
        <div>Operador: {venda.operador} · Venda nº {venda.numero}</div>
        <div className="comprovante-acoes">
          <button type="button" className="btn btn-sm" onClick={whatsapp}>WhatsApp</button>
          <button type="button" className="btn btn-sm" onClick={() => window.print()}>Imprimir / PDF</button>
          <button type="button" className="btn btn-primary btn-sm" ref={botao} onClick={onFechar}>Fechar <Kbd>Enter</Kbd></button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
