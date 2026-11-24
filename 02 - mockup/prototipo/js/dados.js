/* =========================================================
   PDV de Bolso — Protótipo v0.1
   Dados de exemplo e armazenamento local.

   No sistema real, o banco local será o IndexedDB (Dexie.js)
   e o servidor será a API Express + PostgreSQL.
   Aqui, tudo fica no localStorage deste navegador.
   ========================================================= */

const CHAVE_DADOS = 'pdv-bolso-prototipo-v1';
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

/* Produtos alinhados à matriz de testes (P001–P003) + itens extras. */
function produtosIniciais() {
  return [
    { codigo: 'P001', nome: 'Arroz Tipo 1 5 kg',     categoria: 'Mercearia',  preco: 25.90, qtd: 10, minimo: 3,  local: 'A1', ativo: true },
    { codigo: 'P002', nome: 'Feijão Carioca 1 kg',   categoria: 'Mercearia',  preco: 8.50,  qtd: 4,  minimo: 5,  local: 'A2', ativo: true },
    { codigo: 'P003', nome: 'Café Torrado 500 g',    categoria: 'Mercearia',  preco: 16.90, qtd: 0,  minimo: 2,  local: 'A3', ativo: true },
    { codigo: 'P010', nome: 'Refrigerante Cola 2 L', categoria: 'Bebidas',    preco: 9.90,  qtd: 30, minimo: 10, local: 'B1', ativo: true },
    { codigo: 'P011', nome: 'Água Mineral 500 ml',   categoria: 'Bebidas',    preco: 2.50,  qtd: 48, minimo: 12, local: 'B2', ativo: true },
    { codigo: 'P012', nome: 'Leite Integral 1 L',    categoria: 'Laticínios', preco: 5.79,  qtd: 18, minimo: 12, local: 'C1', ativo: true },
    { codigo: 'P013', nome: 'Pão de Forma 500 g',    categoria: 'Padaria',    preco: 7.99,  qtd: 11, minimo: 5,  local: 'C3', ativo: true },
    { codigo: 'P014', nome: 'Sabão em Pó 1 kg',      categoria: 'Limpeza',    preco: 13.50, qtd: 9,  minimo: 4,  local: 'D2', ativo: true },
    { codigo: 'P015', nome: 'Óleo de Soja 900 ml',   categoria: 'Mercearia',  preco: 7.49,  qtd: 14, minimo: 6,  local: 'A4', ativo: true },
  ];
}

function usuariosIniciais() {
  return [
    { id: gerarUUID(), nome: 'Ana',   perfil: 'admin',    senha: hashSenha('1234'), ativo: true },
    { id: gerarUUID(), nome: 'Bruno', perfil: 'operador', senha: hashSenha('1234'), ativo: true },
    { id: gerarUUID(), nome: 'Carla', perfil: 'estoque',  senha: hashSenha('1234'), ativo: true },
    { id: gerarUUID(), nome: 'Diego', perfil: 'operador', senha: hashSenha('1234'), ativo: false },
  ];
}

/* Histórico de vendas dos últimos 6 dias, para os gráficos terem conteúdo. */
function vendasIniciais(produtos) {
  const vendas = [];
  const formas = ['PIX', 'Dinheiro', 'PIX', 'Débito', 'Crédito', 'PIX', 'Dinheiro'];
  const operadores = ['Bruno', 'Ana'];
  let semente = 7;
  const aleatorio = () => (semente = (semente * 9301 + 49297) % 233280) / 233280;
  const vendaveis = produtos.filter(p => p.codigo !== 'P003');

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
      const total = itens.reduce((s, it) => s + it.preco * it.qtd, 0);
      vendas.push({
        id: gerarUUID(),
        numero: vendas.length + 1,
        data: data.toISOString(),
        operador: operadores[Math.floor(aleatorio() * operadores.length)],
        itens,
        total: Math.round(total * 100) / 100,
        pagamento: formas[Math.floor(aleatorio() * formas.length)],
        recebido: null,
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
    versao: 1,
    produtos,
    usuarios: usuariosIniciais(),
    vendas: vendasIniciais(produtos),
    movimentacoes: produtos.map(p => ({
      id: gerarUUID(), codigo: p.codigo, tipo: 'entrada', qtd: p.qtd,
      motivo: 'Estoque inicial', usuario: 'Ana', data: new Date(Date.now() - 7 * 864e5).toISOString(),
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
