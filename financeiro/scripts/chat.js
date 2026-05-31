// ════════════════════════════════════════════════════════════
// financeiro/scripts/chat.js
// Assistente Claude IA: tool use + contexto + envio/render
// ════════════════════════════════════════════════════════════

let chatHistory = [];

const CHAT_TOOLS = [
  { name:'add_entrada',
    description:'Registra nova entrada de receita. ATENÇÃO: para pagamento de noiva, preencha noivaId com o ID exato retornado ao cadastrar a noiva. NÃO chame add_entrada depois de add_noiva — use os campos sinal_* dentro de add_noiva.',
    input_schema:{ type:'object', properties:{
        dataPag:    { type:'string', description:'Data do pagamento YYYY-MM-DD' },
        dataServ:   { type:'string', description:'Data do serviço YYYY-MM-DD' },
        cliente:    { type:'string', description:'Nome da cliente' },
        tipo:       { type:'string', enum:['Sinal','Parcela','Pagamento'], description:'Tipo do lançamento' },
        valor:      { type:'number', description:'Valor recebido' },
        valorTotal: { type:'number', description:'Valor total do contrato (apenas para Sinal)' },
        servico:    { type:'string', description:'Tipo de serviço', default:'Maquiagem' },
        local:      { type:'string', description:'Local', default:'Studio' },
        forma:      { type:'string', enum:['PIX','Crédito','Dinheiro'], description:'Forma de pagamento' },
        status:     { type:'string', enum:['Realizado','Previsto'], description:'Status do pagamento' },
        origem:     { type:'string', enum:['Produção Social','Noiva','Assistência','Curso de Automaquiagem'], description:'Origem da receita' },
        obs:        { type:'string', description:'Observações opcionais' },
        noivaId:    { type:'string', description:'ID da noiva (obrigatório quando origem=Noiva). Use o ID retornado por add_noiva.' }
    }, required:['cliente','valor','forma','status','origem'] }
  },
  { name:'add_saida',
    description:'Registra nova saída/despesa.',
    input_schema:{ type:'object', properties:{
        dataPag: { type:'string', description:'Data YYYY-MM-DD' },
        tipo:    { type:'string', enum:['Reposição de Material','Curso','DAS','Assistente','Seguro de Celular','Investimento Produto','Investimento Material','Outro'] },
        valor:   { type:'number', description:'Valor da despesa' },
        forma:   { type:'string', enum:['PIX','Crédito','Dinheiro'] },
        status:  { type:'string', enum:['Pago','Pendente'] },
        obs:     { type:'string', description:'Observações' }
    }, required:['tipo','valor','forma','status'] }
  },
  { name:'add_noiva',
    description:'Cadastra noiva E cria automaticamente: (1) entrada do sinal, (2) entrada do restante previsto. NÃO chame add_entrada separadamente depois deste tool.',
    input_schema:{ type:'object', properties:{
        nome:          { type:'string', description:'Nome da noiva' },
        dataCasamento: { type:'string', description:'Data do casamento YYYY-MM-DD' },
        valorContrato: { type:'number', description:'Valor total do contrato' },
        obs:           { type:'string', description:'Observações' },
        sinal_valor:   { type:'number', description:'Valor do sinal (deixe vazio se não houver sinal ainda)' },
        sinal_data:    { type:'string', description:'Data do sinal YYYY-MM-DD' },
        sinal_forma:   { type:'string', enum:['PIX','Crédito','Dinheiro'], description:'Forma do sinal' },
        sinal_status:  { type:'string', enum:['Realizado','Previsto'], description:'Status do sinal' }
    }, required:['nome','valorContrato'] }
  },
  { name:'edit_entrada',
    description:'Edita campos de uma entrada existente. Informe apenas os campos a alterar.',
    input_schema:{ type:'object', properties:{
        id:       { type:'string', description:'ID da entrada' },
        dataPag:  { type:'string' }, dataServ: { type:'string' },
        cliente:  { type:'string' }, tipo:     { type:'string', enum:['Sinal','Parcela','Pagamento'] },
        valor:    { type:'number' }, forma:    { type:'string', enum:['PIX','Crédito','Dinheiro'] },
        status:   { type:'string', enum:['Realizado','Previsto'] },
        origem:   { type:'string', enum:['Produção Social','Noiva','Assistência','Curso de Automaquiagem'] },
        obs:      { type:'string' }
    }, required:['id'] }
  },
  { name:'delete_entrada',
    description:'Exclui uma entrada pelo ID.',
    input_schema:{ type:'object', properties:{ id:{ type:'string', description:'ID da entrada' } }, required:['id'] }
  },
  { name:'edit_saida',
    description:'Edita campos de uma saída existente.',
    input_schema:{ type:'object', properties:{
        id:      { type:'string', description:'ID da saída' },
        dataPag: { type:'string' }, tipo: { type:'string' },
        valor:   { type:'number' }, forma:{ type:'string', enum:['PIX','Crédito','Dinheiro'] },
        status:  { type:'string', enum:['Pago','Pendente'] },
        obs:     { type:'string' }
    }, required:['id'] }
  },
  { name:'delete_saida',
    description:'Exclui uma saída pelo ID.',
    input_schema:{ type:'object', properties:{ id:{ type:'string', description:'ID da saída' } }, required:['id'] }
  },
  { name:'edit_noiva',
    description:'Edita dados de uma noiva existente.',
    input_schema:{ type:'object', properties:{
        id:            { type:'string', description:'ID da noiva' },
        nome:          { type:'string' }, dataCasamento: { type:'string' },
        valorContrato: { type:'number' }, obs: { type:'string' }
    }, required:['id'] }
  },
  { name:'delete_noiva',
    description:'Exclui uma noiva pelo ID (os pagamentos vinculados permanecem em Entradas).',
    input_schema:{ type:'object', properties:{ id:{ type:'string', description:'ID da noiva' } }, required:['id'] }
  }
];

function buildContext() {
    const now = new Date();
    const mAtual = MONTHS[selMonth] + ' ' + selYear;

    const me = entries.filter(e=>{ const my=getMonthYear(e.dataPag); return my&&my.m===selMonth&&my.y===selYear; });
    const fatReal = me.filter(e=>e.status==='Realizado').reduce((t,e)=>t+Number(e.valor||0),0);
    const fatPrev = me.filter(e=>e.status==='Previsto').reduce((t,e)=>t+Number(e.valor||0),0);

    const ms = saidas.filter(s=>{ const my=getMonthYear(s.dataPag); return my&&my.m===selMonth&&my.y===selYear; });
    const despReal = ms.filter(s=>s.status==='Pago').reduce((t,s)=>t+Number(s.valor||0),0);
    const despPrev = ms.filter(s=>s.status==='Pendente').reduce((t,s)=>t+Number(s.valor||0),0);

    const entradasMes = me.map(e=>({
        id:e.id, data:e.dataPag, cliente:e.cliente, tipo:e.tipo,
        valor:Number(e.valor||0), status:e.status, origem:e.origem,
        forma:e.forma, auto:e.auto===true||e.auto==='true', noivaId:e.noivaId||''
    }));

    const anoEntries = entries.filter(e=>{ const my=getMonthYear(e.dataPag); return my&&my.y===selYear; });
    const fatAno = anoEntries.reduce((t,e)=>t+Number(e.valor||0),0);
    const fatAnoReal = anoEntries.filter(e=>e.status==='Realizado').reduce((t,e)=>t+Number(e.valor||0),0);
    const fatAnoPrev = anoEntries.filter(e=>e.status==='Previsto').reduce((t,e)=>t+Number(e.valor||0),0);

    const noivasCtx = noivas.map(n=>{
        const pg  = entries.filter(e=>e.noivaId===n.id||(e.origem==='Noiva'&&e.cliente.trim().toLowerCase()===n.nome.trim().toLowerCase()));
        const pgM = pg.filter(e=>!(e.auto===true||e.auto==='true'));
        const pago = pgM.filter(e=>e.status==='Realizado').reduce((t,e)=>t+Number(e.valor||0),0);
        const prev = pgM.filter(e=>e.status==='Previsto').reduce((t,e)=>t+Number(e.valor||0),0);
        const contrato = Number(n.valorContrato||0);
        const pagamentos = pg.map(e=>({id:e.id,tipo:e.tipo,valor:Number(e.valor||0),status:e.status,data:e.dataPag,forma:e.forma,auto:e.auto===true||e.auto==='true'}));
        return { id:n.id, nome:n.nome, contrato, pago, previsto:prev,
                 saldoRestante:Math.max(0,contrato-pago-prev),
                 dataCasamento:n.dataCasamento||'—', pagamentos };
    });

    const entradasPorMes = {};
    const resumoPorMes = {};
    entries.forEach(e => {
        if (!e.dataPag || typeof e.dataPag !== 'string') return;
        const k = e.dataPag.slice(0,7);
        if (!/^\d{4}-\d{2}$/.test(k)) return;
        if (!entradasPorMes[k]) entradasPorMes[k] = [];
        entradasPorMes[k].push({
            id:e.id, data:e.dataPag, cliente:e.cliente, tipo:e.tipo,
            valor:Number(e.valor||0), status:e.status, origem:e.origem,
            forma:e.forma, auto:e.auto===true||e.auto==='true', noivaId:e.noivaId||''
        });
    });
    Object.keys(entradasPorMes).forEach(k => {
        const arr = entradasPorMes[k];
        const real = arr.filter(x=>x.status==='Realizado').reduce((t,x)=>t+x.valor,0);
        const prev = arr.filter(x=>x.status==='Previsto').reduce((t,x)=>t+x.valor,0);
        resumoPorMes[k] = {
            fatReal: real, fatPrev: prev, fatTotal: real+prev,
            qtdEntradas: arr.length,
            qtdReal: arr.filter(x=>x.status==='Realizado').length,
            qtdPrev: arr.filter(x=>x.status==='Previsto').length
        };
    });

    const mesAtualKey = `${selYear}-${String(selMonth+1).padStart(2,'0')}`;
    const mapaMeses = {
        janeiro:'01', fevereiro:'02', marco:'03', 'março':'03', abril:'04',
        maio:'05', junho:'06', julho:'07', agosto:'08', setembro:'09',
        outubro:'10', novembro:'11', dezembro:'12'
    };

    const ultimasEntradas = [...entries]
        .sort((a,b)=>(b.dataPag||'').localeCompare(a.dataPag||'')||b.createdAt?.localeCompare(a.createdAt)||0)
        .slice(0,40)
        .map(e=>({id:e.id,data:e.dataPag,cliente:e.cliente,tipo:e.tipo,
                  valor:Number(e.valor||0),status:e.status,origem:e.origem,
                  forma:e.forma,auto:e.auto===true||e.auto==='true',noivaId:e.noivaId||''}));

    const ultimasSaidas = [...saidas]
        .sort((a,b)=>b.createdAt?.localeCompare(a.createdAt)||0)
        .slice(0,10)
        .map(s=>({id:s.id,data:s.dataPag,tipo:s.tipo,valor:Number(s.valor||0),status:s.status,forma:s.forma}));

    return JSON.stringify({
        hoje: now.toISOString().slice(0,10),
        mesAtual: mAtual,
        mesAtualKey,
        mapaMeses,
        resumoMes: { fatReal, fatPrev, despReal, despPrev, lucro:fatReal-despReal, totalEntradas: entradasMes.length },
        resumoPorMes,
        entradasMes,
        entradasPorMes,
        fatAno, fatAnoReal, fatAnoPrev,
        noivas: noivasCtx,
        ultimasEntradas,
        ultimasSaidas
    }, null, 0);
}

async function callClaudeAPI(messages) {
    const apiKey = localStorage.getItem('mk_claude_key') || '';
    if (!apiKey) throw new Error('Chave da API Claude não configurada. Acesse ⚙️ → Claude IA e cole sua sk-ant-key.');

    const ctx = buildContext();
    const systemPrompt = `Você é a assistente financeira pessoal de uma maquiadora autônoma chamada Carol.
Você tem acesso aos dados financeiros dela em tempo real e pode criar, editar e excluir lançamentos.

DADOS ATUAIS (JSON):
${ctx}

REGRAS OBRIGATÓRIAS:
1. Para cadastrar noiva com sinal: use SOMENTE add_noiva (com campos sinal_*). NUNCA chame add_entrada logo depois.
2. Para adicionar parcela/pagamento a noiva já cadastrada: use add_entrada com noivaId correto.
3. Pagamentos de noiva NUNCA devem ultrapassar o valor do contrato (campo saldoRestante nos dados).
4. O campo noivaId é OBRIGATÓRIO quando origem="Noiva". Use o ID exato que está nos dados.
5. Responda sempre em português brasileiro, de forma amigável e direta.
6. Após executar uma ação, confirme o que foi feito e mostre o saldo atualizado se relevante.
7. Para excluir ou editar uma entrada, use SEMPRE o campo "id" exato da entrada listada nos dados. Entradas com mesmo valor mas tipos diferentes (ex: Sinal vs Parcela) têm IDs diferentes — use o tipo para diferenciar.
8. Entradas com auto=true são geradas pelo sistema (Restante Previsto de noiva) — NUNCA as exclua diretamente.

REGRA FUNDAMENTAL — ENTRADAS AUTO:
As entradas com auto=true representam o saldo restante previsto de contratos de noivas. Elas são tão reais quanto as manuais e DEVEM ser incluídas em TODOS os cálculos e listagens, sem exceção.

FONTE DE DADOS POR MÊS — REGRA INEGOCIÁVEL:
9. Para QUALQUER pergunta sobre valor previsto, realizado ou total de UM MÊS específico, leia os totais PRÉ-CALCULADOS em resumoPorMes[chave]. NÃO some valores manualmente.
   - resumoPorMes[chave].fatPrev   = previsto
   - resumoPorMes[chave].fatReal   = realizado
   - resumoPorMes[chave].fatTotal  = total
   - Use entradasPorMes[chave] para listar.
   - Se resumoPorMes[chave] for undefined → "Não há lançamentos cadastrados para [Mês] de [Ano]."

10. PROIBIÇÕES:
    - NUNCA use entradasMes para responder sobre um mês citado pelo usuário.
    - NUNCA use ultimasEntradas para somar ou listar entradas de um mês específico.

FORMATO DAS RESPOSTAS:
- NUNCA use tabelas markdown (| col | col |).
- Use linhas simples com hífen: "- Cliente: R$ valor (status)"
- Use **negrito** para valores totais.
- Seja direta e concisa.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{
            'content-type':'application/json',
            'x-api-key': apiKey,
            'anthropic-version':'2023-06-01',
            'anthropic-dangerous-direct-browser-access':'true'
        },
        body: JSON.stringify({
            model:'claude-haiku-4-5-20251001',
            max_tokens:1024,
            system: systemPrompt,
            tools: CHAT_TOOLS,
            tool_choice:{ type:'auto', disable_parallel_tool_use:true },
            messages
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(()=>({error:{message:res.statusText}}));
        throw new Error(err?.error?.message || res.statusText);
    }
    return res.json();
}

async function executeChatTool(name, input) {
    try {
        if (name === 'add_entrada') {
            if (input.origem === 'Noiva' || input.noivaId) {
                const noiva = noivas.find(n=>n.id===input.noivaId)
                           || noivas.find(n=>n.nome.trim().toLowerCase()===(input.cliente||'').trim().toLowerCase());
                if (noiva) {
                    const contrato = Number(noiva.valorContrato||0);
                    const pgtos = entries.filter(e=>
                        (e.noivaId===noiva.id||(e.origem==='Noiva'&&e.cliente.trim().toLowerCase()===noiva.nome.trim().toLowerCase()))
                        && !(e.auto===true||e.auto==='true'));
                    const comprometido = pgtos.reduce((s,e)=>s+Number(e.valor||0),0);
                    const disponivel = contrato - comprometido;
                    if (Number(input.valor||0) > disponivel + 0.01) {
                        return `ERRO: Valor R$${input.valor} excede o disponível (${brl(Math.max(0,disponivel))}) no contrato de ${noiva.nome}. Saldo restante: ${brl(Math.max(0,disponivel))}.`;
                    }
                    if (!input.noivaId && noiva) input.noivaId = noiva.id;
                }
            }
            const entry = {
                id: genId(), dataPag:input.dataPag||today(), dataServ:input.dataServ||'',
                cliente:input.cliente||'', tipo:input.tipo||'Pagamento',
                valor:String(input.valor||0), valorTotal:String(input.valorTotal||''),
                servico:input.servico||'Maquiagem', local:input.local||'Studio',
                forma:input.forma||'PIX', status:input.status||'Realizado',
                origem:input.origem||'Produção Social', obs:input.obs||'',
                auto:false, createdAt:new Date().toISOString(), noivaId:input.noivaId||''
            };
            if (!await sbCall({action:'save', table:'entries', data:encodeURIComponent(JSON.stringify(entry))})) return `ERRO: falha ao salvar no servidor — entrada NÃO criada. Avise a usuária para tentar de novo.`;
            entries.unshift(entry); cacheEntries();
            if (entry.noivaId) await recalcRestaNoiva(entry.noivaId);
            else if (entry.origem==='Noiva') await recalcRestaNoiva(entry.cliente);
            render();
            return `Entrada criada: id="${entry.id}" | ${entry.cliente} | ${entry.tipo} | ${brl(entry.valor)} | ${entry.status} | noivaId="${entry.noivaId}"`;
        }
        if (name === 'add_saida') {
            const saida = {
                id:genId(), dataPag:input.dataPag||today(),
                tipo:input.tipo||'Outro', valor:String(input.valor||0),
                forma:input.forma||'PIX', status:input.status||'Pago',
                obs:input.obs||'', createdAt:new Date().toISOString()
            };
            if (!await sbCall({action:'save', table:'saidas', data:encodeURIComponent(JSON.stringify(saida))})) return `ERRO: falha ao salvar no servidor — saída NÃO criada. Avise a usuária para tentar de novo.`;
            saidas.unshift(saida); cacheSaidas();
            render();
            return `Saída criada: id="${saida.id}" | ${saida.tipo} | ${brl(saida.valor)} | ${saida.status}`;
        }
        if (name === 'add_noiva') {
            const noiva = {
                id:genId(), nome:input.nome, dataCasamento:input.dataCasamento||'',
                valorContrato:String(input.valorContrato||0), obs:input.obs||'',
                createdAt:new Date().toISOString()
            };
            if (!await sbCall({action:'save', table:'noivas', data:encodeURIComponent(JSON.stringify(noiva))})) return `ERRO: falha ao salvar no servidor — noiva NÃO criada. Avise a usuária para tentar de novo.`;
            const contrato = Number(input.valorContrato||0);
            const sinalValor = Number(input.sinal_valor||0);
            const restante = contrato - sinalValor;
            let msg = `Noiva cadastrada: noivaId="${noiva.id}" | ${noiva.nome} | contrato ${brl(contrato)}`;
            let sinalEntry = null, restaEntry = null;
            if (sinalValor > 0 && sinalValor <= contrato) {
                const sinalIdChat = genId();
                sinalEntry = {
                    id:sinalIdChat, dataPag:input.sinal_data||today(), dataServ:input.dataCasamento||'',
                    cliente:noiva.nome, tipo:'Sinal', valor:String(sinalValor),
                    valorTotal:String(contrato), servico:'Maquiagem', local:'Studio',
                    forma:input.sinal_forma||'PIX', status:input.sinal_status||'Realizado',
                    origem:'Noiva', obs:'', auto:false, createdAt:new Date().toISOString(), noivaId:noiva.id
                };
                if (!await sbCall({action:'save', table:'entries', data:encodeURIComponent(JSON.stringify(sinalEntry))})) {
                    await sbCall({action:'delete', table:'noivas', id:noiva.id});   // rollback
                    return `ERRO: falha ao salvar o sinal — noiva desfeita. Tente de novo.`;
                }
                if (restante > 0.01) {
                    restaEntry = {
                        id:genId(), dataPag:noiva.dataCasamento||today(), dataServ:noiva.dataCasamento||'',
                        cliente:noiva.nome, tipo:'Pagamento', valor:String(restante),
                        valorTotal:String(contrato), servico:'Maquiagem', local:'Studio',
                        forma:'PIX', status:'Previsto', origem:'Noiva',
                        obs:`Restante do contrato (sinal: ${brl(sinalValor)})`,
                        auto:true, parentSinalId:sinalIdChat,
                        createdAt:new Date().toISOString(), noivaId:noiva.id
                    };
                    if (!await sbCall({action:'save', table:'entries', data:encodeURIComponent(JSON.stringify(restaEntry))})) {
                        await sbCall({action:'delete', table:'entries', id:sinalEntry.id});
                        await sbCall({action:'delete', table:'noivas', id:noiva.id});
                        return `ERRO: falha ao salvar o restante — noiva desfeita. Tente de novo.`;
                    }
                }
                msg += ` | sinal ${brl(sinalValor)} lançado | restante previsto ${brl(Math.max(0,restante))}`;
            } else if (sinalValor > contrato) {
                msg += ` | AVISO: sinal ${brl(sinalValor)} maior que contrato — sinal NÃO lançado.`;
            }
            // Tudo confirmado no Supabase → aplica na memória
            noivas.unshift(noiva); cacheNoivas();
            if (sinalEntry) entries.unshift(sinalEntry);
            if (restaEntry) entries.unshift(restaEntry);
            if (sinalEntry || restaEntry) cacheEntries();
            render();
            return msg;
        }
        if (name === 'edit_entrada') {
            const idx = entries.findIndex(e=>String(e.id)===String(input.id));
            if (idx<0) return `ERRO: entrada id="${input.id}" não encontrada.`;
            const old = entries[idx];
            const updated = { ...old };
            if (input.dataPag  !== undefined) updated.dataPag  = input.dataPag;
            if (input.dataServ !== undefined) updated.dataServ = input.dataServ;
            if (input.cliente  !== undefined) updated.cliente  = input.cliente;
            if (input.tipo     !== undefined) updated.tipo     = input.tipo;
            if (input.valor    !== undefined) {
                if (updated.noivaId || updated.origem==='Noiva') {
                    const noiva = noivas.find(n=>n.id===updated.noivaId)
                               || noivas.find(n=>n.nome.trim().toLowerCase()===updated.cliente.trim().toLowerCase());
                    if (noiva) {
                        const contrato = Number(noiva.valorContrato||0);
                        const pgtos = entries.filter(e=>
                            e.id !== old.id &&
                            (e.noivaId===noiva.id||(e.origem==='Noiva'&&e.cliente.trim().toLowerCase()===noiva.nome.trim().toLowerCase()))
                            && !(e.auto===true||e.auto==='true'));
                        const comprometido = pgtos.reduce((s,e)=>s+Number(e.valor||0),0);
                        if (Number(input.valor) > contrato - comprometido + 0.01) {
                            return `ERRO: Novo valor excede o disponível no contrato de ${noiva.nome}.`;
                        }
                    }
                }
                updated.valor = String(input.valor);
            }
            if (input.forma   !== undefined) updated.forma   = input.forma;
            if (input.status  !== undefined) updated.status  = input.status;
            if (input.origem  !== undefined) updated.origem  = input.origem;
            if (input.obs     !== undefined) updated.obs     = input.obs;
            if (!await sbCall({action:'save', table:'entries', data:encodeURIComponent(JSON.stringify(updated))})) return `ERRO: falha ao salvar no servidor — entrada NÃO atualizada.`;
            entries[idx] = updated; cacheEntries();
            if (updated.noivaId) await recalcRestaNoiva(updated.noivaId);
            else if (updated.origem==='Noiva') await recalcRestaNoiva(updated.cliente);
            render();
            return `Entrada atualizada: id="${updated.id}" | ${updated.cliente} | ${brl(updated.valor)} | ${updated.status}`;
        }
        if (name === 'delete_entrada') {
            const e = entries.find(x=>String(x.id)===String(input.id));
            if (!e) return `ERRO: entrada id="${input.id}" não encontrada.`;
            if (!await sbCall({action:'delete', table:'entries', id:input.id})) return `ERRO: falha ao excluir no servidor — entrada NÃO excluída.`;
            entries = entries.filter(x=>String(x.id)!==String(input.id)); cacheEntries();
            if (e.noivaId) await recalcRestaNoiva(e.noivaId);
            else if (e.origem==='Noiva') await recalcRestaNoiva(e.cliente);
            render();
            return `Entrada id="${input.id}" excluída.`;
        }
        if (name === 'edit_saida') {
            const idx = saidas.findIndex(s=>s.id===input.id);
            if (idx<0) return `ERRO: saída id="${input.id}" não encontrada.`;
            const updated = { ...saidas[idx] };
            if (input.dataPag !== undefined) updated.dataPag = input.dataPag;
            if (input.tipo    !== undefined) updated.tipo    = input.tipo;
            if (input.valor   !== undefined) updated.valor   = String(input.valor);
            if (input.forma   !== undefined) updated.forma   = input.forma;
            if (input.status  !== undefined) updated.status  = input.status;
            if (input.obs     !== undefined) updated.obs     = input.obs;
            if (!await sbCall({action:'save', table:'saidas', data:encodeURIComponent(JSON.stringify(updated))})) return `ERRO: falha ao salvar no servidor — saída NÃO atualizada.`;
            saidas[idx] = updated; cacheSaidas();
            render();
            return `Saída atualizada: id="${updated.id}" | ${updated.tipo} | ${brl(updated.valor)}`;
        }
        if (name === 'delete_saida') {
            if (!saidas.find(s=>s.id===input.id)) return 'ERRO: saida id="'+input.id+'" nao encontrada.';
            if (!await sbCall({action:'delete',table:'saidas',id:input.id})) return 'ERRO: falha ao excluir no servidor — saida NAO excluida.';
            saidas = saidas.filter(s=>s.id!==input.id); cacheSaidas();
            render();
            return 'Saida id="'+input.id+'" excluida.';
        }
        if (name === 'edit_noiva') {
            const idx = noivas.findIndex(n=>String(n.id)===String(input.id));
            if (idx<0) return 'ERRO: noiva id="'+input.id+'" nao encontrada.';
            const updated = {...noivas[idx]};
            if (input.nome          != null) updated.nome          = input.nome;
            if (input.dataCasamento != null) updated.dataCasamento = input.dataCasamento;
            if (input.valorContrato != null) updated.valorContrato = String(input.valorContrato);
            if (input.obs           != null) updated.obs           = input.obs;
            if (!await sbCall({action:'save',table:'noivas',data:encodeURIComponent(JSON.stringify(updated))})) return 'ERRO: falha ao salvar no servidor — noiva NAO atualizada.';
            noivas[idx] = updated; cacheNoivas();
            if (input.valorContrato != null) await recalcRestaNoiva(updated.id);
            render();
            return 'Noiva atualizada: id="'+updated.id+'" | '+updated.nome+' | contrato '+brl(updated.valorContrato);
        }
        if (name === 'delete_noiva') {
            if (!noivas.find(n=>String(n.id)===String(input.id))) return 'ERRO: noiva id="'+input.id+'" nao encontrada.';
            if (!await sbCall({action:'delete',table:'noivas',id:input.id})) return 'ERRO: falha ao excluir no servidor — noiva NAO excluida.';
            noivas = noivas.filter(n=>String(n.id)!==String(input.id)); cacheNoivas();
            render();
            return 'Noiva id="'+input.id+'" excluida.';
        }
        return 'ERRO: tool desconhecida "'+name+'".';
    } catch(err) {
        return 'ERRO interno: '+err.message;
    }
}

function openChat() {
    document.getElementById('chat-modal').style.display='flex';
    renderChatMessages();
    setTimeout(()=>document.getElementById('chat-input')?.focus(),120);
}
function closeChat() { document.getElementById('chat-modal').style.display='none'; render(); }

function renderMd(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/((?:^|\n)[•\-\*] .+)+/g, m => {
            const items = m.trim().split(/\n[•\-\*] /).map((s,i)=>i===0?s.replace(/^[•\-\*] /,''):s);
            return '<ul>' + items.map(s=>`<li>${s.trim()}</li>`).join('') + '</ul>';
        })
        .replace(/\n{2,}/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

function renderChatMessages() {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    if (!chatHistory.length) {
        box.innerHTML='<div style="text-align:center;color:var(--muted);font-size:.83rem;padding:30px 0">Olá! Sou sua assistente financeira.<br>Posso consultar seus dados, registrar entradas, saídas e noivas.<br><br><em>Ex: "quanto faturei esse mês?" ou "cadastrar noiva Julia, contrato R$3000, sinal R$600 PIX"</em></div>';
    } else {
        box.innerHTML = chatHistory.map(m=>{
            const bubble = m.role==='user' ? 'user' : 'ai';
            const body   = m.role==='user'
                ? m.content.replace(/\n/g,'<br>')
                : renderMd(m.content);
            return `<div class="chat-bubble-${bubble}">${body}</div>`;
        }).join('');
    }
    box.scrollTop = box.scrollHeight;
}

async function sendChat() {
    const inp = document.getElementById('chat-input');
    const msg = inp?.value?.trim();
    if (!msg) return;
    inp.value = '';
    chatHistory.push({role:'user',content:msg});
    renderChatMessages();
    document.getElementById('chat-typing').style.display='flex';
    document.getElementById('chat-send').disabled=true;
    try {
        let messages = chatHistory.slice(0,-1).concat([{role:'user',content:msg}]).map(m=>({role:m.role,content:m.content}));
        let data = await callClaudeAPI(messages);
        let rounds = 0;
        while (data.stop_reason==='tool_use' && rounds<5) {
            rounds++;
            const toolBlocks = data.content.filter(b=>b.type==='tool_use');
            const toolResults = [];
            for (const b of toolBlocks) {
                toolResults.push({ type:'tool_result', tool_use_id:b.id, content: await executeChatTool(b.name, b.input) });
            }
            messages = [...messages,{role:'assistant',content:data.content},{role:'user',content:toolResults}];
            data = await callClaudeAPI(messages);
        }
        const reply = Array.isArray(data.content)
            ? (data.content.find(b=>b.type==='text')?.text||'(sem resposta)')
            : (data.content||'(sem resposta)');
        chatHistory.push({role:'assistant',content:reply});
    } catch(err) {
        chatHistory.push({role:'assistant',content:'Erro: '+err.message});
    } finally {
        document.getElementById('chat-typing').style.display='none';
        document.getElementById('chat-send').disabled=false;
        renderChatMessages();
    }
}
