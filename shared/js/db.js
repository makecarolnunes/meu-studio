// ============================================================
// shared/js/db.js — Cliente Supabase compartilhado
// Expõe window.DB com CRUD para entries, noivas, saidas, orcamentos,
// conteudo, valoresServicos + DB.auth.login()
//
// COMO USAR NAS PÁGINAS:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="../config.js"></script>
//   <script src="../shared/js/db.js"></script>   ← ajuste o caminho
// ============================================================

// Computa SHA-256 usando Web Crypto API nativa (sem dependências)
async function _sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Lê de config.js (window.ENV) — nunca hardcode aqui
const SUPABASE_URL  = (window.ENV || {}).SUPABASE_URL  || '';
const SUPABASE_ANON = (window.ENV || {}).SUPABASE_ANON || '';

// Inicialização protegida — erros aqui não devem derrubar o arquivo inteiro
let _sb = null;
window._SB_ERROR = null;

(function _init() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    window._SB_ERROR = 'Credenciais ausentes — verifique config.js e os Secrets do GitHub (SUPABASE_URL / SUPABASE_ANON).';
    console.error('[supabase-client]', window._SB_ERROR);
    return;
  }
  try {
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    console.info('[supabase-client] OK — projeto:', SUPABASE_URL);
  } catch(err) {
    window._SB_ERROR = err.message || String(err);
    console.error('[supabase-client] createClient falhou:', window._SB_ERROR);
  }
})();

function _guard() {
  if (window._SB_ERROR) throw new Error(window._SB_ERROR);
  if (!_sb)             throw new Error('Supabase não inicializado.');
}

// ── Mapeadores de campos JS (camelCase) → DB (snake_case) ──────────────────

const _ENTRY_KEYS = {
  dataPag: 'data_pag', dataServ: 'data_serv', cliente: 'cliente',
  tipo: 'tipo', valor: 'valor', valorTotal: 'valor_total',
  servico: 'servico', local: 'local', forma: 'forma',
  status: 'status', origem: 'origem', obs: 'obs', equipe: 'equipe',
  auto: 'auto', noivaId: 'noiva_id', createdAt: 'created_at',
  comprovanteUrl: 'comprovante_url',
};

const _NOIVA_KEYS = {
  nome: 'nome', dataCasamento: 'data_casamento',
  valorContrato: 'valor_contrato', obs: 'obs', createdAt: 'created_at',
  contratos: 'contratos',
};

const _SAIDA_KEYS = {
  dataPag: 'data_pag', dataCaixa: 'data_caixa', tipo: 'tipo', valor: 'valor',
  forma: 'forma', status: 'status', obs: 'obs',
  recorrencia: 'recorrencia', grupoId: 'grupo_id',
  createdAt: 'created_at',
  natureza: 'natureza',
  transferenciaParaMim: 'transferencia_para_mim',
};

const _ORC_KEYS = {
  Cliente: 'cliente', Telefone: 'telefone', Servico: 'servico', Status: 'status',
  DataPedido: 'data_pedido', DataEnvio: 'data_envio', DataFechamento: 'data_fechamento',
  DataEvento: 'data_evento', ValorProp: 'valor_prop', ValorFechado: 'valor_fechado',
  Origem: 'origem', Endereco: 'endereco', Obs: 'obs', ProxFollowup: 'prox_followup',
  AgendaCriada: 'agenda_criada', EnderecoEvento: 'endereco_evento', LocalTipo: 'local_tipo',
  SinalFech: 'sinal_fech', SaldoFech: 'saldo_fech', Comprovantes: 'comprovantes',
  Propostas: 'propostas', Equipe: 'equipe', DataCriacao: 'created_at',
};

// Converte apenas os campos presentes (para update parcial)
function _toDb(obj, keyMap, numericFields = [], boolFields = []) {
  const result = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (k === 'id' || k === 'ID') { result.id = String(v); return; }
    const dbKey = keyMap[k];
    if (!dbKey) return;
    if (boolFields.includes(k))    { result[dbKey] = v === true || v === 'true'; return; }
    if (numericFields.includes(k)) { result[dbKey] = (v !== '' && v != null) ? parseFloat(v) || null : null; return; }
    // Datas e strings vazias → null no DB
    if ((dbKey.startsWith('data_') || dbKey === 'prox_followup') && v === '') {
      result[dbKey] = null; return;
    }
    // noivaId vazio → null
    if (dbKey === 'noiva_id') { result[dbKey] = v || null; return; }
    result[dbKey] = v ?? '';
  });
  return result;
}

// ── Entry ─────────────────────────────────────────────────────────────────────
function _entryToDb(e)   { return _toDb(e, _ENTRY_KEYS, ['valor','valorTotal'], ['auto']); }
function _entryFromDb(r) {
  return {
    id:         String(r.id),
    dataPag:    r.data_pag     || '',
    dataServ:   r.data_serv    || '',
    cliente:    r.cliente      || '',
    tipo:       r.tipo         || '',
    valor:      r.valor        != null ? String(r.valor)       : '',
    valorTotal: r.valor_total  != null ? String(r.valor_total) : '',
    servico:    r.servico      || '',
    local:      r.local        || '',
    forma:      r.forma        || '',
    status:     r.status       || '',
    origem:     r.origem       || '',
    obs:        r.obs          || '',
    equipe:     r.equipe       || '',
    auto:           !!r.auto,
    noivaId:        r.noiva_id       || '',
    createdAt:      r.created_at     || '',
    comprovanteUrl: r.comprovante_url || '',
  };
}

// ── Noiva ─────────────────────────────────────────────────────────────────────
function _noivaToDb(n)   { return _toDb(n, _NOIVA_KEYS, ['valorContrato']); }
function _noivaFromDb(r) {
  return {
    id:            String(r.id),
    nome:          r.nome              || '',
    dataCasamento: r.data_casamento    || '',
    valorContrato: r.valor_contrato    != null ? String(r.valor_contrato) : '',
    obs:           r.obs               || '',
    createdAt:     r.created_at        || '',
    contratos:     Array.isArray(r.contratos) ? r.contratos : [],
  };
}

// ── Saida ─────────────────────────────────────────────────────────────────────
function _saidaToDb(s)   { return _toDb(s, _SAIDA_KEYS, ['valor'], ['transferenciaParaMim']); }
function _saidaFromDb(r) {
  return {
    id:          String(r.id),
    dataPag:     r.data_pag  || '',
    dataCaixa:   r.data_caixa || '',
    tipo:        r.tipo      || '',
    valor:       r.valor     != null ? String(r.valor) : '',
    forma:       r.forma     || '',
    status:      r.status    || '',
    obs:         r.obs       || '',
    recorrencia: r.recorrencia || 'unica',
    grupoId:     r.grupo_id  || null,
    createdAt:   r.created_at || '',
    natureza:    r.natureza  || 'PROFISSIONAL',
    transferenciaParaMim: !!r.transferencia_para_mim,
  };
}

// ── Orçamento ─────────────────────────────────────────────────────────────────
function _orcToDb(o) {
  const row = _toDb(o, _ORC_KEYS, ['ValorProp','ValorFechado','SinalFech','SaldoFech']);
  // ID pode vir como 'ID' (GAS) ou 'id'
  row.id = String(o.ID || o.id);
  // Comprovantes: aceitar array ou string JSON
  if ('Comprovantes' in o) {
    let comp = o.Comprovantes;
    if (typeof comp === 'string') { try { comp = JSON.parse(comp); } catch(_) { comp = []; } }
    row.comprovantes = Array.isArray(comp) ? comp : [];
  }
  // Propostas: campo JSONB — nunca pode ser string vazia (causa 400).
  // Orçamentos criados localmente antes do primeiro sync não têm Propostas,
  // o que faz _toDb mapear propostas: '' → rejeitado pelo banco.
  if ('propostas' in row && !Array.isArray(row.propostas)) {
    row.propostas = [];
  }
  return row;
}
function _orcFromDb(r) {
  return {
    ID:             String(r.id),
    Cliente:        r.cliente          || '',
    Telefone:       r.telefone         || '',
    Servico:        r.servico          || '',
    Status:         r.status           || '',
    DataPedido:     r.data_pedido      || '',
    DataEnvio:      r.data_envio       || '',
    DataFechamento: r.data_fechamento  || '',
    DataEvento:     r.data_evento      || '',
    ValorProp:      r.valor_prop       != null ? String(r.valor_prop)     : '',
    ValorFechado:   r.valor_fechado    != null ? String(r.valor_fechado)  : '',
    Origem:         r.origem           || '',
    Endereco:       r.endereco         || '',
    Obs:            r.obs              || '',
    ProxFollowup:   r.prox_followup    || '',
    AgendaCriada:   r.agenda_criada    || '',
    EnderecoEvento: r.endereco_evento  || '',
    LocalTipo:      r.local_tipo       || '',
    SinalFech:      r.sinal_fech       != null ? String(r.sinal_fech)  : '',
    SaldoFech:      r.saldo_fech       != null ? String(r.saldo_fech)  : '',
    Comprovantes:   r.comprovantes     || [],
    Propostas:      r.propostas        || [],
    Equipe:         r.equipe           || '',
    DataCriacao:    r.created_at       || '',
  };
}

// ── API pública: window.DB ────────────────────────────────────────────────────
window.DB = {

  entries: {
    async list() {
      const { data, error } = await _sb.from('entries').select('*').order('data_pag', { ascending: false });
      if (error) throw error;
      return data.map(_entryFromDb);
    },
    async create(e) {
      const row = _entryToDb(e);
      row.id = row.id || String(Date.now());
      const { error } = await _sb.from('entries').insert(row);
      if (error) throw error;
      return row.id;
    },
    async update(id, fields) {
      const row = _entryToDb({ ...fields, id });
      delete row.id;
      const { error } = await _sb.from('entries').update(row).eq('id', String(id));
      if (error) throw error;
    },
    async delete(id) {
      const { error } = await _sb.from('entries').delete().eq('id', String(id));
      if (error) throw error;
    },
    async upsert(e) {
      const row = _entryToDb(e);
      row.id = row.id || String(Date.now());
      const { error } = await _sb.from('entries').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },
  },

  noivas: {
    async list() {
      const { data, error } = await _sb.from('noivas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(_noivaFromDb);
    },
    async create(n) {
      const row = _noivaToDb(n);
      row.id = row.id || String(Date.now());
      const { error } = await _sb.from('noivas').insert(row);
      if (error) throw error;
      return row.id;
    },
    async update(id, fields) {
      const row = _noivaToDb({ ...fields, id });
      delete row.id;
      const { error } = await _sb.from('noivas').update(row).eq('id', String(id));
      if (error) throw error;
    },
    async delete(id) {
      const { error } = await _sb.from('noivas').delete().eq('id', String(id));
      if (error) throw error;
    },
    async upsert(n) {
      const row = _noivaToDb(n);
      row.id = row.id || String(Date.now());
      const { error } = await _sb.from('noivas').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },
  },

  saidas: {
    async list() {
      const { data, error } = await _sb.from('saidas').select('*').order('data_pag', { ascending: false });
      if (error) throw error;
      return data.map(_saidaFromDb);
    },
    async create(s) {
      const row = _saidaToDb(s);
      row.id = row.id || String(Date.now());
      const { error } = await _sb.from('saidas').insert(row);
      if (error) throw error;
      return row.id;
    },
    async update(id, fields) {
      const row = _saidaToDb({ ...fields, id });
      delete row.id;
      const { error } = await _sb.from('saidas').update(row).eq('id', String(id));
      if (error) throw error;
    },
    async delete(id) {
      const { error } = await _sb.from('saidas').delete().eq('id', String(id));
      if (error) throw error;
    },
    async upsert(s) {
      const row = _saidaToDb(s);
      row.id = row.id || String(Date.now());
      const { error } = await _sb.from('saidas').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },
  },

  orcamentos: {
    async list() {
      const { data, error } = await _sb.from('orcamentos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(_orcFromDb);
    },
    async create(o) {
      const row = _orcToDb(o);
      row.id = row.id || String(Date.now());
      const { error } = await _sb.from('orcamentos').insert(row);
      if (error) throw error;
      return row.id;
    },
    async update(id, fields) {
      const row = _orcToDb({ ...fields, ID: id });
      delete row.id;
      const { error } = await _sb.from('orcamentos').update(row).eq('id', String(id));
      if (error) throw error;
    },
    async delete(id) {
      const { error } = await _sb.from('orcamentos').delete().eq('id', String(id));
      if (error) throw error;
    },
    async upsert(o) {
      const row = _orcToDb(o);
      row.id = row.id || String(Date.now());
      const { error } = await _sb.from('orcamentos').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },
  },

  // ── Contatos de clientes (telefone para WhatsApp) ──
  // Chave: nome_normalizado (lowercase + trim) bate com entries.cliente.
  clienteContatos: {
    async list() {
      _guard();
      const { data, error } = await _sb
        .from('cliente_contatos').select('*');
      if (error) throw error;
      // Retorna map { nome_normalizado: { telefone, obs, nomeOriginal } }
      const map = {};
      (data || []).forEach(r => {
        map[r.nome_normalizado] = {
          telefone: r.telefone || '',
          obs: r.obs || '',
          nomeOriginal: r.nome_original || r.nome_normalizado,
          updatedAt: r.updated_at || '',
        };
      });
      return map;
    },
    async upsert(nomeOriginal, telefone, obs) {
      _guard();
      const nomeNorm = String(nomeOriginal || '').trim().toLowerCase();
      if (!nomeNorm) throw new Error('Nome vazio');
      const row = {
        nome_normalizado: nomeNorm,
        nome_original: nomeOriginal,
        telefone: String(telefone || '').replace(/\D/g, ''),
        obs: obs || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await _sb.from('cliente_contatos').upsert(row, { onConflict: 'nome_normalizado' });
      if (error) throw error;
      return nomeNorm;
    },
    async delete(nomeNorm) {
      _guard();
      const { error } = await _sb
        .from('cliente_contatos').delete().eq('nome_normalizado', String(nomeNorm).toLowerCase());
      if (error) throw error;
    },
  },

  storage: {
    // Bucket "comprovantes" deve ser criado no Supabase Dashboard → Storage
    async uploadComprovante(orcaId, file, categoria, base64Data, mimeType) {
      const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const cat = categoria ? `${categoria.toLowerCase()}_` : '';
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${orcaId}/${cat}${ts}.${ext}`;

      // Converter base64 para Blob
      const byteChars = atob(base64Data);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || file.type });

      const { error } = await _sb.storage.from('comprovantes').upload(path, blob, {
        cacheControl: '3600', upsert: false,
      });
      if (error) throw error;

      const { data } = _sb.storage.from('comprovantes').getPublicUrl(path);
      return { ok: true, fileId: path, link: data.publicUrl, nome: file.name };
    },

    async deleteComprovante(fileId) {
      // fileId pode ser um path do Supabase Storage ou um Drive ID legado (ignorar)
      if (!fileId || !fileId.includes('/')) return; // Drive IDs não têm barra
      const { error } = await _sb.storage.from('comprovantes').remove([fileId]);
      if (error) throw error;
    },

    async uploadEntradaComprovante(entryId, file, base64Data, mimeType) {
      const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const ext = file.name.split('.').pop() || 'bin';
      const path = `entradas/${entryId}/${ts}.${ext}`;
      const byteChars = atob(base64Data);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || file.type });
      const { error } = await _sb.storage.from('comprovantes').upload(path, blob, {
        cacheControl: '3600', upsert: true,
      });
      if (error) throw error;
      const { data } = _sb.storage.from('comprovantes').getPublicUrl(path);
      return { ok: true, fileId: path, link: data.publicUrl, nome: file.name };
    },

    async uploadAnotacao(notaId, file, base64Data, mimeType) {
      const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${notaId}/${ts}.${ext}`;

      const byteChars = atob(base64Data);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || file.type });

      const { error } = await _sb.storage.from('anotacoes').upload(path, blob, {
        cacheControl: '3600', upsert: false,
      });
      if (error) throw error;

      const { data } = _sb.storage.from('anotacoes').getPublicUrl(path);
      return { ok: true, fileId: path, link: data.publicUrl, nome: file.name };
    },

    // Sprint 4 — documentos fiscais (DASN-SIMEI, recibos, informes, NFs etc.)
    async uploadFiscalDoc(ano, tipo, file, base64Data, mimeType) {
      const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const slug = String(tipo || 'OUTRO').toLowerCase();
      const path = `${ano}/${slug}_${ts}.${ext}`;

      const byteChars = atob(base64Data);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || file.type });

      const { error } = await _sb.storage.from('fiscal-documentos').upload(path, blob, {
        cacheControl: '3600', upsert: false,
      });
      if (error) throw error;

      const { data } = _sb.storage.from('fiscal-documentos').getPublicUrl(path);
      return { ok: true, fileId: path, link: data.publicUrl, nome: file.name };
    },
    async deleteFiscalDoc(fileId) {
      if (!fileId || !fileId.includes('/')) return;
      const { error } = await _sb.storage.from('fiscal-documentos').remove([fileId]);
      if (error) throw error;
    },

    // ── Acervo — bucket PRIVADO "materiais" (URLs assinadas) ──
    // Recebe base64 (já redimensionado pelo client). Retorna o path.
    async uploadMaterial(materialId, base64Data, mimeType, ext) {
      const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const rnd  = Math.random().toString(36).slice(2, 7);
      const path = `${materialId}/${ts}_${rnd}.${ext || 'bin'}`;
      const byteChars = atob(base64Data);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
      const { error } = await _sb.storage.from('materiais').upload(path, blob, {
        cacheControl: '3600', upsert: false,
      });
      if (error) throw error;
      return path;
    },
    // URL assinada (default 1h) para exibir/enviar à IA
    async signMaterial(path, secs) {
      if (!path) return '';
      const { data, error } = await _sb.storage.from('materiais')
        .createSignedUrl(path, secs || 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    // Assina vários paths de uma vez → { path: url }
    async signMaterials(paths, secs) {
      const out = {};
      const clean = (paths || []).filter(Boolean);
      if (!clean.length) return out;
      const { data, error } = await _sb.storage.from('materiais')
        .createSignedUrls(clean, secs || 3600);
      if (error) throw error;
      (data || []).forEach(d => { if (d && d.signedUrl) out[d.path] = d.signedUrl; });
      return out;
    },
    async deleteMaterial(paths) {
      const arr = (Array.isArray(paths) ? paths : [paths]).filter(p => p && p.includes('/'));
      if (!arr.length) return;
      const { error } = await _sb.storage.from('materiais').remove(arr);
      if (error) throw error;
    },
  },

  // ──────────────────────────────────────────────────────────────
  //  Acervo — materiais (tabela conteudo_materiais)
  //  Requer migration sql/conteudo-acervo.sql
  materiais: {
    async list() {
      _guard();
      const { data, error } = await _sb
        .from('conteudo_materiais').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id:         r.id,
        titulo:     r.titulo      || '',
        origemTipo: r.origem_tipo || 'livre',
        origemRef:  r.origem_ref  || '',
        data:       r.data        || '',
        assets:     r.assets      || [],
        sugestoes:  r.sugestoes   || [],
        status:     r.status      || 'novo',
        createdAt:  r.created_at  || '',
      }));
    },
    async upsert(m) {
      _guard();
      const row = {
        id:          String(m.id),
        titulo:      m.titulo     || '',
        origem_tipo: m.origemTipo || 'livre',
        origem_ref:  m.origemRef  || '',
        data:        m.data       || null,
        assets:      Array.isArray(m.assets)    ? m.assets    : [],
        sugestoes:   Array.isArray(m.sugestoes) ? m.sugestoes : [],
        status:      m.status     || 'novo',
        created_at:  m.createdAt  || new Date().toISOString(),
      };
      const { error } = await _sb.from('conteudo_materiais').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },
    async delete(id) {
      _guard();
      const { error } = await _sb.from('conteudo_materiais').delete().eq('id', String(id));
      if (error) throw error;
    },
  },

  conteudo: {
    async list() {
      _guard();
      const { data, error } = await _sb
        .from('conteudo_ideas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => ({
        id:            r.id,
        title:         r.title         || '',
        categories:    r.categories    || [],
        formatos:      r.formatos      || [],
        status:        r.status        || 'Nao Iniciado',
        notes:         r.notes         || '',
        roteiro:       r.roteiro       || '',
        legenda:       r.legenda       || '',
        platforms:     r.platforms     || [],
        scheduledDate: r.scheduled_date || '',
        gravarDate:    r.gravar_date   || '',
        objetivo:      r.objetivo      || '',
        materialId:    r.material_id   || '',
        createdAt:     r.created_at    || '',
      }));
    },
    async upsert(idea) {
      _guard();
      const row = {
        id:             String(idea.id),
        title:          idea.title         || '',
        categories:     Array.isArray(idea.categories) ? idea.categories : [],
        formatos:       Array.isArray(idea.formatos)   ? idea.formatos   : [],
        status:         idea.status        || 'Nao Iniciado',
        notes:          idea.notes         || '',
        roteiro:        idea.roteiro       || '',
        legenda:        idea.legenda       || '',
        platforms:      Array.isArray(idea.platforms)  ? idea.platforms  : [],
        scheduled_date: idea.scheduledDate || null,
        gravar_date:    idea.gravarDate    || null,
        objetivo:       idea.objetivo      || null,
        material_id:    idea.materialId    || null,
        created_at:     idea.createdAt     || new Date().toISOString(),
      };
      const { error } = await _sb.from('conteudo_ideas').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },
    async delete(id) {
      _guard();
      const { error } = await _sb.from('conteudo_ideas').delete().eq('id', String(id));
      if (error) throw error;
    },
  },

  // ──────────────────────────────────────────────────────────────
  //  Stories — checklist diário (tabela conteudo_stories)
  //  Requer migration sql/conteudo-centro-comando.sql
  stories: {
    async list() {
      _guard();
      const { data, error } = await _sb
        .from('conteudo_stories').select('*')
        .order('date', { ascending: true })
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data.map(r => ({
        id:        r.id,
        date:      r.date       || '',
        texto:     r.texto      || '',
        ideaId:    r.idea_id    || '',
        done:      !!r.done,
        ordem:     r.ordem      || 0,
        createdAt: r.created_at || '',
      }));
    },
    async upsert(story) {
      _guard();
      const row = {
        id:         String(story.id),
        date:       story.date || null,
        texto:      story.texto || '',
        idea_id:    story.ideaId || null,
        done:       !!story.done,
        ordem:      story.ordem || 0,
        created_at: story.createdAt || new Date().toISOString(),
      };
      const { error } = await _sb.from('conteudo_stories').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },
    async delete(id) {
      _guard();
      const { error } = await _sb.from('conteudo_stories').delete().eq('id', String(id));
      if (error) throw error;
    },
  },

  // ──────────────────────────────────────────────────────────────
  //  Instagram Dashboard — Validações + estado singleton
  //  Sincroniza dados estratégicos do módulo Instagram entre devices.
  // ──────────────────────────────────────────────────────────────
  instagram: {
    // ── Validações do Validador de Post (histórico) ──
    validations: {
      async list() {
        _guard();
        const { data, error } = await _sb
          .from('instagram_validations')
          .select('*')
          .order('generated_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        return (data || []).map(r => ({
          id:          r.id,
          generatedAt: r.generated_at ? new Date(r.generated_at).getTime() : Date.now(),
          inputs:      r.inputs || {},
          result:      r.result || {},
          usage:       r.usage_json || null,
          revisions:   r.revisions || [],
          chat:        r.chat || [],
        }));
      },
      async upsert(v) {
        _guard();
        const base = {
          id:           String(v.id || Date.now()),
          generated_at: new Date(v.generatedAt || Date.now()).toISOString(),
          inputs:       v.inputs || {},
          result:       v.result || {},
          usage_json:   v.usage || null,
        };
        const row = { ...base, revisions: v.revisions || [], chat: v.chat || [] };
        let { error } = await _sb
          .from('instagram_validations')
          .upsert(row, { onConflict: 'id' });
        // Resiliência: se as colunas revisions/chat ainda não existem
        // (migration supabase-instagram-reavaliacao-chat.sql não rodada),
        // o Supabase devolve PGRST204. Refaz o upsert sem essas colunas
        // pra não quebrar o sync principal — reaval/chat ficam só locais.
        if (error && (error.code === 'PGRST204' || /revisions|chat|schema cache|column/i.test(error.message || ''))) {
          console.warn('[db] colunas revisions/chat ausentes — sync sem elas. Rode supabase-instagram-reavaliacao-chat.sql.');
          ({ error } = await _sb
            .from('instagram_validations')
            .upsert(base, { onConflict: 'id' }));
        }
        if (error) throw error;
      },
      async remove(id) {
        _guard();
        const { error } = await _sb
          .from('instagram_validations')
          .delete()
          .eq('id', String(id));
        if (error) throw error;
      },
      async clear() {
        _guard();
        const { error } = await _sb
          .from('instagram_validations')
          .delete()
          .neq('id', '__none__'); // delete all
        if (error) throw error;
      },
    },
    // ── Estado singleton (analysis, competitors, manual_inputs) ──
    async getState(key) {
      _guard();
      const { data, error } = await _sb
        .from('instagram_state')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return data ? data.value : null;
    },
    async setState(key, value) {
      _guard();
      const { error } = await _sb
        .from('instagram_state')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
    async removeState(key) {
      _guard();
      const { error } = await _sb
        .from('instagram_state')
        .delete()
        .eq('key', key);
      if (error) throw error;
    },
  },

  valoresServicos: {
    // Retorna mapa { nome: { valor, duracao } }
    async load() {
      _guard();
      const { data, error } = await _sb
        .from('valores_servicos')
        .select('nome, valor, duracao')
        .order('nome');
      if (error) throw error;
      const map = {};
      data.forEach(r => {
        map[r.nome] = {
          valor:   r.valor   != null ? Number(r.valor) : 0,
          duracao: r.duracao != null ? Number(r.duracao) : null,
        };
      });
      return map;
    },
    // Remove uma linha pelo nome
    async remove(nome) {
      _guard();
      if (!nome) return;
      const { error } = await _sb
        .from('valores_servicos')
        .delete()
        .eq('nome', String(nome).trim());
      if (error) throw error;
    },
    // Recebe array [{ nome, valor, duracao }] e faz upsert por nome
    async saveAll(rows) {
      _guard();
      const data = rows
        .filter(r => r.nome && String(r.nome).trim())
        .map(r => ({
          nome:       String(r.nome).trim(),
          valor:      parseFloat(r.valor) || 0,
          duracao:    r.duracao != null && r.duracao !== '' ? parseInt(r.duracao) : null,
          updated_at: new Date().toISOString(),
        }));
      if (!data.length) return;
      const { error } = await _sb
        .from('valores_servicos')
        .upsert(data, { onConflict: 'nome' });
      if (error) throw error;
    },
    // Substitui completamente: apaga linhas ausentes na nova lista, faz upsert do resto
    async replaceAll(rows) {
      _guard();
      await this.saveAll(rows);
      const keep = rows.map(r => String(r.nome).trim()).filter(Boolean);
      if (!keep.length) return;
      // Remove apenas as linhas que NÃO estão na lista
      const { error } = await _sb
        .from('valores_servicos')
        .delete()
        .not('nome', 'in', `(${keep.map(n => `"${n.replace(/"/g,'\\"')}"`).join(',')})`);
      if (error) console.warn('[valoresServicos.replaceAll] erro ao limpar:', error.message);
    },
  },

  estoque: {
    async list() {
      _guard();
      const { data, error } = await _sb.from('estoque').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => ({
        id: String(r.id), nome: r.nome || '', categoria: r.categoria || '',
        status: r.status || 'ok', obs: r.obs || '',
        valor: r.valor != null ? Number(r.valor) : 0,
        comprado: !!r.comprado,
        createdAt: r.created_at || '',
      }));
    },
    async upsert(item) {
      _guard();
      const row = {
        id: String(item.id || Date.now()), nome: item.nome || '',
        categoria: item.categoria || '', status: item.status || 'ok', obs: item.obs || '',
        valor: item.valor != null && item.valor !== '' ? parseFloat(item.valor) || 0 : 0,
      };
      // comprado só é incluído quando explicitamente definido (requer migration)
      if (item.comprado !== undefined) row.comprado = !!item.comprado;
      const { error } = await _sb.from('estoque').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return row.id;
    },
    async delete(id) {
      _guard();
      const { error } = await _sb.from('estoque').delete().eq('id', String(id));
      if (error) throw error;
    },
  },

  cadernos: {
    async list() {
      _guard();
      const { data, error } = await _sb
        .from('cadernos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => ({
        id: String(r.id), nome: r.nome || '',
        emoji: r.emoji || '📓', cor: r.cor || '#a36844',
        createdAt: r.created_at || '',
      }));
    },
    async upsert(c) {
      _guard();
      const row = {
        id: String(c.id || Date.now()), nome: c.nome || '',
        emoji: c.emoji || '📓', cor: c.cor || '#a36844',
      };
      const { error } = await _sb.from('cadernos').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return row.id;
    },
    async delete(id) {
      _guard();
      const { error } = await _sb.from('cadernos').delete().eq('id', String(id));
      if (error) throw error;
    },
  },

  anotacoes: {
    async listByCaderno(cadernoId) {
      _guard();
      const { data, error } = await _sb
        .from('anotacoes').select('*')
        .eq('caderno_id', String(cadernoId))
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data.map(r => ({
        id: String(r.id), cadernoId: String(r.caderno_id),
        titulo: r.titulo || '', conteudo: r.conteudo || '',
        tags: r.tags || [], imagens: r.imagens || [],
        createdAt: r.created_at || '', updatedAt: r.updated_at || '',
      }));
    },
    // Notas na lixeira (soft-deleted), mais recentes primeiro
    async listTrash() {
      _guard();
      const { data, error } = await _sb
        .from('anotacoes').select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data.map(r => ({
        id: String(r.id), cadernoId: String(r.caderno_id),
        titulo: r.titulo || '', conteudo: r.conteudo || '',
        tags: r.tags || [], imagens: r.imagens || [],
        createdAt: r.created_at || '', updatedAt: r.updated_at || '',
        deletedAt: r.deleted_at || '',
      }));
    },
    async upsert(nota) {
      _guard();
      const row = {
        id: String(nota.id || Date.now()),
        caderno_id: String(nota.cadernoId),
        titulo: nota.titulo || '', conteudo: nota.conteudo || '',
        tags: Array.isArray(nota.tags) ? nota.tags : [],
        imagens: Array.isArray(nota.imagens) ? nota.imagens : [],
        updated_at: new Date().toISOString(),
        created_at: nota.createdAt || new Date().toISOString(),
      };
      const { error } = await _sb.from('anotacoes').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return row.id;
    },
    // Manda pra lixeira (reversível)
    async softDelete(id) {
      _guard();
      const { error } = await _sb.from('anotacoes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', String(id));
      if (error) throw error;
    },
    // Restaura da lixeira
    async restore(id) {
      _guard();
      const { error } = await _sb.from('anotacoes')
        .update({ deleted_at: null })
        .eq('id', String(id));
      if (error) throw error;
    },
    // Exclusão permanente (esvaziar lixeira / excluir definitivamente)
    async delete(id) {
      _guard();
      const { error } = await _sb.from('anotacoes').delete().eq('id', String(id));
      if (error) throw error;
    },
  },

  tarefas: {
    async list() {
      _guard();
      const { data, error } = await _sb.from('tarefas').select('*').order('prazo', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data.map(r => ({
        id: String(r.id), titulo: r.titulo || '', prazo: r.prazo || '',
        prioridade: r.prioridade || 'normal', feita: !!r.feita, createdAt: r.created_at || '',
      }));
    },
    async upsert(t) {
      _guard();
      const row = {
        id: String(t.id || Date.now()), titulo: t.titulo || '',
        prazo: t.prazo || null, prioridade: t.prioridade || 'normal', feita: !!t.feita,
      };
      const { error } = await _sb.from('tarefas').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return row.id;
    },
    async delete(id) {
      _guard();
      const { error } = await _sb.from('tarefas').delete().eq('id', String(id));
      if (error) throw error;
    },
  },

  config: {
    async get(chave) {
      _guard();
      const { data, error } = await _sb
        .from('configuracoes')
        .select('valor')
        .eq('chave', chave)
        .maybeSingle();
      if (error) throw error;
      return data ? data.valor : null;
    },
    async set(chave, valor) {
      _guard();
      const { error } = await _sb
        .from('configuracoes')
        .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
    },
  },

  // ── Alertas: estado das ações do usuário (resolvido/adiado/ignorado) ──
  // Os alertas são DERIVADOS (recalculados pelo motor em shared/js/alerts.js).
  // Aqui só persiste a AÇÃO sobre cada alerta, por chave estável (cross-device).
  alertas: {
    async list() {
      _guard();
      const { data, error } = await _sb.from('alertas_estado').select('*');
      if (error) throw error;
      const map = {};
      (data || []).forEach(r => {
        map[r.alert_key] = {
          status:      r.status       || 'ativo',
          snoozeUntil: r.snooze_until || null,
          updatedAt:   r.updated_at   || '',
        };
      });
      return map;
    },
    async setStatus(key, status, snoozeUntil) {
      _guard();
      const row = {
        alert_key:    String(key),
        status:       status || 'ativo',
        snooze_until: snoozeUntil || null,
        updated_at:   new Date().toISOString(),
      };
      const { error } = await _sb.from('alertas_estado').upsert(row, { onConflict: 'alert_key' });
      if (error) throw error;
    },
    async remove(key) {
      _guard();
      const { error } = await _sb.from('alertas_estado').delete().eq('alert_key', String(key));
      if (error) throw error;
    },
  },

  auth: {
    // Retorna { id, usuario, nivel } se válido, null se inválido, lança erro se offline
    async login(usuario, senha) {
      _guard();
      const hash = await _sha256(senha);
      const { data, error } = await _sb.rpc('autenticar', {
        p_usuario:    usuario.toLowerCase().trim(),
        p_senha_hash: hash,
      });
      if (error) throw error;
      return (data && data.length > 0) ? data[0] : null;
    },
  },

  // ──────────────────────────────────────────────────────────────
  //  PESSOAL — sistema financeiro pessoal (isolado da empresa)
  //  Auth própria (usuarios_pessoal). Tabelas entradas_pessoal /
  //  saidas_pessoal. Sincronização empresa->pessoal via trigger.
  // ──────────────────────────────────────────────────────────────
  pessoal: {
    auth: {
      // Retorna { id, usuario } se válido, null se inválido
      async login(usuario, senha) {
        _guard();
        const hash = await _sha256(senha);
        const { data, error } = await _sb.rpc('autenticar_pessoal', {
          p_usuario:    usuario.toLowerCase().trim(),
          p_senha_hash: hash,
        });
        if (error) throw error;
        return (data && data.length > 0) ? data[0] : null;
      },
    },

    entradas: {
      async list() {
        _guard();
        const { data, error } = await _sb.from('entradas_pessoal').select('*').order('data', { ascending: false });
        if (error) throw error;
        return (data || []).map(_pessFromDb);
      },
      async upsert(e) {
        _guard();
        const row = _pessToDb(e);
        const { error } = await _sb.from('entradas_pessoal').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        return row.id;
      },
      async delete(id) {
        _guard();
        const { error } = await _sb.from('entradas_pessoal').delete().eq('id', String(id));
        if (error) throw error;
      },
      // Insere várias (importação) ignorando duplicatas por id
      async insertBatch(arr) {
        _guard();
        if (!arr || !arr.length) return 0;
        const rows = arr.map(_pessToDb);
        const { data, error } = await _sb.from('entradas_pessoal')
          .upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id');
        if (error) throw error;
        return (data || []).length;
      },
    },

    saidas: {
      async list() {
        _guard();
        const { data, error } = await _sb.from('saidas_pessoal').select('*').order('data', { ascending: false });
        if (error) throw error;
        return (data || []).map(_pessFromDb);
      },
      async upsert(s) {
        _guard();
        const row = _pessToDb(s);
        const { error } = await _sb.from('saidas_pessoal').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        return row.id;
      },
      async delete(id) {
        _guard();
        const { error } = await _sb.from('saidas_pessoal').delete().eq('id', String(id));
        if (error) throw error;
      },
      async insertBatch(arr) {
        _guard();
        if (!arr || !arr.length) return 0;
        const rows = arr.map(_pessToDb);
        const { data, error } = await _sb.from('saidas_pessoal')
          .upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id');
        if (error) throw error;
        return (data || []).length;
      },
    },
  },

  // ──────────────────────────────────────────────────────────────
  //  FISCAL — módulo tributário (Sprint 1+)
  //  Namespace isolado. Não compartilha estado com entries/saidas.
  //  Tabelas: fiscal_config (singleton), fiscal_das.
  // ──────────────────────────────────────────────────────────────
  fiscal: {
    config: {
      // Retorna { regime, tetoAnual, dataAbertura, cnpj, atividade } ou null se nunca configurou
      async get() {
        _guard();
        const { data, error } = await _sb
          .from('fiscal_config')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return {
          regime:       data.regime        || 'MEI',
          tetoAnual:    data.teto_anual    != null ? Number(data.teto_anual) : 81000,
          dataAbertura: data.data_abertura || '',
          cnpj:         data.cnpj          || '',
          atividade:    data.atividade     || '',
          updatedAt:    data.updated_at    || '',
        };
      },
      async save(cfg) {
        _guard();
        const row = {
          id:            'default',
          regime:        cfg.regime || 'MEI',
          teto_anual:    cfg.tetoAnual != null && cfg.tetoAnual !== '' ? parseFloat(cfg.tetoAnual) : 81000,
          data_abertura: cfg.dataAbertura || null,
          cnpj:          cfg.cnpj || null,
          atividade:     cfg.atividade || null,
          updated_at:    new Date().toISOString(),
        };
        const { error } = await _sb.from('fiscal_config').upsert(row, { onConflict: 'id' });
        if (error) throw error;
      },
    },

    das: {
      async list() {
        _guard();
        const { data, error } = await _sb
          .from('fiscal_das')
          .select('*')
          .order('competencia', { ascending: false });
        if (error) throw error;
        return (data || []).map(r => ({
          id:             String(r.id),
          competencia:    r.competencia     || '',
          valor:          r.valor           != null ? Number(r.valor) : 0,
          vencimento:     r.vencimento      || '',
          pago:           !!r.pago,
          dataPagamento:  r.data_pagamento  || '',
          comprovanteUrl: r.comprovante_url || '',
          observacao:     r.observacao      || '',
          createdAt:      r.created_at      || '',
        }));
      },
      async upsert(d) {
        _guard();
        const row = {
          id:              String(d.id || Date.now()),
          competencia:     d.competencia,
          valor:           d.valor != null && d.valor !== '' ? parseFloat(d.valor) : 0,
          vencimento:      d.vencimento,
          pago:            !!d.pago,
          data_pagamento:  d.dataPagamento  || null,
          comprovante_url: d.comprovanteUrl || null,
          observacao:      d.observacao     || null,
        };
        const { error } = await _sb.from('fiscal_das').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        return row.id;
      },
      async delete(id) {
        _guard();
        const { error } = await _sb.from('fiscal_das').delete().eq('id', String(id));
        if (error) throw error;
      },
    },

    transacoes: {
      async list(filtro) {
        _guard();
        let q = _sb.from('fiscal_transacoes_raw').select('*').order('data', { ascending: false });
        if (filtro && filtro.importacaoId) q = q.eq('importacao_id', filtro.importacaoId);
        if (filtro && filtro.status)       q = q.eq('status', filtro.status);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(_rawFromDb);
      },
      async insertBatch(arr) {
        _guard();
        if (!arr || !arr.length) return { inserted: 0, duplicates: 0 };
        const rows = arr.map(_rawToDb);
        // Para detectar duplicatas: tenta inserir e ignora conflitos via upsert + ignoreDuplicates
        const { data, error } = await _sb
          .from('fiscal_transacoes_raw')
          .upsert(rows, { onConflict: 'hash', ignoreDuplicates: true })
          .select('id');
        if (error) throw error;
        const inserted = (data || []).length;
        return { inserted, duplicates: rows.length - inserted };
      },
      async update(id, fields) {
        _guard();
        const row = _rawToDb({ id, ...fields });
        delete row.id;
        const { error } = await _sb.from('fiscal_transacoes_raw').update(row).eq('id', String(id));
        if (error) throw error;
      },
      async delete(id) {
        _guard();
        const { error } = await _sb.from('fiscal_transacoes_raw').delete().eq('id', String(id));
        if (error) throw error;
      },
    },

    despesas: {
      async list() {
        _guard();
        const { data, error } = await _sb
          .from('fiscal_despesas').select('*').order('data', { ascending: false });
        if (error) throw error;
        return (data || []).map(_despFromDb);
      },
      async upsert(d) {
        _guard();
        const row = _despToDb(d);
        const { error } = await _sb.from('fiscal_despesas').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        return row.id;
      },
      async delete(id) {
        _guard();
        const { error } = await _sb.from('fiscal_despesas').delete().eq('id', String(id));
        if (error) throw error;
      },
    },

    regras: {
      async list() {
        _guard();
        const { data, error } = await _sb
          .from('fiscal_regras').select('*').order('prioridade', { ascending: false });
        if (error) throw error;
        return (data || []).map(r => ({
          id: String(r.id), padrao: r.padrao || '',
          categoria: r.categoria || '', natureza: r.natureza || 'PROFISSIONAL',
          prioridade: r.prioridade || 0, origem: r.origem || 'manual',
          acertos: r.acertos || 0, erros: r.erros || 0,
          createdAt: r.created_at || '',
        }));
      },
      async upsert(r) {
        _guard();
        const row = {
          id: String(r.id || Date.now()),
          padrao: String(r.padrao || '').toLowerCase().trim(),
          categoria: r.categoria || '', natureza: r.natureza || 'PROFISSIONAL',
          prioridade: r.prioridade || 0, origem: r.origem || 'manual',
          acertos: r.acertos || 0, erros: r.erros || 0,
        };
        const { error } = await _sb.from('fiscal_regras').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        return row.id;
      },
      async delete(id) {
        _guard();
        const { error } = await _sb.from('fiscal_regras').delete().eq('id', String(id));
        if (error) throw error;
      },
    },

    // Sprint 4 — documentos fiscais por ano
    documentos: {
      async list(filtro) {
        _guard();
        let q = _sb.from('fiscal_documentos').select('*').order('uploaded_at', { ascending: false });
        if (filtro && filtro.ano)  q = q.eq('ano', filtro.ano);
        if (filtro && filtro.tipo) q = q.eq('tipo', filtro.tipo);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(_docFromDb);
      },
      async upsert(d) {
        _guard();
        const row = _docToDb(d);
        const { error } = await _sb.from('fiscal_documentos').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        return row.id;
      },
      async delete(id) {
        _guard();
        const { error } = await _sb.from('fiscal_documentos').delete().eq('id', String(id));
        if (error) throw error;
      },
    },

    // Sprint 4 fase 2 — checklist IR por ano
    // Formato items: { item_key: { status, nota } }
    //   status ∈ 'pendente' | 'em_progresso' | 'concluido'
    checklist: {
      async list() {
        _guard();
        const { data, error } = await _sb.from('fiscal_checklist').select('*');
        if (error) throw error;
        // Retorna map { 2025: {items}, 2026: {items} }
        const map = {};
        (data || []).forEach(r => { map[r.ano] = r.items || {}; });
        return map;
      },
      async save(ano, items) {
        _guard();
        const row = {
          ano: parseInt(ano),
          items: items || {},
          updated_at: new Date().toISOString(),
        };
        const { error } = await _sb.from('fiscal_checklist').upsert(row, { onConflict: 'ano' });
        if (error) throw error;
      },
    },
  },
};

// ── Mapeadores pessoal (entradas_pessoal / saidas_pessoal) ────────
function _pessFromDb(r) {
  return {
    id:            String(r.id),
    usuarioId:     r.usuario_id      || null,
    data:          r.data            || '',
    descricao:     r.descricao       || '',
    valor:         r.valor != null ? Number(r.valor) : 0,
    categoria:     r.categoria       || 'Outros',
    forma:         r.forma           || '',
    origem:        r.origem          || 'manual',
    saidaOrigemId: r.saida_origem_id || null,
    createdAt:     r.created_at       || '',
  };
}
function _pessToDb(e) {
  return {
    id:              String(e.id || Date.now()),
    usuario_id:      e.usuarioId || null,
    data:            e.data || null,
    descricao:       e.descricao || '',
    valor:           e.valor != null && e.valor !== '' ? parseFloat(e.valor) || 0 : 0,
    categoria:       e.categoria || 'Outros',
    forma:           e.forma || '',
    origem:          e.origem || 'manual',
    saida_origem_id: e.saidaOrigemId || null,
  };
}

// ── Mapeadores fiscal_documentos ──────────────────────────────────
function _docFromDb(r) {
  return {
    id:          String(r.id),
    tipo:        r.tipo         || 'OUTRO',
    ano:         r.ano          != null ? Number(r.ano) : null,
    mes:         r.mes          != null ? Number(r.mes) : null,
    descricao:   r.descricao    || '',
    arquivoUrl:  r.arquivo_url  || '',
    arquivoNome: r.arquivo_nome || '',
    valor:       r.valor        != null ? Number(r.valor) : null,
    emitente:    r.emitente     || '',
    uploadedAt:  r.uploaded_at  || '',
  };
}
function _docToDb(d) {
  return {
    id:           String(d.id || Date.now()),
    tipo:         d.tipo || 'OUTRO',
    ano:          d.ano != null && d.ano !== '' ? parseInt(d.ano) : null,
    mes:          d.mes != null && d.mes !== '' ? parseInt(d.mes) : null,
    descricao:    d.descricao    || null,
    arquivo_url:  d.arquivoUrl   || '',
    arquivo_nome: d.arquivoNome  || null,
    valor:        d.valor != null && d.valor !== '' ? parseFloat(d.valor) : null,
    emitente:     d.emitente     || null,
  };
}

// ── Mapeadores fiscal_transacoes_raw ──────────────────────────────
function _rawFromDb(r) {
  return {
    id: String(r.id),
    importacaoId: r.importacao_id || '',
    banco: r.banco || '', conta: r.conta || '',
    data: r.data || '',
    descricao: r.descricao || '',
    valor: r.valor != null ? Number(r.valor) : 0,
    tipoMov: r.tipo_mov || 'DEBITO',
    hash: r.hash || '',
    status: r.status || 'PENDENTE',
    categoriaSugerida: r.categoria_sugerida || '',
    naturezaSugerida: r.natureza_sugerida || 'PENDENTE',
    confiancaIa: r.confianca_ia != null ? Number(r.confianca_ia) : null,
    saidaId: r.saida_id || null,
    saidaExistenteId: r.saida_existente_id || null,
    despesaId: r.despesa_id || null,
    rawData: r.raw_data || null,
    createdAt: r.created_at || '',
  };
}
function _rawToDb(t) {
  const row = {
    id: String(t.id || Date.now()),
    importacao_id: t.importacaoId || null,
    banco: t.banco || null, conta: t.conta || null,
    data: t.data || null,
    descricao: t.descricao || '',
    valor: t.valor != null && t.valor !== '' ? parseFloat(t.valor) : 0,
    tipo_mov: t.tipoMov || 'DEBITO',
    hash: t.hash || null,
    status: t.status || 'PENDENTE',
    categoria_sugerida: t.categoriaSugerida || null,
    natureza_sugerida: t.naturezaSugerida || null,
    confianca_ia: t.confiancaIa != null ? parseFloat(t.confiancaIa) : null,
    saida_id: t.saidaId || null,
    saida_existente_id: t.saidaExistenteId || null,
    despesa_id: t.despesaId || null,
    raw_data: t.rawData || null,
  };
  return row;
}

// ── Mapeadores fiscal_despesas ────────────────────────────────────
function _despFromDb(r) {
  return {
    id: String(r.id),
    saidaId: r.saida_id || null,
    data: r.data || '',
    descricao: r.descricao || '',
    valor: r.valor != null ? Number(r.valor) : 0,
    categoria: r.categoria || '',
    natureza: r.natureza || 'PROFISSIONAL',
    dedutivel: !!r.dedutivel,
    origem: r.origem || 'manual',
    transacaoRawId: r.transacao_raw_id || null,
    comprovanteUrl: r.comprovante_url || '',
    obs: r.obs || '',
    createdAt: r.created_at || '',
  };
}
function _despToDb(d) {
  return {
    id: String(d.id || Date.now()),
    saida_id: d.saidaId || null,
    data: d.data || null,
    descricao: d.descricao || null,
    valor: d.valor != null && d.valor !== '' ? parseFloat(d.valor) : 0,
    categoria: d.categoria || null,
    natureza: d.natureza || 'PROFISSIONAL',
    dedutivel: !!d.dedutivel,
    origem: d.origem || 'manual',
    transacao_raw_id: d.transacaoRawId || null,
    comprovante_url: d.comprovanteUrl || null,
    obs: d.obs || null,
  };
}
