  var DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  var END_STUDIO = 'Rua Barão de Itapagipe, 445, apt 702 bloco A, Tijuca';
  var SERVICOS_MULT = ['Maquiagem','Cabelo','Maquiagem e Cabelo'];
  var DUR = { 'Maquiagem': 60, 'Cabelo': 60, 'Maquiagem e Cabelo': 120 };

  var modoAtual = 'unico';
  var tipoEnd   = 'studio';
  var datas     = [];
  var itens     = [];

  window.addEventListener('load', function() {
    document.getElementById('btnModoUnico').addEventListener('click', function(){ setModo('unico'); });
    document.getElementById('btnModoMultiplos').addEventListener('click', function(){ setModo('multiplos'); });
    document.getElementById('btnAddData').addEventListener('click', adicionarData);
    document.getElementById('btnAddItem').addEventListener('click', adicionarItem);
    adicionarData();
    // Inicializar visual do toggle Gcal
    if (!coworkDisponivel) {
      var tog = document.getElementById('gcalModeToggle');
      if (tog) tog.style.display = 'none';
    } else {
      document.getElementById('btnModeLink').classList.remove('ativo');
      document.getElementById('btnModeDireto').classList.add('ativo');
    }
  });

  function setModo(modo) {
    modoAtual = modo;
    document.getElementById('btnModoUnico').classList.toggle('ativo', modo === 'unico');
    document.getElementById('btnModoMultiplos').classList.toggle('ativo', modo === 'multiplos');
    var isUnico = modo === 'unico';
    document.getElementById('campoNome').style.display         = isUnico ? 'block' : 'none';
    document.getElementById('campoTelefone').style.display     = isUnico ? 'block' : 'none';
    document.getElementById('campoServicoUnico').style.display = isUnico ? 'block' : 'none';
    document.getElementById('campoDatas').style.display        = isUnico ? 'block' : 'none';
    document.getElementById('valoresUnico').style.display      = isUnico ? 'grid'  : 'none';
    document.getElementById('campoItens').style.display        = isUnico ? 'none'  : 'block';
    if (!isUnico && itens.length === 0) { adicionarItem(); adicionarItem(); }
    atualizar();
  }

  function selEnd(tipo) {
    tipoEnd = tipo;
    document.getElementById('btnStudio').classList.toggle('ativo', tipo === 'studio');
    document.getElementById('btnDomicilio').classList.toggle('ativo', tipo === 'domicilio');
    document.getElementById('endStudio').style.display    = tipo === 'studio'    ? 'flex'  : 'none';
    document.getElementById('endDomicilio').style.display = tipo === 'domicilio' ? 'block' : 'none';
    atualizar();
  }
  function getEnd() {
    return tipoEnd === 'studio' ? END_STUDIO : document.getElementById('endDomicilio').value.trim();
  }

  function adicionarData() {
    datas.push({ id: Date.now(), data: '', horario: '' });
    renderDatas();
    atualizar();
  }
  function removerData(id) {
    if (datas.length <= 1) return;
    datas = datas.filter(function(d){ return d.id !== id; });
    renderDatas();
    atualizar();
  }
  function renderDatas() {
    var lista = document.getElementById('datasLista');
    lista.innerHTML = datas.map(function(d) {
      return '<div class="data-row">' +
        '<div class="form-group"><label>Data</label>' +
          '<input type="date" value="' + d.data + '" oninput="syncData(' + d.id + ',\'data\',this.value)" /></div>' +
        '<div class="form-group"><label>Horário de início</label>' +
          '<input type="time" value="' + d.horario + '" oninput="syncData(' + d.id + ',\'horario\',this.value)" /></div>' +
        (datas.length > 1
          ? '<button class="btn-rem-data" onclick="removerData(' + d.id + ')" title="Remover">x</button>'
          : '<div></div>') +
      '</div>';
    }).join('');
  }
  function syncData(id, campo, valor) {
    var d = datas.find(function(x){ return x.id === id; });
    if (d) { d[campo] = valor; atualizar(); }
  }

  function adicionarItem() {
    itens.push({ id: Date.now(), qtd: 1, servico: 'Maquiagem', valorUnit: '' });
    renderItens();
    aoMudarTotalItens();
  }
  function removerItem(id) {
    itens = itens.filter(function(i){ return i.id !== id; });
    renderItens();
    aoMudarTotalItens();
  }
  function renderItens() {
    var lista = document.getElementById('itensLista');
    lista.innerHTML = itens.map(function(item) {
      var opts = SERVICOS_MULT.map(function(s){
        return '<option value="' + s + '"' + (item.servico === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      return '<div class="item-row">' +
        '<input type="number" min="1" step="1" value="' + item.qtd + '" style="text-align:center;padding:7px 5px;" oninput="syncItem(' + item.id + ',\'qtd\',this.value)" />' +
        '<select onchange="syncItem(' + item.id + ',\'servico\',this.value)">' + opts + '</select>' +
        '<input type="number" min="0" step="0.01" value="' + item.valorUnit + '" placeholder="R$ unit." oninput="syncItem(' + item.id + ',\'valorUnit\',this.value)" />' +
        '<div class="item-sub" id="sub-' + item.id + '">' + calcSub(item) + '</div>' +
        '<button class="btn-rem-item" onclick="removerItem(' + item.id + ')">x</button>' +
      '</div>';
    }).join('');
  }
  function syncItem(id, campo, valor) {
    var item = itens.find(function(i){ return i.id === id; });
    if (!item) return;
    item[campo] = campo === 'qtd' ? (parseInt(valor) || 1) : valor;
    var sub = document.getElementById('sub-' + id);
    if (sub) sub.textContent = calcSub(item);
    aoMudarTotalItens();
  }
  function calcSub(item) {
    var q = parseInt(item.qtd) || 0, u = parseFloat(item.valorUnit) || 0;
    return (q && u) ? 'R$ ' + fmt(q * u) : '-';
  }
  function getTotalItens() {
    return itens.reduce(function(s, i){ return s + (parseInt(i.qtd)||0) * (parseFloat(i.valorUnit)||0); }, 0);
  }

  function fmt(v) { return parseFloat(v).toFixed(2).replace('.', ','); }
  function setV(id, v) { var el = document.getElementById(id); if (el) el.value = v > 0 ? parseFloat(v).toFixed(2) : ''; }

  function aoMudarTotal() {
    var total = parseFloat(document.getElementById('total').value) || 0;
    setV('sinal',    Math.round(total * 0.30 * 100) / 100);
    setV('restante', Math.round(total * 0.70 * 100) / 100);
    atualizar();
  }
  function aoMudarSinal() {
    var total = parseFloat(document.getElementById('total').value) || 0;
    var sinal = parseFloat(document.getElementById('sinal').value) || 0;
    setV('restante', Math.max(0, total - sinal));
    atualizar();
  }
  function aoMudarTotalItens() {
    var total = getTotalItens();
    document.getElementById('totalCalc').textContent = total > 0 ? 'R$ ' + fmt(total) : '-';
    setV('sinalMult',    Math.round(total * 0.30 * 100) / 100);
    setV('restanteMult', Math.round(total * 0.70 * 100) / 100);
    atualizar();
  }
  function aoMudarSinalMult() {
    var total = getTotalItens();
    var sinal = parseFloat(document.getElementById('sinalMult').value) || 0;
    setV('restanteMult', Math.max(0, total - sinal));
    atualizar();
  }

  function fmtData(val) {
    if (!val) return '';
    var parts = val.split('-').map(Number);
    var d = String(parts[2]).padStart(2,'0'), m = String(parts[1]).padStart(2,'0');
    var diasSemana = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    var dia = diasSemana[new Date(parts[0], parts[1]-1, parts[2]).getDay()];
    return d + '/' + m + ', ' + dia;
  }
  function fmtHorario(val) { return val ? val.replace(':', 'h') : ''; }
  function addMinutes(horario, mins) {
    if (!horario) return '';
    var parts = horario.split(':').map(Number);
    var total = parts[0] * 60 + parts[1] + mins;
    return String(Math.floor(total/60) % 24).padStart(2,'0') + 'h' + String(total % 60).padStart(2,'0');
  }
  function getServicoDur() {
    var sel = document.getElementById('servico');
    if (!sel || !sel.value) return 60;
    return parseInt(sel.options[sel.selectedIndex].getAttribute('data-dur')) || 60;
  }
  function getServicoAbrev() {
    var sel = document.getElementById('servico');
    if (!sel || !sel.value) return '';
    return sel.options[sel.selectedIndex].getAttribute('data-abrev') || sel.value;
  }
  function getServicoLocal() {
    var sel = document.getElementById('servico');
    if (!sel || !sel.value) return '';
    return sel.options[sel.selectedIndex].getAttribute('data-local') || '';
  }

  function pluralizar(s) {
    if (s === 'Maquiagem') return 'Maquiagens';
    if (s === 'Cabelo') return 'Cabelos';
    if (s === 'Maquiagem e Cabelo') return 'Maquiagens e Cabelos';
    return s + 's';
  }
  function agruparItens(itensValidos) {
    var mapa = {};
    itensValidos.forEach(function(i) {
      var q = parseInt(i.qtd) || 0;
      mapa[i.servico] = (mapa[i.servico] || 0) + q;
    });
    return Object.keys(mapa).map(function(s) { return { servico: s, qtd: mapa[s] }; });
  }

  function montarBlocoUnico(data, horario, servico, endereco, total, sinal, rest) {
    var linha = [];
    linha.push('*Servico:* ' + (servico || '[serviço]'));
    linha.push('*Data:* ' + (fmtData(data) || '[data]'));
    linha.push('*Horario de inicio:* ' + (fmtHorario(horario) || '[horário]'));
    linha.push('*Endereco:* ' + (endereco || '[endereço]'));
    linha.push('*Valor total:* R$ ' + (total > 0 ? fmt(total) : '[valor]'));
    linha.push('*Valor pago na reserva:* R$ ' + (sinal > 0 ? fmt(sinal) : '[sinal]'));
    linha.push('*Restante a ser pago:* R$ ' + (rest > 0 ? fmt(rest) : '[restante]'));
    return linha.join('\n');
  }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function atualizar() {
    var preview    = document.getElementById('preview');
    var gcalSection = document.getElementById('gcalSection');
    if (!preview || !gcalSection) return;

    if (modoAtual === 'unico') {
      var nome    = document.getElementById('nome').value.trim();
      var tel     = document.getElementById('telefone').value.trim();
      var servico = document.getElementById('servico').value;
      var end     = getEnd();
      var total   = parseFloat(document.getElementById('total').value)    || 0;
      var sinal   = parseFloat(document.getElementById('sinal').value)    || 0;
      var rest    = parseFloat(document.getElementById('restante').value) || 0;
      var datasValidas = datas.filter(function(d){ return d.data || d.horario; });

      if (!nome && !servico && datasValidas.length === 0) {
        preview.innerHTML = '<span class="placeholder-text">Preencha os dados acima...</span>';
        gcalSection.style.display = 'none';
        return;
      }

      var plural = datasValidas.length > 1;
      var linhas = [];
      linhas.push('Obrigada, ' + (nome || '[nome]') + '!');
      linhas.push(plural ? 'Seus agendamentos estão confirmados ✅' : 'Seu agendamento está confirmado ✅');
      if (datasValidas.length <= 1) {
        var d0 = datasValidas[0] || { data: '', horario: '' };
        linhas.push('');
        linhas.push(montarBlocoUnico(d0.data, d0.horario, servico, end, total, sinal, rest));
      } else {
        datasValidas.forEach(function(d, idx) {
          linhas.push('');
          linhas.push(montarBlocoUnico(d.data, d.horario, servico, end, total, sinal, rest));
          if (idx < datasValidas.length - 1) linhas.push('');
        });
      }
      preview.textContent = linhas.join('\n');

      gcalSection.style.display = 'block';

    } else {
      var end2     = getEnd();
      var total2   = getTotalItens();
      var sinal2   = parseFloat(document.getElementById('sinalMult').value)    || 0;
      var rest2    = parseFloat(document.getElementById('restanteMult').value) || 0;
      var itensVal = itens.filter(function(i){ return parseInt(i.qtd) > 0 && i.servico; });

      if (itensVal.length === 0) {
        preview.innerHTML = '<span class="placeholder-text">Preencha os dados acima...</span>';
        gcalSection.style.display = 'none';
        return;
      }

      var grupos   = agruparItens(itensVal);
      var descServ = grupos.map(function(g){ return g.qtd + ' ' + (g.qtd > 1 ? pluralizar(g.servico) : g.servico); }).join(' e ');

      var detMapa = {};
      itensVal.filter(function(i){ return parseFloat(i.valorUnit) > 0; }).forEach(function(i) {
        var key = i.servico + '|' + i.valorUnit;
        if (!detMapa[key]) detMapa[key] = { servico: i.servico, valorUnit: i.valorUnit, qtd: 0 };
        detMapa[key].qtd += parseInt(i.qtd);
      });
      var detalhe = Object.keys(detMapa).map(function(k){
        var det = detMapa[k];
        return det.qtd + 'x ' + det.servico + ' R$ ' + fmt(parseFloat(det.valorUnit));
      }).join(' - ');
      var detStr = detalhe ? ' (' + detalhe + ')' : '';

      var dataVal  = document.getElementById('dataM').value;
      var horario2 = document.getElementById('horarioM').value;
      var telM     = document.getElementById('telefoneM').value.trim();

      var linhas2 = [];
      linhas2.push('Agendamentos confirmados! ✅');
      linhas2.push('');
      linhas2.push('*Servico:* ' + descServ);
      linhas2.push('*Data:* ' + (fmtData(dataVal) || '[data]'));
      linhas2.push('*Horario de inicio:* ' + (fmtHorario(horario2) || '[horário]'));
      linhas2.push('*Endereco:* ' + (end2 || '[endereço]'));
      linhas2.push('*Valor total:* R$ ' + (total2 > 0 ? fmt(total2) : '[valor]') + detStr);
      linhas2.push('*Valor pago na reserva:* R$ ' + (sinal2 > 0 ? fmt(sinal2) : '[sinal]'));
      linhas2.push('*Restante a ser pago no dia:* R$ ' + (rest2 > 0 ? fmt(rest2) : '[restante]'));
      preview.textContent = linhas2.join('\n');

      var durTotal = itensVal.reduce(function(acc, i) {
        return acc + (parseInt(i.qtd) || 0) * (DUR[i.servico] || 60);
      }, 0);
      var inicio2 = fmtHorario(horario2);
      var fim2    = horario2 ? addMinutes(horario2, durTotal) : '';
      var localM  = tipoEnd === 'studio' ? 'Studio' : 'Domicílio';
      var tituloM = (inicio2 && fim2 ? inicio2 + ' - ' + fim2 : '[horário]') + ' | ' + descServ + ' | ' + localM;
      var descM = [];
      descM.push('Serviço: ' + descServ);
      descM.push('Data: ' + (fmtData(dataVal) || '[data]'));
      descM.push('Horário de início: ' + (inicio2 || '[horário]'));
      descM.push('Endereço: ' + (end2 || '[endereço]'));
      descM.push('Valor total: R$ ' + (total2 > 0 ? fmt(total2) : '[valor]') + (detalhe ? ' (' + detalhe + ')' : ''));
      descM.push('Valor pago na reserva: R$ ' + (sinal2 > 0 ? fmt(sinal2) : '[sinal]'));
      descM.push('Restante a ser pago no dia: R$ ' + (rest2 > 0 ? fmt(rest2) : '[restante]'));
      if (telM) { descM.push(''); descM.push('Contato: ' + telM); }
      var descMStr = descM.join('\n');

      gcalSection.style.display = 'block';
    }
  }


  var coworkDisponivel = (typeof window !== 'undefined' && typeof window.cowork !== 'undefined');
  var gcalMode = coworkDisponivel ? 'direto' : 'link';

  function setGcalMode(modo) {
    gcalMode = modo;
    document.getElementById('btnModeLink').classList.toggle('ativo', modo === 'link');
    document.getElementById('btnModeDireto').classList.toggle('ativo', modo === 'direto');
    limparStatus();
  }

  function mostrarStatus(msg, tipo) {
    var el = document.getElementById('gcalStatus');
    el.className = 'gcal-status ' + tipo;
    el.textContent = msg;
  }
  function limparStatus() {
    var el = document.getElementById('gcalStatus');
    el.className = 'gcal-status';
    el.textContent = '';
  }

  function pad2(n) { return String(n).padStart(2,'0'); }

  function buildGCalURL(titulo, dataStr, horarioStr, durMinutes, endereco, descricao) {
    if (!dataStr || !horarioStr) return null;
    var dp = dataStr.split('-');
    var tp = horarioStr.split(':');
    var h = parseInt(tp[0]), m = parseInt(tp[1]);
    var startStr = dp[0] + dp[1] + dp[2] + 'T' + pad2(h) + pad2(m) + '00';
    var endTot = h * 60 + m + (durMinutes || 60);
    var eh = Math.floor(endTot / 60) % 24, em = endTot % 60;
    var endStr = dp[0] + dp[1] + dp[2] + 'T' + pad2(eh) + pad2(em) + '00';
    var url = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    url += '&text='    + encodeURIComponent(titulo);
    url += '&dates='   + startStr + '/' + endStr;
    url += '&ctz=America%2FSao_Paulo';
    if (endereco)  url += '&location=' + encodeURIComponent(endereco);
    if (descricao) url += '&details='  + encodeURIComponent(descricao);
    return url;
  }

  function abrirGcal() {
    if (gcalMode === 'direto' && coworkDisponivel) {
      salvarDireto();
    } else {
      var entradas = coletarUrlsGcal();
      if (!entradas.length) { mostrarStatus('Preencha data e horário antes de adicionar à agenda.', 'err'); return; }
      limparStatus();
      if (entradas.length === 1) {
        window.open(entradas[0].url, '_blank');
        var btn = document.getElementById('btnGcalPrincipal');
        if (btn) { btn.classList.add('ok'); btn.textContent = '✓ Agenda aberta!'; setTimeout(function(){ btn.classList.remove('ok'); btn.textContent = '📅 Adicionar ao Google Agenda'; }, 4000); }
        mostrarStatus('⚠️ Na tela do Google Agenda, troque para a agenda "Clientes" antes de salvar.', 'warn');
      } else {
        var el = document.getElementById('gcalStatus');
        el.className = 'gcal-status info';
        var h = '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">Clique para adicionar cada data:</div><div style="font-size:12px;color:#b45309;margin-bottom:6px;">⚠️ Lembre de trocar para a agenda Clientes antes de salvar.</div>';
        entradas.forEach(function(e) {
          h += '<a href="' + e.url + '" target="_blank" class="gcal-link-btn">📅 ' + e.label + '</a>';
        });
        el.innerHTML = h;
      }
    }
  }

  function salvarDireto() {
    var eventos = coletarEventosDiretos();
    if (!eventos.length) { mostrarStatus('Preencha data e horário antes de salvar.', 'err'); return; }
    var calId = 'c82d7e89c34b742daed656c5aa3113d25cb3feda4e8f159936750f2e17473b38@group.calendar.google.com';
    var btn = document.getElementById('btnGcalPrincipal');
    mostrarStatus('Salvando na agenda...', 'loading');
    if (btn) { btn.disabled = true; }

    var promessas = eventos.map(function(ev) {
      var params = {
        summary:   ev.titulo,
        startTime: ev.startISO,
        endTime:   ev.endISO,
        timeZone:  'America/Sao_Paulo',
        description: ev.descricao
      };
      if (ev.endereco) params.location = ev.endereco;
      if (calId)       params.calendarId = calId;
      return window.cowork.callMcpTool(
        'mcp__26a09c15-4d33-4f5b-87c7-da8ae7d87b7c__create_event', params
      );
    });

    Promise.all(promessas).then(function() {
      var n = eventos.length;
      mostrarStatus('✅ ' + n + (n === 1 ? ' evento salvo' : ' eventos salvos') + ' na agenda!', 'ok');
      if (btn) { btn.disabled = false; btn.classList.add('ok'); btn.textContent = '✓ Salvo na agenda!';
        setTimeout(function(){ btn.classList.remove('ok'); btn.textContent = '📅 Adicionar ao Google Agenda'; }, 4000); }
    }).catch(function(err) {
      mostrarStatus('Erro ao salvar: ' + (err.message || err), 'err');
      if (btn) { btn.disabled = false; }
    });
  }

  function toISO(dataStr, horarioStr) {
    /* '2024-05-09' + '10:00' -> '2024-05-09T10:00:00' */
    if (!dataStr || !horarioStr) return null;
    return dataStr + 'T' + horarioStr + ':00';
  }

  function coletarEventosDiretos() {
    var lista = [];
    if (modoAtual === 'unico') {
      var nome    = document.getElementById('nome').value.trim();
      var servico = document.getElementById('servico').value;
      var end     = getEnd();
      var total   = parseFloat(document.getElementById('total').value)    || 0;
      var sinal   = parseFloat(document.getElementById('sinal').value)    || 0;
      var rest    = parseFloat(document.getElementById('restante').value) || 0;
      var dur     = getServicoDur();
      var abrev   = getServicoAbrev();
      var local   = getServicoLocal();
      var tel     = document.getElementById('telefone').value.trim();
      var datasValidas = datas.filter(function(d){ return d.data && d.horario; });
      datasValidas.forEach(function(d) {
        var inicio = fmtHorario(d.horario);
        var fim    = addMinutes(d.horario, dur);
        var titulo = inicio + ' - ' + fim + ' | ' + (nome||'[nome]') + ' | ' + (abrev||'[serviço]') + ' | ' + (local||'[local]');
        var desc = ['Serviço: '+(servico||''), 'Data: '+fmtData(d.data), 'Horário de início: '+inicio,
          'Endereço: '+end, 'Valor total: R$ '+(total>0?fmt(total):''),
          'Valor pago na reserva: R$ '+(sinal>0?fmt(sinal):''),
          'Restante a ser pago no dia: R$ '+(rest>0?fmt(rest):'')];
        if (tel) { desc.push(''); desc.push('Contato: '+tel); }
        /* calcula endTime */
        var tp = d.horario.split(':').map(Number);
        var endMin = tp[0]*60+tp[1]+dur;
        var eh=Math.floor(endMin/60)%24, em=endMin%60;
        var endHStr = pad2(eh)+':'+pad2(em);
        lista.push({ titulo: titulo, startISO: toISO(d.data, d.horario), endISO: toISO(d.data, endHStr), endereco: end, descricao: desc.join('\n') });
      });
    } else {
      var dataVal  = document.getElementById('dataM').value;
      var horario2 = document.getElementById('horarioM').value;
      if (!dataVal || !horario2) return lista;
      var end2   = getEnd();
      var total2 = getTotalItens();
      var sinal2 = parseFloat(document.getElementById('sinalMult').value)||0;
      var rest2  = parseFloat(document.getElementById('restanteMult').value)||0;
      var telM   = document.getElementById('telefoneM').value.trim();
      var itensVal = itens.filter(function(i){ return parseInt(i.qtd)>0 && i.servico; });
      var grupos   = agruparItens(itensVal);
      var descServ = grupos.map(function(g){ return g.qtd+' '+(g.qtd>1?pluralizar(g.servico):g.servico); }).join(' e ');
      var durTotal = itensVal.reduce(function(acc,i){ return acc+(parseInt(i.qtd)||0)*(DUR[i.servico]||60); },0);
      var localM  = tipoEnd==='studio'?'Studio':'Domicílio';
      var inicio2 = fmtHorario(horario2);
      var fim2    = addMinutes(horario2, durTotal);
      var tituloM = inicio2+' - '+fim2+' | '+descServ+' | '+localM;
      var tp2 = horario2.split(':').map(Number);
      var endMin2 = tp2[0]*60+tp2[1]+durTotal;
      var eh2=Math.floor(endMin2/60)%24, em2=endMin2%60;
      var endH2 = pad2(eh2)+':'+pad2(em2);
      var descM = ['Serviço: '+descServ,'Data: '+fmtData(dataVal),'Horário de início: '+inicio2,
        'Endereço: '+end2,'Valor total: R$ '+(total2>0?fmt(total2):''),
        'Valor pago na reserva: R$ '+(sinal2>0?fmt(sinal2):''),
        'Restante a ser pago no dia: R$ '+(rest2>0?fmt(rest2):'')];
      if (telM) { descM.push(''); descM.push('Contato: '+telM); }
      lista.push({ titulo: tituloM, startISO: toISO(dataVal,horario2), endISO: toISO(dataVal,endH2), endereco: end2, descricao: descM.join('\n') });
    }
    return lista;
  }

  function coletarUrlsGcal() {
    var urls = [];
    if (modoAtual === 'unico') {
      var nome    = document.getElementById('nome').value.trim();
      var servico = document.getElementById('servico').value;
      var end     = getEnd();
      var total   = parseFloat(document.getElementById('total').value)    || 0;
      var sinal   = parseFloat(document.getElementById('sinal').value)    || 0;
      var rest    = parseFloat(document.getElementById('restante').value) || 0;
      var dur     = getServicoDur();
      var abrev   = getServicoAbrev();
      var local   = getServicoLocal();
      var tel     = document.getElementById('telefone').value.trim();
      var datasValidas = datas.filter(function(d){ return d.data && d.horario; });
      datasValidas.forEach(function(d) {
        var inicio = fmtHorario(d.horario);
        var fim    = addMinutes(d.horario, dur);
        var titulo = inicio + ' - ' + fim + ' | ' + (nome || '[nome]') + ' | ' + (abrev || '[serviço]') + ' | ' + (local || '[local]');
        var desc = [];
        desc.push('Serviço: ' + (servico || ''));
        desc.push('Data: ' + fmtData(d.data));
        desc.push('Horário de início: ' + inicio);
        desc.push('Endereço: ' + end);
        desc.push('Valor total: R$ ' + (total > 0 ? fmt(total) : ''));
        desc.push('Valor pago na reserva: R$ ' + (sinal > 0 ? fmt(sinal) : ''));
        desc.push('Restante a ser pago no dia: R$ ' + (rest > 0 ? fmt(rest) : ''));
        if (tel) { desc.push(''); desc.push('Contato: ' + tel); }
        var url = buildGCalURL(titulo, d.data, d.horario, dur, end, desc.join('\n'));
        if (url) urls.push({ url: url, label: fmtData(d.data) || ('Data ' + (urls.length+1)) });
      });
    } else {
      var dataVal  = document.getElementById('dataM').value;
      var horario2 = document.getElementById('horarioM').value;
      if (!dataVal || !horario2) return urls;
      var end2   = getEnd();
      var total2 = getTotalItens();
      var sinal2 = parseFloat(document.getElementById('sinalMult').value)    || 0;
      var rest2  = parseFloat(document.getElementById('restanteMult').value) || 0;
      var telM   = document.getElementById('telefoneM').value.trim();
      var itensVal = itens.filter(function(i){ return parseInt(i.qtd) > 0 && i.servico; });
      var grupos   = agruparItens(itensVal);
      var descServ = grupos.map(function(g){ return g.qtd + ' ' + (g.qtd > 1 ? pluralizar(g.servico) : g.servico); }).join(' e ');
      var durTotal = itensVal.reduce(function(acc, i){ return acc + (parseInt(i.qtd)||0) * (DUR[i.servico]||60); }, 0);
      var localM  = tipoEnd === 'studio' ? 'Studio' : 'Domicílio';
      var inicio2 = fmtHorario(horario2);
      var fim2    = addMinutes(horario2, durTotal);
      var tituloM = inicio2 + ' - ' + fim2 + ' | ' + descServ + ' | ' + localM;
      var descM = [];
      descM.push('Serviço: ' + descServ);
      descM.push('Data: ' + fmtData(dataVal));
      descM.push('Horário de início: ' + inicio2);
      descM.push('Endereço: ' + end2);
      descM.push('Valor total: R$ ' + (total2 > 0 ? fmt(total2) : ''));
      descM.push('Valor pago na reserva: R$ ' + (sinal2 > 0 ? fmt(sinal2) : ''));
      descM.push('Restante a ser pago no dia: R$ ' + (rest2 > 0 ? fmt(rest2) : ''));
      if (telM) { descM.push(''); descM.push('Contato: ' + telM); }
      var url = buildGCalURL(tituloM, dataVal, horario2, durTotal, end2, descM.join('\n'));
      if (url) urls.push({ url: url, label: fmtData(dataVal) || 'Agendamento' });
    }
    return urls;
  }

  function copiarTexto(srcId, btnId) {
    var el = document.getElementById(srcId), btn = document.getElementById(btnId);
    if (!el || !btn) return;
    navigator.clipboard.writeText(el.textContent).then(function() {
      var orig = btn.textContent;
      btn.textContent = 'Copiado!';
      btn.classList.add('copied');
      setTimeout(function(){ btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
    });
  }
  function copiar(previewId, btnId) {
    var texto = document.getElementById(previewId).textContent;
    if (!texto || texto.includes('Preencha')) return;
    navigator.clipboard.writeText(texto).then(function() {
      var btn = document.getElementById(btnId);
      btn.classList.add('copied');
      btn.textContent = 'Copiado!';
      setTimeout(function() { btn.classList.remove('copied'); btn.textContent = 'Copiar mensagem'; }, 2000);
    });
  }
  function enviarWA() {
    var texto = document.getElementById('preview').textContent;
    if (!texto || texto.includes('Preencha')) return;
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  }
  function limpar() {
    ['nome','telefone','total','sinal','restante','sinalMult','restanteMult','endDomicilio']
      .forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('servico').value = '';
    document.getElementById('totalCalc').textContent = '-';
    datas = []; itens = [];
    adicionarData();
    renderItens();
    selEnd('studio');
    document.getElementById('preview').innerHTML = '<span class="placeholder-text">Preencha os dados acima...</span>';
    document.getElementById('gcalSection').style.display = 'none';
  }