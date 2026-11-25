/* Conexão com o Supabase. Só a URL e a chave pública (anon/publishable)
   chegam ao navegador; quem protege os dados é o RLS (02_seguranca.sql). */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configurado = Boolean(url && chave);
export const supabase = configurado ? createClient(url, chave) : null;

/* O login do sistema é a parte do e-mail antes do @ (02_seguranca.sql) */
export const DOMINIO_LOGIN = 'pdvdebolso.local';
export const emailDoLogin = login => (login.includes('@') ? login : `${login}@${DOMINIO_LOGIN}`);

/* Mensagem para mostrar ao usuário. As exceções do banco já vêm em português. */
export function mensagemErro(erro) {
  if (!erro) return '';
  const msg = erro.message || String(erro);
  if (/failed to fetch|networkerror|fetch failed|load failed/i.test(msg)) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  if (erro.code === '23505') return 'Já existe um registro com esse código.';
  if (erro.code === '42501' || /row-level security/i.test(msg)) return 'Seu perfil não tem permissão para isso.';
  return msg;
}
