// ════════════════════════════════════════════════════════════
// financeiro/scripts/handlers.js
// CRUD entradas + saídas + form toggles + navegação mês + filtros + CSV
// ════════════════════════════════════════════════════════════

// ── TOGGLE / SYNC FORM ──
function pick(field, value, form) {
    syncF();
    if (form === 's') Fs[field] = value;
    else F[field] = value;
    if (field === 'tipo' || field === 'recorrencia') { render(); return; }
    // Auto-fill price when service or local changes
    if (!form && (field === 'servico' || field === 'local')) {
        const prices = getServicePrices();
        const k = priceKey(F.servico, F.local);
        const p = prices[k];
        if (p) {
            const vInput = document.getElementById('i-v');
            const vtInput = document.getElementById('i-vt');
            if (vInput && !vInput.value) { vInput.value = p; F.valor = String(p); }
            if (vtInput && !vtInput.value) { vtInput.value = p; F.valorTotal = String(p); }
        }
    }
    document.querySelectorAll(`[data-f="${field}"][data-form="${form||'e'}"]`).forEach(btn => {
        const on = btn.dataset.v === value;
        if (field === 'status') {
            btn.classList.remove('on-g','on-r');
            if (on) btn.classList.add(value==='Realizado'||value==='Pago' ? 'on-g' : 'on-r');
        } else {
            btn.classList.toggle('on', on);
        }
    });
}
function syncF() {
    const r = (id, obj, f) => { const el=document.getElementById(id); if(el) obj[f]=el.value; };
    r('i-dp',F,'dataPag'); r('i-ds',F,'dataServ'); r('i-cl',F,'cliente');
    r('i-v',F,'valor');    r('i-vt',F,'valorTotal'); r('i-ob',F,'obs'); r('i-eq',F,'equipe');
    r('si-dp',Fs,'dataPag'); r('si-v',Fs,'valor'); r('si-ob',Fs,'obs'); r('si-meses',Fs,'meses');
    const st = document.getElementById('si-tipo'); if(st) Fs.tipo = st.value;
}

// ── NAVEGAÇÃO MÊS / FILTROS ──
function chm(d) { selMonth+=d; if(selMonth<0){selMonth=11;selYear--;}if(selMonth>11){selMonth=0;selYear++;} render(); }
function setF(f) { listFilter=f; render(); }

// ── ACTIONS: ENTRADAS ──
async function saveEntry() {
    if (_savingEntry) return;
    _savingEntry = true;
    setTimeout(()=>{ _savingEntry = false; }, 600);

    syncF(); F.cliente = F.cliente.trim();
    if (!F.cliente)  { toast('⚠️ Informe o nome da cliente!'); return; }
    if (!F.dataPag)  { toast('⚠️ Informe a data!'); return; }
    if (!F.valor || Number(F.valor)<=0) { toast('⚠️ Informe um valor válido!'); return; }

    if (F.tipo === 'Sinal') {
        const sinal=Number(F.valor), total=Number(F.valorTotal);
        if (!F.valorTotal||total<=0) { toast('⚠️ Informe o valor total!'); return; }
        if (sinal>=total) { toast('⚠️ Sinal deve ser menor que o total!'); return; }
        const rest=total-sinal, datRest=F.dataServ||F.dataPag;
        const sinalId = genId();
        const e1={ id:sinalId, ...JSON.parse(JSON.stringify(F)), createdAt:new Date().toISOString() };
        const e2={ id:genId(), dataPag:datRest, dataServ:F.dataServ, cliente:F.cliente,
            tipo:'Pagamento', valor:rest.toFixed(2), valorTotal:'', servico:F.servico, local:F.local,
            forma:F.forma, status:'Previsto', origem:F.origem, obs:`Restante (sinal: ${brl(sinal)})`,
            equipe:F.equipe||'', auto:true, parentSinalId:sinalId, createdAt:new Date().toISOString() };
        entries.unshift(e2); entries.unshift(e1);
        cacheEntries(); render();
        toast(`Sinal + Previsto de ${brl(rest)} criados!`);
        sbCall({action:'save', table:'entries', data: encodeURIComponent(JSON.stringify(e1))});
        sbCall({action:'save', table:'entries', data: encodeURIComponent(JSON.stringify(e2))});
    } else {
        const entry={ id:genId(), ...JSON.parse(JSON.stringify(F)), createdAt:new Date().toISOString() };
        entries.unshift(entry); cacheEntries(); render();
        toast('Lançamento salvo!');
        sbCall({action:'save', table:'entries', data: encodeURIComponent(JSON.stringify(entry))});
    }
    const k={local:F.local, servico:F.servico, origem:F.origem, forma:F.forma};
    initF(); Object.assign(F, k);
    render();
}

async function delEntry(id) {
    const target = entries.find(e=>String(e.id)===String(id));
    const filhoPrev = target && target.tipo==='Sinal'
        ? entries.find(e => String(e.parentSinalId||'')===String(target.id))
        : null;
    const msg = filhoPrev
        ? 'Excluir este Sinal? O Previsto auto vinculado também será removido.'
        : 'Excluir este lançamento?';
    if (!confirm(msg)) return;
    const idsParaApagar = new Set([String(id)]);
    if (filhoPrev) idsParaApagar.add(String(filhoPrev.id));
    entries = entries.filter(e => !idsParaApagar.has(String(e.id)));
    cacheEntries();
    idsParaApagar.forEach(delId => sbCall({action:'delete', table:'entries', id: delId}));
    if (target?.noivaId) recalcRestaNoiva(target.noivaId);
    render(); toast(filhoPrev ? 'Sinal + Previsto excluídos' : 'Excluído');
}

async function toggleStatus(id) {
    const e = entries.find(e=>String(e.id)===String(id));
    if (!e) return;
    e.status = e.status==='Realizado' ? 'Previsto' : 'Realizado';
    cacheEntries(); render();
    toast(e.status==='Realizado' ? 'Marcado como Realizado!' : 'Marcado como Previsto');
    sbCall({action:'update', table:'entries', id, field:'status', value:e.status});
}

// ── ACTIONS: SAÍDAS ──
function toggleSaidasForm() { syncF(); saidasFormOpen=!saidasFormOpen; render(); }

async function saveSaida() {
    if (_savingSaida) return;
    _savingSaida = true;
    setTimeout(()=>{ _savingSaida = false; }, 600);
    syncF();
    if (!Fs.valor||Number(Fs.valor)<=0) { toast('⚠️ Informe o valor!'); return; }
    if (!Fs.dataPag) { toast('⚠️ Informe a data!'); return; }
    const rec = Fs.recorrencia || 'unica';
    const k = {tipo:Fs.tipo, forma:Fs.forma};
    if (rec === 'unica') {
        const saida = { id:genId(), dataPag:Fs.dataPag, tipo:Fs.tipo, valor:Fs.valor,
            forma:Fs.forma, status:Fs.status, obs:Fs.obs,
            recorrencia:'unica', grupoId:null, createdAt:new Date().toISOString() };
        saidas.unshift(saida); cacheSaidas();
        toast('Saída salva!');
        initFs(); Object.assign(Fs,k);
        saidasFormOpen=false; render();
        sbCall({action:'save', table:'saidas', data: encodeURIComponent(JSON.stringify(saida))});
    } else {
        const totalMeses = rec === 'fixa' ? 12 : Math.max(2, Number(Fs.meses)||2);
        const grupoId = genId();
        const novasSaidas = [];
        for (let i = 0; i < totalMeses; i++) {
            novasSaidas.push({ id:genId(), dataPag:addMonths(Fs.dataPag, i),
                tipo:Fs.tipo, valor:Fs.valor, forma:Fs.forma, status:Fs.status, obs:Fs.obs,
                recorrencia:rec, grupoId, createdAt:new Date().toISOString() });
        }
        [...novasSaidas].reverse().forEach(s=>saidas.unshift(s)); cacheSaidas();
        toast(rec==='fixa' ? `Saída fixa criada (12 meses)!` : `${totalMeses} parcelas criadas!`);
        initFs(); Object.assign(Fs,k);
        saidasFormOpen=false; render();
        novasSaidas.forEach(s=>sbCall({action:'save', table:'saidas', data: encodeURIComponent(JSON.stringify(s))}));
    }
}

async function delSaida(id) {
    const s = saidas.find(x=>String(x.id)===String(id));
    if (!s) return;
    if (s.grupoId) {
        _pendingDelSaidaId = id;
        document.getElementById('modal-bg').style.display='flex';
        document.getElementById('modal-inner').innerHTML=`
        <div class="modal-title">Excluir saída recorrente</div>
        <p style="color:var(--muted);font-size:.85rem;margin:0 0 16px">Esta saída faz parte de um grupo. O que deseja excluir?</p>
        <button class="bsub" style="margin-bottom:8px" onclick="execDelSaida('so-esta')">Só esta</button>
        <button class="bsub" style="background:var(--muted);margin-bottom:8px" onclick="execDelSaida('futuras')">Esta e as futuras</button>
        <button class="bsub red" style="margin-bottom:8px" onclick="execDelSaida('todas')">Todas do grupo</button>
        <button class="skip" onclick="closeModal()">Cancelar</button>`;
        return;
    }
    if (!confirm('Excluir?')) return;
    saidas=saidas.filter(x=>String(x.id)!==String(id));
    cacheSaidas(); render(); toast('Excluído');
    sbCall({action:'delete', table:'saidas', id});
}

function execDelSaida(scope) {
    const id = _pendingDelSaidaId;
    const s = saidas.find(x=>String(x.id)===String(id));
    if (!s) { closeModal(); return; }
    let ids;
    if (scope === 'so-esta') {
        ids = [String(id)];
    } else if (scope === 'futuras') {
        ids = saidas.filter(x=>x.grupoId===s.grupoId&&(x.dataPag||'')>=(s.dataPag||'')).map(x=>String(x.id));
    } else {
        ids = saidas.filter(x=>x.grupoId===s.grupoId).map(x=>String(x.id));
    }
    const idSet = new Set(ids);
    saidas = saidas.filter(x=>!idSet.has(String(x.id)));
    cacheSaidas(); closeModal(); render(); toast(`${idSet.size} saída(s) excluída(s)`);
    idSet.forEach(delId=>sbCall({action:'delete', table:'saidas', id:delId}));
}

async function toggleSaidaStatus(id) {
    const s=saidas.find(s=>s.id===id);
    if (!s) return;
    s.status=s.status==='Pago'?'Previsto':'Pago';
    cacheSaidas(); render();
    toast(s.status==='Pago'?'Marcado como Pago!':'Marcado como Previsto');
    sbCall({action:'update', table:'saidas', id, field:'status', value:s.status});
}

// ── CSV ──
function exportCSV() {
    const me=entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.m===selMonth&&my.y===selYear;});
    if(!me.length){toast('Nenhum dado para exportar!');return;}
    const h=['Data Pgto','Data Serv','Cliente','Tipo','Valor Sinal','Valor Total','Serviço','Local','Forma Pgto','Status','Origem','Obs'];
    const r=me.map(e=>[e.dataPag?e.dataPag.split('-').reverse().join('/'):'',e.dataServ?e.dataServ.split('-').reverse().join('/'):'',e.cliente,e.tipo,Number(e.valor||0).toFixed(2).replace('.',','),Number(e.valorTotal||0)>0?Number(e.valorTotal).toFixed(2).replace('.',','):'',e.servico,e.local,e.forma,e.status,e.origem,(e.obs||'').replace(/"/g,'""')]);
    dl([h,...r].map(row=>row.map(c=>`"${c}"`).join(';')).join('\n'),`entradas_${MONTHS[selMonth].toLowerCase()}_${selYear}.csv`);
    toast('CSV baixado!');
}
function exportSaidasCSV() {
    const ms=saidas.filter(s=>{const my=getMonthYear(s.dataPag);return my&&my.m===selMonth&&my.y===selYear;});
    if(!ms.length){toast('Nenhuma saída para exportar!');return;}
    const h=['Data','Valor','Tipo de Despesa','Status','Forma Pgto','Observações'];
    const r=ms.map(s=>[s.dataPag?s.dataPag.split('-').reverse().join('/'):'',Number(s.valor||0).toFixed(2).replace('.',','),s.tipo,s.status,s.forma,(s.obs||'').replace(/"/g,'""')]);
    dl([h,...r].map(row=>row.map(c=>`"${c}"`).join(';')).join('\n'),`saidas_${MONTHS[selMonth].toLowerCase()}_${selYear}.csv`);
    toast('CSV baixado!');
}
