# Análise Semanal Instagram — @makecarolnunes
**Semana:** 25–31 ago 2026 | **Gerado em:** 31/08/2026

---

## ⚠️ Avisos Importantes

> **DADOS DA API DO INSTAGRAM INDISPONÍVEIS** — O ambiente remoto onde esta routine roda bloqueia requisições ao `graph.instagram.com` via proxy (HTTP 403). Os dados de métricas reais (curtidas, alcance, impressões, insights por post) não puderam ser coletados. A análise de performance dos posts é impossível sem esses dados — as seções correspondentes estão marcadas como "dados indisponíveis".
>
> **Ação necessária:** Para corrigir isso, Carol (ou quem gerencia o ambiente) precisa verificar se o plano/configuração do Claude Code permite acesso à API do Meta/Instagram. O token em si pode ou não ter expirado (sem conexão, não é possível confirmar) — mas o token expira em ~60 dias a partir da criação. Se foi gerado antes de julho 2026, gerar novo token no Facebook Developer e atualizar a routine.

> **ANÁLISE COMPARATIVA DE CONCORRENTES PULADA** — O arquivo `instagram/concorrentes.md` está com o template vazio: nenhum dos 7 perfis monitorados tem dados preenchidos. Para análise comparativa na próxima semana, preencha ao menos 2–3 perfis com 2–3 posts cada antes de domingo à noite.

---

## 1. Performance dos Posts × Brand Brain

**Dados da API indisponíveis.** Não foi possível identificar Top 3 / Bottom 3 com métricas reais.

O que é possível analisar a partir do que o Brand Brain documenta como histórico conhecido:

### Posts com desempenho comprovado (registrados no Brand Brain)
| Post | Métricas conhecidas | Pilar | Persona | Arquétipo | Por que funciona |
|------|---------------------|-------|---------|-----------|-----------------|
| Pele preta afro editorial (Erykah Badu) | Melhor post do feed | II — Autoridade | Persona 2 (Noiva Preta) | Criadora | Editorial impecável, música autoral, sofisticação sem explicação — demonstra especialização sem declarar |
| Making of Dinaci (noiva madura) | Referência de engajamento emocional | I — Noivas Premium | Persona 1 (Noiva Premium) | Cuidadora | Emoção real + legenda narrativa profunda — a noiva não aparece — aparece o relacionamento |
| Carrossel Emily P Santos | 2.6k views | II — Autoridade | Persona 2 / 3 | Sábia | Formato carrossel captura salvamento; pele preta com técnica visível converte profissional curioso em seguidor |
| Série retratos profissionais Carol (brown shirt) | Âncora visual do feed | Ambos | Todas | Criadora + Cuidadora | Presença real de Carol — transmite segurança, não performance |
| Reel "O que ela me pediu X o que entreguei" | 1.1k views | I — Noivas | Persona 1 | Sábia | Conteúdo funciona; capa laranja sólida está destruindo o primeiro impacto (veja seção 3) |

### Padrão identificado (sem API, com Brand Brain)
Posts que performam bem têm três elementos em comum: **foto de qualidade técnica real**, **legenda com narrativa** (não produto + CTA), e **alinhamento visual claro com paleta quente**. Posts que ficam para baixo têm pelo menos um desses ausente.

---

## 2. Pilares Editoriais — Desvio do Ideal

Sem acesso à API, não é possível fazer a contagem exata por categoria dos últimos 20 posts. A análise abaixo cruza o que o Brand Brain documenta como situação atual com o ideal definido:

| Pilar | % Ideal | Status atual (estimado) | Gap |
|-------|---------|------------------------|-----|
| Noivas — Emoção | 25% | Presente, mas irregular | Sem ritmo semanal consistente |
| Pele Preta — Portfólio | 20% | Presente (ponto forte) | Qualidade alta mas frequência incerta |
| Cachos & Crespos | 15% | **Ausente como série** | Crítico: nem destaque existe |
| Técnica — Educacional | 15% | **Praticamente ausente** | Crítico: zero conteúdo técnico ativo |
| Carol — Presença | 10% | Série brown shirt (forte) | Ok, mas não mantido |
| Produtos & Bancada | 10% | Irregular | Flat lay de qualidade ausente |
| Social Beauty | 5% | Post de carnaval visível | Errado: estética contradiz marca |

**Desvios críticos:**
1. **Cachos & Crespos (15% do feed) está em zero.** É o terceiro pilar mais importante — não tem um único destaque, nem série. Para a Persona 3, o perfil não existe.
2. **Educacional (15%) está inativo.** Isso trava a construção de autoridade para a Persona 4 (futura aluna) e impede o caminho natural para o Curso VIP.
3. **Social Beauty com estética errada:** O post de carnaval (glitter colorido) está ocupando espaço de um pilar que deveria ser mínimo (5%) e ainda assim contradizendo a paleta inteira.

---

## 3. Alinhamento de Marca

### Posts off-brand identificados (com base no Brand Brain)

**1. Thumbnail laranja "O que ela me pediu × o que eu entreguei"**
- Problema: Fundo sólido laranja + texto bold centralizado. O Brand Brain é explícito: "fundo sólido colorido em capa de reel transmite conteúdo genérico de micro-influenciadora iniciante". Laranja não está na paleta.
- Ação: Trocar a capa para o frame mais bonito do resultado, com 1 linha serif no terço inferior. O reel fica; a capa vai.

**2. Post de carnaval com glitter colorido**
- Problema: Glitter de festival é o oposto da paleta terra/nude. Palavra proibida implícita: "transformação" de carnaval. Uma noiva premium que vê esse post sai do perfil.
- Ação: Arquivar imediatamente (não deletar).

**3. Bio atual**
> "Carol Nunes | Maquiadora RJ / Beleza natural e sofisticada para noivas e produções sociais / 📍 RJ | Agende pelo link abaixo"
- Problemas: "Produções sociais" é genérico; não menciona pele preta nem cachos; sem personalidade; não comunica nenhum dos dois pilares.
- Ver seção 5 para análise completa.

**4. Destaque "Pele Madu" (título truncado)**
- Problema: Clareza antes de elegância. Um destaque cujo nome ninguém entende no primeiro segundo não converte.
- Ação: Renomear para "Pele Preta" ou título por extenso.

**5. Ausência de destaque "Cachos & Crespos" e "Feedbacks"**
- Problema estrutural: O destaque de Feedbacks é o mais crítico para conversão de noivas. Sem ele, prova social depende de quem procura ativamente. Sem Cachos & Crespos, a Persona 3 simplesmente não se vê no perfil.

---

## 4. Horários e Dias de Pico

**Dados de insights indisponíveis** (API bloqueada).

Recomendação baseada em padrões de mercado + perfil da audiência documentada no Brand Brain:

- **Noivas Premium (Persona 1–2):** Profissional estabelecida, 28–38 anos. Pico de consumo de Instagram: **terça a quinta, 20h–22h** (após trabalho) e **sábado 10h–12h** (planejamento de casamento).
- **Profissional em formação (Persona 4):** **Domingo 14h–18h** (estudo) e **segunda 7h–9h** (semana começa com planejamento).
- **Reels técnicos:** Segunda ou terça — alta taxa de salvamento nos primeiros dias eleva o alcance orgânico do algoritmo.
- **Posts emocionais de noiva:** Quinta ou sexta — semana encaminhada, audiência mais receptiva a conteúdo emocional.

> Quando o acesso à API for restaurado: priorizar a geração de relatório com os dados reais de `insights?metric=reach&period=day` cruzados com os timestamps dos posts para confirmar esses padrões.

---

## 5. Análise da Bio

### Bio atual (problema)
```
Carol Nunes | Maquiadora RJ
Beleza natural e sofisticada para noivas e produções sociais
📍 RJ | Agende pelo link abaixo
```

**O que falta:** Os dois pilares centrais. "Produções sociais" é o que qualquer maquiadora faz — não diferencia. "Beleza natural e sofisticada" é genérico ao ponto de ser invisível. Não há menção a pele preta, cachos, ou qualquer elemento que faça a Persona 2 ou 3 se reconhecer ali.

### Versão proposta v1 (dois pilares — mais direta)
```
Carol Nunes · Maquiadora RJ
Beleza de noivas — do making of ao altar
Especialista em pele preta · cachos e crespos
📍 Tijuca · Atendo RJ · Cursos em breve
↓ Orçamentos e agenda
```

**Análise:** Comunica ambos os pilares explicitamente. "Do making of ao altar" diferencia de qualquer maquiadora de festa. "Especialista em pele preta · cachos e crespos" serve de filtro ativo — Persona 2 e 3 se reconhecem na segunda linha. "Cursos em breve" planta o Curso VIP sem anunciar. Funcional para conversão.

### Versão proposta v2 (emocional — mais filosófica)
```
Carol Nunes · Maquiadora
A beleza que faz você se reconhecer no espelho
Noivas · Pele preta · Cachos e crespos
📍 Rio de Janeiro
↓ Orçamentos e agenda
```

**Análise:** A frase central ("a beleza que faz você se reconhecer") é a essência da marca em uma linha — forte, diferenciada, usa linguagem da marca. Funciona melhor para quem já conhece Carol; conversão fria é menor porque não explicita o "making of ao altar".

### Recomendação
**Usar a v1 agora.** É mais funcional para conversão de orçamentos, que é o objetivo imediato. A v2 faz sentido quando o portfólio e a autoridade já comunicam por si só — quando alguém chega ao perfil e já entende o nível antes de ler a bio.

---

## 6. Análise Comparativa de Concorrentes

**Pulada — arquivo `instagram/concorrentes.md` não foi preenchido.**

Para análise comparativa na próxima semana: preencha os dados de ao menos 2–3 perfis (@makecomgaby, @juliatorresmakeup, @cinthiaprado são os mais relevantes para benchmark) com ao menos 1–2 posts cada, antes de domingo à noite.

O que esta análise buscaria cruzar com o Brand Brain:
- Quais formatos os concorrentes saturaram (o que Carol não precisa fazer)
- Gaps de posicionamento em pele preta / cachos (onde a especialização real da Carol é diferencial)
- Como esses perfis abordam o Curso VIP — o que Carol pode fazer diferente

---

## 7. 10 Pautas Estratégicas — Semana 01–07 set 2026

> Prioridade de execução: primeiro as pautas marcadas como **[URGENTE]**, depois em ordem numérica.

---

### Pauta 1 — **[URGENTE]** Trocar capa do reel "O que ela me pediu"
- **Formato:** Edição de reel existente (só a capa)
- **Pilar:** I — Noivas Premium
- **Persona:** 1 (Noiva Premium)
- **Arquétipo:** Criadora
- **Justificativa:** Reel com bom conteúdo (1.1k views) está sendo prejudicado por uma capa que contradiz todo o posicionamento visual. Custo: 2 minutos. Impacto: imediato em percepção de marca para qualquer novo visitante.
- **Estrutura:**
  - Escolher o frame mais limpo do resultado final da cliente
  - Adicionar 1 linha serif (Cormorant) no terço inferior: "ela pediu. eu ouvi."
  - Adicionar @makecarolnunes discreto no canto inferior
  - Publicar como nova capa (sem regravar o reel)

---

### Pauta 2 — **[URGENTE]** Atualizar bio para v1
- **Formato:** Edição de perfil
- **Pilar:** Ambos
- **Persona:** Todas
- **Arquétipo:** Sábia (clareza posicional)
- **Justificativa:** A bio atual não comunica nenhum dos dois pilares. Toda noiva preta ou cacheada que chega ao perfil e lê "produções sociais" não se identifica e vai embora. Custo: zero. Impacto: conversão imediata.
- **Estrutura:** Usar exatamente a v1 documentada no Brand Brain (seção 5 acima)

---

### Pauta 3 — Reel técnico: "Subtom frio ou quente em pele negra — como identificar antes de escolher a base"
- **Formato:** Reel 45–60s
- **Pilar:** II — Autoridade Técnica
- **Persona:** 3 (Profissional em Formação) + efeito halo na Persona 2 (Noiva Preta)
- **Arquétipo:** Sábia
- **Justificativa:** O pilar educacional (15% do feed) está praticamente inativo. Este tema tem alto potencial de salvamento (profissionais salvam conteúdo técnico), alcance orgânico elevado e serve de construção de autoridade pré-Curso VIP. "Subtom" é a palavra que separa especialista de generalista.
- **Estrutura:**
  - Capa: close extremo de mãos de Carol aplicando base em pele escura, luz lateral. Texto: "Subtom frio ou quente?" (serif, terço inferior)
  - 0–5s: gancho — "Esse é o erro mais comum com pele negra: escolher a base pelo número, não pelo subtom"
  - 5–20s: como identificar subtom quente vs frio em pele melanada (mostrar na pele real)
  - 20–35s: como a escolha errada aparece nas fotos (efeito cinza ou laranja)
  - 35–50s: produtos que Carol usa por subtom (Dior, NARS, MAC) — mostra a bancada
  - Frame final: "Pele melanada tem sua linguagem. Eu aprendi a ouvi-la."

---

### Pauta 4 — Carrossel educacional: "5 produtos que nunca saem do meu kit para pele preta"
- **Formato:** Carrossel 6–7 slides
- **Pilar:** II — Autoridade Técnica
- **Persona:** 4 (Profissional em Formação) + Persona 2 (Noiva Preta que quer saber o que vai ser usado nela)
- **Arquétipo:** Sábia + Criadora
- **Justificativa:** Carrossel é o formato de maior salvamento no Instagram. Produtos são conteúdo de autoridade que não envelhecem rapidamente. Noiva que vê produtos Dior, NARS, Lancôme tem percepção de valor premium reforçada. Servem dois públicos com o mesmo conteúdo.
- **Estrutura:**
  - Slide 1 (capa): foto de bancada organizada + título "5 produtos que nunca saem do meu kit para pele preta" em serif sobre fundo café
  - Slides 2–6: um produto por slide. Fundo off-white, título do produto em café escuro, por que foi escolhido para pele melanada (subtom, acabamento, durabilidade), foto do produto em uso
  - Slide 7: fundo café escuro, texto nude — "Cada produto tem um porquê. Essa é a parte que eu ensino. @makecarolnunes"
  - Legenda: contar por que cada escolha é técnica, não estética

---

### Pauta 5 — Reel de making of de noiva com narração em legenda
- **Formato:** Reel 30–45s
- **Pilar:** I — Noivas Premium
- **Persona:** 1 (Noiva Premium)
- **Arquétipo:** Cuidadora
- **Justificativa:** O pilar Noivas deve ter 1 post/semana. Making of com narração é o formato que converte — noiva que assiste imagina o próprio dia. É o produto diferenciado de Carol: não é só a maquiagem, é a presença de 6–8h.
- **Estrutura (briefing do Brand Brain):**
  - 0–3s: bancada com produtos. Luz quente. Sem texto. Música instrumental suave
  - 3–10s: close das mãos de Carol preparando. Câmera lenta. Texto: nome da noiva (não da Carol)
  - 10–25s: noiva no espelho → detalhe do olho → Carol aplicando → satisfação
  - 25–35s: resultado. A frase mais bonita da legenda aparece gradualmente no frame
  - 35–45s: making of — noiva saindo, sorrindo, família ao fundo
  - Frame final: @makecarolnunes. "Beleza que faz você se reconhecer."
  - Legenda: narrativa com o contexto emocional real — quem é a noiva, o que ela sentia, o que aconteceu no making of

---

### Pauta 6 — Primeiro reel de Cachos & Crespos: coque com cachos naturais
- **Formato:** Reel 30–45s
- **Pilar:** II — Autoridade Técnica (cachos como especialização)
- **Persona:** 3 (Mulher Cacheada/Crespa)
- **Arquétipo:** Criadora + Sábia
- **Justificativa:** Este pilar está em zero no feed atual. A Persona 3 não se vê no perfil de Carol. Um único reel de cachos bem feito abre esse público — e cachos + casamento é uma lacuna real no mercado (concorrentes tendem a alisar). O Brand Brain é claro: "cachos valorizados como são".
- **Estrutura:**
  - Capa: perfil com cachos estilizados em coque alto, luz dourada lateral. Texto: "Coque com cachos. Sem alisar nenhum fio." (serif)
  - Mostrar o processo de penteado em textura natural (antes → construção → resultado)
  - Narrar em legenda: por que Carol não alisa, o que a textura natural permite que o alisado nunca entrega
  - Finalizar com: "Sua textura não é um problema a resolver. É o que vou valorizar."

---

### Pauta 7 — Story série: "Perguntas que toda noiva me manda antes de contratar"
- **Formato:** Story série (5–6 frames) + salvar em destaque "FAQ"
- **Pilar:** I — Noivas Premium
- **Persona:** 1 e 2 (Noivas)
- **Arquétipo:** Cuidadora + Sábia
- **Justificativa:** Destaque de FAQ é apontado no Brand Brain como ausente e crítico para conversão. Stories de FAQ constroem o destaque ao mesmo tempo que ativam o perfil no dia. Perguntas reais de noivas têm altíssima taxa de resposta/reply.
- **Estrutura:**
  - Frame 1: "Recebo muito isso no DM. Vou responder aqui."
  - Frame 2: "Você faz prévia antes do casamento?" — resposta de Carol com contexto (por que a prévia existe, o que ela garante)
  - Frame 3: "A maquiagem dura o dia todo?" — resposta técnica (produtos fixadores, teste de durabilidade na prévia)
  - Frame 4: "Você atende noivas com pele preta / cachos?" — resposta explícita de especialização
  - Frame 5: "Como funciona o dia do casamento?" — cronograma simplificado
  - Frame 6: "Me manda mensagem. Vamos conversar sobre o seu dia." (CTA único)
  - Salvar os frames relevantes como destaque "Perguntas"

---

### Pauta 8 — Carrossel: "O que muda na maquiagem para pele preta que ninguém te conta"
- **Formato:** Carrossel 7–8 slides
- **Pilar:** II — Autoridade Técnica
- **Persona:** 2 (Noiva Preta) + 4 (Profissional em Formação)
- **Arquétipo:** Sábia
- **Justificativa:** Alto potencial de salvamento e compartilhamento. "Ninguém te conta" é gancho de descoberta — faz a Persona 2 enviar para outras mulheres negras. Profissionais salvam para estudo. Construção de autoridade direta para o Curso VIP.
- **Estrutura:**
  - Capa: close de pele negra iluminada com olhar direto + título em serif sobre fundo café
  - Slide 2: "A base certa não é a mais cobrindo. É a que respeita o subtom."
  - Slide 3: "Flash fotográfico apaga a pele melanada. O segredo está no primer."
  - Slide 4: "Iluminador em pele preta: onde colocar e onde nunca colocar."
  - Slide 5: "A diferença entre pele 'plastificada' e pele iluminada."
  - Slide 6: "Por que a maioria das fotos de noivas pretas não fazem justiça à pele real."
  - Último slide: "Pele melanada tem sua própria linguagem. Eu aprendi a ouvi-la." + @makecarolnunes + CTA para lista do curso

---

### Pauta 9 — Retrato de Carol com legenda de bastidores / valores
- **Formato:** Foto (retrato editorial)
- **Pilar:** Ambos (colagem da marca)
- **Persona:** Todas
- **Arquétipo:** Criadora
- **Justificativa:** O pilar Carol — Presença (10% do feed) humaniza a marca. Retratos editoriais de Carol funcionam como âncora do feed e constroem a percepção de autoridade. A série brown shirt é a referência — manter o padrão visual.
- **Estrutura:**
  - Foto editorial: Carol com a bancada ao fundo ou em set de atendimento. Luz natural lateral. Paleta quente.
  - Legenda de bastidores: não "sobre mim" — uma história específica. "Tem coisas que aprendi na publicidade que mudaram a forma como olho para uma noiva..." ou "7 anos. Uma bancada. E a certeza de que cada pele merece uma abordagem diferente."
  - Tom: primeira pessoa, narrativa, honesta. Nenhuma palavra proibida.

---

### Pauta 10 — Reel de portfólio editorial pele preta (preparação de autoridade para Curso VIP)
- **Formato:** Reel 20–30s (portfólio puro, pouca fala)
- **Pilar:** II — Autoridade Técnica
- **Persona:** 2 (Noiva Preta) + 4 (Profissional)
- **Arquétipo:** Criadora
- **Justificativa:** O post de pele preta afro editorial (Erykah Badu) é o melhor do feed. Precisa de continuidade — não de repetição do mesmo, mas de uma nova peça editorial com a mesma qualidade. Cada peça editorial forte é um tijolo na construção de autoridade para o Curso VIP, que deve ser lançado como resultado natural da acumulação de conteúdo técnico, não como anúncio surpresa.
- **Estrutura:**
  - Sequência de closes: pele, olho, lábios, cabelo — tudo em pele negra, luz lateral perfeita
  - Sem narração. Música que respira no universo da marca (jazz, soul, instrumental black)
  - Texto mínimo no final: "Tornar o belo ainda mais belo."
  - Legenda: curta. A foto carrega o peso. "Pele melanada com a luz que ela merece. Rio de Janeiro, 2026."

---

## Resumo Executivo — O que fazer esta semana

**Hoje (imediato, <30 min no total):**
1. Trocar a capa do reel "O que ela me pediu" (Pauta 1)
2. Atualizar a bio para v1 (Pauta 2)
3. Arquivar o post de carnaval com glitter

**Esta semana (publicar 3–4 conteúdos):**
- Pauta 3 ou 4 (educacional) — segunda ou terça
- Pauta 5 (making of de noiva) — quinta ou sexta
- Pauta 6 (primeiro reel de cachos) — qualquer dia da semana
- Pauta 7 (stories FAQ) — qualquer dia, publicar e salvar em destaque

**Antes de domingo (preparação para próxima análise):**
- Preencher `instagram/concorrentes.md` com dados de ao menos 2–3 perfis
- Checar se o token da API do Instagram ainda é válido e/ou se o ambiente permite acesso externo ao `graph.instagram.com`

---

*Análise gerada automaticamente em 31/08/2026. Dados da API indisponíveis (bloqueio de rede). Toda análise de performance é baseada no Brand Brain e em dados históricos documentados no manual — não em métricas reais da semana.*
