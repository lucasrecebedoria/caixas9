
# MoveBuss - Lançamento de Caixas

Site pronto para hospedagem no GitHub Pages. Autenticação por matrícula (e-mail sintético matricula@movebuss.app). 
Após o cadastro, o usuário é redirecionado ao login. Coleções `usuarios`, `caixas` e `relatorios` são geradas automaticamente na primeira inserção.

## Páginas
- `login.html` – login por matrícula e senha
- `register.html` – cadastro (matrícula, nome, senha). Admins automáticos: 4144, 70029, 6266
- `app.html` – abertura/fechamento de caixa, abastecimentos, sangria, relatórios
- `reports.html` – atalho para a tela de relatórios

## Recursos
- Abrir/Fechar caixa
- Registrar abastecimento (validador PRODATA/DIGICON, bordos, prefixo 55 + 3 dígitos, valor = bordos * 5, matrículas, data BR)
- Impressão automática de recibo (formato impressora térmica 80mm)
- Solicitação de sangria com aprovação em relatórios (somente admin)
- Relatórios diários agrupados, totals por dia/caixa, exportar CSV/PDF
- Badge verde (usuário) e dourada (admin) no topo
- Persistência de login até efetuar logout

## Deploy
Faça upload de todos os arquivos em um repositório GitHub e ative o GitHub Pages (branch `main`, pasta root).
