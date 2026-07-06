/* ============================================================
   ALERTS — Sistema Inteligente de Alertas e Lembretes (Fase 1)
   Sino global + central de alertas, presente em todos os módulos.

   Padrão: IIFE auto-injetável (igual sidebar.js / global-search.js).
   Lê dados via window.DB. Os alertas são DERIVADOS (recalculados a
   cada refresh). Só a AÇÃO do usuário (resolver/adiar) persiste em
   Supabase (tabela alertas_estado) via DB.alertas, com cache local.

   ── EXTENSÍVEL ──────────────────────────────────────────────
   Adicionar um alerta novo = adicionar um objeto a RULES, ou chamar
   window.Alerts.registerRule(rule) a partir de um módulo. Contrato:

     rule  = { id, domain, evaluate(ctx) -> alert[] }
     ctx   = { data, cfg, today }
     alert = { key, priority, title, desc, href?, actions?[] }
       priority ∈ 'critico' | 'importante' | 'informativo'
       key estável (ex.: 'orc-evento-passou:<id>') → dedupe + persistência
       actions[] = { label, kind?, confirm?, run: async()=>{} }  (opcional)
   ============================================================ */
(function () {
  'use strict';

  /* ── Sensibilidade (Equilibrado — ajustável) ─────────────── */
  var CFG = {
    orcParadoDias:  7,     // orçamento sem movimentação → importante
    orcPerdaDias:   14,    // → crítico (alta prob. de perda)
    dasVenceEmDias: 7,     // DAS vencendo em ≤ N dias
    tetoMeiAlerta:  0.80,  // ≥80% do teto → importante
    tetoMeiCritico: 0.95,  // ≥95% → crítico
    // ── Fase 2 ──
    fluxoHorizonteDias:    30,    // janela p/ projeção de fluxo de caixa
    faturamentoMediaMeses: 3,     // base de meses p/ a média
    faturamentoQuedaPct:   0.70,  // mês < 70% da média → alerta
    agendaDiaCheio:        3,     // ≥ N atendimentos no mesmo dia → "dia cheio"
    maxPorRegra:    30,    // anti-spam: teto de itens por regra
  };

  var LS_CACHE = 'mk_alertas_cache';   // {ts,count,top} — badge instantâneo
  var LS_STATE = 'mk_alertas_estado';  // cache do estado (resolvido/adiado)

  /* ── Helpers ─────────────────────────────────────────────── */
  function byId(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function norm(s){ return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
  function brl(v){ return 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }

  function parseDate(s){
    if(!s) return null;
    var p = String(s).slice(0,10).split('-');
    if(p.length===3){ var d=new Date(+p[0], +p[1]-1, +p[2]); return isNaN(d)?null:d; }
    var dd=new Date(s); return isNaN(dd)?null:dd;
  }
  function startOfToday(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
  function daysBetween(a,b){ return Math.floor((b - a) / 86400000); } // (b - a) em dias
  function daysSince(s, today){ var d=parseDate(s); return d ? daysBetween(d, today) : null; }
  function fmtBR(s){ var d=parseDate(s); if(!d) return ''; return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear(); }
  function fmtComp(s){ var d=parseDate(s); if(!d) return ''; return ('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear(); }

  function hasSession(){
    try{ var s=JSON.parse(localStorage.getItem('mk_session')||'null'); return !!(s && s.expires && Date.now() < s.expires); }
    catch(e){ return false; }
  }

  // Raiz do app derivada do próprio <script src=".../shared/js/alerts.js">.
  // Usar o src resolvido (absoluto) torna a navegação correta em qualquer
  // hospedagem — raiz do domínio OU subpasta (ex.: GitHub Pages /meu-studio/).
  // (Contar segmentos do pathname quebrava no subpath: gerava ../ a mais e
  //  caía na raiz do domínio → 404.)
  var _self = document.currentScript;
  function appRoot(){
    var sc = _self;
    if(!sc){
      var ss=document.getElementsByTagName('script');
      for(var i=ss.length-1;i>=0;i--){ if(/shared\/js\/alerts\.js/.test(ss[i].src)){ sc=ss[i]; break; } }
    }
    var src = sc ? sc.src : '';
    var root = src.replace(/shared\/js\/alerts\.js.*$/, '');
    return root || './';
  }
  function go(href){ window.location.href = appRoot() + href; }

  /* ── Prioridades ─────────────────────────────────────────── */
  var PRIO_RANK = { critico:3, importante:2, informativo:1 };
  var PRIO_META = {
    critico:    { emoji:'🔴', label:'Crítico',     color:'#C62828' },
    importante: { emoji:'🟠', label:'Importante',  color:'#BA7517' },
    informativo:{ emoji:'🔵', label:'Informativo', color:'#1565C0' },
  };
  function topPriority(list){
    var top='informativo';
    list.forEach(function(a){ if(PRIO_RANK[a.priority] > PRIO_RANK[top]) top=a.priority; });
    return top;
  }

  /* ── Faturamento MEI (reusa window.mkFiscal se presente) ──── */
  function faturamentoAno(entries, year){
    if(window.mkFiscal && mkFiscal.faturamentoRealizadoAno) return mkFiscal.faturamentoRealizadoAno(entries, year);
    var t=0; (entries||[]).forEach(function(e){
      if(!e || e.auto || e.status!=='Realizado') return;
      var d=parseDate(e.dataPag); if(!d || d.getFullYear()!==year) return;
      t += parseFloat(e.valor)||0;
    }); return t;
  }
  function tetoAno(cfg, year){
    if(window.mkFiscal && mkFiscal.tetoEfetivo) return mkFiscal.tetoEfetivo(cfg, year);
    return (cfg && parseFloat(cfg.tetoAnual)) || 81000;
  }

  /* ── Registry de regras ──────────────────────────────────── */
  var RULES = [];
  function registerRule(r){ if(r && r.id && typeof r.evaluate==='function') RULES.push(r); }

  var ABERTO = { 'Novo Pedido':1, 'Orçamento Enviado':1 };

  // 1) Orçamento: evento já passou e segue aberto → sugerir Perdido
  registerRule({ id:'orc-evento-passou', domain:'Orçamentos', evaluate:function(ctx){
    var out=[];
    (ctx.data.orcamentos||[]).forEach(function(o){
      if(!ABERTO[o.Status]) return;
      var dev=parseDate(o.DataEvento); if(!dev || dev >= ctx.today) return;
      var dias=daysBetween(dev, ctx.today);
      out.push({
        key:'orc-evento-passou:'+o.ID, priority:'critico',
        title:'Evento já passou — orçamento ainda aberto',
        desc:(o.Cliente||'(sem cliente)')+' · evento '+fmtBR(o.DataEvento)+' (há '+dias+'d) · '+o.Status,
        href:'orcamentos/orcamentos_novo.html?openId='+encodeURIComponent(o.ID),
        actions:[{
          label:'Marcar como Perdido', kind:'primary',
          confirm:'Marcar o orçamento de '+(o.Cliente||'cliente')+' como Perdido (Sem Resposta)?',
          run: function(){ return DB.orcamentos.update(o.ID, { Status:'Perdido - Sem Resposta' }); }
        }]
      });
    });
    return out;
  }});

  // 2) Orçamento parado (sem movimentação) — exclui evento-passado (regra 1)
  registerRule({ id:'orc-parado', domain:'Orçamentos', evaluate:function(ctx){
    var out=[];
    (ctx.data.orcamentos||[]).forEach(function(o){
      if(!ABERTO[o.Status]) return;
      var dev=parseDate(o.DataEvento); if(dev && dev < ctx.today) return; // é da regra 1
      var ref = (o.Status==='Orçamento Enviado' && o.DataEnvio) ? o.DataEnvio : (o.DataPedido || o.DataCriacao);
      var dias=daysSince(ref, ctx.today);
      if(dias==null || dias < ctx.cfg.orcParadoDias) return;
      var crit = dias >= ctx.cfg.orcPerdaDias;
      out.push({
        key:'orc-parado:'+o.ID, priority: crit?'critico':'importante',
        title: crit ? 'Orçamento parado — alta chance de perda' : 'Orçamento sem movimentação',
        desc:(o.Cliente||'(sem cliente)')+' · '+o.Status+' · parado há '+dias+' dias',
        href:'orcamentos/orcamentos_novo.html?openId='+encodeURIComponent(o.ID),
      });
    });
    return out;
  }});

  // 3) Financeiro: entrada prevista vencida (não recebida)
  //  "Abrir" leva ao CARD do orçamento da cliente (contexto: serviço, data,
  //  telefone) — casando por nome. Sem orçamento correspondente (ex.: entrada
  //  avulsa), cai no Financeiro.
  registerRule({ id:'fin-entrada-vencida', domain:'Financeiro', evaluate:function(ctx){
    var out=[];
    var orcaByCli={};
    (ctx.data.orcamentos||[]).forEach(function(o){
      if(!o.Cliente) return;
      var k=norm(o.Cliente);
      if(!orcaByCli[k] || o.Status==='Fechado') orcaByCli[k]=o; // prioriza o Fechado
    });
    (ctx.data.entries||[]).forEach(function(e){
      if(e.status!=='Previsto') return;
      var d=parseDate(e.dataPag); if(!d || d >= ctx.today) return;
      var dias=daysBetween(d, ctx.today);
      var orca = e.cliente ? orcaByCli[norm(e.cliente)] : null;
      out.push({
        key:'fin-entrada-vencida:'+e.id, priority:'importante',
        title:'Entrada prevista não recebida',
        desc:(e.cliente||'(sem nome)')+' · '+brl(e.valor)+' · venceu '+fmtBR(e.dataPag)+' (há '+dias+'d)',
        href: orca
          ? 'orcamentos/orcamentos_novo.html?openId='+encodeURIComponent(orca.ID)
          : 'financeiro/?focus='+encodeURIComponent(e.id)+'&type=entry',
      });
    });
    return out;
  }});

  // 4) Fiscal/MEI: DAS vencido / vencendo
  registerRule({ id:'fiscal-das', domain:'Fiscal/MEI', evaluate:function(ctx){
    var out=[];
    (ctx.data.das||[]).forEach(function(d){
      if(d.pago) return;
      var venc=parseDate(d.vencimento); if(!venc) return;
      var ate=daysBetween(ctx.today, venc); // <0 = vencido
      if(ate < 0){
        out.push({ key:'fiscal-das:'+d.id, priority:'critico',
          title:'DAS vencido',
          desc:'Competência '+fmtComp(d.competencia)+' · '+brl(d.valor)+' · venceu '+fmtBR(d.vencimento)+' (há '+(-ate)+'d)',
          href:'financeiro/fiscal.html' });
      } else if(ate <= ctx.cfg.dasVenceEmDias){
        out.push({ key:'fiscal-das:'+d.id, priority:'importante',
          title:'DAS vencendo',
          desc:'Competência '+fmtComp(d.competencia)+' · '+brl(d.valor)+' · vence '+fmtBR(d.vencimento)+' (em '+ate+'d)',
          href:'financeiro/fiscal.html' });
      }
    });
    return out;
  }});

  // 5) Fiscal/MEI: faturamento se aproximando do teto
  registerRule({ id:'fiscal-teto-mei', domain:'Fiscal/MEI', evaluate:function(ctx){
    var year=ctx.today.getFullYear();
    var fat=faturamentoAno(ctx.data.entries, year);
    var teto=tetoAno(ctx.data.fiscalConfig, year);
    if(!teto || teto<=0 || fat<=0) return [];
    var pct=fat/teto;
    if(pct < ctx.cfg.tetoMeiAlerta) return [];
    var crit = pct >= ctx.cfg.tetoMeiCritico;
    return [{
      key:'fiscal-teto-mei:'+year, priority: crit?'critico':'importante',
      title: crit ? 'Teto do MEI quase no limite' : 'Faturamento se aproximando do teto MEI',
      desc: Math.round(pct*100)+'% do teto · '+brl(fat)+' de '+brl(teto)+' em '+year,
      href:'financeiro/fiscal.html',
    }];
  }});

  // 6) Gestão: tarefa atrasada
  registerRule({ id:'tarefa-atrasada', domain:'Gestão', evaluate:function(ctx){
    var out=[];
    (ctx.data.tarefas||[]).forEach(function(t){
      if(t.feita) return;
      var d=parseDate(t.prazo); if(!d || d >= ctx.today) return;
      var dias=daysBetween(d, ctx.today);
      out.push({
        key:'tarefa-atrasada:'+t.id, priority: t.prioridade==='alta'?'critico':'importante',
        title:'Tarefa atrasada',
        desc:(t.titulo||'(sem título)')+' · venceu '+fmtBR(t.prazo)+' (há '+dias+'d)',
        href:'tarefas/?tarefa='+encodeURIComponent(t.id),
      });
    });
    return out;
  }});

  // 7) Agenda: cliente fechada sem sinal registrado
  registerRule({ id:'orc-sem-sinal', domain:'Agenda', evaluate:function(ctx){
    var out=[], sinais={};
    (ctx.data.entries||[]).forEach(function(e){ if(e.tipo==='Sinal' && e.cliente) sinais[norm(e.cliente)]=true; });
    (ctx.data.orcamentos||[]).forEach(function(o){
      if(o.Status!=='Fechado') return;
      // Atendimento por equipe: não há sinal — pagamento integral no dia do evento
      if(o.Equipe && String(o.Equipe).trim()) return;
      if(sinais[norm(o.Cliente)]) return;
      out.push({
        key:'orc-sem-sinal:'+o.ID, priority:'importante',
        title:'Cliente fechada sem sinal registrado',
        desc:(o.Cliente||'(sem cliente)')+' · fechado'+(o.DataEvento?' · evento '+fmtBR(o.DataEvento):''),
        href:'orcamentos/orcamentos_novo.html?openId='+encodeURIComponent(o.ID),
      });
    });
    return out;
  }});

  // ── Fase 2 ──────────────────────────────────────────────────

  // 8) Financeiro: saídas previstas superam entradas no período (fluxo)
  registerRule({ id:'fin-fluxo-negativo', domain:'Financeiro', evaluate:function(ctx){
    var today=ctx.today, horizon=new Date(today.getTime()+ctx.cfg.fluxoHorizonteDias*86400000);
    var inflow=0, outflow=0;
    (ctx.data.entries||[]).forEach(function(e){
      if(e.status!=='Previsto') return;
      var d=parseDate(e.dataPag); if(!d || d<today || d>horizon) return;
      inflow += parseFloat(e.valor)||0;
    });
    (ctx.data.saidas||[]).forEach(function(s){
      if(s.status==='Pago' || s.status==='Realizado') return; // já liquidadas não são saída futura
      var d=parseDate(s.dataPag); if(!d || d<today || d>horizon) return;
      outflow += parseFloat(s.valor)||0;
    });
    if(outflow<=0 || outflow<=inflow) return [];
    return [{
      key:'fin-fluxo-negativo:'+today.getFullYear()+'-'+(today.getMonth()+1), priority:'importante',
      title:'Saídas previstas superam as entradas',
      desc:'Próximos '+ctx.cfg.fluxoHorizonteDias+'d: saídas '+brl(outflow)+' vs entradas '+brl(inflow)+' · faltam '+brl(outflow-inflow),
      href:'financeiro/',
    }];
  }});

  // 9) Fiscal/MEI: ritmo atual projeta ultrapassar o teto (mesmo sem estar perto ainda)
  registerRule({ id:'fiscal-projecao-teto', domain:'Fiscal/MEI', evaluate:function(ctx){
    var year=ctx.today.getFullYear();
    var fat=faturamentoAno(ctx.data.entries, year), teto=tetoAno(ctx.data.fiscalConfig, year);
    if(!teto || teto<=0 || fat<=0) return [];
    if(fat/teto >= ctx.cfg.tetoMeiAlerta) return []; // já coberto pela regra de teto (atual)
    var start=new Date(year,0,1), end=new Date(year+1,0,1);
    var frac=(ctx.today-start)/(end-start);
    if(frac < 0.15) return []; // cedo demais p/ extrapolar
    var proj=fat/frac;
    if(proj < teto) return [];
    return [{
      key:'fiscal-projecao-teto:'+year, priority:'importante',
      title:'Projeção pode ultrapassar o teto do MEI',
      desc:'No ritmo atual, ~'+brl(proj)+' até dezembro — acima do teto de '+brl(teto)+' ('+brl(fat)+' até agora)',
      href:'financeiro/fiscal.html',
    }];
  }});

  // (Regra "despesa atípica" adiada: contra dados reais floda gastos pessoais
  //  conhecidos — alta variância da natureza Pessoal. Refazer com filtro de
  //  natureza profissional ou crescimento por categoria antes de reativar.)

  // 10) Financeiro: faturamento do mês abaixo da média (só perto do fim do mês, informativo)
  //  Usa a MESMA fórmula do Resumo do app (Realizado por dataPag, inclui auto) —
  //  financeiro/scripts/views.js:542 — para o número bater com o que ela vê na tela.
  registerRule({ id:'fin-faturamento-baixo', domain:'Financeiro', evaluate:function(ctx){
    var today=ctx.today, y=today.getFullYear(), m=today.getMonth();
    var lastDay=new Date(y, m+1, 0).getDate();
    if(today.getDate() < lastDay-4) return []; // só nos últimos 5 dias do mês
    function fatMes(yy,mm){
      var t=0;
      (ctx.data.entries||[]).forEach(function(e){
        if(!e || e.status!=='Realizado') return;
        var d=parseDate(e.dataPag); if(!d || d.getFullYear()!==yy || d.getMonth()!==mm) return;
        t+=parseFloat(e.valor)||0;
      });
      return t;
    }
    var atual=fatMes(y,m), n=ctx.cfg.faturamentoMediaMeses, soma=0;
    for(var i=1;i<=n;i++){ var dd=new Date(y,m-i,1); soma+=fatMes(dd.getFullYear(), dd.getMonth()); }
    var media=soma/n;
    if(media<=0 || atual >= media*ctx.cfg.faturamentoQuedaPct) return [];
    return [{
      key:'fin-faturamento-baixo:'+y+'-'+(m+1), priority:'informativo',
      title:'Faturamento do mês abaixo da média',
      desc:brl(atual)+' neste mês vs média de '+brl(media)+' (últimos '+n+' meses)',
      href:'financeiro/',
    }];
  }});

  // 11) Agenda: dia cheio de atendimentos (deriva da lista de clientes = entries por data de serviço).
  //  O Google Calendar não é acessível de forma confiável pelo app no mobile, então usamos os
  //  atendimentos (cliente único por dia) como fonte — mesma base da tela de Clientes.
  registerRule({ id:'agenda-dia-cheio', domain:'Agenda', evaluate:function(ctx){
    var byDay={};
    (ctx.data.entries||[]).forEach(function(e){
      var ds=e.dataServ||e.dataPag; if(!ds) return;
      var d=parseDate(ds); if(!d || d<ctx.today) return; // só hoje/futuro
      var cli=norm(e.cliente); if(!cli) return;
      (byDay[ds]=byDay[ds]||{})[cli]=1;
    });
    var out=[];
    Object.keys(byDay).forEach(function(ds){
      var n=Object.keys(byDay[ds]).length;
      if(n < ctx.cfg.agendaDiaCheio) return;
      out.push({
        key:'agenda-dia-cheio:'+ds, priority:'informativo',
        title:'Dia cheio de atendimentos',
        desc:fmtBR(ds)+' · '+n+' atendimentos agendados',
        href:'clientes/',
      });
    });
    return out;
  }});

  /* ── Dados (carregados via DB, em paralelo, tolerante a erro) ── */
  var _data = { orcamentos:[], entries:[], saidas:[], tarefas:[], das:[], fiscalConfig:null };
  async function loadData(){
    if(!window.DB) return;
    function safe(p){ return (p && p.catch) ? p.catch(function(){ return null; }) : Promise.resolve(null); }
    var jobs=[];
    if(DB.orcamentos&&DB.orcamentos.list) jobs.push(safe(DB.orcamentos.list()).then(function(d){ if(d)_data.orcamentos=d; }));
    if(DB.entries&&DB.entries.list)       jobs.push(safe(DB.entries.list()).then(function(d){ if(d)_data.entries=d; }));
    if(DB.saidas&&DB.saidas.list)         jobs.push(safe(DB.saidas.list()).then(function(d){ if(d)_data.saidas=d; }));
    if(DB.tarefas&&DB.tarefas.list)       jobs.push(safe(DB.tarefas.list()).then(function(d){ if(d)_data.tarefas=d; }));
    if(DB.fiscal&&DB.fiscal.das&&DB.fiscal.das.list)       jobs.push(safe(DB.fiscal.das.list()).then(function(d){ if(d)_data.das=d; }));
    if(DB.fiscal&&DB.fiscal.config&&DB.fiscal.config.get)  jobs.push(safe(DB.fiscal.config.get()).then(function(d){ _data.fiscalConfig=d; }));
    await Promise.all(jobs);
  }

  /* ── Estado das ações (Supabase + cache local) ───────────── */
  var _state = {};
  async function loadState(){
    try{ _state = JSON.parse(localStorage.getItem(LS_STATE)||'{}') || {}; }catch(e){ _state={}; }
    if(window.DB && DB.alertas && DB.alertas.list){
      try{ var srv=await DB.alertas.list(); if(srv){ _state=srv; localStorage.setItem(LS_STATE, JSON.stringify(srv)); } }catch(e){}
    }
  }
  function setState(key, status, snoozeUntil){
    _state[key] = { status:status, snoozeUntil:snoozeUntil||null };
    try{ localStorage.setItem(LS_STATE, JSON.stringify(_state)); }catch(e){}
    if(window.DB && DB.alertas && DB.alertas.setStatus){ DB.alertas.setStatus(key, status, snoozeUntil).catch(function(){}); }
  }
  function isVisible(a){
    var st=_state[a.key];
    if(!st) return true;
    if(st.status==='resolvido' || st.status==='ignorado') return false;
    if(st.status==='adiado' && st.snoozeUntil) return Date.now() >= new Date(st.snoozeUntil).getTime();
    return true;
  }

  /* ── Cálculo ─────────────────────────────────────────────── */
  var _alerts=[], _view=[];
  function computeAll(){
    var ctx={ data:_data, cfg:CFG, today:startOfToday() }, all=[];
    RULES.forEach(function(rule){
      var out; try{ out=rule.evaluate(ctx)||[]; }catch(e){ out=[]; }
      out.slice(0, CFG.maxPorRegra).forEach(function(a){
        a.ruleId=a.ruleId||rule.id; a.domain=a.domain||rule.domain; all.push(a);
      });
    });
    // ordena por prioridade desc
    all.sort(function(x,y){ return PRIO_RANK[y.priority]-PRIO_RANK[x.priority]; });
    return all;
  }

  /* ── CSS ─────────────────────────────────────────────────── */
  function injectCSS(){
    if(byId('mk-al-css')) return;
    var s=document.createElement('style'); s.id='mk-al-css';
    s.textContent = [
      '#mk-al-fab{position:fixed;top:13px;right:13px;z-index:897;width:36px;height:36px;border-radius:50%;',
      'border:.5px solid rgba(255,255,255,.18);background:rgba(18,5,1,.82);backdrop-filter:blur(10px);',
      '-webkit-backdrop-filter:blur(10px);color:rgba(255,255,255,.85);display:flex;align-items:center;',
      'justify-content:center;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.32);padding:0;',
      'transition:opacity .22s,transform .18s,background .15s;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
      '#mk-al-fab:hover{background:rgba(18,5,1,.97)}#mk-al-fab:active{transform:scale(.9)}',
      '#mk-al-badge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:9px;',
      'background:#C62828;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;',
      'padding:0 4px;box-shadow:0 0 0 2px rgba(18,5,1,.9);display:none;}',
      '#mk-al-bd{position:fixed;inset:0;z-index:1400;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .3s ease;}',
      '#mk-al-bd.on{opacity:1;pointer-events:auto;}',
      '#mk-al-panel{position:fixed;top:0;right:0;height:100vh;height:100dvh;width:344px;max-width:88vw;z-index:1401;',
      'background:#FAF8F6;box-shadow:-8px 0 36px rgba(0,0,0,.22);transform:translateX(380px);',
      'transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
      '#mk-al-panel.on{transform:translateX(0);}',
      '.al-hd{display:flex;align-items:center;justify-content:space-between;padding:18px 16px 13px;',
      'border-bottom:.5px solid #EDE4DF;flex-shrink:0;}',
      '.al-hd-t{font-size:15px;font-weight:700;color:#2C2420;letter-spacing:-.01em;}',
      '.al-hd-t span{font-size:11px;font-weight:500;color:#A8A199;margin-left:6px;}',
      '.al-x{width:28px;height:28px;border-radius:7px;border:none;background:#F5EFEA;color:#6F6660;',
      'font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
      '.al-x:hover{background:#EDE4DF;color:#2C2420;}',
      '.al-body{flex:1;overflow-y:auto;padding:6px 0 16px;-webkit-overflow-scrolling:touch;}',
      '.al-grp{margin-top:8px;}',
      '.al-grp-h{padding:9px 16px 5px;font-size:10px;font-weight:750;letter-spacing:.10em;text-transform:uppercase;display:flex;align-items:center;gap:6px;}',
      '.al-grp-h span{margin-left:auto;background:rgba(0,0,0,.05);color:#6F6660;border-radius:9px;padding:1px 7px;font-size:10px;letter-spacing:0;}',
      '.al-card{background:#fff;border:.5px solid #EDE4DF;border-left:3px solid #ccc;border-radius:10px;padding:11px 12px;margin:7px 12px;}',
      '.al-t{font-size:13px;font-weight:650;color:#2C2420;line-height:1.3;}',
      '.al-d{font-size:11.5px;color:#6F6660;margin-top:3px;line-height:1.45;}',
      '.al-actions,.al-snooze{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;align-items:center;}',
      '.al-snooze{margin-top:7px;}.al-snooze>span{font-size:11px;color:#A8A199;}',
      '.al-btn{font-size:11px;font-weight:600;border-radius:7px;padding:5px 10px;border:1px solid #EDE4DF;',
      'background:#fff;color:#6F6660;cursor:pointer;font-family:inherit;transition:filter .12s,background .12s;}',
      '.al-btn:hover{background:#FAF5F0;}.al-btn:active{transform:translateY(1px);}',
      '.al-btn.primary{background:var(--c,#C62828);color:#fff;border-color:transparent;}',
      '.al-btn.primary:hover{filter:brightness(.93);background:var(--c,#C62828);}',
      '.al-btn[disabled]{opacity:.55;cursor:default;}',
      '.al-empty{text-align:center;color:#A8A199;padding:64px 24px;font-size:15px;font-weight:600;}',
      '.al-empty span{display:block;margin-top:6px;font-size:12px;font-weight:400;color:#C4BDB6;}',
      '.al-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);z-index:1500;',
      'background:rgba(28,20,16,.95);color:#fff;font-size:12.5px;font-weight:500;padding:9px 16px;border-radius:9px;',
      'box-shadow:0 6px 24px rgba(0,0,0,.3);opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:80vw;text-align:center;}',
      '.al-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── DOM ─────────────────────────────────────────────────── */
  var BELL='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

  function build(){
    if(byId('mk-al-bd')) return;
    injectCSS();
    var bd=document.createElement('div'); bd.id='mk-al-bd'; bd.addEventListener('click', close);
    var p=document.createElement('aside'); p.id='mk-al-panel'; p.setAttribute('role','dialog'); p.setAttribute('aria-label','Central de alertas');
    p.innerHTML =
      '<div class="al-hd"><div class="al-hd-t">Alertas<span id="mk-al-sub"></span></div>'+
      '<button class="al-x" id="mk-al-close" aria-label="Fechar">×</button></div>'+
      '<div class="al-body" id="mk-al-body"></div>';
    document.body.appendChild(bd);
    document.body.appendChild(p);
    byId('mk-al-close').addEventListener('click', close);
    byId('mk-al-body').addEventListener('click', onBodyClick);
    document.addEventListener('keydown', function(ev){ if(ev.key==='Escape' && _open) close(); });
  }

  function cardHtml(a){
    var meta=PRIO_META[a.priority]||PRIO_META.informativo, acts='';
    (a.actions||[]).forEach(function(x,i){ acts+='<button class="al-btn primary" data-act="primary" data-i="'+i+'">'+esc(x.label)+'</button>'; });
    if(a.href) acts+='<button class="al-btn" data-act="open">Abrir</button>';
    acts+='<button class="al-btn" data-act="snooze">Adiar</button>';
    acts+='<button class="al-btn" data-act="resolve">Resolver</button>';
    var snooze='<div class="al-snooze" style="display:none">'+
      '<span>Adiar por:</span>'+
      '<button class="al-btn" data-act="snooze-set" data-days="1">1 dia</button>'+
      '<button class="al-btn" data-act="snooze-set" data-days="3">3 dias</button>'+
      '<button class="al-btn" data-act="snooze-set" data-days="7">7 dias</button>'+
      '<button class="al-btn" data-act="snooze-cancel">cancelar</button></div>';
    return '<div class="al-card" data-key="'+esc(a.key)+'" style="--c:'+meta.color+';border-left-color:'+meta.color+'">'+
      '<div class="al-t">'+esc(a.title)+'</div>'+
      '<div class="al-d">'+esc(a.desc||'')+'</div>'+
      '<div class="al-actions">'+acts+'</div>'+snooze+'</div>';
  }

  function render(){
    var body=byId('mk-al-body'); if(!body) return;
    var sub=byId('mk-al-sub'); if(sub) sub.textContent = _view.length ? (_view.length+' pendente'+(_view.length>1?'s':'')) : '';
    if(!_view.length){ body.innerHTML='<div class="al-empty">Tudo em dia ✨<span>Nenhum alerta pendente.</span></div>'; return; }
    var order=['critico','importante','informativo'], html='';
    order.forEach(function(p){
      var items=_view.filter(function(a){ return a.priority===p; });
      if(!items.length) return;
      var meta=PRIO_META[p];
      html+='<div class="al-grp"><div class="al-grp-h" style="color:'+meta.color+'">'+meta.emoji+' '+meta.label+'<span>'+items.length+'</span></div>';
      items.forEach(function(a){ html+=cardHtml(a); });
      html+='</div>';
    });
    body.innerHTML=html;
  }

  function updateBadge(){
    var badge=byId('mk-al-badge'); if(!badge) return;
    var n=_view.length;
    if(n>0){ badge.style.display='block'; badge.textContent = n>9?'9+':String(n); badge.style.background=PRIO_META[topPriority(_view)].color; }
    else badge.style.display='none';
    try{ localStorage.setItem(LS_CACHE, JSON.stringify({ ts:Date.now(), count:n, top:(n?topPriority(_view):null) })); }catch(e){}
  }
  function applyCachedBadge(){
    var badge=byId('mk-al-badge'); if(!badge) return;
    try{
      var c=JSON.parse(localStorage.getItem(LS_CACHE)||'null');
      if(c && c.count>0){ badge.style.display='block'; badge.textContent=c.count>9?'9+':String(c.count); if(c.top&&PRIO_META[c.top]) badge.style.background=PRIO_META[c.top].color; }
    }catch(e){}
  }

  function afterChange(){ _view=_alerts.filter(isVisible); render(); updateBadge(); }

  function onBodyClick(ev){
    var btn=ev.target.closest('[data-act]'); if(!btn) return;
    var card=ev.target.closest('[data-key]'); var key=card&&card.getAttribute('data-key');
    var act=btn.getAttribute('data-act');
    var a=_view.filter(function(x){ return x.key===key; })[0];
    if(act==='open'){ if(a&&a.href) go(a.href); }
    else if(act==='resolve'){ setState(key,'resolvido',null); afterChange(); toast('Alerta resolvido'); }
    else if(act==='snooze'){ var s=card.querySelector('.al-snooze'); if(s) s.style.display='flex'; }
    else if(act==='snooze-cancel'){ var s2=card.querySelector('.al-snooze'); if(s2) s2.style.display='none'; }
    else if(act==='snooze-set'){
      var days=+btn.getAttribute('data-days')||3;
      setState(key,'adiado', new Date(Date.now()+days*86400000).toISOString());
      afterChange(); toast('Adiado por '+days+' dia'+(days>1?'s':''));
    }
    else if(act==='primary'){ runPrimary(a, btn); }
  }

  async function runPrimary(a, btn){
    if(!a) return;
    var i = +btn.getAttribute('data-i') || 0;
    var act = (a.actions||[])[i] || (a.actions||[])[0];
    if(!act || typeof act.run!=='function') return;
    if(act.confirm && !window.confirm(act.confirm)) return;
    var label=btn.textContent; btn.disabled=true; btn.textContent='…';
    try{
      await act.run();
      setState(a.key,'resolvido',null);           // some após a ação
      try{ if(typeof window.syncAll==='function') window.syncAll(); }catch(_){}  // refresh best-effort da página host
      afterChange(); toast('✓ Feito');
    }catch(e){
      btn.disabled=false; btn.textContent=label; toast('Falhou — tente de novo');
    }
  }

  /* ── Toast interno ───────────────────────────────────────── */
  function toast(msg){
    var t=document.createElement('div'); t.className='al-toast'; t.textContent=msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('on'); });
    setTimeout(function(){ t.classList.remove('on'); setTimeout(function(){ if(t.parentNode) t.remove(); }, 320); }, 1900);
  }

  /* ── Abrir / fechar ──────────────────────────────────────── */
  var _open=false, _refreshing=false;
  function open(){ build(); _open=true; byId('mk-al-bd').classList.add('on'); byId('mk-al-panel').classList.add('on'); render(); refresh(); }
  function close(){ _open=false; var bd=byId('mk-al-bd'),p=byId('mk-al-panel'); if(bd)bd.classList.remove('on'); if(p)p.classList.remove('on'); }

  async function refresh(){
    if(_refreshing) return; _refreshing=true;
    try{
      await Promise.all([ loadData(), loadState() ]);
      _alerts=computeAll(); _view=_alerts.filter(isVisible);
      render(); updateBadge();
    } finally { _refreshing=false; }
  }

  /* ── Init ────────────────────────────────────────────────── */
  function mount(){
    if(byId('mk-al-fab')) return;
    injectCSS();
    var fab=document.createElement('button');
    fab.id='mk-al-fab'; fab.setAttribute('aria-label','Alertas'); fab.title='Alertas';
    fab.innerHTML = BELL + '<span id="mk-al-badge"></span>';
    fab.addEventListener('click', open);
    document.body.appendChild(fab);
    applyCachedBadge();   // mostra contador conhecido instantaneamente
    refresh();            // recalcula em segundo plano
  }

  function init(){
    if(hasSession()){ mount(); return; }
    // Hub: sem sessão na carga (tela de login). Mostra o sino assim que logar.
    var hubApp=byId('hub-app');
    if(hubApp && !hubApp._mkAlObs){
      var obs=new MutationObserver(function(){
        if(hasSession() && hubApp.style.display!=='none'){ mount(); obs.disconnect(); hubApp._mkAlObs=null; }
      });
      obs.observe(hubApp, { attributes:true, attributeFilter:['style'] });
      hubApp._mkAlObs=obs;
    }
  }

  /* ── API pública ─────────────────────────────────────────── */
  window.Alerts = { open:open, close:close, refresh:refresh, registerRule:registerRule };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
