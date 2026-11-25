/* Testes das regras do caixa (camada 1 do plano de QA). Rodar: npm test */
import { describe, expect, it } from 'vitest';
import {
  separarQtd, buscarProdutos, escolherProduto, validarAdicao, situacaoPagamento,
  validarPagamento, montarVenda, deixariaSemAdmin, num, r2,
} from './regras.js';
import { lerCSV, validarImportacao, textoModeloCSV } from './csv.js';

const P = (codigo, nome, saldo, minimo, preco = 10, ativo = true) => ({ id: codigo, codigo, nome, saldo, minimo, preco, ativo });
const produtos = [
  P('7891025101106', 'Leite Integral 1L', 48, 24, 5.49),
  P('7891000100103', 'Arroz Tipo 1 5kg', 18, 10, 27.9),
  P('7890000000001', 'Produto inativo', 50, 1, 3, false),
];

describe('multiplicador * (RF-41, CX-10 a CX-14)', () => {
  it('5*leite lança 5 unidades', () => expect(separarQtd('5*leite')).toEqual({ qtd: 5, termo: 'leite' }));
  it('sem * é 1 unidade', () => expect(separarQtd('arroz')).toEqual({ qtd: 1, termo: 'arroz' }));
  it('0* e -3* chegam como quantidade inválida', () => {
    expect(validarAdicao(produtos[0], separarQtd('0*leite').qtd).ok).toBe(false);
    expect(validarAdicao(produtos[0], separarQtd('-3*leite').qtd).ok).toBe(false);
  });
  it('* sem número é recusado', () => expect(validarAdicao(produtos[0], separarQtd('*leite').qtd).ok).toBe(false));
  it('acima de 999 é recusado', () => expect(validarAdicao(P('1', 'x', 5000, 0), 1000).ok).toBe(false));
});

describe('busca (RF-05, CX-01 a CX-03)', () => {
  it('acha por parte do nome', () => expect(buscarProdutos(produtos, 'leite')[0].nome).toBe('Leite Integral 1L'));
  it('acha por começo do código', () => expect(buscarProdutos(produtos, '78910001').length).toBe(1));
  it('não mostra produto inativo', () => expect(buscarProdutos(produtos, 'inativo')).toEqual([]));
  it('código inexistente não escolhe nada', () => expect(escolherProduto(produtos, '7899999999999')).toBeNull());
});

describe('RN-02: estoque mínimo e zerado (CX-20 a CX-25)', () => {
  const B = P('2', 'B', 11, 10);   // mínimo + 1
  const C = P('3', 'C', 10, 10);   // igual ao mínimo
  const D = P('4', 'D', 1, 0);
  const E = P('5', 'E', 0, 0);
  it('CX-20: venda leva ao mínimo, permite com aviso', () => {
    const r = validarAdicao(B, 1);
    expect(r.ok).toBe(true);
    expect(r.aviso).toMatch(/estoque baixo/);
  });
  it('CX-21: já no mínimo, permite com aviso', () => expect(validarAdicao(C, 1).aviso).toBeTruthy());
  it('acima do mínimo, sem aviso', () => expect(validarAdicao(produtos[0], 1).aviso).toBeNull());
  it('CX-22: estoque zerado bloqueia', () => expect(validarAdicao(E, 1).ok).toBe(false));
  it('CX-23: 2* com 1 em estoque bloqueia', () => expect(validarAdicao(D, 2).ok).toBe(false));
  it('CX-24: carrinho já consome o estoque, bloqueia', () => expect(validarAdicao(D, 1, 1).ok).toBe(false));
});

describe('pagamento dividido (RF-09, CX-30 a CX-37)', () => {
  const itens = [{ codigo: '1', preco: 38.88, qtd: 1 }];
  it('CX-30: duas formas somando o total completam', () => {
    const st = situacaoPagamento(itens, [{ forma: 'dinheiro', valor: 20 }, { forma: 'pix', valor: 18.88 }]);
    expect(st.completo).toBe(true);
    expect(st.troco).toBe(0);
  });
  it('CX-31: valor menor mostra o que falta', () => {
    const st = situacaoPagamento(itens, [{ forma: 'pix', valor: 30 }]);
    expect(st.completo).toBe(false);
    expect(st.falta).toBe(8.88);
  });
  it('CX-32: dinheiro a mais gera troco', () => expect(situacaoPagamento(itens, [{ forma: 'dinheiro', valor: 50 }]).troco).toBe(11.12));
  it('CX-33: PIX acima do que falta é recusado', () => expect(validarPagamento(itens, [], 'pix', 50).ok).toBe(false));
  it('CX-35: três partes com centavos fecham ao centavo', () => {
    const t = [{ codigo: '1', preco: 10, qtd: 1 }];
    const st = situacaoPagamento(t, [{ forma: 'pix', valor: 3.33 }, { forma: 'debito', valor: 3.33 }, { forma: 'credito', valor: 3.34 }]);
    expect(st.completo).toBe(true);
    expect(st.troco).toBe(0);
  });
  it('CX-37: zero e negativo são recusados', () => {
    expect(validarPagamento(itens, [], 'dinheiro', 0).ok).toBe(false);
    expect(validarPagamento(itens, [], 'dinheiro', -10).ok).toBe(false);
    expect(num('abc')).toBe(0);
  });
  it('soma 0,1 + 0,2 sem erro de ponto flutuante', () => expect(r2(0.1 + 0.2)).toBe(0.3));
});

describe('venda enviada ao banco (registrar_venda)', () => {
  it('leva o id do caixa e o mesmo formato do 03_funcoes.sql', () => {
    const v = montarVenda({
      id: 'abc', caixaId: 'cx', numeroLocal: 3, feitaEm: new Date('2026-11-25T10:00:00Z'),
      itens: [{ codigo: '7891025101106', nome: 'Leite', preco: 5.49, qtd: 2 }],
      pagamentos: [{ forma: 'pix', valor: 10.98 }],
    });
    expect(v).toEqual({
      id: 'abc', numero_local: 3, caixa_id: 'cx', feita_em: '2026-11-25T10:00:00.000Z',
      itens: [{ codigo: '7891025101106', qtd: 2, preco: 5.49 }],
      pagamentos: [{ forma: 'pix', valor: 10.98 }],
    });
  });
});

describe('último administrador ativo (SEG-01, SEG-02, SEG-06)', () => {
  const um = [{ id: 'a', perfil: 'admin', ativo: true }, { id: 'b', perfil: 'operador', ativo: true }];
  const dois = [...um, { id: 'c', perfil: 'admin', ativo: true }];
  it('desativar o único admin é barrado', () => expect(deixariaSemAdmin(um, 'a', { ativo: false })).toBe(true));
  it('rebaixar o único admin é barrado', () => expect(deixariaSemAdmin(um, 'a', { perfil: 'operador' })).toBe(true));
  it('com dois admins, desativar um é permitido', () => expect(deixariaSemAdmin(dois, 'a', { ativo: false })).toBe(false));
});

describe('importação CSV (RF-40, EST-07 a EST-09)', () => {
  it('o modelo é lido sem erros', () => {
    const linhas = validarImportacao(lerCSV(textoModeloCSV()), new Set());
    expect(linhas.length).toBe(3);
    expect(linhas.every(l => !l.erros.length)).toBe(true);
  });
  it('EST-08: aponta cada erro por linha', () => {
    const csv = 'codigo;nome;preco\n7891025101106;Leite;5,49\n123;Curto;1\n7890000000099;;abc';
    const [dup, curto, vazio] = validarImportacao(lerCSV(csv), new Set(['7891025101106']));
    expect(dup.erros).toContain('código já cadastrado');
    expect(curto.erros).toContain('código deve ter de 8 a 14 números');
    expect(vazio.erros).toEqual(expect.arrayContaining(['nome vazio', 'preço vazio ou inválido']));
  });
  it('EST-09: cabeçalho errado é recusado', () => expect(() => lerCSV('a;b\n1;2')).toThrow(/Cabeçalho/));
});
