// ============================================================
// supabase-client.js — Cliente Supabase compartilhado
// Expõe window.DB com CRUD para entries, noivas, saidas, orcamentos
// e DB.auth.login() para autenticação via tabela usuarios
//
// COMO USAR NAS PÁGINAS:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="../config.js"></script>
//   <script src="../supabase-client.js"></script>   ← ajuste o caminho
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
  status: 'status', origem: 'origem', obs: 'obs',
  auto: 'auto', noivaId: 'noiva_id', createdAt: 'created_at',
};

const _NOIVA_KEYS = {
  nome: 'nome', dataCasamento: 'data_casamento',
  valorContrato: 'valor_contrato', obs: 'obs', createdAt: 'created_at',
};

const _SAIDA_KEYS = {
  dataPag: 'data_pag', tipo: 'tipo', valor: 'valor',
  forma: 'forma', status: 'status', obs: 'obs', createdAt: 'created_at',
};

const _ORC_KEYS = {
  Cliente: 'cliente', Telefone: 'telefone', Servico: 'servico', Status: 'status',
  DataPedido: 'data_pedido', DataEnvio: 'data_envio', DataFechamento: 'data_fechamento',
  DataEvento: 'data_evento', ValorProp: 'valor_prop', ValorFechado: 'valor_fechado',
  Origem: 'origem', Endereco: 'endereco', Obs: 'obs', ProxFollowup: 'prox_followup',
  AgendaCriada: 'agenda_criada', EnderecoEvento: 'endereco_evento', LocalTipo: 'local_tipo',
  SinalFech: 'sinal_fech', SaldoFech: 'saldo_fech', Comprovantes: 'comprovantes',
  DataCriacao: 'created_at',
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
    auto:       !!r.auto,
    noivaId:    r.noiva_id     || '',
    createdAt:  r.created_at   || '',
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
  };
}

// ── Saida ─────────────────────────────────────────────────────────────────────
function _saidaToDb(s)   { return _toDb(s, _SAIDA_KEYS, ['valor']); }
function _saidaFromDb(r) {
  return {
    id:        String(r.id),
    dataPag:   r.data_pag  || '',
    tipo:      r.tipo      || '',
    valor:     r.valor     != null ? String(r.valor) : '',
    forma:     r.forma     || '',
    status:    r.status    || '',
    obs:       r.obs       || '',
    createdAt: r.created_at || '',
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

  storage: {
    // Bucket "comprovantes" deve ser criado no Supabase Dashboard → Storage
    async uploadComprovante(orcaId, file, categoria, base64Data, mimeType) {
      const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const cat = categoria ? `[${categoria.toUpperCase()}]_` : '';
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
        status:        r.status        || 'Nao',
        notes:         r.notes         || '',
        platforms:     r.platforms     || [],
        scheduledDate: r.scheduled_date || '',
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
        status:         idea.status        || 'Nao',
        notes:          idea.notes         || '',
        platforms:      Array.isArray(idea.platforms)  ? idea.platforms  : [],
        scheduled_date: idea.scheduledDate || null,
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
};
