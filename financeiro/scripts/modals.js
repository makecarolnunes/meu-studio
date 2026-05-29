// ════════════════════════════════════════════════════════════
// financeiro/scripts/modals.js
// Modal de configurações (preços + Claude IA) + modais de edição
// ════════════════════════════════════════════════════════════

function openConfig() {
    document.getElementById('modal-bg').style.display = 'flex';
    renderConfigModal();
}
function closeModal() {
    document.getElementById('modal-bg').style.display = 'none';
}

// ── Service prices helpers ──
// Compõe o "nome" usado como chave única na tabela valores_servicos
// (mesmo padrão dos orçamentos: "Serviço no Studio" / "Serviço em domicílio")
function priceKey(servico, local) {
    if (!servico) return '';
    const suffix = local === 'Studio' ? 'no Studio' : 'em domicílio';
    return servico + ' ' + suffix;
}
function getServicePrices() {
    try { return JSON.parse(localStorage.getItem('mk_service_prices') || '{}'); } catch(e) { return {}; }
}
function _cacheServicePrices(prices) {
    localStorage.setItem('mk_service_prices', JSON.stringify(prices));
}
async function loadServicePricesFromSupabase() {
    try {
        const map = await DB.valoresServicos.load();
        const prices = {};
        Object.entries(map).forEach(([nome, v]) => { prices[nome] = v.valor; });
        _cacheServicePrices(prices);
        return prices;
    } catch(e) {
        console.warn('[preços] Supabase indisponível, usando cache local:', e.message);
        return getServicePrices();
    }
}

let _cfgTab = 'servicos';
function openConfigTab(tab) {
    _cfgTab = tab;
    renderConfigModal();
}

function renderConfigModal() {
    const hasKey = !!localStorage.getItem('mk_claude_key');
    const prices = getServicePrices();
    const SERVS = [
        {l:'Maquiagem', v:'Maquiagem'},
        {l:'Cabelo', v:'Cabelo'},
        {l:'Maq+Cabelo', v:'Maquiagem e Cabelo'},
        {l:'Curso Auto', v:'Curso de Automaquiagem'}
    ];
    const LOCS = ['Studio','Em Domicílio'];

    const pixCfg = getPixConfig();
    const tabPix = _cfgTab === 'pix' ? `
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px;line-height:1.5">
        Configure seus dados PIX para gerar QR Codes nas entradas Previstas.
        O QR é gerado no seu dispositivo a cada uso (não fica salvo).
    </div>
    <div class="fg">
        <label class="fl">Chave PIX</label>
        <input class="fi" type="text" id="cfg-pix-chave" placeholder="CPF, e-mail, telefone ou aleatória" value="${pixCfg.chave || ''}" autocomplete="off">
    </div>
    <div class="fg">
        <label class="fl">Nome do recebedor</label>
        <input class="fi" type="text" id="cfg-pix-nome" placeholder="Como aparece no extrato" value="${pixCfg.nome || ''}" maxlength="25" autocomplete="off">
        <div style="font-size:.7rem;color:var(--muted);margin-top:4px">Máximo 25 caracteres, sem acentos</div>
    </div>
    <div class="fg">
        <label class="fl">Cidade</label>
        <input class="fi" type="text" id="cfg-pix-cidade" placeholder="Ex: Rio de Janeiro" value="${pixCfg.cidade || ''}" maxlength="15" autocomplete="off">
    </div>
    <button class="bsub" onclick="savePixConfig()">Salvar PIX</button>
    ` : '';

    const tabServicos = _cfgTab === 'servicos' ? `
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px;line-height:1.5">Configure os valores padrão por serviço. Ao selecionar um serviço no formulário, o valor será preenchido automaticamente.</div>
    <table style="width:100%;border-collapse:collapse;font-size:.82rem">
        <thead><tr>
            <th style="text-align:left;padding:5px 4px;color:var(--muted);font-size:.67rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid var(--border)">Serviço</th>
            <th style="text-align:center;padding:5px 4px;color:var(--muted);font-size:.67rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid var(--border)">Studio</th>
            <th style="text-align:center;padding:5px 4px;color:var(--muted);font-size:.67rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid var(--border)">Domicílio</th>
        </tr></thead>
        <tbody>
        ${SERVS.map(s => `<tr>
            <td style="padding:7px 4px;font-weight:600;color:var(--text)">${s.l}</td>
            ${LOCS.map(loc => {
                const k = priceKey(s.v, loc);
                const inpId = 'sp_' + k.replace(/\s+/g,'_').replace(/[^A-Za-z0-9_]/g,'');
                const v = prices[k] || '';
                return `<td style="padding:7px 3px"><div style="position:relative"><span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:.8rem;font-weight:600;pointer-events:none">R$</span><input type="number" id="${inpId}" data-nome="${k}" value="${v}" placeholder="0" step="1" min="0" inputmode="decimal" style="width:100%;padding:7px 7px 7px 28px;border:1.5px solid var(--border);border-radius:10px;font-size:.88rem;font-weight:700;color:var(--text);background:white;-webkit-appearance:none;appearance:none;text-align:right;box-sizing:border-box"></div></td>`;
            }).join('')}
        </tr>`).join('')}
        </tbody>
    </table>
    <button class="bsub" style="margin-top:14px" onclick="saveServicePricesFromForm()">Salvar tabela de preços</button>
    ` : `
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px;line-height:1.5">Cole sua chave da API Claude (sk-ant-...) para habilitar o assistente de IA.</div>
    <input class="fi" type="password" id="cfg-claude-key" placeholder="${hasKey ? '••••••••••••' : 'Cole aqui sua sk-ant-key'}"
        style="margin-bottom:10px;font-size:.82rem">
    <button class="bsub" style="background:#555;box-shadow:none;margin-bottom:0" onclick="saveCfgKey()">Salvar chave</button>
    `;

    document.getElementById('modal-inner').innerHTML = `
    <div class="modal-title" style="margin-bottom:12px">Configurações</div>
    <div style="background:var(--brown-l);border-radius:9px;padding:8px 12px;font-size:.82rem;color:var(--brown-d);font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:7px">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--ok);flex-shrink:0;display:inline-block"></span>Supabase conectado
    </div>
    <button class="bsub" style="margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:8px" onclick="syncNow()">${SVG.refresh} Sincronizar agora</button>
    <div class="modal-tabs" style="margin-bottom:14px">
        <button class="modal-tab ${_cfgTab==='servicos'?'on':''}" onclick="openConfigTab('servicos')">Preços</button>
        <button class="modal-tab ${_cfgTab==='pix'?'on':''}" onclick="openConfigTab('pix')">PIX</button>
        <button class="modal-tab ${_cfgTab==='ia'?'on':''}" onclick="openConfigTab('ia')">Claude IA</button>
    </div>
    ${_cfgTab === 'pix' ? tabPix : tabServicos}
    <div style="height:12px"></div>
    <button class="skip" onclick="closeModal()">Fechar</button>
    <button class="logout-btn" style="display:flex;align-items:center;justify-content:center;gap:8px" onclick="doLogout()">${SVG.logout} Sair da conta</button>
    `;
}
async function saveServicePricesFromForm() {
    const prices = {};
    const rows = [];
    document.querySelectorAll('[id^="sp_"][data-nome]').forEach(el => {
        const nome = el.dataset.nome;
        const v = parseFloat(el.value);
        const valor = isNaN(v) ? 0 : v;
        prices[nome] = valor;
        rows.push({ nome, valor });
    });
    _cacheServicePrices(prices);
    closeModal();
    toast('Salvando preços...');
    try {
        await DB.valoresServicos.saveAll(rows);
        toast('Tabela de preços salva!');
    } catch(e) {
        console.error('[preços] Erro ao salvar no Supabase:', e);
        toast('Salvo localmente (Supabase offline)');
    }
}
function saveCfgKey() {
    const k = document.getElementById('cfg-claude-key').value.trim();
    if (!k) { toast('Cole a sk-ant-key no campo!'); return; }
    localStorage.setItem('mk_claude_key', k);
    DB.config.set('claude_api_key', k).catch(e => console.warn('[config] erro ao salvar no Supabase:', e));
    closeModal();
    toast('Chave Claude salva!');
}

// 6.G.2 · PIX config
function savePixConfig() {
    const chave  = document.getElementById('cfg-pix-chave').value.trim();
    const nome   = document.getElementById('cfg-pix-nome').value.trim();
    const cidade = document.getElementById('cfg-pix-cidade').value.trim();
    if (!chave) { toast('Informe sua chave PIX'); return; }
    if (!nome)  { toast('Informe o nome do recebedor'); return; }
    setPixConfig({ chave, nome, cidade: cidade || 'BRASIL' });
    toast('PIX salvo!');
    closeModal();
}

// 6.A.3 · Busca global — modal único pra entradas, saídas, noivas
let _gsQuery = '';
function openGlobalSearch() {
    _gsQuery = '';
    document.getElementById('modal-bg').style.display = 'flex';
    document.getElementById('modal-inner').innerHTML = `
    <div class="modal-title" style="margin-bottom:10px">Buscar</div>
    <input type="text" id="gs-input" class="fi" placeholder="Cliente, noiva, despesa, observação..." autocomplete="off"
        oninput="onGlobalSearchInput(this.value)" style="margin-bottom:14px;font-size:.95rem">
    <div id="gs-results">
        <div style="font-size:.78rem;color:var(--muted);text-align:center;padding:24px 8px;line-height:1.5">
            Digite ao menos 2 caracteres.<br>Busca em entradas, saídas e noivas.
        </div>
    </div>
    <button class="skip" style="margin-top:12px" onclick="closeModal()">Fechar</button>`;
    setTimeout(() => {
        const inp = document.getElementById('gs-input');
        if (inp) inp.focus();
    }, 60);
}

function onGlobalSearchInput(v) {
    _gsQuery = v;
    const el = document.getElementById('gs-results');
    if (!el) return;
    if (!v || v.trim().length < 2) {
        el.innerHTML = `<div style="font-size:.78rem;color:var(--muted);text-align:center;padding:24px 8px;line-height:1.5">Digite ao menos 2 caracteres.<br>Busca em entradas, saídas e noivas.</div>`;
        return;
    }
    const r = runGlobalSearch(v);
    if (r.total === 0) {
        el.innerHTML = `<div style="font-size:.78rem;color:var(--muted);text-align:center;padding:24px 8px">Nada encontrado para <strong>"${v}"</strong>.</div>`;
        return;
    }

    const section = (titulo, total, items) => items.length ? `
        <div style="margin-bottom:14px">
            <div style="font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between;align-items:baseline">
                <span>${titulo}</span>
                ${total > items.length ? `<span style="color:var(--brown);font-weight:600">+${total - items.length} a mais</span>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:5px">${items.join('')}</div>
        </div>` : '';

    const entryRow = e => `
        <button onclick="gsOpenEntry('${e.id}')" style="text-align:left;background:white;border:1px solid var(--border);border-radius:10px;padding:9px 11px;cursor:pointer;display:flex;align-items:center;gap:9px;font-family:inherit;color:var(--text)">
            <div style="flex:1;min-width:0">
                <div style="font-size:.85rem;font-weight:700">${e.cliente || '(sem nome)'}</div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${fmtDate(e.dataPag)} · ${e.tipo} · ${e.servico || e.origem || ''}</div>
            </div>
            <div style="font-weight:800;font-size:.85rem;color:${e.status === 'Realizado' ? 'var(--ok)' : 'var(--red)'}">${brl(e.valor)}</div>
        </button>`;

    const saidaRow = s => `
        <button onclick="gsOpenSaida('${s.id}')" style="text-align:left;background:white;border:1px solid var(--border);border-radius:10px;padding:9px 11px;cursor:pointer;display:flex;align-items:center;gap:9px;font-family:inherit;color:var(--text)">
            <div style="flex:1;min-width:0">
                <div style="font-size:.85rem;font-weight:700">${s.tipo}</div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${fmtDate(s.dataPag)} · ${s.forma}${s.obs ? ' · ' + s.obs.slice(0,30) : ''}</div>
            </div>
            <div style="font-weight:800;font-size:.85rem;color:var(--red)">${brl(s.valor)}</div>
        </button>`;

    const noivaRow = n => `
        <button onclick="gsOpenNoiva('${n.id}')" style="text-align:left;background:white;border:1px solid var(--border);border-radius:10px;padding:9px 11px;cursor:pointer;display:flex;align-items:center;gap:9px;font-family:inherit;color:var(--text)">
            <div style="flex:1;min-width:0">
                <div style="font-size:.85rem;font-weight:700">${n.nome}</div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${n.dataCasamento ? '👰 ' + fmtDate(n.dataCasamento) : 'Sem data'} · Contrato ${brl(n.valorContrato)}</div>
            </div>
        </button>`;

    el.innerHTML =
        section(`Entradas (${r.totalEntries})`, r.totalEntries, r.entries.map(entryRow)) +
        section(`Saídas (${r.totalSaidas})`,   r.totalSaidas,   r.saidas.map(saidaRow)) +
        section(`Noivas (${r.totalNoivas})`,    r.totalNoivas,   r.noivas.map(noivaRow));
}

function gsOpenEntry(id) {
    closeModal();
    setTimeout(() => openEditEntry(id), 50);
}
function gsOpenSaida(id) {
    closeModal();
    setTimeout(() => openEditSaida(id), 50);
}
function gsOpenNoiva(id) {
    closeModal();
    noivaDetail = id;
    go('noivas');
}

// 6.G.2 · Abre modal com QR Code da entrada
function openPixModal(entryId) {
    const e = entries.find(x => String(x.id) === String(entryId));
    if (!e) return;
    const cfg = getPixConfig();
    if (!cfg.chave) {
        if (confirm('Antes de gerar o QR, configure sua chave PIX. Abrir configurações agora?')) {
            _cfgTab = 'pix';
            openConfig();
        }
        return;
    }
    const valor = Number(e.valor) || 0;
    const txid  = String(e.id || '').replace(/[^A-Za-z0-9]/g,'').slice(0, 25) || '***';
    let payload;
    try {
        payload = buildPixPayload({
            chave: cfg.chave, nome: cfg.nome, cidade: cfg.cidade,
            valor, txid,
        });
    } catch(err) {
        toast('Erro ao gerar PIX: ' + err.message);
        return;
    }
    const qrUrl = pixQrUrl(payload, 280);
    document.getElementById('modal-bg').style.display='flex';
    document.getElementById('modal-inner').innerHTML = `
    <div class="modal-title" style="margin-bottom:8px">PIX · ${e.cliente || 'Cliente'}</div>
    <div style="text-align:center;font-size:1.6rem;font-weight:800;color:var(--brown);margin-bottom:4px">${brl(valor)}</div>
    <div style="text-align:center;color:var(--muted);font-size:.8rem;margin-bottom:14px">Para ${cfg.nome} · ${cfg.cidade || 'BRASIL'}</div>

    <div style="background:white;border:1.5px solid var(--border);border-radius:14px;padding:14px;display:flex;justify-content:center;align-items:center;min-height:280px">
        <img src="${qrUrl}" alt="QR Code PIX" width="280" height="280" style="display:block;max-width:100%;height:auto"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div style="display:none;color:var(--muted);font-size:.85rem;text-align:center">Não foi possível gerar o QR.<br>Use o código copia-cola abaixo.</div>
    </div>

    <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:14px 0 6px">PIX Copia e Cola</div>
    <textarea id="pix-payload" readonly style="width:100%;height:80px;font-family:monospace;font-size:.7rem;padding:8px;border:1.5px solid var(--border);border-radius:10px;resize:none;background:var(--surface-2,#f5efea);color:var(--text);word-break:break-all">${payload}</textarea>
    <button class="bsub" style="margin-top:10px" onclick="copyPixPayload()">📋 Copiar código</button>
    <button class="skip" style="margin-top:8px" onclick="closeModal()">Fechar</button>`;
}

function copyPixPayload() {
    const ta = document.getElementById('pix-payload');
    if (!ta) return;
    ta.select();
    try {
        navigator.clipboard.writeText(ta.value).then(() => toast('Código copiado!'));
    } catch(_) {
        document.execCommand('copy');
        toast('Código copiado!');
    }
}

// ── Seletor de botão em grupo (modais de edição/pagamento) ──
let _pick = {};
function edPick(varName, val, btn) {
    _pick[varName] = val;
    btn.closest('.bg').querySelectorAll('.bt').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
}
function edPickStatus(val, btn) {
    document.getElementById('ed-status').value = val;
    btn.closest('.stog').querySelectorAll('.stbtn').forEach(b=>{ b.className='stbtn'; });
    btn.className = 'stbtn ' + (val==='Realizado' ? 'on-g' : 'on-r');
}

// ── Editar Entrada ──
function openEditEntry(id) {
    const e = entries.find(x=>String(x.id)===String(id));
    if (!e) return;
    _pick = {};
    document.getElementById('modal-bg').style.display='flex';
    document.getElementById('modal-inner').innerHTML=`
    <div class="modal-title">Editar Entrada</div>
    <div class="two">
        <div class="fg"><label class="fl">Data Pgto</label><input class="fi" type="date" id="ee-dataPag" value="${e.dataPag||''}"></div>
        <div class="fg"><label class="fl">Data Serviço</label><input class="fi" type="date" id="ee-dataServ" value="${e.dataServ||''}"></div>
    </div>
    <div class="fg"><label class="fl">Cliente</label><input class="fi" type="text" id="ee-cliente" value="${e.cliente||''}" autocomplete="off"></div>
    <div class="fg"><label class="fl">Tipo</label><div class="bg" id="ee-tipo-grp">
        ${['Sinal','Parcela','Pagamento'].map(t=>`<button class="bt ${e.tipo===t?'on':''}" onclick="edPick('tipo','${t}',this)">${t}</button>`).join('')}
    </div></div>
    <div class="fg"><label class="fl">Valor (R$)</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="ee-valor" value="${e.valor||''}" step="0.01" min="0" inputmode="decimal"></div></div>
    <div class="fg"><label class="fl">Origem</label><div class="bg">
        ${['Produção Social','Noiva','Assistência',{l:'Curso Auto',v:'Curso de Automaquiagem'}].map(o=>{const v=typeof o==='string'?o:o.v,l=typeof o==='string'?o:o.l;return `<button class="bt ${e.origem===v?'on':''}" onclick="edPick('origem','${v}',this)">${l}</button>`;}).join('')}
    </div></div>
    <div class="fg"><label class="fl">Forma</label><div class="bg">
        ${['PIX','Crédito','Dinheiro'].map(f=>`<button class="bt ${e.forma===f?'on':''}" onclick="edPick('forma','${f}',this)">${f}</button>`).join('')}
    </div></div>
    <div class="fg"><label class="fl">Status</label>
        <div class="stog">
            <button class="stbtn ${e.status==='Realizado'?'on-g':''}" onclick="edPickStatus('Realizado',this)">Realizado</button>
            <button class="stbtn ${e.status==='Previsto'?'on-r':''}" onclick="edPickStatus('Previsto',this)">Previsto</button>
        </div>
        <input type="hidden" id="ed-status" value="${e.status||'Realizado'}">
    </div>
    <div class="fg"><label class="fl">Atendimento pela equipe <span style="color:var(--muted);font-size:.75rem">(opcional)</span></label><input class="fi" type="text" id="ee-equipe" value="${e.equipe||''}" placeholder="Ex: Julia" autocomplete="off"></div>
    <div class="fg"><label class="fl">Observações</label><textarea class="fi ta" id="ee-obs">${e.obs||''}</textarea></div>
    <button class="bsub" onclick="saveEditEntry('${id}')">Salvar</button>
    <button class="skip" onclick="closeModal()">Cancelar</button>`;
    _pick['tipo']   = e.tipo   || 'Pagamento';
    _pick['origem'] = e.origem || 'Produção Social';
    _pick['forma']  = e.forma  || 'PIX';
}
function saveEditEntry(id) {
    const e = entries.find(x=>String(x.id)===String(id));
    if (!e) return;
    const valor = document.getElementById('ee-valor').value;
    if (!valor||Number(valor)<=0) { toast('⚠️ Informe o valor!'); return; }
    const updated = { ...e,
        dataPag:  document.getElementById('ee-dataPag').value  || e.dataPag,
        dataServ: document.getElementById('ee-dataServ').value || e.dataServ,
        cliente:  document.getElementById('ee-cliente').value.trim() || e.cliente,
        tipo:   _pick['tipo']   || e.tipo,
        origem: _pick['origem'] || e.origem,
        forma:  _pick['forma']  || e.forma,
        status: document.getElementById('ed-status').value,
        valor:  String(valor),
        equipe: document.getElementById('ee-equipe').value.trim(),
        obs:    document.getElementById('ee-obs').value
    };
    const idx = entries.findIndex(x=>String(x.id)===String(id));
    entries[idx] = updated; cacheEntries();
    sbCall({action:'save', table:'entries', data:encodeURIComponent(JSON.stringify(updated))});
    if (updated.noivaId) recalcRestaNoiva(updated.noivaId);
    else if (updated.origem==='Noiva') recalcRestaNoiva(updated.cliente);
    closeModal(); render(); toast('Entrada atualizada!');
}

// ── Editar Saída ──
function openEditSaida(id) {
    const s = saidas.find(x=>String(x.id)===String(id));
    if (!s) return;
    _pick = {};
    document.getElementById('modal-bg').style.display='flex';
    const natAtual = s.natureza || 'PROFISSIONAL';
    const tiposProf = getTiposProfissionais();
    document.getElementById('modal-inner').innerHTML=`
    <div class="modal-title">Editar Saída</div>
    <div class="fg"><label class="fl">Natureza</label><div class="bg">
        <button class="bt ${natAtual==='PROFISSIONAL'?'on':''}" onclick="edPickNatureza('PROFISSIONAL',this)">Profissional</button>
        <button class="bt ${natAtual==='PESSOAL'?'on':''}" onclick="edPickNatureza('PESSOAL',this)">Pessoal</button>
        <button class="bt ${natAtual==='MISTA'?'on':''}" onclick="edPickNatureza('MISTA',this)">Mista</button>
    </div></div>
    <div class="fg"><label class="fl">Data</label><input class="fi" type="date" id="es-data" value="${s.dataPag||''}"></div>
    <div id="es-tipo-wrap" style="display:${natAtual==='PESSOAL'?'none':'block'}">
      <div class="fg"><label class="fl">Tipo de Despesa</label>
        <select class="fi" id="es-tipo-sel">
          ${tiposProf.map(t=>`<option value="${t}" ${s.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="fg"><label class="fl">Valor (R$)</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="es-valor" value="${s.valor||''}" step="0.01" min="0" inputmode="decimal"></div></div>
    <div class="fg"><label class="fl">Forma</label><div class="bg" style="flex-wrap:wrap">
        ${['PIX','Débito','Transferência','Crédito','Dinheiro'].map(f=>`<button class="bt ${s.forma===f?'on':''}" onclick="edPick('sforma','${f}',this)">${f}</button>`).join('')}
    </div></div>
    <div class="fg"><label class="fl">Status</label>
        <div class="stog">
            <button class="stbtn ${s.status==='Pago'?'on-g':''}" onclick="edPickStatus('Pago',this)">Pago</button>
            <button class="stbtn ${s.status==='Pendente'?'on-r':''}" onclick="edPickStatus('Pendente',this)">Pendente</button>
        </div>
        <input type="hidden" id="ed-status" value="${s.status||'Pago'}">
    </div>
    <div class="fg"><label class="fl">Observações</label><textarea class="fi ta" id="es-obs">${s.obs||''}</textarea></div>
    ${s.grupoId?`<div class="fg"><label class="fl">Editar</label><div class="bg">
        <button class="bt on" onclick="edPick('escopo','so-esta',this)">Só esta</button>
        <button class="bt" onclick="edPick('escopo','futuras',this)">Esta e futuras</button>
        <button class="bt" onclick="edPick('escopo','todas',this)">Todas</button>
    </div></div>`:''}
    <button class="bsub" onclick="saveEditSaida('${id}')">Salvar</button>
    <button class="skip" onclick="closeModal()">Cancelar</button>`;
    _pick['stipo']    = s.tipo  || '';
    _pick['sforma']   = s.forma || 'PIX';
    _pick['snatureza']= natAtual;
    if (s.grupoId) _pick['escopo'] = 'so-esta';
}

// Toggle natureza no modal de edição (esconde tipo se Pessoal)
function edPickNatureza(value, btn) {
    _pick['snatureza'] = value;
    if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.bt').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
    }
    const wrap = document.getElementById('es-tipo-wrap');
    if (wrap) wrap.style.display = value === 'PESSOAL' ? 'none' : 'block';
}
function saveEditSaida(id) {
    const s = saidas.find(x=>String(x.id)===String(id));
    if (!s) return;
    const valor = document.getElementById('es-valor').value;
    if (!valor||Number(valor)<=0) { toast('⚠️ Informe o valor!'); return; }
    const natChosen = _pick['snatureza'] || s.natureza || 'PROFISSIONAL';
    const tipoSel = document.getElementById('es-tipo-sel');
    const tipoChosen = natChosen === 'PESSOAL' ? 'Pessoal' : (tipoSel ? tipoSel.value : (_pick['stipo'] || s.tipo));
    const changes = {
        tipo:     tipoChosen,
        forma:    _pick['sforma'] || s.forma,
        status:   document.getElementById('ed-status').value,
        valor:    String(valor),
        obs:      document.getElementById('es-obs').value,
        natureza: natChosen,
    };
    const scope = s.grupoId ? (_pick['escopo'] || 'so-esta') : 'so-esta';
    let toEdit;
    if (scope === 'so-esta') {
        toEdit = [s];
    } else if (scope === 'futuras') {
        toEdit = saidas.filter(x=>x.grupoId===s.grupoId&&(x.dataPag||'')>=(s.dataPag||''));
    } else {
        toEdit = saidas.filter(x=>x.grupoId===s.grupoId);
    }
    toEdit.forEach(item => {
        const idx = saidas.findIndex(x=>String(x.id)===String(item.id));
        const updated = { ...item, ...changes };
        if (scope === 'so-esta') updated.dataPag = document.getElementById('es-data').value || item.dataPag;
        saidas[idx] = updated;
        sbCall({action:'save', table:'saidas', data:encodeURIComponent(JSON.stringify(updated))});
    });
    cacheSaidas(); closeModal(); render();
    toast(toEdit.length>1 ? `${toEdit.length} saídas atualizadas!` : 'Saída atualizada!');
}
