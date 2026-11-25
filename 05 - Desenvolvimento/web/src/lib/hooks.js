/* Dados compartilhados entre as telas */
import { useCallback, useEffect, useState } from 'react';
import { mensagemErro, supabase } from './supabase.js';

/* Situação da internet. Sem conexão, o app avisa e não grava nada (P-05). */
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/* Produtos com saldo (view produtos_saldo, RN-08). Recarrega sozinho quando
   outro caixa vende ou o estoque recebe mercadoria (Supabase Realtime, RF-35). */
export function useProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('produtos_saldo').select('*').order('nome');
    if (error) { setErro(mensagemErro(error)); return; }
    setErro('');
    setProdutos(data.map(p => ({ ...p, preco: Number(p.preco) })));
  }, []);

  useEffect(() => {
    carregar();
    let timer;
    const agendar = () => { clearTimeout(timer); timer = setTimeout(carregar, 300); };
    const canal = supabase
      .channel('estoque-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacoes' }, agendar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, agendar)
      .subscribe();
    window.addEventListener('online', carregar);
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(canal);
      window.removeEventListener('online', carregar);
    };
  }, [carregar]);

  return { produtos, erro, carregar };
}
