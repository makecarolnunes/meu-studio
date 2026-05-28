// ════════════════════════════════════════════════════════════
// fiscal-categorizer.js — Pipeline de categorização
// 1) Regras salvas (DB) → match exato/prioritário
// 2) Regras seed (FS_REGRAS_SEED) → match por substring
// 3) Claude Haiku (batch) → para o resto
// Sempre nasce com confirmado=false; usuário aprova.
// ════════════════════════════════════════════════════════════

const FS_HAIKU_MODEL = 'claude-haiku-4-5-20251001';

function fsNormDesc(s) {
  return String(s || '').toLowerCase().replace(/[^\w\sÀ-ÿ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Match por regras (DB + seed) ────────────────────────────
function fsMatchRegra(descricao, regrasDb) {
  const d = fsNormDesc(descricao);
  if (!d) return null;
  // Prioridade: regras salvas (acertos altos primeiro), depois seed
  const todas = [
    ...(regrasDb || []).sort((a, b) => (b.acertos - b.erros) - (a.acertos - a.erros)),
    ...(window.FS_REGRAS_SEED || []),
  ];
  for (const r of todas) {
    const p = fsNormDesc(r.padrao);
    if (p && d.includes(p)) {
      return {
        categoria: r.categoria,
        natureza: r.natureza,
        confianca: r.acertos > 0 ? Math.min(0.99, 0.85 + r.acertos * 0.01) : 0.92,
        origem: r.acertos > 0 ? 'regra-aprendida' : 'regra-seed',
        regraId: r.id,
      };
    }
  }
  return null;
}

// ── Aprende regra após aprovação humana ─────────────────────
async function fsAprenderRegra(descricao, categoria, natureza) {
  // Extrai termo distintivo: primeira palavra com >=4 chars que NÃO seja genérica
  const STOP = new Set(['pix','transf','transferencia','pagamento','compra','debito','credito','para','de','do','da','com','via','tef']);
  const palavras = fsNormDesc(descricao).split(' ').filter(p => p.length >= 3 && !STOP.has(p));
  if (!palavras.length) return;
  const padrao = palavras[0];
  // Procura se já existe regra com esse padrão
  const existentes = FS.regras || [];
  const ja = existentes.find(r => fsNormDesc(r.padrao) === padrao);
  if (ja) {
    // Mesma categoria → incrementa acertos. Diferente → incrementa erros e baixa prioridade
    if (ja.categoria === categoria && ja.natureza === natureza) {
      ja.acertos = (ja.acertos || 0) + 1;
      ja.prioridade = ja.acertos;
    } else {
      ja.erros = (ja.erros || 0) + 1;
    }
    try { await DB.fiscal.regras.upsert(ja); } catch(_) {}
    return;
  }
  // Nova regra
  const nova = {
    id: 'reg_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    padrao, categoria, natureza,
    prioridade: 1, origem: 'manual', acertos: 1, erros: 0,
  };
  FS.regras = [...(FS.regras || []), nova];
  try { await DB.fiscal.regras.upsert(nova); } catch(_) {}
}

// ── Claude Haiku batch ──────────────────────────────────────
async function fsCategorizarComIA(transacoesParaIA) {
  const apiKey = localStorage.getItem('mk_claude_key');
  if (!apiKey) {
    // Sem chave: marca como PENDENTE pra revisão manual
    return transacoesParaIA.map(t => ({
      ...t,
      categoriaSugerida: '',
      naturezaSugerida: 'PENDENTE',
      confiancaIa: 0,
      _origem: 'sem-ia',
    }));
  }

  // Lote de 20 por chamada
  const BATCH = 20;
  const resultado = [];
  for (let i = 0; i < transacoesParaIA.length; i += BATCH) {
    const lote = transacoesParaIA.slice(i, i + BATCH);
    try {
      const r = await fsChamarClaude(lote, apiKey);
      resultado.push(...r);
    } catch (err) {
      console.error('[fiscal-ia] erro batch', err);
      // Fallback: deixa pendente
      lote.forEach(t => resultado.push({
        ...t, categoriaSugerida: '', naturezaSugerida: 'PENDENTE',
        confiancaIa: 0, _origem: 'erro-ia',
      }));
    }
  }
  return resultado;
}

async function fsChamarClaude(transacoes, apiKey) {
  const catList = FS_CATEGORIAS.filter(c => c.id !== 'outro' && c.nat !== 'IGNORAR')
                  .map(c => c.nome).join(', ');

  const itens = transacoes.map((t, i) => `${i}|${t.data}|${t.valor}|${t.descricao}`).join('\n');

  const systemPrompt = `Você é assistente fiscal de uma maquiadora freelancer MEI no Brasil.
Categorize cada transação de extrato bancário.

CATEGORIAS DISPONÍVEIS: ${catList}, Pessoal, Transferência

REGRAS:
- "Pessoal" para qualquer gasto pessoal (mercado, saúde, casa, lazer, assinaturas pessoais)
- "Transferência" para movimentações entre contas próprias (não é despesa real)
- "Combustível" sempre vem como MISTA (carro é pessoal+profissional)
- Crédito (valor positivo) → recebimento, deixe categoria vazia e natureza IGNORAR
- Descrição genérica (PIX, TED sem destino) → natureza PENDENTE

NATUREZA:
- PROFISSIONAL: gasto do trabalho (deslocamento, produtos, equipamentos, etc.)
- PESSOAL: gasto pessoal
- MISTA: divide entre os dois (combustível típico)
- IGNORAR: transferência entre contas próprias, estorno
- PENDENTE: descrição muito vaga pra decidir

CONFIANÇA: 0.0 a 1.0. Use 0.9+ só quando óbvio.

Retorne APENAS um JSON array, sem markdown, sem texto extra:
[{"i":0,"cat":"Deslocamento","nat":"PROFISSIONAL","conf":0.95}, ...]`;

  const body = {
    model: FS_HAIKU_MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Transações (formato: index|data|valor|descricao):\n${itens}` }],
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error('Claude API ' + resp.status);
  const data = await resp.json();
  const texto = (data.content && data.content[0] && data.content[0].text) || '';
  // Extrai JSON do texto
  const m = texto.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('Resposta IA sem JSON');
  let arr;
  try { arr = JSON.parse(m[0]); } catch(e) { throw new Error('JSON IA inválido'); }

  return transacoes.map((t, idx) => {
    const r = arr.find(x => x.i === idx) || {};
    return {
      ...t,
      categoriaSugerida: r.cat || '',
      naturezaSugerida: r.nat || 'PENDENTE',
      confiancaIa: typeof r.conf === 'number' ? Math.min(1, Math.max(0, r.conf)) : 0.5,
      _origem: 'ia',
    };
  });
}

// ── Pipeline completo ───────────────────────────────────────
// Recebe transações cruas (já dedupadas) e devolve com categoria sugerida.
async function fsCategorizarLote(transacoes, regrasDb, progressCb) {
  const total = transacoes.length;
  const result = new Array(total);
  const pendentes = [];

  // 1) Match por regras (rápido)
  for (let i = 0; i < total; i++) {
    const t = transacoes[i];
    // Crédito não é despesa: marca pra ignorar (vira concilação reversa depois)
    if (t.valor >= 0) {
      result[i] = { ...t, categoriaSugerida: '', naturezaSugerida: 'IGNORAR', confiancaIa: 1, _origem: 'credito' };
      continue;
    }
    const m = fsMatchRegra(t.descricao, regrasDb);
    if (m) {
      result[i] = { ...t, categoriaSugerida: m.categoria, naturezaSugerida: m.natureza, confiancaIa: m.confianca, _origem: m.origem };
    } else {
      result[i] = null;
      pendentes.push({ idx: i, t });
    }
    if (progressCb) progressCb(i + 1, total, 'regras');
  }

  // 2) IA pros que não bateram em regra
  if (pendentes.length) {
    const lote = pendentes.map(p => p.t);
    const cat = await fsCategorizarComIA(lote);
    pendentes.forEach((p, k) => { result[p.idx] = cat[k]; });
    if (progressCb) progressCb(total, total, 'ia');
  }

  return result;
}
