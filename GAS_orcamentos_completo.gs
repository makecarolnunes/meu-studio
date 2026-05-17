// ╔══════════════════════════════════════════════════════════════╗
// ║  SISTEMA DE ORÇAMENTOS — Google Apps Script COMPLETO        ║
// ║  Versão com múltiplos comprovantes no Google Drive          ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  CONFIGURAÇÕES — edite apenas esta seção                    ║
// ╚══════════════════════════════════════════════════════════════╝

const CONFIG = {
  // ID da planilha (extraia da URL: docs.google.com/spreadsheets/d/ID/edit)
  SHEET_ID:   'COLE_O_ID_DA_SUA_PLANILHA_AQUI',

  // Nome da aba com os orçamentos
  SHEET_NAME: 'Orçamentos',

  // Pasta do Drive para comprovantes
  // URL: https://drive.google.com/drive/folders/1M19ERn0JfD0KlT0sQtv4xDdxQacwAjIz
  COMP_FOLDER_ID: '1M19ERn0JfD0KlT0sQtv4xDdxQacwAjIz',
};

// ──────────────────────────────────────────────────────────────
//  CORS / resposta JSON
// ──────────────────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ──────────────────────────────────────────────────────────────
//  GET — carregamento de entradas
// ──────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = (e.parameter || {}).action || 'load';
    if (action === 'load') {
      return jsonResponse({ ok: true, entries: getEntries() });
    }
    return jsonResponse({ ok: false, error: 'ação GET desconhecida: ' + action });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// ──────────────────────────────────────────────────────────────
//  POST — operações de escrita
// ──────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;

    if (action === 'save')               return jsonResponse(saveEntry(payload.entry));
    if (action === 'update')             return jsonResponse(updateEntry(payload.id, payload.fields));
    if (action === 'delete')             return jsonResponse(deleteEntry(payload.id));
    if (action === 'uploadComprovante')  return jsonResponse(uploadComprovante(payload));
    if (action === 'deleteComprovante')  return jsonResponse(deleteComprovanteFile(payload.fileId));

    return jsonResponse({ ok: false, error: 'ação POST desconhecida: ' + action });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// ──────────────────────────────────────────────────────────────
//  PLANILHA — helpers internos
// ──────────────────────────────────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  return ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
}

function getHeaders(sheet) {
  const row = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return row.map(String);
}

function colIndex(headers, name) {
  const idx = headers.indexOf(name);
  return idx; // -1 se não existir
}

// ──────────────────────────────────────────────────────────────
//  LEITURA — getEntries()
// ──────────────────────────────────────────────────────────────
function getEntries() {
  const sheet   = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const headers = getHeaders(sheet);
  const data    = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return data
    .filter(row => row[0] !== '' && row[0] !== null && row[0] !== undefined)
    .map(row => {
      const entry = {};
      headers.forEach((h, i) => {
        let val = row[i];
        // Datas: converter Date objects para string YYYY-MM-DD
        if (val instanceof Date) {
          if (val.getTime() === 0) { val = ''; }
          else {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            val = y + '-' + m + '-' + d;
          }
        }
        entry[h] = (val === null || val === undefined) ? '' : String(val);
      });
      // Parsear campo Comprovantes se for JSON
      if (entry.Comprovantes && entry.Comprovantes.startsWith('[')) {
        try { entry.Comprovantes = JSON.parse(entry.Comprovantes); } catch(_) {}
      }
      // Parsear campo Comprovante legado (objeto JSON)
      if (entry.Comprovante && entry.Comprovante.startsWith('{')) {
        try { entry.Comprovante = JSON.parse(entry.Comprovante); } catch(_) {}
      }
      return entry;
    });
}

// ──────────────────────────────────────────────────────────────
//  SALVAR — novo orçamento
// ──────────────────────────────────────────────────────────────
function saveEntry(entry) {
  const sheet   = getSheet();
  const headers = getHeaders(sheet);

  // Garantir ID único se não veio
  if (!entry.ID) entry.ID = String(Date.now());

  // Verificar se já existe (evitar duplicata em retry)
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const idCol = colIndex(headers, 'ID');
    if (idCol >= 0) {
      const ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues().flat().map(String);
      if (ids.includes(String(entry.ID))) {
        return { ok: true, id: entry.ID, note: 'já existe' };
      }
    }
  }

  // Montar linha seguindo a ordem dos headers
  const row = headers.map(h => {
    const val = entry[h];
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });

  sheet.appendRow(row);
  return { ok: true, id: entry.ID };
}

// ──────────────────────────────────────────────────────────────
//  ATUALIZAR — campos específicos de um orçamento
// ──────────────────────────────────────────────────────────────
function updateEntry(id, fields) {
  const sheet   = getSheet();
  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'planilha vazia' };

  const idCol = colIndex(headers, 'ID');
  if (idCol < 0) return { ok: false, error: 'coluna ID não encontrada' };

  const idValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues().flat().map(String);
  const rowIdx   = idValues.indexOf(String(id));
  if (rowIdx < 0) return { ok: false, error: 'ID não encontrado: ' + id };

  const sheetRow = rowIdx + 2; // +2: header row + 0-based offset

  Object.entries(fields).forEach(([fieldName, value]) => {
    const colIdx = colIndex(headers, fieldName);
    if (colIdx < 0) {
      // Coluna não existe → criar no final
      const newColIdx = headers.length;
      sheet.getRange(1, newColIdx + 1).setValue(fieldName);
      headers.push(fieldName);
      const cellValue = (typeof value === 'object') ? JSON.stringify(value) : String(value ?? '');
      sheet.getRange(sheetRow, newColIdx + 1).setValue(cellValue);
    } else {
      const cellValue = (typeof value === 'object') ? JSON.stringify(value) : String(value ?? '');
      sheet.getRange(sheetRow, colIdx + 1).setValue(cellValue);
    }
  });

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
//  EXCLUIR — orçamento por ID
// ──────────────────────────────────────────────────────────────
function deleteEntry(id) {
  const sheet   = getSheet();
  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'planilha vazia' };

  const idCol    = colIndex(headers, 'ID');
  if (idCol < 0) return { ok: false, error: 'coluna ID não encontrada' };

  const idValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues().flat().map(String);
  const rowIdx   = idValues.indexOf(String(id));
  if (rowIdx < 0) return { ok: false, error: 'ID não encontrado: ' + id };

  sheet.deleteRow(rowIdx + 2);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
//  DRIVE — helpers
// ──────────────────────────────────────────────────────────────
function getOrCreateSubfolder(parentFolder, nome) {
  const existing = parentFolder.getFoldersByName(nome);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(nome);
}

// ──────────────────────────────────────────────────────────────
//  COMPROVANTE — upload para o Google Drive
// ──────────────────────────────────────────────────────────────
function uploadComprovante(payload) {
  // payload: { id, nome, tipo, dados (base64 sem prefixo), categoria }
  const { id, nome, tipo, dados, categoria } = payload;

  if (!dados) return { ok: false, error: 'dados ausentes' };

  // Decodificar base64
  const bytes = Utilities.base64Decode(dados);
  const blob  = Utilities.newBlob(bytes, tipo || 'application/octet-stream', nome || 'comprovante');

  // Pasta raiz de comprovantes
  const rootFolder = DriveApp.getFolderById(CONFIG.COMP_FOLDER_ID);

  // Criar/obter subpasta por ID do orçamento
  // Buscar nome do cliente para label amigável
  let subNome = 'ORC-' + String(id);
  try {
    const sheet   = getSheet();
    const headers = getHeaders(sheet);
    const idCol   = colIndex(headers, 'ID');
    const cliCol  = colIndex(headers, 'Cliente');
    if (idCol >= 0 && cliCol >= 0) {
      const lastRow = sheet.getLastRow();
      const ids     = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues().flat().map(String);
      const rowIdx  = ids.indexOf(String(id));
      if (rowIdx >= 0) {
        const cliente = sheet.getRange(rowIdx + 2, cliCol + 1).getValue();
        if (cliente) subNome = String(id) + ' - ' + String(cliente);
      }
    }
  } catch(_) {}

  const subFolder = getOrCreateSubfolder(rootFolder, subNome);

  // Salvar arquivo com prefixo de categoria e timestamp
  const ts        = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd_HHmm');
  const catPrefix = categoria ? '[' + categoria.toUpperCase() + '] ' : '';
  const nomeFile  = catPrefix + ts + '_' + (nome || 'comprovante');
  const file      = subFolder.createFile(blob.setName(nomeFile));

  // Compartilhar com link (view only)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    ok:        true,
    fileId:    file.getId(),
    link:      file.getUrl(),
    nome:      nomeFile,
    categoria: categoria || 'outros',
  };
}

// ──────────────────────────────────────────────────────────────
//  COMPROVANTE — remoção do Drive
// ──────────────────────────────────────────────────────────────
function deleteComprovanteFile(fileId) {
  if (!fileId) return { ok: false, error: 'fileId ausente' };
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { ok: true };
  } catch(err) {
    return { ok: false, error: err.toString() };
  }
}

// ──────────────────────────────────────────────────────────────
//  COLUNA AUTOMÁTICA — garante que colunas novas sejam criadas
// ──────────────────────────────────────────────────────────────
function ensureColumns(neededCols) {
  const sheet   = getSheet();
  const headers = getHeaders(sheet);
  const lastCol = sheet.getLastColumn();
  let col = lastCol;

  neededCols.forEach(name => {
    if (!headers.includes(name)) {
      col++;
      sheet.getRange(1, col).setValue(name);
      headers.push(name);
      Logger.log('Coluna criada: ' + name + ' (col ' + col + ')');
    }
  });
}

// ──────────────────────────────────────────────────────────────
//  INICIALIZAÇÃO — cria colunas mínimas se planilha estiver vazia
// ──────────────────────────────────────────────────────────────
function setupSheet() {
  const sheet = getSheet();
  if (sheet.getLastRow() > 0) {
    // Garante colunas novas sem apagar dados
    ensureColumns([
      'Comprovantes', 'AgendaCriada', 'EnderecoEvento',
      'LocalTipo', 'SinalFech', 'SaldoFech', 'DataCriacao'
    ]);
    Logger.log('Colunas verificadas.');
    return;
  }
  // Planilha vazia: criar cabeçalho completo
  const headers = [
    'ID', 'Cliente', 'Telefone', 'Servico', 'Status',
    'DataPedido', 'DataEnvio', 'DataFechamento', 'DataEvento',
    'ValorProp', 'ValorFechado', 'Origem', 'Endereco',
    'Obs', 'ProxFollowup', 'DataCriacao',
    'AgendaCriada', 'EnderecoEvento', 'LocalTipo',
    'SinalFech', 'SaldoFech',
    'Comprovante',    // legado (único)
    'Comprovantes',   // novo (array JSON)
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  Logger.log('Planilha inicializada com ' + headers.length + ' colunas.');
}
