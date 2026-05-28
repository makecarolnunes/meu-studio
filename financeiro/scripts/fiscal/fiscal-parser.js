// ════════════════════════════════════════════════════════════
// fiscal-parser.js — OFX (SGML/XML) + CSV (auto-detect)
// Saída padronizada: { transacoes, banco, conta, periodo }
// transacoes = [{ data, descricao, valor, tipoMov }]
// ════════════════════════════════════════════════════════════

// ── Hash dedup ───────────────────────────────────────────────
async function fsHashTransacao(banco, data, valor, descricao) {
  const norm = String(descricao || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const str = `${banco||''}|${data}|${valor.toFixed(2)}|${norm}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Normalizadores ───────────────────────────────────────────
function fsNormDataOfx(s) {
  // OFX usa YYYYMMDD[HHMMSS][.SSS][TZ]
  if (!s) return '';
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
function fsNormDataBr(s) {
  // dd/mm/yyyy ou dd-mm-yyyy
  if (!s) return '';
  const m = String(s).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) {
    // YYYY-MM-DD direto
    const m2 = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m2 ? `${m2[1]}-${m2[2]}-${m2[3]}` : '';
  }
  let yyyy = m[3];
  if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy;
  return `${yyyy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function fsNormValor(s) {
  if (s == null) return 0;
  let v = String(s).trim();
  if (!v) return 0;
  // Remove R$, espaços
  v = v.replace(/R\$\s*/gi, '').replace(/\s/g, '');
  // Formato BR: 1.234,56 → 1234.56
  if (/,/.test(v) && /\./.test(v)) {
    v = v.replace(/\./g, '').replace(',', '.');
  } else if (/,/.test(v)) {
    v = v.replace(',', '.');
  }
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ════════════════════════════════════════════════════════════
//  OFX PARSER
// ════════════════════════════════════════════════════════════
function fsParseOfx(text) {
  if (!text) throw new Error('Arquivo vazio');
  // Remove cabeçalho SGML (linhas antes do <OFX>)
  const ofxStart = text.indexOf('<OFX>');
  if (ofxStart < 0) throw new Error('Não parece um arquivo OFX válido');
  const body = text.slice(ofxStart);

  const get = (tag, src = body) => {
    const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
    const m = src.match(re);
    return m ? m[1].trim() : '';
  };
  const getAll = (tag, src = body) => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const out = [];
    let m;
    while ((m = re.exec(src)) !== null) out.push(m[1]);
    return out;
  };

  // Banco (BANKID) + conta (ACCTID)
  const banco = fsBancoNomeDoBankId(get('BANKID')) || get('ORG') || 'Banco';
  const conta = get('ACCTID');
  const periodoIni = fsNormDataOfx(get('DTSTART'));
  const periodoFim = fsNormDataOfx(get('DTEND'));

  // Transações: <STMTTRN>...</STMTTRN> (com fechamento) OU bloco solto SGML
  let trnBlocks = getAll('STMTTRN');
  if (!trnBlocks.length) {
    // SGML sem fechamento: split por <STMTTRN>
    const parts = body.split(/<STMTTRN>/i).slice(1);
    trnBlocks = parts.map(p => p.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);
  }

  const transacoes = trnBlocks.map(b => {
    const tipo  = get('TRNTYPE', b).toUpperCase();
    const data  = fsNormDataOfx(get('DTPOSTED', b));
    const memo  = (get('MEMO', b) || '').replace(/\s+/g, ' ').trim();
    const name  = (get('NAME', b) || '').replace(/\s+/g, ' ').trim();
    const desc  = memo || name || '';
    const valor = fsNormValor(get('TRNAMT', b));
    return {
      data,
      descricao: desc,
      valor,
      tipoMov: valor >= 0 ? 'CREDITO' : 'DEBITO',
      _ofxTipo: tipo,
    };
  }).filter(t => t.data && t.valor !== 0);

  return { transacoes, banco, conta, periodoIni, periodoFim };
}

function fsBancoNomeDoBankId(bankId) {
  const map = {
    '237': 'Bradesco', '341': 'Itaú', '001': 'Banco do Brasil',
    '104': 'Caixa', '033': 'Santander', '422': 'Safra',
    '260': 'Nubank', '077': 'Inter', '335': 'Digio',
    '212': 'Banco Original', '380': 'PicPay', '290': 'PagSeguro',
    '323': 'Mercado Pago', '336': 'C6 Bank',
  };
  return map[String(bankId).padStart(3, '0')] || '';
}

// ════════════════════════════════════════════════════════════
//  CSV PARSER (auto-detect)
// ════════════════════════════════════════════════════════════
function fsParseCsv(text, bancoHint) {
  if (!text) throw new Error('Arquivo vazio');
  // Detecta separador (vírgula ou ponto-e-vírgula)
  const sep = (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length) ? ';' : ',';
  const linhas = text.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) throw new Error('CSV vazio');

  // Detecta header (1ª linha não-numérica)
  const headerLine = linhas[0];
  const headerCols = fsCsvSplit(headerLine, sep).map(c => c.toLowerCase().trim().replace(/"/g,''));
  const dataLines = linhas.slice(1);

  // Detecta colunas
  const idxData = headerCols.findIndex(c => /data|date/i.test(c));
  const idxDesc = headerCols.findIndex(c => /descri|histor|estabeleci|memo|category|merchant/i.test(c));
  const idxValor= headerCols.findIndex(c => /valor|amount|montante/i.test(c));
  const idxDeb  = headerCols.findIndex(c => /d[ée]bito|debit/i.test(c));
  const idxCred = headerCols.findIndex(c => /cr[ée]dito|credit/i.test(c));
  const idxTipo = headerCols.findIndex(c => /tipo|type/i.test(c));

  if (idxData < 0) throw new Error('CSV não tem coluna de data reconhecível');
  if (idxValor < 0 && idxDeb < 0 && idxCred < 0) throw new Error('CSV não tem coluna de valor reconhecível');

  const transacoes = [];
  for (const linha of dataLines) {
    const cols = fsCsvSplit(linha, sep).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;
    const data = fsNormDataBr(cols[idxData]);
    const desc = (idxDesc >= 0 ? cols[idxDesc] : '').trim();
    let valor = 0;
    if (idxValor >= 0) {
      valor = fsNormValor(cols[idxValor]);
      // Tipo opcional sinaliza débito
      if (idxTipo >= 0) {
        const t = (cols[idxTipo] || '').toLowerCase();
        if (/d[ée]bito|debit|saida|saída/.test(t)) valor = -Math.abs(valor);
        else if (/cr[ée]dito|credit|entrada/.test(t)) valor = Math.abs(valor);
      }
    } else {
      const debv  = idxDeb  >= 0 ? fsNormValor(cols[idxDeb])  : 0;
      const credv = idxCred >= 0 ? fsNormValor(cols[idxCred]) : 0;
      valor = credv > 0 ? credv : -Math.abs(debv);
    }
    if (!data || valor === 0) continue;
    transacoes.push({
      data, descricao: desc, valor,
      tipoMov: valor >= 0 ? 'CREDITO' : 'DEBITO',
    });
  }

  const periodoIni = transacoes.length ? transacoes.map(t => t.data).sort()[0] : '';
  const periodoFim = transacoes.length ? transacoes.map(t => t.data).sort().slice(-1)[0] : '';

  return {
    transacoes,
    banco: bancoHint || fsDetectarBancoPorCsv(headerCols) || 'Banco',
    conta: '',
    periodoIni, periodoFim,
  };
}

function fsCsvSplit(line, sep) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === sep && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function fsDetectarBancoPorCsv(headers) {
  const j = headers.join('|');
  if (/identificador/.test(j)) return 'Nubank';
  if (/n[uú]mero do documento|histórico/.test(j)) return 'Inter';
  if (/c\.[\s_]?custo|item/.test(j)) return 'Itaú';
  return '';
}

// ════════════════════════════════════════════════════════════
//  ENTRADA PRINCIPAL
// ════════════════════════════════════════════════════════════
async function fsParseArquivo(file) {
  const text = await file.text();
  const nome = (file.name || '').toLowerCase();
  if (nome.endsWith('.ofx') || /<OFX>/i.test(text.slice(0, 2000))) {
    return fsParseOfx(text);
  }
  if (nome.endsWith('.csv') || /,|;/.test(text.slice(0, 200))) {
    return fsParseCsv(text);
  }
  throw new Error('Formato não suportado. Use OFX ou CSV.');
}
