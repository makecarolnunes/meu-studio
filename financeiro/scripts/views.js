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
        <div class="fg"><label class="fl">Atendimento pela equipe <span style="color:var(--muted);font-size:.75rem">(opcional)</span></label><input class="fi" type="text" id="i-eq" placeholder="Ex: Julia" value="${F.equipe||''}" autocomplete="off"></div>
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
    list.sort((a,b)=>(b.dataPag||'').localeCompare(a.dataPag||''));
    const total = list.reduce((s,e)=>s+Number(e.valor||0),0);
    const filters = [{k:'todos',l:'Todos'},{k:'Realizado',l:'Realizado'},{k:'Previsto',l:'Previsto'},{k:'Sinal',l:'Sinal'},{k:'Pagamento',l:'Pagamento'},{k:'Parcela',l:'Parcela'}];
    return `
    <div class="msel">
        <button class="mnbtn" onclick="chm(-1)">‹</button>
        <div class="mlab">${MONTHS[selMonth]} ${selYear}${list.length?`<div class="msub">${list.length} lançamento${list.length!==1?'s':''} · ${brl(total)}</div>`:''}</div>
        <button class="mnbtn" onclick="chm(1)">›</button>
    </div>
    <div class="ftabs">${filters.map(f=>`<button class="ftab ${listFilter===f.k?'on':''}" onclick="setF('${f.k}')">${f.l}</button>`).join('')}</div>
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
    <div class="detail-actions">
        <button class="bsub" onclick="saveEditEntry('${e.id}')">Salvar alterações</button>
        <button class="delbtn" style="width:44px;height:44px;flex-shrink:0" onclick="delEntry('${e.id}')">${SVG.trash}</button>
    </div>`;
}

// ── DESKTOP: renderização master-detail da tela Lista ──
function renderListaDesktop() {
    let list = entries.filter(e => { const my=getMonthYear(e.dataPag); return my&&my.m===selMonth&&my.y===selYear; });
    if (listFilter!=='todos') list = list.filter(e=>e.status===listFilter||e.tipo===listFilter);
    list.sort((a,b)=>(b.dataPag||'').localeCompare(a.dataPag||''));
    const total    = list.reduce((s,e)=>s+Number(e.valor||0),0);
    const realized = list.filter(e=>e.status==='Realizado').reduce((s,e)=>s+Number(e.valor||0),0);
    const previsto = list.filter(e=>e.status==='Previsto').reduce((s,e)=>s+Number(e.valor||0),0);
    const cntReal  = list.filter(e=>e.status==='Realizado').length;
    const cntPrev  = list.filter(e=>e.status==='Previsto').length;
    const filters  = [{k:'todos',l:'Todos'},{k:'Realizado',l:'Realizado'},{k:'Previsto',l:'Previsto'},{k:'Sinal',l:'Sinal'},{k:'Pagamento',l:'Pagamento'},{k:'Parcela',l:'Parcela'}];

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
        <div class="ftabs">${filters.map(f=>`<button class="ftab ${listFilter===f.k?'on':''}" onclick="setF('${f.k}')">${f.l}</button>`).join('')}</div>
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
    const list = saidas.filter(s=>{const my=getMonthYear(s.dataPag);return my&&my.m===selMonth&&my.y===selYear;})
                       .sort((a,b)=>(b.dataPag||'').localeCompare(a.dataPag||''));
    const totPago = list.filter(s=>s.status==='Pago').reduce((t,s)=>t+Number(s.valor||0),0);
    const totPrev = list.filter(s=>s.status==='Previsto').reduce((t,s)=>t+Number(s.valor||0),0);
    return `
    <div class="msel">
        <button class="mnbtn" onclick="chm(-1)">‹</button>
        <div class="mlab">${MONTHS[selMonth]} ${selYear}${list.length?`<div class="msub">${list.length} saída${list.length!==1?'s':''} · ${brl(totPago+totPrev)}</div>`:''}</div>
        <button class="mnbtn" onclick="chm(1)">›</button>
    </div>
    <button class="add-btn ${saidasFormOpen?'open':''}" onclick="toggleSaidasForm()">${saidasFormOpen?'✕ Fechar':'＋ Nova Saída'}</button>
    ${saidasFormOpen?`
    <div class="card">
        <div class="two">
            <div class="fg"><label class="fl">Data</label><input class="fi" type="date" id="si-dp" value="${Fs.dataPag}"></div>
            <div class="fg"><label class="fl">Valor</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="si-v" placeholder="0,00" step="0.01" min="0" value="${Fs.valor}" inputmode="decimal"></div></div>
        </div>
        <div class="fg"><label class="fl">Tipo de Despesa</label><select class="fi" id="si-tipo">${SAIDA_TIPOS.map(t=>`<option value="${t}" ${Fs.tipo===t?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="fg"><label class="fl">Status</label><div class="stog">
            <button class="stbtn ${Fs.status==='Pago'?'on-g':''}"    data-f="status" data-v="Pago"    data-form="s" onclick="pick('status','Pago','s')">Pago</button>
            <button class="stbtn ${Fs.status==='Previsto'?'on-r':''}" data-f="status" data-v="Previsto" data-form="s" onclick="pick('status','Previsto','s')">Previsto</button>
        </div></div>
        <div class="fg"><label class="fl">Forma de Pagamento</label>${bgroup('forma',['PIX','Crédito','Dinheiro'],'s')}</div>
        <div class="fg"><label class="fl">Observações</label><textarea class="fi ta" id="si-ob" placeholder="Detalhe...">${Fs.obs}</textarea></div>
        <div class="fg"><label class="fl">Recorrência</label><div class="bg" style="flex-wrap:wrap">
            <button class="bt ${Fs.recorrencia==='unica'?'on':''}" data-f="recorrencia" data-v="unica" data-form="s" onclick="pick('recorrencia','unica','s')">Única</button>
            <button class="bt ${Fs.recorrencia==='fixa'?'on':''}" data-f="recorrencia" data-v="fixa" data-form="s" onclick="pick('recorrencia','fixa','s')">Fixa · 12 meses</button>
            <button class="bt ${Fs.recorrencia==='recorrente'?'on':''}" data-f="recorrencia" data-v="recorrente" data-form="s" onclick="pick('recorrencia','recorrente','s')">Recorrente</button>
        </div></div>
        ${Fs.recorrencia==='recorrente'?`<div class="fg"><label class="fl">Quantos meses?</label><div class="vwrap"><span class="vpfx">#</span><input class="fi" type="number" id="si-meses" min="2" max="60" value="${Fs.meses||2}" inputmode="numeric"></div></div>`:''}
        <button class="bsub red" onclick="saveSaida()">Salvar Saída</button>
    </div>`:''}
    ${list.length===0?`<div class="empty"><div class="ico">${SVG.upload}</div><p>Nenhuma saída em<br><strong>${MONTHS[selMonth]} ${selYear}</strong></p></div>`
    :list.map(s=>{
        const st=saidaStyle(s.tipo);
        return `<div class="eitem">
            <div class="eico" style="background:${st.bg};color:${st.col}">${st.ico}</div>
            <div class="einf"><div class="ecli">${s.tipo}</div>
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
    }).join('')}
    ${list.length?`<button class="bexp" onclick="exportSaidasCSV()" style="display:flex;align-items:center;justify-content:center;gap:7px">${SVG.download} Exportar CSV</button>`:''}`;
}

// ── SCREEN: RESUMO ──
function renderResumo() {
    const me = entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.m===selMonth&&my.y===selYear;});
    const ms = saidas.filter(s=>{const my=getMonthYear(s.dataPag);return my&&my.m===selMonth&&my.y===selYear;});
    const fatReal = me.filter(e=>e.status==='Realizado').reduce((t,e)=>t+Number(e.valor||0),0);
    const fatPrev = me.filter(e=>e.status==='Previsto').reduce((t,e)=>t+Number(e.valor||0),0);
    const fatTotal= fatReal + fatPrev;
    const despPago= ms.filter(s=>s.status==='Pago').reduce((t,s)=>t+Number(s.valor||0),0);
    const despPrev= ms.filter(s=>s.status==='Previsto').reduce((t,s)=>t+Number(s.valor||0),0);
    const despTotal=despPago+despPrev;
    const lucroReal=fatReal-despPago, lucroTotal=fatTotal-despTotal;
    const margem=fatTotal>0?Math.round(lucroTotal/fatTotal*100):0;
    const byOri={}, bySai={};
    ['Produção Social','Noiva','Assistência'].forEach(o=>byOri[o]=me.filter(e=>e.origem===o).reduce((t,e)=>t+Number(e.valor||0),0));
    ms.forEach(s=>bySai[s.tipo]=(bySai[s.tipo]||0)+Number(s.valor||0));
    const meiAno = entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.y===selYear&&e.status==='Realizado';}).reduce((t,e)=>t+Number(e.valor||0),0);
    const meiPct = Math.min(100,Math.round(meiAno/MEI_LIMITE*100));
    const meiCor = meiPct<60?'var(--ok)':meiPct<85?'#f59e0b':'var(--red)';
    const meiRest= MEI_LIMITE-meiAno;
    const mesNow = selYear===new Date().getFullYear()?new Date().getMonth():11;
    const mesesR = 11-mesNow;
    function bar(lbl,val,tot,cor) {
        const pct=tot>0?Math.min(100,Math.round(val/tot*100)):0;
        if(!val) return '';
        return `<div class="barrow"><div class="barhdr"><span>${lbl}</span><span>${brl(val)}</span></div><div class="btrk"><div class="bfil" style="width:${pct}%;background:${cor||'var(--ok)'}"></div></div></div>`;
    }
    const fatAno=entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.y===selYear;}).reduce((t,e)=>t+Number(e.valor||0),0);
    const desAno=saidas.filter(s=>{const my=getMonthYear(s.dataPag);return my&&my.y===selYear;}).reduce((t,s)=>t+Number(s.valor||0),0);
    const anoRows=MONTHS_SHORT.map((m,i)=>{
        const em=entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.m===i&&my.y===selYear;});
        const sm=saidas.filter(s=>{const my=getMonthYear(s.dataPag);return my&&my.m===i&&my.y===selYear;});
        const fat=em.reduce((t,e)=>t+Number(e.valor||0),0);
        const des=sm.reduce((t,s)=>t+Number(s.valor||0),0);
        const luc=fat-des;
        const isCur=i===selMonth&&selYear===new Date().getFullYear();
        if(!fat&&!des) return `<tr${isCur?' class="cur"':''}><td>${m}</td><td>—</td><td>—</td><td>—</td></tr>`;
        return `<tr${isCur?' class="cur"':''}><td>${m}</td><td class="pos">${brl(fat).replace('R$ ','')}</td><td class="neg">${brl(des).replace('R$ ','')}</td><td class="${luc>=0?'pos':'neg'}">${brl(luc).replace('R$ ','')}</td></tr>`;
    });
    return `
    <div class="msel">
        <button class="mnbtn" onclick="chm(-1)">‹</button>
        <span class="mlab">${MONTHS[selMonth]} ${selYear}</span>
        <button class="mnbtn" onclick="chm(1)">›</button>
    </div>
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
        <div class="card-title">Limite MEI ${selYear}</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
            <span style="font-size:.83rem;color:var(--muted)">Faturado: <strong style="color:${meiCor}">${brl(meiAno)}</strong></span>
            <span style="font-size:.83rem;font-weight:700;color:${meiCor}">${meiPct}%</span>
        </div>
        <div class="mei-track"><div class="mei-fill" style="width:${meiPct}%;background:${meiCor}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--muted);margin-bottom:8px"><span>R$ 0</span><span>R$ 81.000</span></div>
        <div class="rrow"><span class="rlbl">Restante</span><span class="rval" style="color:${meiCor}">${brl(Math.max(0,meiRest))}</span></div>
        <div class="rrow"><span class="rlbl">Meta mensal (÷12)</span><span class="rval">${brl(MEI_LIMITE/12)}</span></div>
        ${mesesR>0&&selYear===new Date().getFullYear()?`<div class="rrow"><span class="rlbl">Margem p/ ${mesesR} meses restantes</span><span class="rval" style="color:${meiCor}">${brl(meiRest/mesesR)}/mês</span></div>`:''}
        ${meiPct>=85?`<div style="background:var(--red-l);color:var(--red);border-radius:9px;padding:9px 11px;font-size:.79rem;font-weight:600;margin-top:8px">⚠️ Atenção: ${meiPct}% do limite MEI atingido!</div>`:''}
    </div>
    <div class="card">
        <div class="card-title">Saídas</div>
        <div class="rsum-grid" style="margin-bottom:11px">
            <div class="rsum-card" style="border-left:3px solid var(--red)"><div class="rsum-lbl">Pago</div><div class="rsum-val" style="color:var(--red)">${brl(despPago)}</div></div>
            <div class="rsum-card" style="border-left:3px solid var(--muted)"><div class="rsum-lbl">Previsto</div><div class="rsum-val" style="color:var(--muted)">${brl(despPrev)}</div></div>
        </div>
        ${Object.entries(bySai).map(([k,v])=>bar(saidaStyle(k).ico+' '+k,v,despTotal,'var(--red)')).join('')}
        <div class="rrow total" style="margin-top:8px;padding-top:10px;border-top:2px solid #f0f0f0"><span class="rlbl">TOTAL</span><span class="rval" style="font-size:1.05rem;color:var(--red)">${brl(despTotal)}</span></div>
    </div>
    <div class="card" style="background:linear-gradient(135deg,${lucroReal>=0?'#f1faf1,#e8f5e9':'#fff0f0,#ffebee'})">
        <div class="card-title">Resultado do Mês</div>
        <div class="rrow"><span class="rlbl">Faturamento total</span><span class="rval">${brl(fatTotal)}</span></div>
        <div class="rrow"><span class="rlbl">Saídas totais</span><span class="rval" style="color:var(--red)">- ${brl(despTotal)}</span></div>
        <div class="rrow total" style="margin-top:6px;padding-top:10px;border-top:2px solid rgba(0,0,0,.08)"><span class="rlbl">LUCRO PREVISTO</span><span class="rval" style="font-size:1.1rem;color:${lucroTotal>=0?'var(--ok)':'var(--red)'}">${brl(lucroTotal)}</span></div>
        <div class="rrow total"><span class="rlbl">LUCRO REALIZADO</span><span class="rval" style="font-size:1.1rem;color:${lucroReal>=0?'var(--ok)':'var(--red)'}">${brl(lucroReal)}</span></div>
        <div style="text-align:center;margin-top:8px;font-size:1.5rem;font-weight:800;color:${lucroTotal>=0?'var(--ok)':'var(--red)'}">${margem}% margem</div>
    </div>
    <div class="card">
        <div class="card-title">Visão Anual ${selYear}</div>
        <div style="overflow-x:auto">
        <table class="year-table">
            <tr><th>Mês</th><th>Faturamento</th><th>Saídas</th><th>Lucro</th></tr>
            ${anoRows.join('')}
            <tr class="tfoot"><td>ANO</td><td>${brl(fatAno).replace('R$ ','')}</td><td>${brl(desAno).replace('R$ ','')}</td><td class="${fatAno-desAno>=0?'pos':'neg'}">${brl(fatAno-desAno).replace('R$ ','')}</td></tr>
        </table></div>
    </div>
    ${(()=>{
        const byOri={};
        entries.filter(e=>{const my=getMonthYear(e.dataPag);return my&&my.y===selYear;})
            .forEach(e=>{ const o=e.origem||'Outros'; byOri[o]=(byOri[o]||0)+Number(e.valor||0); });
        const total=Object.values(byOri).reduce((a,b)=>a+b,0)||1;
        const cores={'Produção Social':'var(--brown)','Noiva':'#e91e63','Assistência':'#0d47a1','Curso de Automaquiagem':'#00796b','Outros':'var(--muted)'};
        const items=Object.entries(byOri).sort((a,b)=>b[1]-a[1]);
        if(!items.length) return '';
        return `<div class="card">
            <div class="card-title">Faturamento por Origem — ${selYear}</div>
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
    // Separa em Próximas (casamento >= hoje, ou sem data) e Realizadas (casamento < hoje)
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
        const badge     = totalPago>=contrato&&contrato>0 ? `<span style="background:var(--ok-l);color:var(--ok);font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px">Quitada</span>`
                        : falta>0&&diasCasa!==null&&diasCasa<30&&diasCasa>0 ? `<span style="background:var(--red-l);color:var(--red);font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px">${diasCasa}d</span>` : '';
        return `<div class="card noiva-card${concluida?' noiva-realizada':''}" style="margin-bottom:10px">
            <div style="display:flex;align-items:flex-start;gap:11px;cursor:pointer" onclick="toggleNoivaDetail('${n.id}')">
                <div style="width:42px;height:42px;background:${concluida?'var(--surface-2)':'#fce4ec'};border-radius:10px;display:flex;align-items:center;justify-content:center;color:${concluida?'var(--muted)':'#e91e63'};flex-shrink:0">${SVG.gem}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:.97rem">${n.nome}${badge}</div>
                    <div style="font-size:.71rem;color:var(--muted);margin-top:2px">
                        ${n.dataCasamento?`Casamento: <strong>${n.dataCasamento.split('-').reverse().join('/')}</strong>${diasCasa!==null?(diasCasa>0?` · em ${diasCasa} dias`:' · já passou'):''}`:''} · Contrato: <strong>${brl(contrato)}</strong>
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
                ${pgtos.length===0?`<p style="text-align:center;color:var(--muted);font-size:.82rem;padding:8px 0">Nenhum pagamento registrado</p>`:
                pgtos.sort((a,b)=>(a.dataPag||'').localeCompare(b.dataPag||'')).map((p,i)=>`
                <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f5f5f5">
                    <div style="flex:1;min-width:0">
                        <div style="font-size:.83rem;font-weight:600">${p.tipo} · ${fmtDate(p.dataPag)} · ${p.forma}</div>
                        ${p.obs?`<div style="font-size:.7rem;color:var(--muted)">${p.obs}</div>`:''}
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                        <div style="font-weight:700;font-size:.9rem;color:${p.status==='Realizado'?'var(--ok)':'var(--muted)'}">${brl(p.valor)}</div>
                        <span class="sbadge ${p.status==='Realizado'?'sb-g':'sb-r'}" onclick="toggleStatus('${p.id}')">${p.status==='Realizado'?'Pago':'Previsto'}</span>
                    </div>
                    <button class="editbtn" onclick="openEditEntry('${p.id}')" style="width:28px;height:28px">${SVG.edit}</button>
                    <button class="delbtn"  onclick="delEntry('${p.id}')"      style="width:28px;height:28px">${SVG.trash}</button>
                </div>`).join('')}
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button class="bsub" style="flex:1;padding:11px;font-size:.87rem" onclick="openNoivaPgto('${n.id}','${n.nome.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">+ Registrar Pagamento</button>
                    <button class="delbtn" style="width:42px;height:42px" onclick="deleteNoiva('${n.id}')">${SVG.trash}</button>
                </div>
                ${n.obs?`<div style="font-size:.74rem;color:var(--muted);margin-top:10px;font-style:italic;line-height:1.4">${n.obs}</div>`:''}
            </div>`:''}
        </div>`;
    };

    if (noivas.length === 0) {
        return `
        <button class="add-btn" style="border-color:#e91e63;color:#e91e63;margin-bottom:11px;display:flex;align-items:center;justify-content:center;gap:7px" onclick="openAddNoiva()">${SVG.gem} + Nova Noiva</button>
        <div class="empty"><div class="ico">${SVG.gem}</div><p>Nenhuma noiva cadastrada.<br>Adicione para acompanhar os pagamentos.</p></div>`;
    }

    return `
    <button class="add-btn" style="border-color:#e91e63;color:#e91e63;margin-bottom:11px;display:flex;align-items:center;justify-content:center;gap:7px" onclick="openAddNoiva()">${SVG.gem} + Nova Noiva</button>
    ${proximas.length ? `
        <div class="noiva-section-title">
            <span class="dot" style="background:#e91e63"></span>
            Próximas <span class="count">${proximas.length}</span>
        </div>
        ${proximas.map(n=>renderNoivaCard(n,{concluida:false})).join('')}
    ` : ''}
    ${realizadas.length ? `
        <div class="noiva-section-title realizadas-title">
            ${SVG.check}
            Realizadas <span class="count">${realizadas.length}</span>
        </div>
        ${realizadas.map(n=>renderNoivaCard(n,{concluida:true})).join('')}
    ` : ''}`;
}
