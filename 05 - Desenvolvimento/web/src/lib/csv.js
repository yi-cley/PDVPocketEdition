/* =========================================================
   Importação de produtos em lote por planilha CSV (RF-40)
   Mesmas regras do cadastro individual (RF-17) e do protótipo.
   ========================================================= */
import { CODIGO_VALIDO, num } from './regras.js';

export const COLUNAS_CSV = ['codigo', 'nome', 'categoria', 'preco', 'quantidade', 'minimo', 'local'];

const APELIDOS = {
  codigo: 'codigo', cod: 'codigo', nome: 'nome', produto: 'nome', descricao: 'nome',
  categoria: 'categoria', preco: 'preco', valor: 'preco', quantidade: 'quantidade', qtd: 'quantidade',
  estoque: 'quantidade', minimo: 'minimo', estoqueminimo: 'minimo', local: 'local', localizacao: 'local',
};

export function textoModeloCSV() {
  return [
    COLUNAS_CSV.join(';'),
    '7896022204051;Macarrão Espaguete 500g;Mercearia;4,99;30;10;A4',
    '7891000315507;Biscoito Recheado 130g;Mercearia;2,79;40;12;B3',
    '7891024035009;Desinfetante 2L;Limpeza;9,49;24;8;D1',
  ].join('\r\n');
}

const normalizar = txt => String(txt).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

export function dividirLinha(linha, sep) {
  const campos = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (ch === sep && !aspas) {
      campos.push(atual.trim());
      atual = '';
    } else atual += ch;
  }
  campos.push(atual.trim());
  return campos;
}

export function lerCSV(texto) {
  const linhas = String(texto).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) throw new Error('A planilha precisa do cabeçalho e de pelo menos 1 produto.');
  const sep = linhas[0].includes(';') ? ';' : ',';
  const cabecalho = dividirLinha(linhas[0], sep).map(c => APELIDOS[normalizar(c)] || null);
  if (!cabecalho.includes('codigo') || !cabecalho.includes('nome') || !cabecalho.includes('preco')) {
    throw new Error('Cabeçalho inválido. Use o modelo: ' + COLUNAS_CSV.join(';'));
  }
  return linhas.slice(1).map((linha, i) => {
    const valores = dividirLinha(linha, sep);
    const obj = { linha: i + 2 };
    cabecalho.forEach((col, k) => { if (col) obj[col] = valores[k] ?? ''; });
    return obj;
  });
}

/* codigosExistentes: Set com os códigos já cadastrados no banco */
export function validarImportacao(registros, codigosExistentes) {
  const vistos = new Set();
  return registros.map(r => {
    const erros = [];
    const codigo = String(r.codigo || '').replace(/\s/g, '');
    const nome = String(r.nome || '').trim();
    const precoTxt = String(r.preco || '').trim();
    const preco = num(precoTxt.replace(/^R\$\s*/i, ''));
    const qtdTxt = String(r.quantidade ?? '').trim();
    const qtd = qtdTxt === '' ? 0 : Number(qtdTxt.replace(',', '.'));
    const minTxt = String(r.minimo ?? '').trim();
    const minimo = minTxt === '' ? 0 : Number(minTxt.replace(',', '.'));

    if (!codigo) erros.push('código vazio');
    else if (!CODIGO_VALIDO.test(codigo)) erros.push('código deve ter de 8 a 14 números');
    else if (codigosExistentes.has(codigo)) erros.push('código já cadastrado');
    else if (vistos.has(codigo)) erros.push('código repetido na planilha');
    if (!nome) erros.push('nome vazio');
    if (!precoTxt || !(preco > 0)) erros.push('preço vazio ou inválido');
    if (!Number.isInteger(qtd) || qtd < 0) erros.push('quantidade negativa ou inválida');
    if (!Number.isInteger(minimo) || minimo < 0) erros.push('mínimo negativo ou inválido');
    if (codigo) vistos.add(codigo);

    return {
      linha: r.linha,
      erros,
      dados: {
        codigo, nome, preco, qtd, minimo,
        categoria: String(r.categoria || '').trim() || 'Geral',
        local: String(r.local || '').trim().toUpperCase() || null,
      },
    };
  });
}
