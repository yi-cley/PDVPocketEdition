/* =========================================================
   PDV de Bolso — Protótipo v0.1
   Dados de exemplo e armazenamento local.

   No sistema real, o banco local será o IndexedDB (Dexie.js)
   e o servidor será a API Express + PostgreSQL.
   Aqui, tudo fica no localStorage deste navegador.
   ========================================================= */

const CHAVE_DADOS = 'pdv-bolso-prototipo-v2';   // v2: dados do mockup de UX e pagamento dividido
const CHAVE_TEMA = 'pdv-bolso-tema';

/* Gera um identificador único no próprio aparelho (RN-09). */
function gerarUUID() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* "Hash" de demonstração — no sistema real a senha usa bcrypt/argon2 (RNF-06). */
function hashSenha(senha) {
  let h = 5381;
  for (const ch of String(senha)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return 'demo$' + h.toString(16);
}

/* Produtos de exemplo, os mesmos do mockup de UX (decisão da equipe em 24/11/2026).
   O código é o código de barras numérico (EAN, 8 a 14 dígitos), como o leitor USB lê. */
function produtosIniciais() {
  const P = (codigo, nome, categoria, preco, qtd, minimo, local) => ({ codigo, nome, categoria, preco, qtd, minimo, local, ativo: true });
  return [
    P('7891000100103', 'Arroz Tipo 1 5kg',          'Mercearia',  27.90, 18, 10, 'A1'),
    P('7896005800012', 'Feijão Carioca 1kg',        'Mercearia',   8.49, 24, 12, 'A2'),
    P('7891910000197', 'Açúcar Refinado 1kg',       'Mercearia',   4.99,  9, 10, 'A3'),
    P('7896036090245', 'Óleo de Soja 900ml',        'Mercearia',   7.29, 30, 12, 'A4'),
    P('7891000053508', 'Café Torrado e Moído 500g', 'Mercearia',  18.90,  4,  6, 'B1'),
    P('7891025101106', 'Leite Integral 1L',         'Laticínios',  5.49, 48, 24, 'B2'),
    P('7891097000123', 'Manteiga com Sal 200g',     'Laticínios', 11.90,  7,  5, 'B3'),
    P('7896004006156', 'Pão de Forma 500g',         'Padaria',     9.99,  0,  6, 'B4'),
    P('7896004006200', 'Ovos Brancos 12un',         'Padaria',    12.49, 14,  6, 'C1'),
    P('7894900011517', 'Refrigerante Cola 2L',      'Bebidas',    10.99, 36, 12, 'C2'),
    P('7894900530018', 'Água Mineral 500ml',        'Bebidas',     2.50, 60, 24, 'C3'),
    P('7896045104482', 'Cerveja Lata 350ml',        'Bebidas',     4.29, 96, 48, 'C4'),
    P('7891024134702', 'Sabão em Pó 1kg',           'Limpeza',    14.90, 12,  6, 'D1'),
    P('7891024132906', 'Detergente 500ml',          'Limpeza',     2.79,  5, 10, 'D2'),
    P('7896098900208', 'Papel Higiênico 12un',      'Higiene',    21.90, 15,  8, 'D3'),
    P('7891150037876', 'Creme Dental 90g',          'Higiene',     4.49, 22, 10, 'D4'),
  ];
}

function usuariosIniciais() {
  const U = (nome, perfil, ativo = true) => ({ id: gerarUUID(), nome, perfil, senha: hashSenha('1234'), ativo });
  return [
    U('Ana Souza',   'operador'),
    U('João Lima',   'operador'),
    U('Carlos Melo', 'estoque'),
    U('Marta Alves', 'admin'),
    U('Pedro Rocha', 'operador', false),
  ];
}

/* Histórico de vendas dos últimos 6 dias, para os gráficos terem conteúdo. */
function vendasIniciais(produtos) {
  const vendas = [];
  const formas = ['PIX', 'Dinheiro', 'PIX', 'Débito', 'Crédito', 'PIX', 'Dinheiro'];
  const operadores = ['Ana Souza', 'João Lima', 'Marta Alves'];
  let semente = 7;
  const aleatorio = () => (semente = (semente * 9301 + 49297) % 233280) / 233280;
  const vendaveis = produtos.filter(p => p.qtd > 0);

  for (let dia = 6; dia >= 1; dia--) {
    const qtdVendas = 4 + Math.floor(aleatorio() * 5);
    for (let v = 0; v < qtdVendas; v++) {
      const data = new Date();
      data.setDate(data.getDate() - dia);
      data.setHours(8 + Math.floor(aleatorio() * 10), Math.floor(aleatorio() * 60), 0, 0);
      const itens = [];
      const nItens = 1 + Math.floor(aleatorio() * 3);
      for (let i = 0; i < nItens; i++) {
        const p = vendaveis[Math.floor(aleatorio() * vendaveis.length)];
        if (itens.some(it => it.codigo === p.codigo)) continue;
        itens.push({ codigo: p.codigo, nome: p.nome, preco: p.preco, qtd: 1 + Math.floor(aleatorio() * 3) });
      }
      const total = Math.round(itens.reduce((s, it) => s + it.preco * it.qtd, 0) * 100) / 100;
      const forma = formas[Math.floor(aleatorio() * formas.length)];
      vendas.push({
        id: gerarUUID(),
        numero: vendas.length + 1,
        data: data.toISOString(),
        operador: operadores[Math.floor(aleatorio() * operadores.length)],
        itens,
        total,
        pagamento: forma,
        pagamentos: [{ forma, valor: total }],                    // RF-09
        recebido: total,
        troco: 0,
        status: 'sincronizado',
      });
    }
  }
  return vendas;
}

function dadosIniciais() {
  const produtos = produtosIniciais();
  return {
    versao: 2,
    produtos,
    usuarios: usuariosIniciais(),
    vendas: vendasIniciais(produtos),
    movimentacoes: produtos.map(p => ({
      id: gerarUUID(), codigo: p.codigo, tipo: 'entrada', qtd: p.qtd,
      motivo: 'Estoque inicial', usuario: 'Carlos Melo', data: new Date(Date.now() - 7 * 864e5).toISOString(),
    })),
    autorizacoes: [],
    fila: [],
    logSync: [],
    caixa: null,
    ultimaSync: new Date().toISOString(),
    config: {
      senhaSupervisor: hashSenha('9999'),
    },
  };
}

function carregarDados() {
  try {
    const bruto = localStorage.getItem(CHAVE_DADOS);
    if (bruto) return JSON.parse(bruto);
  } catch (e) { /* navegador sem armazenamento: usa dados em memória */ }
  return dadosIniciais();
}

function salvarDados(dados) {
  try { localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados)); } catch (e) { /* ignora */ }
}

function carregarTema() {
  try { return localStorage.getItem(CHAVE_TEMA); } catch (e) { return null; }
}

function salvarTema(tema) {
  try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) { /* ignora */ }
}
