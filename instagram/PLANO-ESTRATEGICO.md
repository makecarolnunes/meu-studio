# Dashboard Estratégico Instagram — Plano Detalhado

> Documento de planejamento. Carol aprova/redireciona antes de qualquer codificação.

---

## 🎯 Objetivo

Construir um sistema de **análise estratégica de marca** que usa os dados do Instagram + Brand Brain da Carol + dados de concorrentes para gerar **diagnósticos profundos, hipóteses e direcionamentos acionáveis** — não um dashboard de métricas.

O sistema atua como: **estrategista de marca + diretor criativo + analista de marketing + especialista em comportamento + consultor de posicionamento**.

---

## 🚦 Limitações honestas (precisam estar claras antes de começar)

### O que a Instagram Graph API ENTREGA hoje (token Business)
| Dado | Disponível? | Observação |
|------|:-:|---|
| Perfil, bio, seguidores, contagem de posts | ✅ | Já no dashboard atual |
| Últimos posts (legenda, data, likes, comentários) | ✅ | Já no dashboard atual |
| Reach por post | ✅ | Via `/{media-id}/insights?metric=reach` |
| Saved e Shares por post | ✅ | Via `/insights?metric=saved,shares` |
| Total interactions por post | ✅ | Via `/insights?metric=total_interactions` |
| Plays/Views de Reels | ✅ | Via `/insights?metric=plays` |
| Tempo médio de view (Reels) | ⚠️ | Disponível mas inconsistente |
| Profile views, account reach (período) | ✅ | Via `/me/insights?metric=...&period=day&since=...` |
| Website clicks | ✅ | Via account insights |
| Novos seguidores (período) | ✅ | Via account insights |
| Conteúdo dos comentários | ✅ | Via `/{media-id}/comments` (só comentários do feed, não DMs) |
| Demografia de seguidores (idade, gênero, cidade) | ✅ | Via account insights — disponível só para contas Business com 100+ seguidores |

### O que a API NÃO ENTREGA (mesmo com permissões avançadas)
| Não disponível | Por quê |
|---|---|
| Origem do tráfego (Explorar vs Reels vs Search vs Home feed) | Meta não expõe — só dentro do app da Carol |
| Audience insights de não-seguidores que viram seu conteúdo | Restrição de privacidade |
| Dados granulares dos concorrentes | Restrição absoluta |
| Stories engagement detalhado | Endpoint limitado, dados parciais |
| Reach por conteúdo (Reel vs Foto vs Carrossel) cruzado com demografia | Não exposto |

### Conclusão
Conseguimos ~80% do que você descreveu via API. Os 20% restantes (origem do tráfego, demografia detalhada de não-seguidores) precisam ser **lidos manualmente do app do Instagram** e inseridos como input — eu construo a interface para isso ser rápido.

---

## 🏗️ Arquitetura — 3 camadas

```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 1 · DADOS                                            │
│  • Graph API (perfil, posts, insights, demografia, comments) │
│  • Brand Brain (parsed do centro-de-comando.html)            │
│  • Concorrentes (concorrentes.md + UI estruturada)           │
│  • Inputs manuais (origem do tráfego, retenção Reels)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 2 · ANÁLISE IA (Claude API)                          │
│  • 5 análises distintas, cada uma com prompt especializado:  │
│    1. Strategic Pattern Recognition (por que performaram)    │
│    2. Brand Alignment Audit (cada post vs Brand Brain)       │
│    3. Audience Behavior Analysis (quem está engajando)       │
│    4. Competitor Market Intelligence                         │
│    5. Content Gap & Opportunity Map                          │
│  • Resultados salvos em JSON estruturado + commit no repo    │
│  • Cache de 7 dias, refresh manual disponível                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 3 · VISUALIZAÇÃO (4 abas)                            │
│  • Visão Geral · métricas brutas + alertas                   │
│  • Estratégia · análises da IA com Brand Brain               │
│  • Concorrentes · matriz comparativa profunda                │
│  • Brand Alignment · auditoria post a post                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 Camada 1 — Dados

### Endpoints Graph API expandidos

```javascript
// Já tem
GET /me?fields=id,username,biography,followers_count,follows_count,media_count,profile_picture_url
GET /me/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink,...&limit=50

// Adicionar
GET /{media-id}/insights?metric=reach,saved,shares,total_interactions,plays
GET /{media-id}/comments?fields=text,timestamp,username,like_count    // para análise qualitativa
GET /me/insights?metric=impressions,reach,profile_views,website_clicks,follower_count&period=day&since=...&until=...
GET /me/insights?metric=audience_gender_age,audience_city,audience_country,audience_locale
```

### Brand Brain Parser

Extrai do `../centro de comando/centro-de-comando.html` os seguintes blocos:

- **DNA** (essência, propósito, posicionamento, promessa)
- **Pilares** (Noivas Premium, Autoridade Técnica)
- **Personas** (4 personas + mapa emocional)
- **Arquétipos** (Criadora, Cuidadora, Sábia)
- **Tom de voz** (palavras da marca, palavras proibidas)
- **Paleta** (cores principais + secundárias + regras)
- **Linguagem fotográfica** (luz, enquadramento, tratamento)
- **Pilares editoriais do feed** (% por categoria)
- **5 categorias de conteúdo**
- **O que evitar** (erros visuais, erros de posicionamento)

Salvo como `instagram/brand-brain.json` (gerado, não editado manualmente). Re-gerado quando você editar o centro de comando.

### Concorrentes — UI estruturada

Substitui o `concorrentes.md` por um **formulário no próprio dashboard**:

```
[+ Adicionar concorrente]

@makecomgaby                                              [⋮]
─────────────────────────────────────────────────────────
Posicionamento percebido:    [select: Premium / Mid / Acessível]
Especialidade declarada:     [input: ex: "Maquiagem de noiva"]
Estética visual:             [select: Editorial / Casual / Mista]

Posts recentes (3-5):
  ┌─────────────────────────────────────────────────┐
  │ Tipo: [Reel ▼]    Likes: [____]   Coment: [__]  │
  │ Tema: [_________________________________]       │
  │ Captura visual (descrição): [textarea]          │
  │ Legenda (cole ou resuma): [textarea]            │
  └─────────────────────────────────────────────────┘
  [+ Adicionar post]

Comentários típicos (3 exemplos): [textarea]
Tipo de relacionamento com seguidores: [select: Distante/Próximo/Mentor/Amiga]
```

Dados salvos em `instagram/concorrentes.json` (auto-commit no save).

### Inputs manuais (o que API não dá)

Aba "Inputs Semanais" no dashboard, ~3min de preenchimento toda semana:

```
SEMANA 19-25 maio 2026
────────────────────────────────────────
Origem do tráfego (do Instagram Insights do app):
  Explorar:        [__%]   Reels:           [__%]
  Compartilhamento:[__%]   Perfil/Search:   [__%]
  Outros:          [__%]

Top 3 Reels por retenção média (do app):
  Reel 1: [permalink]  Retenção: [__%]
  Reel 2: [permalink]  Retenção: [__%]
  Reel 3: [permalink]  Retenção: [__%]
```

Salvos como `instagram/inputs/AAAA-MM-DD.json`.

---

## 🧠 Camada 2 — Análise IA

### 5 análises, 5 prompts especializados

Cada análise tem prompt próprio, recebe contexto específico, retorna JSON estruturado.

#### 1. Strategic Pattern Recognition

**O que faz:** Olha os últimos 20-50 posts e identifica POR QUE os top performaram e POR QUE os bottom não.

**Inputs:** posts + insights por post + Brand Brain (pilares, tom)

**Output (JSON):**
```json
{
  "top_patterns": [
    {
      "pattern": "Reels com hook que começa com cena (não com 'oi gente')",
      "evidence": ["post_id_1", "post_id_2", "post_id_3"],
      "performance_lift": "+340% vs média",
      "hypothesis": "Hooks narrativos prendem porque criam expectativa..."
    }
  ],
  "bottom_patterns": [
    {
      "pattern": "Posts com fundo bagunçado visível",
      "evidence": ["post_id_X"],
      "performance_drop": "-60% vs média",
      "hypothesis": "Quebra de percepção premium documentada no Brand Brain"
    }
  ],
  "format_intelligence": {
    "reels": { "best_for": "alcance e novos seguidores", "avg_engagement": "..." },
    "carrossel": { "best_for": "salvamentos e autoridade", "avg_engagement": "..." },
    "foto": { "best_for": "..." }
  }
}
```

**Mockup de prompt (resumido):**
```
Você é estrategista de marca especialista em Instagram para maquiadoras
profissionais. Analise os 20 posts abaixo CRUZANDO com o Brand Brain
da Carol (anexo).

Para cada padrão identificado:
- Cite os post IDs como evidência
- Quantifique o lift/drop de performance
- Conecte com pilar/persona/arquétipo específico do Brand Brain
- Gere hipótese causal (não apenas correlação)

NÃO use insights genéricos como "Reels performam melhor que fotos".
Procure padrões específicos a esse perfil: tipo de hook, presença
de Carol vs apenas resultado, narração emocional vs técnica pura,
temas relacionados aos 4 personas, etc.
```

#### 2. Brand Alignment Audit

**O que faz:** Cada post recebe score de alinhamento com Brand Brain (0-10) em 5 eixos.

**Inputs:** post (caption + media_type + thumbnail) + Brand Brain inteiro

**Output (JSON):**
```json
{
  "audit_per_post": [
    {
      "post_id": "...",
      "permalink": "...",
      "scores": {
        "tom_de_voz": 9,         // usa palavras da marca, sem proibidas
        "estetica_visual": 7,     // paleta, luz, enquadramento
        "pilar_alignment": "noivas",  // qual pilar reforça
        "persona_alignment": ["persona_1", "persona_2"],
        "arquetipo": "criadora",
        "posicionamento_premium": 8   // 0-10
      },
      "flags": [
        "Usa palavra 'transformação' (proibida no Brand Brain)",
        "Capa: fundo laranja sólido (proibido)"
      ],
      "strengths": [
        "Legenda começa com cena, não com 'oi gente'",
        "Mostra making of, não só resultado"
      ],
      "score_geral": 7.5
    }
  ],
  "summary": {
    "avg_brand_alignment": 7.2,
    "weakest_dimension": "estetica_visual",
    "posts_off_brand": ["post_id_X", "post_id_Y"],  // score < 5
    "posts_perfect_brand": ["post_id_Z"]            // score >= 9
  }
}
```

#### 3. Audience Behavior Analysis

**O que faz:** Cruza demografia + comentários + tipos de post para hipotetizar QUEM está engajando.

**Inputs:** demografia agregada + comentários dos top 10 posts + Brand Brain (personas)

**Output (JSON):**
```json
{
  "audience_segments_engaging": [
    {
      "segment": "Mulheres 25-34, RJ/SP, interessadas em maquiagem profissional",
      "evidence": "78% dos comentários top vêm desse grupo demográfico",
      "matches_persona": "persona_1_noiva_premium",
      "fit_score": 8
    },
    {
      "segment": "Maquiadoras iniciantes/intermediárias",
      "evidence": "Comentários técnicos perguntando produtos, %",
      "matches_persona": "persona_4_profissional",
      "fit_score": 9,
      "opportunity": "Engajamento alto + Curso VIP em planejamento = aquecer essa lista"
    }
  ],
  "audience_vazia_signals": [
    {
      "signal": "Posts de carnaval atraem audiência fora do nicho (medido por: comentários sem relação técnica/emocional, contas que seguem ~2000 perfis)",
      "posts": ["post_id_X"]
    }
  ]
}
```

#### 4. Competitor Market Intelligence

**O que faz:** Análise profunda dos concorrentes vs Carol.

**Inputs:** concorrentes.json + Brand Brain Carol + posts top da Carol

**Output (JSON):**
```json
{
  "competitor_analysis": [
    {
      "competitor": "@makecomgaby",
      "positioning": "Premium-acessível, foco volume",
      "strengths_vs_carol": ["Frequência maior de Reels", "..."],
      "weaknesses_vs_carol": ["Sem especialização declarada em pele preta", "..."],
      "tom_de_voz_overlap": "Médio - usa algumas palavras genéricas que estão na lista proibida da Carol",
      "stratagems_to_borrow": ["Formato de carrossel educacional X"],
      "stratagems_to_avoid": ["Tom influenciadora 'oi gente'"]
    }
  ],
  "market_gaps": [
    {
      "gap": "Conteúdo educacional técnico sobre subtom em pele negra",
      "evidence": "Nenhum dos 7 concorrentes cobre isso",
      "fit_with_carol_brand": "10/10 - alinha com Pilar II + arquétipo Sábia + atrai Persona 4 (Curso VIP)"
    }
  ],
  "saturated_areas": [
    {
      "topic": "Tutorial básico de maquiagem nude",
      "competitors_doing": 5,
      "recommendation": "Não competir aqui — não diferencia"
    }
  ],
  "positioning_map": {
    // dados para gerar um quadrante visual
    "axis_x": "Premium ↔ Acessível",
    "axis_y": "Especialista ↔ Generalista",
    "carol": { "x": 0.7, "y": 0.85 },
    "competitors": [
      { "name": "@makecomgaby", "x": 0.5, "y": 0.4 },
      ...
    ]
  }
}
```

#### 5. Content Gap & Opportunity Map

**O que faz:** Olha o feed + concorrentes + Brand Brain pilares editoriais (%) e detecta desbalanço/gaps.

**Inputs:** todos os outputs acima + pilares editoriais do Brand Brain

**Output (JSON):**
```json
{
  "feed_balance": {
    "ideal": {
      "noivas": 25, "pele_preta": 20, "cachos": 15,
      "tecnico": 15, "carol_presenca": 10, "produtos": 10, "social": 5
    },
    "atual": {
      "noivas": 35, "pele_preta": 10, "cachos": 8,
      "tecnico": 5, "carol_presenca": 25, "produtos": 12, "social": 5
    },
    "desvios_criticos": [
      "Pele Preta abaixo do ideal (10% vs 25%) - subaproveitamento do Pilar II",
      "Técnico abaixo (5% vs 15%) - urgente para preparar Curso VIP"
    ]
  },
  "next_10_pautas": [
    {
      "titulo": "Subtom frio vs quente em pele negra: como identificar antes de comprar base",
      "formato": "Reel técnico",
      "categoria": "Autoridade Técnica",
      "pilar": "II",
      "persona_alvo": ["persona_2_noiva_preta", "persona_4_profissional"],
      "arquetipo_dominante": "sabia",
      "justificativa": "Fecha gap de 10% no pilar técnico + atrai Persona 4 (Curso VIP) + zero concorrentes cobrindo + alinha com 'Tornar o belo ainda mais belo'",
      "estrutura": [
        "Hook 0-3s: 'A base certa para sua pele começa antes da loja' (Cormorant grande)",
        "3-10s: close de braço com 2 subtons visíveis",
        "10-25s: técnica de identificação...",
        "Final: CTA suave para futura turma do curso"
      ],
      "score_estrategico": 9.5
    }
  ]
}
```

---

## 🎨 Camada 3 — Visualização (4 abas)

### Layout geral

```
┌────────────────────────────────────────────────────┐
│ ← Voltar    Instagram        🔄  ⚙️                │
│ @makecarolnunes · Última análise: 21/05 14h        │
├────────────────────────────────────────────────────┤
│ [ Visão Geral ] [ Estratégia ⭐ ] [ Concorrentes ] │
│                 [ Brand Alignment ]                │
├────────────────────────────────────────────────────┤
│                                                    │
│              CONTEÚDO DA ABA                       │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Aba 1 · Visão Geral

Métricas brutas + alertas inteligentes.

```
┌──────────────────────────────────────────┐
│ ⚠️ 2 posts off-brand detectados          │  ← alerta
│ ⚠️ Pilar "Técnico" 5% do feed (ideal 15%)│
│ ✨ Top post da semana: +340% vs média     │
└──────────────────────────────────────────┘

┌──────┬──────┬──────┬──────┐
│ Seg  │Posts │ Eng% │Alcance│
│ 951  │ 47   │3.2%  │40.2k │
└──────┴──────┴──────┴──────┘

[ Gráfico: alcance últimos 30 dias ]
[ Gráfico: novos seguidores ]
[ Gráfico: cliques no link ]

📊 Performance dos últimos 20 posts (já existente, melhorado)
🌡️ Heatmap horários × dias (já existente)

🏆 Top 3 / 📉 Bottom 3 posts (já existente)
```

### Aba 2 · Estratégia ⭐ (a aba principal)

Resultado da IA com Brand Brain.

```
┌────────────────────────────────────────────────────┐
│ 🧠 Análise gerada em 21/05 14h    [Regenerar 🔄]   │
│ Próxima atualização automática: segunda 7h         │
└────────────────────────────────────────────────────┘

┌─ DIAGNÓSTICO ESTRATÉGICO ─────────────────────────┐
│                                                    │
│ "Seu feed está 70% alinhado com Brand Brain.       │
│ O Pilar Noivas está bem comunicado, mas o Pilar    │
│ Autoridade Técnica está subaproveitado (5% vs      │
│ 15% ideal). Isso é o gargalo mais crítico, porque  │
│ é exatamente esse pilar que prepara terreno para   │
│ o Curso VIP."                                      │
│                                                    │
└────────────────────────────────────────────────────┘

┌─ POR QUE OS TOP POSTS PERFORMARAM ────────────────┐
│                                                    │
│ Padrão #1: Hook narrativo (não "oi gente")         │
│   +340% engajamento · Posts: P12, P18, P21         │
│   Hipótese: prende porque cria expectativa...      │
│                                                    │
│ Padrão #2: Carol presente no frame                 │
│   +210% engajamento · Posts: P05, P15              │
│   Hipótese: arquétipo Cuidadora ativado...         │
│                                                    │
│ Padrão #3: Conteúdo técnico com nome de produto    │
│   +180% salvamentos · Posts: P09, P22              │
│   Hipótese: Persona 4 (profissional) ativando      │
│   sinal de autoridade real (Brand Brain · Sábia)   │
└────────────────────────────────────────────────────┘

┌─ POR QUE OS BOTTOM PERFORMARAM MAL ───────────────┐
│ Padrão #1: Fundo bagunçado visível                 │
│ Padrão #2: Tom genérico de influenciadora          │
│ Padrão #3: Resultado sem narrativa do processo     │
└────────────────────────────────────────────────────┘

┌─ PRÓXIMAS 10 PAUTAS ALINHADAS ────────────────────┐
│                                                    │
│ 1. Subtom em pele negra (Reel Técnico)             │
│    Score: 9.5 · Pilar II · Persona 2+4             │
│    [Ver briefing completo ↓]                       │
│                                                    │
│ 2. Making of Camila — capítulo 2 (Reel Emocional)  │
│    Score: 9.2 · Pilar I · Persona 1                │
│    ...                                             │
└────────────────────────────────────────────────────┘

┌─ SINAIS DE FADIGA / OPORTUNIDADE ──────────────────┐
│ ⚠ Fadiga: 3 posts seguidos de retrato Carol        │
│   sem novidade visual                              │
│ ✨ Oportunidade: 0 posts sobre durabilidade        │
│   (sua maior vantagem técnica)                     │
└────────────────────────────────────────────────────┘
```

### Aba 3 · Concorrentes

Análise comparativa profunda usando Brand Brain como filtro.

```
┌─ POSITIONING MAP ──────────────────────────────────┐
│  Especialista                                       │
│       │                                             │
│       │     ★ Carol                                 │
│       │   • @nathmatosmakeup                        │
│       │                                             │
│  ─────┼───────────────── Premium                    │
│       │                                             │
│       │ • @makecomgaby                              │
│       │           • @juliatorresmakeup              │
│  Generalista                                        │
└────────────────────────────────────────────────────┘

┌─ MATRIZ COMPARATIVA ──────────────────────────────┐
│                                                    │
│ DIFERENCIAIS REAIS DA CAROL                        │
│ ✓ Única com especialização técnica em pele preta   │
│   declarada + portfólio que prova                  │
│ ✓ Background publicidade (10 anos) — ninguém tem   │
│ ✓ Tom de marca distinto (sem "oi gente")           │
│                                                    │
│ SEMELHANÇAS EXCESSIVAS (alerta!)                   │
│ ⚠ Capa estilo @maker — 3 posts da Carol parecem   │
│   uma diluição visual                              │
│                                                    │
│ FORMATOS SATURADOS (não competir)                  │
│ ✗ Tutorial básico nude (5 fazem)                   │
│ ✗ "Get ready with me" genérico (4 fazem)           │
│                                                    │
│ ESPAÇOS POUCO EXPLORADOS (dominar)                 │
│ ★ Subtom técnico em pele negra (0 fazem)           │
│ ★ Durabilidade real de maquiagem (1 faz mal)       │
│ ★ Cachos + maquiagem juntos (0 cobrem bem)         │
└────────────────────────────────────────────────────┘

┌─ ANÁLISE INDIVIDUAL ──────────────────────────────┐
│ @makecomgaby [▼ expandir]                          │
│   Posicionamento: ...                              │
│   Estratégia de venda indireta: ...                │
│   Tipos de comentário típicos: ...                 │
│   Tom de comunicação: ...                          │
│   O que adotar: ...                                │
│   O que evitar: ...                                │
│                                                    │
│ @juliatorresmakeup [▼ expandir]                    │
│   ...                                              │
└────────────────────────────────────────────────────┘
```

### Aba 4 · Brand Alignment

Auditoria post a post.

```
┌─ SCORE GERAL: 7.2 / 10 ────────────────────────────┐
│                                                    │
│ Tom de Voz:         ████████░░ 8.1                 │
│ Estética Visual:    ██████░░░░ 6.2  ⚠ mais fraco  │
│ Alinhamento Pilar:  ████████░░ 7.8                 │
│ Posicionamento:     ███████░░░ 7.5                 │
└────────────────────────────────────────────────────┘

┌─ POSTS OFF-BRAND (score < 5) ─────────────────────┐
│                                                    │
│ [thumb] Post #X — Score 3.2                        │
│         "Maquiagem incrível para arrasar"          │
│         🚩 Usa "incrível" + "arrasar" (proibidas)  │
│         🚩 Capa: fundo laranja sólido (proibido)   │
│         💡 Sugestão: arquivar ou refazer capa      │
│                                                    │
│ [thumb] Post #Y — Score 4.1                        │
│         ...                                        │
└────────────────────────────────────────────────────┘

┌─ POSTS PERFEITOS (score >= 9) ────────────────────┐
│ [thumb] Post #Z — Score 9.6                        │
│         "Pele melanada tem sua própria linguagem"  │
│         ✓ Pilar II + arquétipo Sábia               │
│         ✓ Tom impecável                            │
│         ✓ Estética alinhada                        │
│         💡 Replicar fórmula                        │
└────────────────────────────────────────────────────┘

[ Lista completa de 20 posts com scores ↓ ]
```

---

## 💰 Custos estimados (Claude API)

Cada execução das 5 análises completas consome aproximadamente:
- Input: ~25k tokens (Brand Brain + 20 posts com captions + concorrentes)
- Output: ~8k tokens (análises estruturadas)
- Custo com Sonnet 4.6: **~$0.10 a $0.20 por análise completa**

Se rodar 1x por semana (junto com a routine semanal) + ~2 refresh manuais por mês:
**~$1 a $2 por mês**. Praticamente irrelevante.

---

## 🗺️ Plano de execução — 3 fases

### Fase 1 · Fundação de dados (4-6h)
1. Adicionar todos os endpoints novos do Graph API
2. Criar Brand Brain Parser (HTML → JSON)
3. UI estruturada para concorrentes (formulário em vez de markdown)
4. UI para inputs manuais (origem do tráfego, retenção)
5. Camada de cache estendida (Local + commit no repo)

**Entregável:** dados muito mais ricos no dashboard atual + concorrentes estruturado.

### Fase 2 · Camada IA (6-8h)
1. Implementar chamadas para Claude API (`mk_claude_key`)
2. 5 prompts especializados + parsers de output
3. Sistema de cache (7 dias, refresh manual)
4. Botão "🧠 Gerar análise estratégica" no dashboard
5. Salvar resultados em `instagram/analises/` (auto-commit)
6. **Integrar com a routine semanal:** routine roda Claude API e atualiza o JSON, dashboard apenas lê

**Entregável:** análises da IA disponíveis, com Brand Brain plenamente integrado.

### Fase 3 · Visualização estratégica (6-8h)
1. Refatorar dashboard atual para sistema de abas
2. Aba 1: Visão Geral + alertas inteligentes
3. Aba 2: Estratégia (a principal)
4. Aba 3: Concorrentes com positioning map
5. Aba 4: Brand Alignment

**Entregável:** dashboard estratégico completo.

**Tempo total estimado:** 16-22h de trabalho. Posso fazer faseado, entregando valor incremental, ou tudo de uma vez.

---

## ⚠️ Riscos e dependências

| Risco | Mitigação |
|---|---|
| API Claude exige chave configurada | Você já tem em `mk_claude_key`. Botão de config se faltar. |
| Token Instagram pode expirar durante análise | Detectar 401, mostrar prompt pra atualizar. |
| Brand Brain mudar no centro de comando | Parser re-gera o JSON na hora. Refletido na próxima análise. |
| Custo de API se rodar muito | Cache 7 dias + refresh manual + sem auto-refresh. |
| Análise gerar conteúdo "alucinado" | Prompts pedem evidência explícita (post_id) para cada claim. |
| Endpoints novos do Graph API podem falhar | Try/catch por endpoint. Análise continua com o que conseguir. |
| CORS do Claude API no browser | Anthropic permite. Se mudar, fallback para um endpoint serverless. |

---

## ❓ Pontos pra você decidir

1. **Faseado ou tudo de uma vez?** Recomendo faseado — Fase 1 já entrega muito valor.
2. **A análise IA deve rodar no browser (você dispara) OU dentro da routine semanal de segunda?** Recomendo ambos: routine atualiza semanal, botão permite refresh manual.
3. **Quer pular alguma das 5 análises?** Ou alguma deve ter prioridade?
4. **Brand Brain Parser deve ler do `centro de comando` (caminho fora do repo) ou copiamos uma cópia pro repo?** Recomendo copiar e versionar — caminho com espaço fora do repo cria fricção.
5. **Aba "Brand Alignment" — vai ser pesada (auditoria post a post). Quer assim mesmo ou versão simplificada?**

---

## Próximo passo

Quando você aprovar (com ajustes que quiser), começo pela **Fase 1**. Cada fase termina com commit + push, então você pode validar incrementalmente.
