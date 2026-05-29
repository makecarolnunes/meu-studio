// ════════════════════════════════════════════════════════════
// financeiro/scripts/noivas.js
// CRUD + modais de noiva + recalcRestaNoiva
// ════════════════════════════════════════════════════════════

function toggleNoivaDetail(id) {
    noivaDetail = noivaDetail===id ? null : id;
    render();
}

// Recalcula a entrada "Restante Previsto" de uma noiva.
// Aceita ID ou nome da noiva como fallback.
function recalcRestaNoiva(noivaIdOrNome) {
    if (!noivaIdOrNome) return;
    const noiva = noivas.find(n => n.id === noivaIdOrNome)
               || noivas.find(n => n.nome.trim().toLowerCase() === String(noivaIdOrNome).trim().toLowerCase());
    if (!noiva) return;
    const noivaId = noiva.id;
    const contrato = Number(noiva.valorContrato||0);

    const pgtos = entries.filter(e =>
        (e.noivaId === noivaId || (e.origem==='Noiva' && e.cliente.trim().toLowerCase()===noiva.nome.trim().toLowerCase()))
        && !(e.auto===true || e.auto==='true')
    );
    const totalPagos = pgtos.reduce((t,e) => t + Number(e.valor||0), 0);
    const restante   = Math.max(0, contrato - totalPagos);

    const autoIdx = entries.findIndex(e =>
        (e.noivaId === noivaId || (e.origem==='Noiva' && e.cliente.trim().toLowerCase()===noiva.nome.trim().toLowerCase()))
        && (e.auto===true || e.auto==='true') && e.status==='Previsto'
    );

    if (autoIdx >= 0) {
        const autoEntry = entries[autoIdx];
        if (restante <= 0.01) {
            entries.splice(autoIdx, 1);
            cacheEntries();
            sbCall({action:'delete', table:'entries', id: autoEntry.id});
        } else {
            const updated = {...autoEntry, valor: String(restante),
                obs: `Restante do contrato — total pago até agora: ${brl(totalPagos)}`};
            entries[autoIdx] = updated;
            cacheEntries();
            sbCall({action:'save', table:'entries', data: encodeURIComponent(JSON.stringify(updated))});
        }
    } else if (restante > 0.01) {
        const nova = {
            id: genId(), dataPag: noiva.dataCasamento||today(),
            dataServ: noiva.dataCasamento||'', cliente: noiva.nome,
            tipo: 'Pagamento', valor: String(restante), valorTotal: String(contrato),
            servico: 'Maquiagem', local: 'Studio', forma: 'PIX',
            status: 'Previsto', origem: 'Noiva',
            obs: `Restante do contrato — total pago até agora: ${brl(totalPagos)}`,
            auto: true, createdAt: new Date().toISOString(), noivaId
        };
        entries.unshift(nova); cacheEntries();
        sbCall({action:'save', table:'entries', data: encodeURIComponent(JSON.stringify(nova))});
    }
}

function openAddNoiva() {
    document.getElementById('modal-bg').style.display='flex';
    document.getElementById('modal-inner').innerHTML=`
    <div class="modal-title">Cadastrar Noiva</div>
    <div class="fg"><label class="fl">Nome da Noiva</label><input class="fi" type="text" id="nv-nome" placeholder="Ex: Maria Santos" autocomplete="off"></div>
    <div class="fg"><label class="fl">Data do Casamento</label><input class="fi" type="date" id="nv-data"></div>
    <div class="fg"><label class="fl">Valor Total do Contrato</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="nv-valor" placeholder="0,00" step="0.01" min="0" inputmode="decimal"></div></div>
    <div class="fg"><label class="fl">Observações</label><textarea class="fi ta" id="nv-obs" placeholder="Ex: Paga 3x, noiva do Pedro, cerimônia em SP..."></textarea></div>
    <div style="border-top:1.5px dashed var(--border);margin:12px 0 10px;padding-top:12px">
        <div style="font-size:.72rem;font-weight:700;color:var(--brown);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Sinal Inicial (opcional)</div>
        <div class="two">
            <div class="fg"><label class="fl">Valor do Sinal</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="nv-sinal" placeholder="0,00" step="0.01" min="0" inputmode="decimal"></div></div>
            <div class="fg"><label class="fl">Data do Sinal</label><input class="fi" type="date" id="nv-sinal-data" value="${today()}"></div>
        </div>
        <div class="fg"><label class="fl">Forma de Pagamento</label>
            <div class="bg" id="nv-forma-grp">
                <button class="bt on" onclick="nvPick('nv-forma-grp','PIX',this)">PIX</button>
                <button class="bt" onclick="nvPick('nv-forma-grp','Crédito',this)">Crédito</button>
                <button class="bt" onclick="nvPick('nv-forma-grp','Dinheiro',this)">Dinheiro</button>
            </div>
        </div>
        <div class="fg"><label class="fl">Status do Sinal</label>
            <div class="stog">
                <button class="stbtn on-g" id="nv-st-real" onclick="nvPickStatus('Realizado')">Realizado</button>
                <button class="stbtn" id="nv-st-prev" onclick="nvPickStatus('Previsto')">Previsto</button>
            </div>
            <input type="hidden" id="nv-sinal-status" value="Realizado">
        </div>
    </div>
    <button class="bsub" onclick="saveNoiva()">Cadastrar</button>
    <button class="skip" onclick="closeModal()">Cancelar</button>`;
    setTimeout(()=>document.getElementById('nv-nome')?.focus(),80);
}
function nvPick(grpId, val, btn) {
    document.getElementById(grpId).querySelectorAll('.bt').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    document.getElementById(grpId).dataset.val = val;
}
function nvPickStatus(val) {
    document.getElementById('nv-sinal-status').value = val;
    document.getElementById('nv-st-real').className = 'stbtn'+(val==='Realizado'?' on-g':'');
    document.getElementById('nv-st-prev').className = 'stbtn'+(val==='Previsto'?' on-r':'');
}

function saveNoiva() {
    const nome       = document.getElementById('nv-nome').value.trim();
    const data       = document.getElementById('nv-data').value;
    const valor      = document.getElementById('nv-valor').value;
    const obs        = document.getElementById('nv-obs').value;
    const sinalValor = Number(document.getElementById('nv-sinal')?.value||0);
    const sinalData  = document.getElementById('nv-sinal-data')?.value || today();
    const sinalForma = document.getElementById('nv-forma-grp')?.dataset.val || 'PIX';
    const sinalSt    = document.getElementById('nv-sinal-status')?.value || 'Realizado';
    if (!nome)  { toast('⚠️ Informe o nome da noiva!'); return; }
    if (!valor||Number(valor)<=0) { toast('⚠️ Informe o valor do contrato!'); return; }
    const contrato = Number(valor);
    const noivaIdNew = genId();
    const noiva = { id:noivaIdNew, nome, dataCasamento:data, valorContrato:valor, obs, createdAt:new Date().toISOString() };
    noivas.unshift(noiva); cacheNoivas();
    sbCall({action:'save', table:'noivas', data:encodeURIComponent(JSON.stringify(noiva))});

    if (sinalValor > 0) {
        if (sinalValor > contrato) { toast('⚠️ Sinal maior que o contrato!'); return; }
        const sinalIdNoiva = genId();
        const sinalEntry = {
            id: sinalIdNoiva, dataPag: sinalData, dataServ: data||'',
            cliente: nome, tipo: 'Sinal', valor: String(sinalValor),
            valorTotal: valor, servico: 'Maquiagem', local: 'Studio',
            forma: sinalForma, status: sinalSt, origem: 'Noiva', obs: '',
            auto: false, createdAt: new Date().toISOString(), noivaId: noiva.id
        };
        entries.unshift(sinalEntry); cacheEntries();
        sbCall({action:'save', table:'entries', data:encodeURIComponent(JSON.stringify(sinalEntry))});
        const restante = contrato - sinalValor;
        if (restante > 0.01) {
            const restaEntry = {
                id: genId(), dataPag: data||today(), dataServ: data||'',
                cliente: nome, tipo: 'Pagamento', valor: String(restante),
                valorTotal: valor, servico: 'Maquiagem', local: 'Studio',
                forma: 'PIX', status: 'Previsto', origem: 'Noiva',
                obs: `Restante do contrato (sinal: ${brl(sinalValor)})`,
                auto: true, parentSinalId: sinalIdNoiva,
                createdAt: new Date().toISOString(), noivaId: noiva.id
            };
            entries.unshift(restaEntry); cacheEntries();
            sbCall({action:'save', table:'entries', data:encodeURIComponent(JSON.stringify(restaEntry))});
        }
        toast(`Noiva cadastrada! Sinal ${brl(sinalValor)} + Restante ${brl(restante)} lançados.`);
    } else {
        toast('Noiva cadastrada!');
    }
    noivaDetail = noiva.id;
    closeModal(); render();
}

function deleteNoiva(id) {
    if (!confirm('Excluir esta noiva? Os pagamentos vinculados ficam em Entradas.')) return;
    noivas = noivas.filter(n=>n.id!==id); cacheNoivas();
    noivaDetail=null; render(); toast('Noiva excluída');
    sbCall({action:'delete', table:'noivas', id});
}

function openNoivaPgto(noivaId, nomeCli) {
    _pick = {};
    document.getElementById('modal-bg').style.display='flex';
    document.getElementById('modal-inner').innerHTML=`
    <div class="modal-title">Registrar Pagamento</div>
    <div style="background:var(--brown-l);border-radius:9px;padding:9px 12px;font-size:.85rem;color:var(--brown-d);font-weight:700;margin-bottom:16px">${nomeCli}</div>
    <div class="fg"><label class="fl">Status</label>
        <div class="stog">
            <button class="stbtn on-g" onclick="edPickStatus('Realizado',this)">Realizado</button>
            <button class="stbtn" onclick="edPickStatus('Previsto',this)">Previsto</button>
        </div>
        <input type="hidden" id="ed-status" value="Realizado">
    </div>
    <div class="two">
        <div class="fg"><label class="fl">Data</label><input class="fi" type="date" id="np-data" value="${today()}"></div>
        <div class="fg"><label class="fl">Valor</label><div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="np-valor" placeholder="0,00" step="0.01" min="0" inputmode="decimal"></div></div>
    </div>
    <div class="fg"><label class="fl">Tipo</label><div class="bg">
        ${['Sinal','Parcela','Pagamento'].map((t,i)=>`<button class="bt ${i===1?'on':''}" onclick="edPick('npTipo','${t}',this)">${t}</button>`).join('')}
    </div></div>
    <div class="fg"><label class="fl">Forma de Pagamento</label><div class="bg">
        ${['PIX','Crédito','Dinheiro'].map((t,i)=>`<button class="bt ${i===0?'on':''}" onclick="edPick('npForma','${t}',this)">${t}</button>`).join('')}
    </div></div>
    <div class="fg"><label class="fl">Observações</label><textarea class="fi ta" id="np-obs" placeholder="Ex: 1ª parcela, sinal inicial..."></textarea></div>
    <button class="bsub" onclick="saveNoivaPgto('${noivaId}','${nomeCli.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">Salvar Pagamento</button>
    <button class="skip" onclick="closeModal()">Cancelar</button>`;
    setTimeout(()=>document.getElementById('np-valor')?.focus(),80);
}

function openEditNoivaContrato(noivaId) {
    const noiva = noivas.find(n => n.id === noivaId);
    if (!noiva) return;
    document.getElementById('modal-bg').style.display='flex';
    document.getElementById('modal-inner').innerHTML=`
    <div class="modal-title">Editar Contrato</div>
    <div style="background:var(--brown-l);border-radius:9px;padding:9px 12px;font-size:.85rem;color:var(--brown-d);font-weight:700;margin-bottom:16px">${noiva.nome}</div>
    <div class="fg"><label class="fl">Valor do Contrato</label>
        <div class="vwrap"><span class="vpfx">R$</span><input class="fi" type="number" id="ec-valor" value="${noiva.valorContrato}" step="0.01" min="0" inputmode="decimal"></div>
    </div>
    <div class="fg"><label class="fl">Observações</label>
        <textarea class="fi ta" id="ec-obs" placeholder="Ex: Aditivo: make da mãe incluída...">${noiva.obs||''}</textarea>
    </div>
    <button class="bsub" onclick="saveEditNoivaContrato('${noivaId}')">Salvar Alteração</button>
    <button class="skip" onclick="closeModal()">Cancelar</button>`;
    setTimeout(()=>document.getElementById('ec-valor')?.focus(),80);
}

function saveEditNoivaContrato(noivaId) {
    const valor = document.getElementById('ec-valor').value;
    const obs   = document.getElementById('ec-obs').value;
    if (!valor || Number(valor) <= 0) { toast('⚠️ Informe o valor!'); return; }
    const idx = noivas.findIndex(n => n.id === noivaId);
    if (idx < 0) return;
    noivas[idx] = { ...noivas[idx], valorContrato: valor, obs };
    cacheNoivas();
    sbCall({action:'save', table:'noivas', data: encodeURIComponent(JSON.stringify(noivas[idx]))});
    recalcRestaNoiva(noivaId);
    closeModal(); render();
    toast('Contrato atualizado!');
}

async function uploadNoivaDoc(noivaId, tipo) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        toast('Enviando arquivo...');
        try {
            const b64 = await fileToBase64(file);
            const result = await DB.storage.uploadComprovante(noivaId, file, tipo, b64, file.type);
            const idx = noivas.findIndex(n => n.id === noivaId);
            if (idx < 0) return;
            const doc = { fileId: result.fileId, link: result.link, nome: file.name, tipo, ts: Date.now() };
            const contratos = [...(noivas[idx].contratos || []), doc];
            noivas[idx] = { ...noivas[idx], contratos };
            cacheNoivas();
            sbCall({action:'save', table:'noivas', data: encodeURIComponent(JSON.stringify(noivas[idx]))});
            render();
            toast('Arquivo enviado!');
        } catch(err) {
            toast('Erro ao enviar: ' + err.message);
        }
    };
    input.click();
}

async function deleteNoivaDoc(noivaId, fileId) {
    if (!confirm('Remover este documento?')) return;
    const idx = noivas.findIndex(n => n.id === noivaId);
    if (idx < 0) return;
    try { await DB.storage.deleteComprovante(fileId); } catch(_) {}
    noivas[idx] = { ...noivas[idx], contratos: (noivas[idx].contratos||[]).filter(d=>d.fileId!==fileId) };
    cacheNoivas();
    sbCall({action:'save', table:'noivas', data: encodeURIComponent(JSON.stringify(noivas[idx]))});
    render();
    toast('Documento removido');
}

async function uploadPgtoProof(entryId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        toast('Enviando comprovante...');
        try {
            const b64 = await fileToBase64(file);
            const result = await DB.storage.uploadComprovante(entryId, file, 'PGTO', b64, file.type);
            const idx = entries.findIndex(en => en.id === entryId);
            if (idx < 0) return;
            entries[idx] = { ...entries[idx], comprovanteUrl: result.link };
            cacheEntries();
            sbCall({action:'save', table:'entries', data: encodeURIComponent(JSON.stringify(entries[idx]))});
            render();
            toast('Comprovante salvo!');
        } catch(err) {
            toast('Erro ao enviar: ' + err.message);
        }
    };
    input.click();
}

function saveNoivaPgto(noivaId, nomeCli) {
    const valor  = document.getElementById('np-valor').value;
    const dataPag= document.getElementById('np-data').value;
    const status = document.getElementById('ed-status').value;
    const tipo   = _pick['npTipo']  || 'Parcela';
    const forma  = _pick['npForma'] || 'PIX';
    const obs    = document.getElementById('np-obs')?.value || '';
    if (!valor || Number(valor)<=0) { toast('⚠️ Informe o valor!'); return; }
    const noiva = noivas.find(n=>n.id===noivaId);
    if (noiva) {
        const contrato = Number(noiva.valorContrato||0);
        const pgtos = entries.filter(e=>
            (e.noivaId===noiva.id||(e.origem==='Noiva'&&e.cliente.trim().toLowerCase()===noiva.nome.trim().toLowerCase()))
            && !(e.auto===true||e.auto==='true'));
        const comprometido = pgtos.reduce((t,e)=>t+Number(e.valor||0),0);
        const disponivel = contrato - comprometido;
        if (Number(valor) > disponivel + 0.01) {
            toast(`Valor excede o disponível: ${brl(Math.max(0,disponivel))}`); return;
        }
    }
    const entry = {
        id: genId(), dataPag, dataServ: noiva?.dataCasamento||'',
        cliente: nomeCli, tipo, valor: String(valor),
        valorTotal: noiva?.valorContrato||'', servico:'Maquiagem', local:'Studio',
        forma, status, origem:'Noiva', obs,
        auto: false, createdAt: new Date().toISOString(), noivaId
    };
    entries.unshift(entry); cacheEntries();
    sbCall({action:'save', table:'entries', data:encodeURIComponent(JSON.stringify(entry))});
    recalcRestaNoiva(noivaId);
    closeModal(); render();
    toast(`Pagamento de ${brl(valor)} salvo!`);
}
