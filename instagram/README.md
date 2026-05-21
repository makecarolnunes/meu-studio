# Instagram — Análise Semanal Automática

Pasta com a infraestrutura da routine semanal de análise do Instagram.

## Como funciona

Toda **segunda-feira às 7h (Brasília)** uma routine remota roda automaticamente e:

1. Puxa dados da conta @makecarolnunes via Instagram Graph API (perfil, bio, últimos 20 posts, likes, comentários, alcance)
2. Lê os dados dos concorrentes que você preencheu manualmente em `concorrentes.md`
3. Analisa tudo e gera um relatório completo em `relatorios/instagram-analise-YYYY-MM-DD.md`
4. Faz commit e push automaticamente (você vê aqui no GitHub)

## O que você precisa fazer toda semana

Antes de domingo à noite, abra o arquivo [`concorrentes.md`](concorrentes.md) e preencha os dados dos últimos posts dos perfis monitorados. Se não preencher, o relatório roda normalmente mas sem a análise comparativa.

## Concorrentes monitorados

- @makecomgaby
- @juliatorresmakeup
- @cinthiaprado
- @nathmatosmakeup
- @carolzimmaromakeup
- @thaisbenites
- @anasamakeup

Pode adicionar/remover editando o arquivo `concorrentes.md` E avisando o Claude para atualizar o prompt da routine.

## Token de acesso

O token do Instagram Graph API está armazenado dentro do prompt da routine (privado, só você acessa em https://claude.ai/code/routines).

**O token expira a cada ~60 dias.** Quando expirar:
1. Gere um novo token no Facebook Developer
2. Atualize o prompt da routine substituindo o valor de `ACCESS_TOKEN`

## Relatórios

Todos os relatórios ficam em [`relatorios/`](relatorios/), nomeados como `instagram-analise-AAAA-MM-DD.md`.
