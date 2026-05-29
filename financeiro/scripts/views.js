// ════════════════════════════════════════════════════════════
// financeiro/scripts/views.js
// Camada de apresentação: render router + screens (template literals)
// ════════════════════════════════════════════════════════════

function render() {
    const el = document.getElementById('content');
    if (screen==='nova')   el.innerHTML = renderNova();
    if (screen==='lista')  el.innerHTML = renderLista();
    if (screen==='saidas') el.innerHTML = renderSaidas();
    if (screen==='resumo') el.innerHTML = renderResumo();
    if (screen==='noivas') el.innerHTML = renderNoivas();
    bindAll();
}

function bindAll() {
    const on = (id, ev, fn) => { const e=document.getElementById(id); if(e) e.addEventListener(ev,fn); };
    on('i-dp','change',e=>F.dataPag=e.target.value);
    on('i-ds','change',e=>F.dataServ=e.target.value);
    on('i-cl','input', e=>F.cliente=e.target.value);
    on('i-v', 'input', e=>{F.valor=e.target.value; updateSinalPreview();});
    on('i-vt','input', e=>{
        F.valorTotal=e.target.value;
        const total = Number(e.target.value);
        if (total > 0 && F.tipo === 'Sinal') {
            const sinal30 = (total * 0.30).toFixed(2);
            const vInput = document.getElementById('i-v');
            if (vInput) { vInput.value = sinal30; F.valor = sinal30; }
        }
        updateSinalPreview();
    });
    on('i-ds','change',()=>updateSinalPreview());
    on('i-ob','input', e=>F.obs=e.target.value);
    on('i-eq','input', e=>F.equipe=e.target.value);
    on('si-dp','change',e=>Fs.dataPag=e.target.value);
    on('si-v','input', e=>Fs.valor=e.target.value);
    on('si-ob','input',e=>Fs.obs=e.target.value);
    on('si-tipo','change',e=>Fs.tipo=e.target.value);
    const ftabs = document.querySelector('.ftabs');
    if (ftabs) {
        ftabs.addEventListener('wheel', e => {
            if (e.deltaY !== 0) { e.preventDefault(); ftabs.scrollLeft += e.deltaY; }
        }, { passive: false });
    }
}

function bgroup(field, opts, form) {
    const frm = form||'e';
    return `<div class="bg">${opts.map(o => {
        const lbl=typeof o==='string'?o:o.l, val=typeof o==='string'?o:o.v;
        const cur=(frm==='s'?Fs:F)[field];
        return `<button class="bt ${cur===val?'on':''}" data-f="${field}" data-v="${val}" data-form="${frm}" onclick="pick('${field}','${val}','${frm}')">${lbl}</button>`;
    }).join('')}</div>`;
}

// ── SCREEN: NOVA ENTRADA ──
function renderNova() {
    return `
    <div class="card">
        <div class="fg">
            <label class="fl">Status</label>
            <div class="stog">
                <button class="stbtn ${F.status==='Realizado'?'on-g':''}" data-f="status" data-v="Realizado" data-form="e" onclick="pick('status','Realizado')">Realizado</button>
                <button class="stbtn ${F.status==='Previsto'?'on-r':''}"  data-f="status" data-v="Previsto"  data-form="e" onclick="pick('status','Previsto')">Previsto</button>
            </div>
        </div>
        <div class="two">
            <div class="fg"><label class="fl">Dt. Pagamento</label><input class="fi" type="date" id="i-dp" value="${F.dataPag}"></div>
            <div class="fg"><label class="fl">Dt. Serviço</label><input class="fi" type="date" id="i-ds" value="${F.dataServ}"></div>
        </div>
        <div class="fg"><label class="fl">Nome da Cliente</label><input class="fi" type="text" id="i-cl" placeholder="Ex: Maria Silva" value="${F.cliente}" autocomplete="off"></div>
        <div class="fg"><label class="fl">Tipo de Entrada</label>${bgroup('tipo',['Sinal','Pagamento','Parcela'])}</div>
        ${F.tipo==='Sinal' ? `
        <div class="fg"><label class="fl">Valor Total do Serviço</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="i-vt" placeholder="0,00" step="0.01" min="0" value="${F.valorTotal}" inputmode="decimal"></div></div>
        <div class="fg"><label class="fl">Valor do Sinal</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="i-v" placeholder="0,00" step="0.01" min="0" value="${F.valor}" inputmode="decimal"></div></div>
        <div class="sinal-box" id="sinal-box"></div>
        ` : `
        <div class="fg"><label class="fl">Valor</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="i-v" placeholder="0,00" step="0.01" min="0" value="${F.valor}" inputmode="decimal"></div></div>
        `}
    </div>
    <div class="card">
        <div class="fg"><label class="fl">Serviço</label>${bgroup('servico',[{l:'Maquiagem',v:'Maquiagem'},{l:'Cabelo',v:'Cabelo'},{l:'Maq+Cab',v:'Maquiagem e Cabelo'},{l:'Curso Auto',v:'Curso de Automaquiagem'}])}</div>
        <div class="fg"><label class="fl">Local</label>${bgroup('local',['Studio','Em Domicílio'])}</div>
        <div class="fg"><label class="fl">Forma de Pagamento</label>${bgroup('forma',['PIX','Crédito','Dinheiro'])}</div>
        <div class="fg"><label class="fl">Origem</label>${bgroup('origem',['Produção Social','Noiva','Assistência',{l:'Curso Auto',v:'Curso de Automaquiagem'}])}</div>
        <div class="fg">
            <label class="fl" style="display:flex;align-items:center;gap:8px;cursor:pointer;text-transform:none;font-size:.82rem;font-weight:600;letter-spacing:0">
                <input type="checkbox" id="i-eq-chk" ${F.equipe?'checked':''} style="width:16px;height:16px;accent-color:var(--brand);flex-shrink:0" onchange="toggleEquipeInput(this.checked)"> Atendimento realizado por equipe
            </label>
            <input class="fi" type="text" id="i-eq" placeholder="Nome da equipe ou assistente" value="${F.equipe||''}" autocomplete="off" style="${F.equipe?'margin-top:8px':'display:none'}">
        </div>
        <div class="fg"><label class="fl">Observações</label><textarea class="fi ta" id="i-ob" placeholder="Opcional...">${F.obs}</textarea></div>
    </div>
    <button class="bsub" onclick="saveEntry()">Salvar Lançamento</button>`;
}

function updateSinalPreview() {
    const box = document.getElementById('sinal-box');
    if (!box) return;
    const total = Number(document.getElementById('i-vt')?.value||0);
    const sinal = Number(document.getElementById('i-v')?.value||0);
    const ds    = document.getElementById('i-ds')?.value||'';
    const rest  = total - sinal;
    if (total>0 && sinal>0 && rest>0) {
        const d = ds ? ds.split('-').reverse().join('/') : '(data do serviço)';
        box.innerHTML = `Será criado automaticamente um <strong>Previsto</strong> de<span class="rv">${brl(rest)}</span>para ${d}`;
        box.style.display = 'block';
    } else box.style.display = 'none';
}

// ── SCREEN: LISTA ENTRADAS ──
function renderLista() {
    if (window.innerWidth >= 1024) return renderListaDesktop();
    let list = entries.filter(e => { const my=getMonthYear(e.dataPag); return my&&my.m===selMonth&&my.y===selYear; });
    if (listFilter!=='todos') list = list.filter(e=>e.status===listFilter||e.tipo===listFilter);
    if (listEquipeFilter==='__sem__') list = list.filter(e=>!e.equipe);
    else if (listEquipeFilter!=='todos') list = list.filter(e=>e.equipe===listEquipeFilter);
    list.sort((a,b)=>(b.dataPag||'').localeCompare(a.dataPag||''));
    const total = list.reduce((s,e)=>s+Number(e.valor||0),0);
    const filters = [{k:'todos',l:'Todos'},{k:'Realizado',l:'Realizado'},{k:'Previsto',l:'Previsto'},{k:'Sinal',l:'Sinal'},{k:'Pagamento',l:'Pagamento'},{k:'Parcela',l:'Parcela'}];
    const equipes = [...new Set(entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.m===selMonth&&my.y===selYear;}).map(e=>e.equipe).filter(Boolean))];
    const equipeFiltersHtml = equipes.length ? `<div class="ftabs" style="margin-top:5px">${[{k:'todos',l:'Todas'},{k:'__sem__',l:'Sem equipe'},...equipes.map(eq=>({k:eq,l:eq}))].map(f=>`<button class="ftab ${listEquipeFilter===f.k?'on':''}" onclick="setEquipeFilter('${f.k}')">${f.l}</button>`).join('')}</div>` : '';
    return `
    <div class="msel">
        <button class="mnbtn" onclick="chm(-1)">‹</button>
        <div class="mlab">${MONTHS[selMonth]} ${selYear}${list.length?`<div class="msub">${list.length} lançamento${list.length!==1?'s':''} · ${brl(total)}</div>`:''}</div>
        <button class="mnbtn" onclick="chm(1)">›</button>
    </div>
    <div class="ftabs">${filters.map(f=>`<button class="ftab ${listFilter===f.k?'on':''}" onclick="setF('${f.k}')">${f.l}</button>`).join('')}</div>
    ${equipeFiltersHtml}
    ${list.length===0?`<div class="empty"><div class="ico">${SVG.list}</div><p>Nenhuma entrada em<br><strong>${MONTHS[selMonth]} ${selYear}</strong></p></div>`
    :list.map(e=>{
        const s=entradaStyle(e.origem, e.tipo);
        const extra=e.valorTotal?` · ${brl(e.valorTotal)}`:'';
        const auto=e.auto?`<span style="font-size:.6rem;background:var(--amber-l);color:#7c4a00;border-radius:7px;padding:1px 5px;margin-left:4px">auto</span>`:'';
        const equipeTag=e.equipe?`<span style="background:#e0f7fa;color:#006064;border-radius:8px;padding:1px 7px;font-size:.68rem;margin-left:5px;font-weight:500">↑ ${e.equipe}</span>`:'';
        return `<div class="eitem">
            <div class="eico" style="background:${s.bg};color:${s.col}">${s.ico}</div>
            <div class="einf"><div class="ecli">${e.cliente||'(sem nome)'}${auto}</div>
                <div class="emta"><strong>${fmtDate(e.dataPag)}</strong> · ${e.tipo} · ${e.forma}${extra}</div>
                <div class="emta">${fmtOrigem(e.origem)}${equipeTag}</div></div>
            <div class="erig">
                <div class="eval" style="color:${e.status==='Realizado'?'var(--ok)':'var(--red)'}">${brl(e.valor)}</div>
                <span class="sbadge ${e.status==='Realizado'?'sb-g':'sb-r'}" onclick="toggleStatus('${e.id}')">${e.status==='Realizado'?'Realizado':'Previsto'}</span>
            </div>
            <button class="editbtn" onclick="openEditEntry('${e.id}')">${SVG.edit}</button>
            <button class="delbtn" onclick="delEntry('${e.id}')">${SVG.trash}</button>
        </div>`;
    }).join('')}`;
}

// ── DESKTOP: seleciona entrada no painel de detalhe ──
function selectEntry(id) {
    selectedEntryId = id;
    const e = entries.find(x => String(x.id) === String(id));
    if (e) _pick = { tipo: e.tipo||'Pagamento', origem: e.origem||'Produção Social', forma: e.forma||'PIX' };
    render();
}

// ── DESKTOP: painel de detalhe/edição inline ──
function renderEntryDetailPanel(e) {
    return `
    <div class="detail-hdr">
        <span class="detail-name">${e.cliente||'(sem nome)'}</span>
        <span class="sbadge ${e.status==='Realizado'?'sb-g':'sb-r'}">${e.status==='Realizado'?'Realizado':'Previsto'}</span>
    </div>
    <div class="fg"><label class="fl">Cliente</label><input class="fi" type="text" id="ee-cliente" value="${(e.cliente||'').replace(/"/g,'&quot;')}" autocomplete="off"></div>
    <div class="two">
        <div class="fg"><label class="fl">Dt. Pagamento</label><input class="fi" type="date" id="ee-dataPag" value="${e.dataPag||''}"></div>
        <div class="fg"><label class="fl">Dt. Serviço</label><input class="fi" type="date" id="ee-dataServ" value="${e.dataServ||''}"></div>
    </div>
    <div class="fg"><label class="fl">Valor (R$)</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="ee-valor" value="${e.valor||''}" step="0.01" min="0" inputmode="decimal"></div></div>
    <div class="fg"><label class="fl">Tipo</label><div class="bg">
        ${['Sinal','Parcela','Pagamento'].map(t=>`<button class="bt ${e.tipo===t?'on':''}" onclick="edPick('tipo','${t}',this)">${t}</button>`).join('')}
    </div></div>
    <div class="fg"><label class="fl">Forma</label><div class="bg">
        ${['PIX','Crédito','Dinheiro'].map(f=>`<button class="bt ${e.forma===f?'on':''}" onclick="edPick('forma','${f}',this)">${f}</button>`).join('')}
    </div></div>
    <div class="fg"><label class="fl">Origem</label><div class="bg" style="flex-wrap:wrap">
        ${['Produção Social','Noiva','Assistência',{l:'Curso Auto',v:'Curso de Automaquiagem'}].map(o=>{const v=typeof o==='string'?o:o.v,l=typeof o==='string'?o:o.l;return `<button class="bt ${e.origem===v?'on':''}" onclick="edPick('origem','${v}',this)">${l}</button>`;}).join('')}
    </div></div>
    <div class="fg"><label class="fl">Status</label>
        <div class="stog">
            <button class="stbtn ${e.status==='Realizado'?'on-g':''}" onclick="edPickStatus('Realizado',this)">Realizado</button>
            <button class="stbtn ${e.status==='Previsto'?'on-r':''}" onclick="edPickStatus('Previsto',this)">Previsto</button>
        </div>
        <input type="hidden" id="ed-status" value="${e.status||'Realizado'}">
    </div>
    <div class="fg"><label class="fl">Equipe <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted)">(opcional)</span></label><input class="fi" type="text" id="ee-equipe" value="${(e.equipe||'').replace(/"/g,'&quot;')}" placeholder="Ex: Julia" autocomplete="off"></div>
    <div class="fg"><label class="fl">Observações</label><textarea class="fi ta" id="ee-obs">${e.obs||''}</textarea></div>
    <div class="fg">
        <label class="fl">Comprovante de pagamento</label>
        ${e.comprovanteUrl
            ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:10px 12px;background:#f0f7ff;border-radius:10px;border:1px solid #c5deff">
                   <a href="${e.comprovanteUrl}" target="_blank" rel="noopener" style="flex:1;font-size:.82rem;color:#1565c0;font-weight:600;text-decoration:none">📎 Ver comprovante</a>
                   <button onclick="removeEntradaComprovante('${e.id}')" style="font-size:.72rem;background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 6px">🗑</button>
               </div>`
            : ''}
        <label style="display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 14px;background:var(--bg,#faf8f6);border:1.5px dashed var(--border,#e5ddd8);border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:600;color:var(--muted);transition:border-color .15s" onmouseover="this.style.borderColor='var(--brand,#8B6B61)'" onmouseout="this.style.borderColor='var(--border,#e5ddd8)'" onclick="document.getElementById('entrada-comp-inp').click()">
            📎 ${e.comprovanteUrl ? 'Trocar comprovante' : 'Anexar comprovante'}
            <span style="font-size:.7rem;opacity:.65">imagem ou PDF · máx 10 MB</span>
        </label>
        <input type="file" id="entrada-comp-inp" style="display:none" accept="image/*,application/pdf"
               onchange="uploadEntradaComprovante(event,'${e.id}')">
    </div>
    <div class="detail-actions">
        <button class="bsub" onclick="saveEditEntry('${e.id}')">Salvar alterações</button>
        <button class="delbtn" style="width:44px;height:44px;flex-shrink:0" onclick="delEntry('${e.id}')">${SVG.trash}</button>
    </div>`;
}

// ── DESKTOP: renderização master-detail da tela Lista ──
function renderListaDesktop() {
    let list = entries.filter(e => { const my=getMonthYear(e.dataPag); return my&&my.m===selMonth&&my.y===selYear; });
    if (listFilter!=='todos') list = list.filter(e=>e.status===listFilter||e.tipo===listFilter);
    if (listEquipeFilter==='__sem__') list = list.filter(e=>!e.equipe);
    else if (listEquipeFilter!=='todos') list = list.filter(e=>e.equipe===listEquipeFilter);
    list.sort((a,b)=>(b.dataPag||'').localeCompare(a.dataPag||''));
    const total    = list.reduce((s,e)=>s+Number(e.valor||0),0);
    const realized = list.filter(e=>e.status==='Realizado').reduce((s,e)=>s+Number(e.valor||0),0);
    const previsto = list.filter(e=>e.status==='Previsto').reduce((s,e)=>s+Number(e.valor||0),0);
    const cntReal  = list.filter(e=>e.status==='Realizado').length;
    const cntPrev  = list.filter(e=>e.status==='Previsto').length;
    const filters  = [{k:'todos',l:'Todos'},{k:'Realizado',l:'Realizado'},{k:'Previsto',l:'Previsto'},{k:'Sinal',l:'Sinal'},{k:'Pagamento',l:'Pagamento'},{k:'Parcela',l:'Parcela'}];
    const equipesD = [...new Set(entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.m===selMonth&&my.y===selYear;}).map(e=>e.equipe).filter(Boolean))];
    const equipeToolbar = equipesD.length ? `<div class="ftabs" style="margin-top:5px">${[{k:'todos',l:'Todas'},{k:'__sem__',l:'Sem equipe'},...equipesD.map(eq=>({k:eq,l:eq}))].map(f=>`<button class="ftab ${listEquipeFilter===f.k?'on':''}" onclick="setEquipeFilter('${f.k}')">${f.l}</button>`).join('')}</div>` : '';

    // Limpa seleção se a entrada foi deletada
    if (selectedEntryId && !entries.find(x=>String(x.id)===String(selectedEntryId))) selectedEntryId = null;
    const selEntry = selectedEntryId ? entries.find(x=>String(x.id)===String(selectedEntryId)) : null;

    return `
    <div class="month-hero">
        <div class="month-nav-d">
            <button class="mnbtn" onclick="chm(-1)">‹</button>
            <span class="mlab-d">${MONTHS[selMonth].toUpperCase()} · ${selYear}</span>
            <button class="mnbtn" onclick="chm(1)">›</button>
        </div>
        <div class="stat-row-d">
            <div class="stat-block-d">
                <div class="stat-value-d" style="color:var(--ok)">${brl(total)}</div>
                <div class="stat-label-d">Total faturado no mês</div>
                <div class="stat-sub-d"><strong>${brl(realized)}</strong> realizado · <strong>${brl(previsto)}</strong> previsto</div>
            </div>
            <div class="stat-block-d">
                <div class="stat-value-d">${list.length} lançamento${list.length!==1?'s':''}</div>
                <div class="stat-label-d">Movimentações no mês</div>
                <div class="stat-sub-d"><strong>${cntReal}</strong> realizados · <strong>${cntPrev}</strong> previstos</div>
            </div>
        </div>
    </div>
    <div class="d-toolbar">
        <div>
            <div class="ftabs">${filters.map(f=>`<button class="ftab ${listFilter===f.k?'on':''}" onclick="setF('${f.k}')">${f.l}</button>`).join('')}</div>
            ${equipeToolbar}
        </div>
        <button class="d-btn-add" onclick="go('nova')">${SVG.money} Nova entrada</button>
    </div>
    <div class="lista-split">
        <div class="list-col-d">
            ${list.length===0
                ?`<div class="empty" style="padding:32px 16px"><div class="ico">${SVG.list}</div><p>Nenhuma entrada em<br><strong>${MONTHS[selMonth]} ${selYear}</strong></p></div>`
                :list.map(e=>{
                    const s=entradaStyle(e.origem, e.tipo);
                    const isSel=String(e.id)===String(selectedEntryId);
                    const auto=e.auto?`<span class="auto-tag">auto</span>`:'';
                    const equipe=e.equipe?`<span class="equipe-tag">↑ ${e.equipe}</span>`:'';
                    return `<div class="entry-row${isSel?' selected':''}" onclick="selectEntry('${e.id}')">
                        <div class="entry-ico" style="background:${s.bg};color:${s.col}">${s.ico}</div>
                        <div class="entry-inf">
                            <div class="entry-cli">${e.cliente||'(sem nome)'}${auto}</div>
                            <div class="entry-meta"><strong>${fmtDate(e.dataPag)}</strong> · ${e.tipo} · ${e.forma}</div>
                            <div class="entry-meta">${fmtOrigem(e.origem)}${equipe}</div>
                        </div>
                        <div class="entry-right">
                            <div class="entry-val" style="color:${e.status==='Realizado'?'var(--ok)':'var(--red)'}">${brl(e.valor)}</div>
                            <span class="sbadge ${e.status==='Realizado'?'sb-g':'sb-r'}" onclick="event.stopPropagation();toggleStatus('${e.id}')">${e.status==='Realizado'?'Realizado':'Previsto'}</span>
                        </div>
                    </div>`;
                }).join('')}
        </div>
        <div class="detail-col-d">
            ${selEntry
                ? renderEntryDetailPanel(selEntry)
                :`<div class="detail-empty">
                    <div class="ico">${SVG.list}</div>
                    <p>Selecione uma entrada<br>para ver e editar os detalhes</p>
                </div>`}
        </div>
    </div>`;
}

// ── SCREEN: SAÍDAS ──
function renderSaidas() {
    const monthList = saidas.filter(s=>{const my=getMonthYear(s.dataPag);return my&&my.m===selMonth&&my.y===selYear;});
    const list = monthList
        .filter(s=> saidasNaturezaFilter==='todas' || (s.natureza||'PROFISSIONAL')===saidasNaturezaFilter)
        .filter(s=> saidasTipoFilter==='todas' || s.tipo===saidasTipoFilter)
        .sort((a,b)=>(b.dataPag||'').localeCompare(a.dataPag||''));
    const totPago = list.filter(s=>s.status==='Pago').reduce((t,s)=>t+Number(s.valor||0),0);
    const totPrev = list.filter(s=>s.status==='Previsto').reduce((t,s)=>t+Number(s.valor||0),0);

    // Contagens p/ pills de filtro
    const cntProf = monthList.filter(s=>(s.natureza||'PROFISSIONAL')==='PROFISSIONAL').length;
    const cntPess = monthList.filter(s=>s.natureza==='PESSOAL').length;
    const cntMista= monthList.filter(s=>s.natureza==='MISTA').length;

    const natFs = Fs.natureza || 'PROFISSIONAL';
    const tiposProf = getTiposProfissionais();

    return `
    <div class="msel">
        <button class="mnbtn" onclick="chm(-1)">‹</button>
        <div class="mlab">${MONTHS[selMonth]} ${selYear}${list.length?`<div class="msub">${list.length} saída${list.length!==1?'s':''} · ${brl(totPago+totPrev)}</div>`:''}</div>
        <button class="mnbtn" onclick="chm(1)">›</button>
    </div>

    <div class="natfilter" style="display:flex;gap:6px;margin:0 0 6px;flex-wrap:wrap">
        <button class="bt ${saidasNaturezaFilter==='todas'?'on':''}" onclick="setSaidaNatureza('todas')" style="font-size:.78rem">Todas (${monthList.length})</button>
        <button class="bt ${saidasNaturezaFilter==='PROFISSIONAL'?'on':''}" onclick="setSaidaNatureza('PROFISSIONAL')" style="font-size:.78rem">Profissional (${cntProf})</button>
        <button class="bt ${saidasNaturezaFilter==='PESSOAL'?'on':''}" onclick="setSaidaNatureza('PESSOAL')" style="font-size:.78rem">Pessoal (${cntPess})</button>
        ${cntMista>0?`<button class="bt ${saidasNaturezaFilter==='MISTA'?'on':''}" onclick="setSaidaNatureza('MISTA')" style="font-size:.78rem">Mista (${cntMista})</button>`:''}
    </div>

    ${(()=>{ const tipos=[...new Set(monthList.filter(s=>saidasNaturezaFilter==='todas'||(s.natureza||'PROFISSIONAL')===saidasNaturezaFilter).map(s=>s.tipo).filter(Boolean))].sort(); return tipos.length>1?`<div style="margin-bottom:8px"><select class="fi" style="font-size:.82rem;padding:7px 10px" onchange="setSaidaTipoFilter(this.value)"><option value="todas">Todos os tipos</option>${tipos.map(t=>`<option value="${t}" ${saidasTipoFilter===t?'selected':''}>${t}</option>`).join('')}</select></div>`:''; })()}
    ${saidasTipoFilter !== 'todas' ? `<button class="bt ${saidasVerTodosMeses?'on':''}" onclick="toggleSaidasTodosMeses()" style="font-size:.78rem;margin-bottom:8px;width:100%;text-align:left">📅 ${saidasVerTodosMeses ? '✕ Voltar ao mês atual' : 'Ver em todos os meses'}</button>` : ''}

    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <button class="add-btn ${saidasFormOpen?'open':''}" style="flex:1;min-width:0" onclick="toggleSaidasForm()">${saidasFormOpen?'✕ Fechar':'＋ Nova Saída'}</button>
        <button class="add-btn" style="flex:1;min-width:0;background:var(--brown-soft);color:var(--brown);border:1px solid var(--brown)" onclick="fsImportAbrir()">📥 Importar extrato</button>
    </div>
    ${saidasFormOpen?`
    <div class="card">
        <div class="fg"><label class="fl">Natureza</label><div class="bg">
            <button class="bt ${natFs==='PROFISSIONAL'?'on':''}" onclick="pickSaidaNatureza('PROFISSIONAL')">Profissional</button>
            <button class="bt ${natFs==='PESSOAL'?'on':''}" onclick="pickSaidaNatureza('PESSOAL')">Pessoal</button>
            <button class="bt ${natFs==='MISTA'?'on':''}" onclick="pickSaidaNatureza('MISTA')">Mista</button>
        </div></div>
        <div class="two">
            <div class="fg"><label class="fl">Data</label><input class="fi" type="date" id="si-dp" value="${Fs.dataPag}"></div>
            <div class="fg"><label class="fl">Valor</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="si-v" placeholder="0,00" step="0.01" min="0" value="${Fs.valor}" inputmode="decimal"></div></div>
        </div>
        ${natFs!=='PESSOAL'?`<div class="fg"><label class="fl">Tipo de Despesa</label><select class="fi" id="si-tipo">${tiposProf.map(t=>`<option value="${t}" ${Fs.tipo===t?'selected':''}>${t}</option>`).join('')}</select></div>`:''}
        <div class="fg"><label class="fl">Status</label><div class="stog">
            <button class="stbtn ${Fs.status==='Pago'?'on-g':''}"    data-f="status" data-v="Pago"    data-form="s" onclick="pick('status','Pago','s')">Pago</button>
            <button class="stbtn ${Fs.status==='Previsto'?'on-r':''}" data-f="status" data-v="Previsto" data-form="s" onclick="pick('status','Previsto','s')">Previsto</button>
        </div></div>
        <div class="fg"><label class="fl">Forma de Pagamento</label><div class="bg" style="flex-wrap:wrap">${['PIX','Débito','Transferência','Crédito','Dinheiro'].map(f=>`<button class="bt ${Fs.forma===f?'on':''}" data-f="forma" data-v="${f}" data-form="s" onclick="pick('forma','${f}','s')">${f}</button>`).join('')}</div></div>
        <div class="fg"><label class="fl">Observações</label><textarea class="fi ta" id="si-ob" placeholder="Detalhe...">${Fs.obs}</textarea></div>
        <div class="fg"><label class="fl">Recorrência</label><div class="bg" style="flex-wrap:wrap">
            <button class="bt ${Fs.recorrencia==='unica'?'on':''}" data-f="recorrencia" data-v="unica" data-form="s" onclick="pick('recorrencia','unica','s')">Única</button>
            <button class="bt ${Fs.recorrencia==='fixa'?'on':''}" data-f="recorrencia" data-v="fixa" data-form="s" onclick="pick('recorrencia','fixa','s')">Fixa · 12 meses</button>
            <button class="bt ${Fs.recorrencia==='recorrente'?'on':''}" data-f="recorrencia" data-v="recorrente" data-form="s" onclick="pick('recorrencia','recorrente','s')">Recorrente</button>
        </div></div>
        ${Fs.recorrencia==='recorrente'?`<div class="fg"><label class="fl">Quantos meses?</label><div class="vwrap"><span class="vpfx">#</span><input class="fi" type="number" id="si-meses" min="2" max="60" value="${Fs.meses||2}" inputmode="numeric"></div></div>`:''}
        <button class="bsub red" onclick="saveSaida()">Salvar Saída</button>
    </div>`:''}
    ${(()=>{
      if (saidasVerTodosMeses && saidasTipoFilter !== 'todas') return renderSaidasHistorico();
      if (!list.length) return `<div class="empty"><div class="ico">${SVG.upload}</div><p>Nenhuma saída em<br><strong>${MONTHS[selMonth]} ${selYear}</strong></p></div>`;
      const items = list.map(s => saidaItemHtml(s)).join('');
      return items + `<button class="bexp" onclick="exportSaidasCSV()" style="display:flex;align-items:center;justify-content:center;gap:7px">${SVG.download} Exportar CSV</button>`;
    })()}`;
}

function saidaItemHtml(s) {
    const st=saidaStyle(s.tipo);
    const nat = s.natureza || 'PROFISSIONAL';
    const natBadge = nat==='PESSOAL'
        ? `<span class="natchip natchip-pess">Pessoal</span>`
        : nat==='MISTA'
            ? `<span class="natchip natchip-mista">Mista</span>`
            : `<span class="natchip natchip-prof">Profissional</span>`;
    const creditTag = s.forma === 'Crédito'
        ? `<span style="font-size:.65rem;background:#e3f2fd;color:#0d47a1;border-radius:7px;padding:1px 6px;margin-left:4px">💳</span>`
        : '';
    return `<div class="eitem">
        <div class="eico" style="background:${st.bg};color:${st.col}">${st.ico}</div>
        <div class="einf"><div class="ecli">${s.tipo}${natBadge}${creditTag}</div>
            <div class="emta">${fmtDate(s.dataPag)} · ${s.forma}${s.grupoId?` · ${s.recorrencia==='fixa'?'↺ Fixa':'↺ Recorrente'}`:''}
            </div>
            ${s.obs?`<div class="emta">${s.obs}</div>`:''}
        </div>
        <div class="erig">
            <div class="eval" style="color:${s.status==='Pago'?'var(--red)':'var(--muted)'}">${brl(s.valor)}</div>
            <span class="sbadge ${s.status==='Pago'?'sb-r':'sb-b'}" onclick="toggleSaidaStatus('${s.id}')">${s.status==='Pago'?'Pago':'Previsto'}</span>
        </div>
        <button class="editbtn" onclick="openEditSaida('${s.id}')">${SVG.edit}</button>
        <button class="delbtn" onclick="delSaida('${s.id}')">${SVG.trash}</button>
    </div>`;
}

function renderSaidasHistorico() {
    const filtradas = saidas
        .filter(s => saidasTipoFilter === 'todas' || s.tipo === saidasTipoFilter)
        .filter(s => saidasNaturezaFilter === 'todas' || (s.natureza || 'PROFISSIONAL') === saidasNaturezaFilter)
        .sort((a,b) => (b.dataPag||'').localeCompare(a.dataPag||''));
    if (!filtradas.length) return `<div class="empty"><div class="ico">${SVG.upload}</div><p>Nenhuma saída de <strong>${saidasTipoFilter}</strong></p></div>`;
    const total = filtradas.reduce((t,s) => t + Number(s.valor||0), 0);
    const byMonth = {};
    filtradas.forEach(s => {
        const key = s.dataPag ? s.dataPag.slice(0,7) : 'sem-data';
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(s);
    });
    const monthKeys = Object.keys(byMonth).sort().reverse();
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;background:var(--brown-soft,#faf3ee);border-radius:10px;padding:10px 13px;margin-bottom:10px">
        <span style="font-size:.8rem;color:var(--muted)">${filtradas.length} saída${filtradas.length!==1?'s':''} · todos os meses</span>
        <span style="font-weight:700;color:var(--red)">${brl(total)}</span>
    </div>
    ${monthKeys.map(key => {
        const items = byMonth[key];
        const [yr, mo] = key !== 'sem-data' ? key.split('-') : ['',''];
        const header = key === 'sem-data' ? 'Sem data' : `${MONTHS[parseInt(mo)-1]} ${yr}`;
        const monthTotal = items.reduce((t,s) => t + Number(s.valor||0), 0);
        return `<div style="padding:6px 2px 2px;font-size:.72rem;font-weight:700;color:var(--brown);text-transform:uppercase;letter-spacing:.05em;display:flex;justify-content:space-between;border-bottom:1px solid #f0ebe6;margin-bottom:4px">
            <span>${header}</span><span>${brl(monthTotal)}</span>
        </div>
        ${items.map(s => saidaItemHtml(s)).join('')}`;
    }).join('')}
    <button class="bexp" onclick="exportSaidasHistoricoCSV()" style="display:flex;align-items:center;justify-content:center;gap:7px;margin-top:8px">${SVG.download} Exportar CSV</button>`;
}

// ── SCREEN: RESUMO ──
function renderResumo() {
    // Resolve range a partir do filtro de período
    const range = resumoRange();
    const ini = range.ini, fim = range.fim, tituloPeriodo = range.titulo;
    const yearMin = ini.getFullYear(), yearMax = fim.getFullYear();
    const anoVisaoAnual = yearMin === yearMax ? yearMin : yearMax;

    // ── Filtra entradas/saidas pelo range ──
    const me = entries.filter(e => inResumoRange(e.dataPag, ini, fim));
    const msAll = saidas.filter(s => inResumoRange(s.dataPag, ini, fim));
    const ms = msAll.filter(s => saidasNaturezaFilter==='todas' || (s.natureza||'PROFISSIONAL')===saidasNaturezaFilter);

    const fatReal = me.filter(e=>e.status==='Realizado').reduce((t,e)=>t+Number(e.valor||0),0);
    const fatPrev = me.filter(e=>e.status==='Previsto').reduce((t,e)=>t+Number(e.valor||0),0);
    const fatTotal= fatReal + fatPrev;
    const despPago= ms.filter(s=>s.status==='Pago').reduce((t,s)=>t+Number(s.valor||0),0);
    const despPrev= ms.filter(s=>s.status==='Previsto').reduce((t,s)=>t+Number(s.valor||0),0);
    const despTotal=despPago+despPrev;
    const despProf  = msAll.filter(s=>(s.natureza||'PROFISSIONAL')==='PROFISSIONAL').reduce((t,s)=>t+Number(s.valor||0),0);
    const despPess  = msAll.filter(s=>s.natureza==='PESSOAL').reduce((t,s)=>t+Number(s.valor||0),0);
    const despMista = msAll.filter(s=>s.natureza==='MISTA').reduce((t,s)=>t+Number(s.valor||0),0);
    const despMesTotal = despProf + despPess + despMista;
    const lucroReal=fatReal-despPago, lucroTotal=fatTotal-despTotal;
    const margem=fatTotal>0?Math.round(lucroTotal/fatTotal*100):0;
    const byOri={}, bySai={};
    ['Produção Social','Noiva','Assistência'].forEach(o=>byOri[o]=me.filter(e=>e.origem===o).reduce((t,e)=>t+Number(e.valor||0),0));
    ms.forEach(s=>bySai[s.tipo]=(bySai[s.tipo]||0)+Number(s.valor||0));

    function bar(lbl,val,tot,cor) {
        const pct=tot>0?Math.min(100,Math.round(val/tot*100)):0;
        if(!val) return '';
        return `<div class="barrow"><div class="barhdr"><span>${lbl}</span><span>${brl(val)}</span></div><div class="btrk"><div class="bfil" style="width:${pct}%;background:${cor||'var(--ok)'}"></div></div></div>`;
    }

    // Visão anual: sempre referente ao ano do FIM do range (ou range único)
    const fatAno=entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.y===anoVisaoAnual;}).reduce((t,e)=>t+Number(e.valor||0),0);
    const desAno=saidas.filter(s=>{const my=getMonthYear(s.dataPag);return my&&my.y===anoVisaoAnual;}).reduce((t,s)=>t+Number(s.valor||0),0);
    const anoRows=MONTHS_SHORT.map((m,i)=>{
        const em=entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.m===i&&my.y===anoVisaoAnual;});
        const sm=saidas.filter(s=>{const my=getMonthYear(s.dataPag);return my&&my.m===i&&my.y===anoVisaoAnual;});
        const fat=em.reduce((t,e)=>t+Number(e.valor||0),0);
        const des=sm.reduce((t,s)=>t+Number(s.valor||0),0);
        const luc=fat-des;
        const isCur=i===selMonth&&anoVisaoAnual===new Date().getFullYear();
        if(!fat&&!des) return `<tr${isCur?' class="cur"':''}><td>${m}</td><td>—</td><td>—</td><td>—</td></tr>`;
        return `<tr${isCur?' class="cur"':''}><td>${m}</td><td class="pos">${brl(fat).replace('R$ ','')}</td><td class="neg">${brl(des).replace('R$ ','')}</td><td class="${luc>=0?'pos':'neg'}">${brl(luc).replace('R$ ','')}</td></tr>`;
    });

    // Título do "Resultado" muda conforme o período
    const tituloResultado =
        resumoPeriodo === 'mes' ? 'Resultado do Mês' :
        resumoPeriodo === 'ano' ? `Resultado de ${selYear}` :
        resumoPeriodo === 'ultimos3' ? 'Resultado · Últimos 3 meses' :
        resumoPeriodo === 'ultimos6' ? 'Resultado · Últimos 6 meses' :
        resumoPeriodo === 'acumulado' ? 'Resultado · Acumulado do ano' :
        'Resultado do período';

    return `
    <!-- Filtros de período -->
    <div class="resumo-filter">
        <div class="rf-pills">
            <button class="rf-pill ${resumoPeriodo==='mes'?'on':''}" onclick="setResumoPeriodo('mes')">Mês</button>
            <button class="rf-pill ${resumoPeriodo==='ultimos3'?'on':''}" onclick="setResumoPeriodo('ultimos3')">3 meses</button>
            <button class="rf-pill ${resumoPeriodo==='ultimos6'?'on':''}" onclick="setResumoPeriodo('ultimos6')">6 meses</button>
            <button class="rf-pill ${resumoPeriodo==='acumulado'?'on':''}" onclick="setResumoPeriodo('acumulado')">Ano até hoje</button>
            <button class="rf-pill ${resumoPeriodo==='ano'?'on':''}" onclick="setResumoPeriodo('ano')">Ano inteiro</button>
            <button class="rf-pill ${resumoPeriodo==='personalizado'?'on':''}" onclick="setResumoPeriodo('personalizado')">Personalizado</button>
        </div>
        ${resumoPeriodo==='personalizado'?`
        <div class="rf-custom">
            <input type="date" class="fi" value="${resumoDataIni}" onchange="setResumoDataIni(this.value)">
            <span>→</span>
            <input type="date" class="fi" value="${resumoDataFim}" onchange="setResumoDataFim(this.value)">
            <button class="bt on" onclick="aplicarResumoPersonalizado()" style="padding:8px 14px">Aplicar</button>
        </div>`:''}
    </div>

    ${range.mostrarNav?`
    <div class="msel">
        <button class="mnbtn" onclick="chm(-1)">‹</button>
        <span class="mlab">${MONTHS[selMonth]} ${selYear}</span>
        <button class="mnbtn" onclick="chm(1)">›</button>
    </div>`:`
    <div class="msel" style="justify-content:center"><span class="mlab" style="font-size:.95rem">${tituloPeriodo}</span></div>
    `}

    <div class="card">
        <div class="card-title">Faturamento</div>
        <div class="rsum-grid" style="margin-bottom:11px">
            <div class="rsum-card" style="border-left:3px solid var(--ok)"><div class="rsum-lbl">Realizado</div><div class="rsum-val" style="color:var(--ok)">${brl(fatReal)}</div></div>
            <div class="rsum-card" style="border-left:3px solid var(--red)"><div class="rsum-lbl">Previsto</div><div class="rsum-val" style="color:var(--red)">${brl(fatPrev)}</div></div>
        </div>
        ${['Produção Social','Noiva','Assistência'].map(o=>bar(o,byOri[o],fatTotal,'var(--ok)')).join('')}
        <div class="rrow total" style="margin-top:8px;padding-top:10px;border-top:2px solid #f0f0f0"><span class="rlbl">TOTAL</span><span class="rval" style="font-size:1.05rem;color:var(--ok)">${brl(fatTotal)}</span></div>
    </div>
    <div class="card">
        <div class="card-title">Saídas</div>
        <div class="natfilter" style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
            <button class="bt ${saidasNaturezaFilter==='todas'?'on':''}" onclick="setSaidaNatureza('todas')" style="font-size:.75rem">Todas</button>
            <button class="bt ${saidasNaturezaFilter==='PROFISSIONAL'?'on':''}" onclick="setSaidaNatureza('PROFISSIONAL')" style="font-size:.75rem">Profissional</button>
            <button class="bt ${saidasNaturezaFilter==='PESSOAL'?'on':''}" onclick="setSaidaNatureza('PESSOAL')" style="font-size:.75rem">Pessoal</button>
            ${despMista>0?`<button class="bt ${saidasNaturezaFilter==='MISTA'?'on':''}" onclick="setSaidaNatureza('MISTA')" style="font-size:.75rem">Mista</button>`:''}
        </div>
        <div class="rsum-grid" style="margin-bottom:11px">
            <div class="rsum-card" style="border-left:3px solid var(--red)"><div class="rsum-lbl">Pago</div><div class="rsum-val" style="color:var(--red)">${brl(despPago)}</div></div>
            <div class="rsum-card" style="border-left:3px solid var(--muted)"><div class="rsum-lbl">Previsto</div><div class="rsum-val" style="color:var(--muted)">${brl(despPrev)}</div></div>
        </div>
        ${despMesTotal>0?`
        <div class="natbreak" style="display:grid;grid-template-columns:1fr 1fr${despMista>0?' 1fr':''};gap:8px;margin-bottom:11px">
            <div style="background:#faf3ee;padding:9px 11px;border-radius:9px"><div style="font-size:.65rem;color:#6b4a36;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px">Profissional</div><div style="font-weight:700;color:#3e2c20">${brl(despProf)}</div></div>
            <div style="background:#efe5dd;padding:9px 11px;border-radius:9px"><div style="font-size:.65rem;color:#6b4a36;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px">Pessoal</div><div style="font-weight:700;color:#3e2c20">${brl(despPess)}</div></div>
            ${despMista>0?`<div style="background:#fbeed3;padding:9px 11px;border-radius:9px"><div style="font-size:.65rem;color:#7a5408;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px">Mista</div><div style="font-weight:700;color:#3e2c20">${brl(despMista)}</div></div>`:''}
        </div>`:''}
        ${Object.entries(bySai).map(([k,v])=>bar(saidaStyle(k).ico+' '+k,v,despTotal,'var(--red)')).join('')}
        <div class="rrow total" style="margin-top:8px;padding-top:10px;border-top:2px solid #f0f0f0"><span class="rlbl">TOTAL${saidasNaturezaFilter!=='todas'?' (filtrado)':''}</span><span class="rval" style="font-size:1.05rem;color:var(--red)">${brl(despTotal)}</span></div>
    </div>
    <div class="card" style="background:linear-gradient(135deg,${lucroReal>=0?'#f1faf1,#e8f5e9':'#fff0f0,#ffebee'})">
        <div class="card-title">${tituloResultado}</div>
        <div class="rrow"><span class="rlbl">Faturamento total</span><span class="rval">${brl(fatTotal)}</span></div>
        <div class="rrow"><span class="rlbl">Saídas totais</span><span class="rval" style="color:var(--red)">- ${brl(despTotal)}</span></div>
        <div class="rrow total" style="margin-top:6px;padding-top:10px;border-top:2px solid rgba(0,0,0,.08)"><span class="rlbl">LUCRO PREVISTO</span><span class="rval" style="font-size:1.1rem;color:${lucroTotal>=0?'var(--ok)':'var(--red)'}">${brl(lucroTotal)}</span></div>
        <div class="rrow total"><span class="rlbl">LUCRO REALIZADO</span><span class="rval" style="font-size:1.1rem;color:${lucroReal>=0?'var(--ok)':'var(--red)'}">${brl(lucroReal)}</span></div>
        <div style="text-align:center;margin-top:8px;font-size:1.5rem;font-weight:800;color:${lucroTotal>=0?'var(--ok)':'var(--red)'}">${margem}% margem</div>
    </div>
    <div class="card">
        <div class="card-title">Visão Anual ${anoVisaoAnual}</div>
        <div style="overflow-x:auto">
        <table class="year-table">
            <tr><th>Mês</th><th>Faturamento</th><th>Saídas</th><th>Lucro</th></tr>
            ${anoRows.join('')}
            <tr class="tfoot"><td>ANO</td><td>${brl(fatAno).replace('R$ ','')}</td><td>${brl(desAno).replace('R$ ','')}</td><td class="${fatAno-desAno>=0?'pos':'neg'}">${brl(fatAno-desAno).replace('R$ ','')}</td></tr>
        </table></div>
    </div>
    ${(()=>{
        const byOri={};
        entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.y===anoVisaoAnual;})
            .forEach(e=>{ const o=e.origem||'Outros'; byOri[o]=(byOri[o]||0)+Number(e.valor||0); });
        const total=Object.values(byOri).reduce((a,b)=>a+b,0)||1;
        const cores={'Produção Social':'var(--brown)','Noiva':'#e91e63','Assistência':'#0d47a1','Curso de Automaquiagem':'#00796b','Outros':'var(--muted)'};
        const items=Object.entries(byOri).sort((a,b)=>b[1]-a[1]);
        if(!items.length) return '';
        return `<div class="card">
            <div class="card-title">Faturamento por Origem — ${anoVisaoAnual}</div>
            ${items.map(([o,v])=>{
                const pct=Math.round(v/total*100);
                const cor=cores[o]||'var(--brown)';
                return `<div class="barrow"><div class="barhdr"><span>${o}</span><span>${brl(v)} <span style="color:var(--muted);font-weight:400">(${pct}%)</span></span></div>
                <div class="btrk"><div class="bfil" style="width:${pct}%;background:${cor}"></div></div></div>`;
            }).join('')}
        </div>`;
    })()}
    <button class="bexp" onclick="exportCSV()">${SVG.download} Exportar Entradas CSV</button>
    <button class="bexp" style="margin-top:8px" onclick="exportSaidasCSV()">${SVG.download} Exportar Saídas CSV</button>`;
}

// ── SCREEN: NOIVAS ──
function renderNoivas() {
    const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const MONTHS_ABR = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const proximas = [], realizadas = [];
    noivas.forEach(n => {
        if (!n.dataCasamento) { proximas.push(n); return; }
        const d = new Date(n.dataCasamento); d.setHours(0,0,0,0);
        if (d >= hoje) proximas.push(n); else realizadas.push(n);
    });
    proximas.sort((a,b)=>(a.dataCasamento||'9999').localeCompare(b.dataCasamento||'9999'));
    realizadas.sort((a,b)=>(b.dataCasamento||'').localeCompare(a.dataCasamento||''));

    const renderNoivaCard = (n, opts={}) => {
        const concluida = !!opts.concluida;
        const pgtos = entries.filter(e=>e.noivaId===n.id||(e.origem==='Noiva'&&e.cliente.trim().toLowerCase()===n.nome.trim().toLowerCase()));
        const totalPago = pgtos.filter(e=>e.status==='Realizado').reduce((t,e)=>t+Number(e.valor||0),0);
        const totalPrev = pgtos.filter(e=>e.status==='Previsto').reduce((t,e)=>t+Number(e.valor||0),0);
        const contrato  = Number(n.valorContrato||0);
        const falta     = Math.max(0, contrato - totalPago - totalPrev);
        const pct       = contrato>0 ? Math.min(100,Math.round((totalPago+totalPrev)/contrato*100)) : 0;
        const pctReal   = contrato>0 ? Math.min(100,Math.round(totalPago/contrato*100)) : 0;
        const isOpen    = noivaDetail===n.id;
        const diasCasa  = n.dataCasamento ? Math.ceil((new Date(n.dataCasamento)-new Date())/86400000) : null;
        const quitada   = totalPago>=contrato&&contrato>0;
        const badge     = quitada ? `<span style="background:var(--ok-l);color:var(--ok);font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px">Quitada</span>`
                        : falta>0&&diasCasa!==null&&diasCasa<30&&diasCasa>0 ? `<span style="background:var(--red-l);color:var(--red);font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px">${diasCasa}d</span>` : '';

        // Date badge for proximas; gem icon for realizadas
        let leftIcon;
        if (!concluida && n.dataCasamento) {
            const [,mm,dd] = n.dataCasamento.split('-');
            const mIdx = parseInt(mm)-1;
            leftIcon = `<div class="noiva-date-badge"><span class="noiva-date-day">${dd}</span><span class="noiva-date-month">${MONTHS_ABR[mIdx]}</span></div>`;
        } else {
            leftIcon = `<div style="width:42px;height:42px;background:${concluida?'var(--surface-2)':'#fce4ec'};border-radius:10px;display:flex;align-items:center;justify-content:center;color:${concluida?'var(--muted)':'#e91e63'};flex-shrink:0">${SVG.gem}</div>`;
        }

        const docsHtml = (() => {
            const docs = n.contratos || [];
            const tipoLabel = { CONTRATO: 'Contrato', ADITIVO: 'Aditivo', PROPOSTA: 'Proposta Enviada' };
            return `
            <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border)">
                <div style="font-size:.7rem;font-weight:700;color:var(--brown);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Documentos</div>
                ${docs.length===0?`<p style="font-size:.75rem;color:var(--muted);margin:0 0 8px">Nenhum documento anexado</p>`:
                docs.map(d=>`
                <div class="noiva-doc-item">
                    <span class="noiva-doc-tipo">${tipoLabel[d.tipo]||d.tipo}</span>
                    <a href="${d.link}" target="_blank" rel="noopener" class="noiva-doc-link">${d.nome}</a>
                    <button class="delbtn" style="width:24px;height:24px;flex-shrink:0" onclick="deleteNoivaDoc('${n.id}','${d.fileId}')">${SVG.trash}</button>
                </div>`).join('')}
                <div style="display:flex;gap:7px;margin-top:6px;flex-wrap:wrap">
                    <button class="noiva-doc-add-btn" onclick="uploadNoivaDoc('${n.id}','CONTRATO')">+ Contrato</button>
                    <button class="noiva-doc-add-btn" onclick="uploadNoivaDoc('${n.id}','ADITIVO')">+ Aditivo</button>
                    <button class="noiva-doc-add-btn" onclick="uploadNoivaDoc('${n.id}','PROPOSTA')">+ Proposta</button>
                </div>
            </div>`;
        })();

        const pgtosList = pgtos.sort((a,b)=>(a.dataPag||'').localeCompare(b.dataPag||'')).map(p=>`
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f5f5f5">
                <div style="flex:1;min-width:0">
                    <div style="font-size:.83rem;font-weight:600">${p.tipo} · ${fmtDate(p.dataPag)} · ${p.forma}</div>
                    ${p.obs?`<div style="font-size:.7rem;color:var(--muted)">${p.obs}</div>`:''}
                    ${p.comprovanteUrl?`<a href="${p.comprovanteUrl}" target="_blank" rel="noopener" style="font-size:.68rem;color:#1976d2;display:inline-flex;align-items:center;gap:3px;margin-top:2px">📎 Ver comprovante</a>`:''}
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <div style="font-weight:700;font-size:.9rem;color:${p.status==='Realizado'?'var(--ok)':'var(--muted)'}">${brl(p.valor)}</div>
                    <span class="sbadge ${p.status==='Realizado'?'sb-g':'sb-r'}" onclick="toggleStatus('${p.id}')">${p.status==='Realizado'?'Pago':'Previsto'}</span>
                </div>
                <button class="editbtn" title="Anexar comprovante" onclick="uploadPgtoProof('${p.id}')" style="width:28px;height:28px">${SVG.attach}</button>
                <button class="editbtn" onclick="openEditEntry('${p.id}')" style="width:28px;height:28px">${SVG.edit}</button>
                <button class="delbtn"  onclick="delEntry('${p.id}')"      style="width:28px;height:28px">${SVG.trash}</button>
            </div>`).join('');

        return `<div class="card noiva-card${concluida?' noiva-realizada':''}" style="margin-bottom:10px">
            <div style="display:flex;align-items:flex-start;gap:11px;cursor:pointer" onclick="toggleNoivaDetail('${n.id}')">
                ${leftIcon}
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:.97rem">${n.nome}${badge}</div>
                    <div style="font-size:.71rem;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        ${diasCasa!==null?(diasCasa>0?`em ${diasCasa} dias`:`já passou`):''}
                        <span>·</span>
                        <span>Contrato: <strong>${brl(contrato)}</strong></span>
                        <button onclick="event.stopPropagation();openEditNoivaContrato('${n.id}')" style="background:none;border:none;padding:0;cursor:pointer;color:#e91e63;display:inline-flex;align-items:center" title="Editar valor do contrato">${SVG.edit}</button>
                    </div>
                    <div style="margin:8px 0 3px">
                        <div style="background:#e8ddd8;border-radius:6px;height:9px;overflow:hidden;position:relative">
                            <div style="width:${pctReal}%;background:var(--ok);height:9px;border-radius:6px 0 0 6px;transition:width .4s;position:absolute"></div>
                            <div style="width:${pct}%;background:#f9d5a7;height:9px;border-radius:6px;transition:width .4s"></div>
                        </div>
                    </div>
                    <div style="display:flex;gap:12px;font-size:.71rem;flex-wrap:wrap">
                        <span style="color:var(--ok);font-weight:700">Pago: ${brl(totalPago)}</span>
                        ${totalPrev>0?`<span style="color:#f59e0b;font-weight:700">Previsto: ${brl(totalPrev)}</span>`:''}
                        ${falta>0?`<span style="color:var(--red);font-weight:700">Falta: ${brl(falta)}</span>`:''}
                    </div>
                </div>
                <div style="color:var(--muted);margin-top:4px">${isOpen?SVG.chevUp:SVG.chevDown}</div>
            </div>
            ${isOpen?`
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
                ${pgtos.length===0?`<p style="text-align:center;color:var(--muted);font-size:.82rem;padding:8px 0">Nenhum pagamento registrado</p>`:pgtosList}
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button class="bsub" style="flex:1;padding:11px;font-size:.87rem" onclick="openNoivaPgto('${n.id}','${n.nome.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">+ Registrar Pagamento</button>
                    <button class="delbtn" style="width:42px;height:42px" onclick="deleteNoiva('${n.id}')">${SVG.trash}</button>
                </div>
                ${n.obs?`<div style="font-size:.74rem;color:var(--muted);margin-top:10px;font-style:italic;line-height:1.4">${n.obs}</div>`:''}
                ${docsHtml}
            </div>`:''}
        </div>`;
    };

    if (noivas.length === 0) {
        return `
        <button class="add-btn" style="border-color:#e91e63;color:#e91e63;margin-bottom:11px;display:flex;align-items:center;justify-content:center;gap:7px" onclick="openAddNoiva()">${SVG.gem} + Nova Noiva</button>
        <div class="empty"><div class="ico">${SVG.gem}</div><p>Nenhuma noiva cadastrada.<br>Adicione para acompanhar os pagamentos.</p></div>`;
    }

    // Group proximas by year-month
    const byMonth = {};
    proximas.forEach(n => {
        const key = n.dataCasamento ? n.dataCasamento.slice(0,7) : 'sem-data';
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(n);
    });
    const monthKeys = Object.keys(byMonth).sort();

    const renderMonthSection = (key) => {
        let header;
        if (key === 'sem-data') {
            header = `<div class="noiva-month-hdr"><span class="dot" style="background:#e91e63"></span>Sem data definida</div>`;
        } else {
            const [year, month] = key.split('-');
            const mName = MONTHS_PT[parseInt(month)-1].toUpperCase();
            header = `<div class="noiva-month-hdr"><span class="dot" style="background:#e91e63"></span>${mName} <span class="noiva-month-year">${year}</span></div>`;
        }
        return header + byMonth[key].map(n=>renderNoivaCard(n,{concluida:false})).join('');
    };

    return `
    <button class="add-btn" style="border-color:#e91e63;color:#e91e63;margin-bottom:11px;display:flex;align-items:center;justify-content:center;gap:7px" onclick="openAddNoiva()">${SVG.gem} + Nova Noiva</button>
    ${monthKeys.map(renderMonthSection).join('')}
    ${realizadas.length ? `
        <div class="noiva-section-title realizadas-title">
            ${SVG.check}
            Realizadas <span class="count">${realizadas.length}</span>
        </div>
        ${realizadas.map(n=>renderNoivaCard(n,{concluida:true})).join('')}
    ` : ''}`;
}
