# 07 - Testes

Casos de teste e evidências do PDV de Bolso.

## Resultados

| Teste | Resultado | Onde está |
| --- | --- | --- |
| Bateria automatizada (Playwright) no protótipo, 146 verificações | **146/146 aprovadas** (25/11/2026) | `RELATORIO-QA-25-11.md` e `automacao/qa.py` |
| Banco no Supabase (T-DB-01 a T-DB-19) | **19/19 aprovados** | `05 - Desenvolvimento/supabase/` |
| Matriz de casos de teste (T-CX, T-ES, T-AD, T-OFF) | 52 casos cadastrados | Notion, base Testes |
| Teste manual da versão React (Vercel) | Em andamento | Notion |

## Defeito encontrado

A tecla Delete dentro da busca ou do campo de pagamento do Caixa abria a senha do supervisor (RF-39) em vez de apagar texto. Corrigido no protótipo e no React (PR #4). Detalhes no relatório.

## Como rodar a bateria

```
pip install playwright && playwright install chromium
cd "02 - mockup/prototipo" && python -m http.server 8765
python "07 - Testes/automacao/qa.py" http://localhost:8765/index.html
```

O script parte de um navegador limpo e usa os dados de exemplo do protótipo. O teste de hardware (leitor de código de barras e uso na bodega) é feito à parte, pela equipe.
