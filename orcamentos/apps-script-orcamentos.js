// ╔══════════════════════════════════════════════════════════════════════╗
// ║  APPS SCRIPT — GESTÃO DE ORÇAMENTOS (orcamentos.html)               ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║  COMO INSTALAR:                                                       ║
// ║  1. Abra script.google.com e crie um novo projeto                    ║
// ║  2. Apague o conteúdo padrão e cole TODO este arquivo                ║
// ║  3. Salve (Ctrl+S)                                                   ║
// ║  4. Clique em "Implantar" > "Nova implantação"                       ║
// ║  5. Tipo: "App da Web"                                               ║
// ║  6. Executar como: "Eu (seu e-mail)"                                 ║
// ║  7. Quem tem acesso: "Qualquer pessoa" (necessário para o app HTML)  ║
// ║  8. Clique "Implantar" e copie a URL gerada                          ║
// ║  9. Cole a URL no app orcamentos.html em ⚙️ Configurações           ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── CONFIGURAÇÃO ──────────────────────────────────────────────────────────
const SHEET_NAME = 'Orçamentos';

// Colunas da aba (ordem fixa — não altere sem atualizar HEADERS)
const HEADERS = [
  'ID', 'DataPedido', 'Cliente', 'Telefone', 'Servico',
  'ValorProp', 'Status', 'DataEnvio', 'DataFechamento',
  'ProxFollowup', 'ValorFechado', 'Obs', 'Origem', 'DataEvento', 'DataCriacao'
];

// ── SHEET HELPER ──────────────────────────────────────────────────────────
function getSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);

    // Formatar cabeçalho
    const hdr = sheet.getRange(1, 1, 1, HEADERS.length);
    hdr.setFontWeight('bold')
       .setBackground('#3e2723')
       .setFontColor('#ffffff')
       .setHorizontalAlignment('center');

    // Larguras de coluna
    const widths = [120,100,200,140,200,100,160,100,120,110,110,250,100,110,120];
    widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

    // Congelar cabeçalho
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── CORS HELPER ───────────────────────────────────────────────────────────
function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════════════
//  doGet — leitura de dados
// ══════════════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const action = (e.parameter.action || 'load').toLowerCase();
    if (action === 'load')  return jsonOut(loadEntries());
    if (action === 'stats') return jsonOut(getStats());
    return jsonOut({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  doPost — escrita de dados
// ══════════════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = (body.action || '').toLowerCase();

    if (action === 'save')    return jsonOut(saveEntry(body.entry));
    if (action === 'update')  return jsonOut(updateEntry(body.id, body.fields));
    if (action === 'webhook') return jsonOut(receiveWebhook(body));  // Opção A (Z-API)

    return jsonOut({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  CARREGAR ENTRADAS
// ══════════════════════════════════════════════════════════════════════════
function loadEntries() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, entries: [] };

  const entries = data.slice(1).map(row => {
    const obj = {};
    HEADERS.forEach((h, i) => {
      const val = row[i];
      obj[h] = val instanceof Date
        ? Utilities.formatDate(val, 'America/Sao_Paulo', 'yyyy-MM-dd')
        : (val === null || val === undefined ? '' : String(val));
    });
    return obj;
  }).filter(e => e.ID && e.ID !== '');

  return { ok: true, entries };
}

// ══════════════════════════════════════════════════════════════════════════
//  SALVAR NOVA ENTRADA
// ══════════════════════════════════════════════════════════════════════════
function saveEntry(entry) {
  if (!entry) return { ok: false, error: 'Dados ausentes' };

  const sheet = getSheet();
  const now   = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  const id    = entry.ID || String(Date.now());

  const row = HEADERS.map(h => {
    if (h === 'ID')          return id;
    if (h === 'DataPedido')  return entry.DataPedido  || now;
    if (h === 'DataCriacao') return now;
    if (h === 'Status')      return entry.Status || 'Novo Pedido';
    if (h === 'Origem')      return entry.Origem || 'Manual';
    return entry[h] || '';
  });

  sheet.appendRow(row);

  // Auto-formatar linha nova
  const lastRow = sheet.getLastRow();
  if (lastRow % 2 === 0) {
    sheet.getRange(lastRow, 1, 1, HEADERS.length).setBackground('#fdf8fc');
  }

  return { ok: true, id };
}

// ══════════════════════════════════════════════════════════════════════════
//  ATUALIZAR ENTRADA EXISTENTE
// ══════════════════════════════════════════════════════════════════════════
function updateEntry(id, fields) {
  if (!id || !fields) return { ok: false, error: 'ID ou campos ausentes' };

  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      Object.keys(fields).forEach(key => {
        const colIdx = HEADERS.indexOf(key);
        if (colIdx >= 0) {
          sheet.getRange(i + 1, colIdx + 1).setValue(fields[key]);
        }
      });

      // Colorir linha por status
      const statusIdx = HEADERS.indexOf('Status');
      const newStatus = fields.Status || data[i][statusIdx];
      colorRowByStatus(sheet, i + 1, newStatus);

      return { ok: true };
    }
  }
  return { ok: false, error: 'Entrada não encontrada: ' + id };
}

// ── COLORIR LINHA POR STATUS ──────────────────────────────────────────────
function colorRowByStatus(sheet, rowNum, status) {
  const colors = {
    'Novo Pedido':       '#e3f2fd',
    'Orçamento Enviado': '#fff8e1',
    'Em Negociação':     '#fff3e0',
    'Fechado':           '#e8f5e9',
    'Perdido':           '#ffebee',
    'Sem Resposta':      '#eceff1',
  };
  const bg = colors[status] || '#ffffff';
  sheet.getRange(rowNum, 1, 1, HEADERS.length).setBackground(bg);
}

// ══════════════════════════════════════════════════════════════════════════
//  ESTATÍSTICAS (para uso futuro / dashboard externo)
// ══════════════════════════════════════════════════════════════════════════
function getStats() {
  const { entries } = loadEntries();
  const total   = entries.length;
  const fechados = entries.filter(e => e.Status === 'Fechado').length;
  const receita = entries
    .filter(e => e.Status === 'Fechado')
    .reduce((s, e) => s + (parseFloat(e.ValorFechado) || parseFloat(e.ValorProp) || 0), 0);
  const potencial = entries
    .filter(e => ['Orçamento Enviado', 'Em Negociação'].includes(e.Status))
    .reduce((s, e) => s + (parseFloat(e.ValorProp) || 0), 0);

  return {
    ok: true,
    stats: {
      total, fechados,
      conversao: total ? (fechados / total) : 0,
      receita, potencial,
      porStatus: ['Novo Pedido','Orçamento Enviado','Em Negociação','Fechado','Perdido','Sem Resposta']
        .reduce((acc, s) => { acc[s] = entries.filter(e => e.Status === s).length; return acc; }, {}),
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  OPÇÃO A — WEBHOOK PARA Z-API (ativar quando contratar)
// ══════════════════════════════════════════════════════════════════════════
//
//  Quando você contratar o Z-API (https://z-api.io), configure o webhook
//  para apontar para a URL deste Apps Script.
//  O Z-API enviará cada mensagem recebida no WhatsApp para cá.
//
//  COMO FUNCIONA:
//  1. Z-API recebe mensagem no seu WhatsApp Business
//  2. Envia POST para esta URL com os dados da mensagem
//  3. Esta função analisa se é um pedido de orçamento
//  4. Se for: cria automaticamente na planilha
//  5. Opcionalmente: envia resposta automática de confirmação
//
function receiveWebhook(data) {
  // ── Estrutura do payload Z-API ─────────────────────────────────────────
  // data.phone    → número do remetente (ex: "5511987654321")
  // data.body     → texto da mensagem
  // data.fromMe   → true se foi você que enviou
  // data.isGroup  → true se é grupo (ignorar)

  try {
    // Ignorar mensagens enviadas por você ou grupos
    if (data.fromMe || data.isGroup) return { ok: true, skipped: true };

    const phone   = data.phone   || data.sender || '';
    const msgBody = (data.body   || data.text   || '').toLowerCase();

    // ── Detectar se é pedido de orçamento ────────────────────────────────
    const keywords = [
      'orçamento', 'orcamento', 'quanto custa', 'preço', 'preco',
      'valor', 'disponível', 'disponivel', 'agenda', 'casamento',
      'noiva', 'maquiagem', 'cabelo', 'penteado', 'make', 'evento'
    ];
    const isOrcamento = keywords.some(k => msgBody.includes(k));

    if (!isOrcamento) return { ok: true, skipped: true, reason: 'Não parece pedido de orçamento' };

    // ── Extrair nome (heurística básica) ─────────────────────────────────
    // Tenta pegar nome de saudações como "oi, sou a Maria" ou "meu nome é João"
    let clientName = '';
    const nameMatch = msgBody.match(/(?:sou (?:a |o )?|me chamo |meu nome é )([a-záéíóúàâêôãõç]+)/i);
    if (nameMatch) clientName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
    if (!clientName) clientName = 'Cliente ' + phone.slice(-4); // fallback

    // ── Detectar serviço mencionado ───────────────────────────────────────
    let servico = '';
    if (msgBody.includes('noiva'))                           servico = 'Noiva (pacote completo)';
    else if (msgBody.includes('casamento'))                  servico = 'Noiva (pacote completo)';
    else if (msgBody.includes('maquiagem') && msgBody.includes('cabelo')) servico = 'Maquiagem e Cabelo';
    else if (msgBody.includes('maquiagem') || msgBody.includes('make'))   servico = 'Maquiagem';
    else if (msgBody.includes('penteado'))                   servico = 'Penteado';
    else if (msgBody.includes('cabelo'))                     servico = 'Cabelo';
    else if (msgBody.includes('curso'))                      servico = 'Curso de Automaquiagem';

    // ── Criar entrada no Google Sheets ───────────────────────────────────
    const entry = {
      Cliente:  clientName,
      Telefone: phone,
      Servico:  servico,
      Status:   'Novo Pedido',
      Origem:   'WhatsApp (automático)',
      Obs:      'Mensagem original: ' + (data.body || '').substring(0, 200),
    };
    const result = saveEntry(entry);

    // ── (Opcional) Enviar resposta automática via Z-API ───────────────────
    // Descomente e configure se quiser resposta automática:
    //
    // const ZAPI_INSTANCE = 'SEU_INSTANCE_ID';
    // const ZAPI_TOKEN    = 'SEU_TOKEN';
    // const replyText = `Olá! 😊\nRecebi seu pedido e em breve envio o orçamento!\nAtenciosamente 🎂`;
    // UrlFetchApp.fetch(
    //   `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
    //   {
    //     method: 'post',
    //     contentType: 'application/json',
    //     payload: JSON.stringify({ phone, message: replyText })
    //   }
    // );

    return { ok: true, created: true, id: result.id };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  TRIGGER: limpeza semanal de entradas "Perdido" com mais de 90 dias
//  (opcional — configure em Gatilhos > Baseados em tempo > Semanal)
// ══════════════════════════════════════════════════════════════════════════
function arquivarAntigos() {
  const sheet   = getSheet();
  const data    = sheet.getDataRange().getValues();
  const hoje    = new Date();
  const statusI = HEADERS.indexOf('Status');
  const dataI   = HEADERS.indexOf('DataFechamento');

  // Percorre de baixo pra cima para não deslocar índices ao deletar
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][statusI] !== 'Perdido') continue;
    const dateVal = data[i][dataI];
    if (!dateVal) continue;
    const dias = (hoje - new Date(dateVal)) / 86400000;
    if (dias > 90) sheet.deleteRow(i + 1);
  }
}
