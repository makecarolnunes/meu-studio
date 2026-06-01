// ════════════════════════════════════════════════════════════
// pessoal/scripts/parser.js — extrato OFX + CSV → transações
// Saída: { transacoes:[{data,descricao,valor,tipoMov}], banco, periodoIni, periodoFim }
// (reaproveita a lógica do módulo fiscal da empresa)
// ════════════════════════════════════════════════════════════

function ppNormDataOfx(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
function ppNormDataBr(s) {
  if (!s) return '';
  const m = String(s).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) {
    const m2 = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m2 ? `${m2[1]}-${m2[2]}-${m2[3]}` : '';
  }
  let yyyy = m[3];
  if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy;
  return `${yyyy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function ppNormValor(s) {
  if (s == null) return 0;
  let v = String(s).trim();
  if (!v) return 0;
  v = v.replace(/R\$\s*/gi, '').replace(/\s/g, '');
  if (/,/.test(v) && /\./.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else if (/,/.test(v))            v = v.replace(',', '.');
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ── OFX ──────────────────────────────────────────────────
function ppParseOfx(text) {
  const ofxStart = text.indexOf('<OFX>');
  if (ofxStart < 0) throw new Error('Não parece um arquivo OFX válido');
  const body = text.slice(ofxStart);
  const get = (tag, src = body) => {
    const m = src.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
    return m ? m[1].trim() : '';
  };
  const getAll = (tag, src = body) => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const out = []; let m;
    while ((m = re.exec(src)) !== null) out.push(m[1]);
    return out;
  };
  const banco = ppBancoNome(get('BANKID')) || get('ORG') || 'Banco';
  let trnBlocks = getAll('STMTTRN');
  if (!trnBlocks.length) {
    const parts = body.split(/<STMTTRN>/i).slice(1);
    trnBlocks = parts.map(p => p.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);
  }
  const transacoes = trnBlocks.map(b => {
    const data  = ppNormDataOfx(get('DTPOSTED', b));
    const memo  = (get('MEMO', b) || '').replace(/\s+/g, ' ').trim();
    const name  = (get('NAME', b) || '').replace(/\s+/g, ' ').trim();
    const valor = ppNormValor(get('TRNAMT', b));
    return { data, descricao: memo || name || '', valor, tipoMov: valor >= 0 ? 'CREDITO' : 'DEBITO' };
  }).filter(t => t.data && t.valor !== 0);
  const datas = transacoes.map(t => t.data).sort();
  return { transacoes, banco, periodoIni: datas[0] || '', periodoFim: datas.slice(-1)[0] || '' };
}

function ppBancoNome(bankId) {
  const map = { '237':'Bradesco','341':'Itaú','001':'Banco do Brasil','104':'Caixa',
    '033':'Santander','422':'Safra','260':'Nubank','077':'Inter','335':'Digio',
    '212':'Banco Original','380':'PicPay','290':'PagSeguro','323':'Mercado Pago','336':'C6 Bank' };
  return map[String(bankId).padStart(3, '0')] || '';
}

// ── CSV ──────────────────────────────────────────────────
function ppCsvSplit(line, sep) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === sep && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function ppParseCsv(text) {
  const first = text.split('\n')[0];
  const sep = (first.split(';').length > first.split(',').length) ? ';' : ',';
  const linhas = text.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) throw new Error('CSV vazio');
  const headerCols = ppCsvSplit(linhas[0], sep).map(c => c.toLowerCase().trim().replace(/"/g, ''));
  const idxData = headerCols.findIndex(c => /data|date/i.test(c));
  const idxDesc = headerCols.findIndex(c => /descri|histor|estabeleci|memo|category|merchant|lan[çc]amento/i.test(c));
  const idxValor= headerCols.findIndex(c => /valor|amount|montante/i.test(c));
  const idxDeb  = headerCols.findIndex(c => /d[ée]bito|debit/i.test(c));
  const idxCred = headerCols.findIndex(c => /cr[ée]dito|credit/i.test(c));
  const idxTipo = headerCols.findIndex(c => /tipo|type/i.test(c));
  if (idxData < 0) throw new Error('CSV sem coluna de data reconhecível');
  if (idxValor < 0 && idxDeb < 0 && idxCred < 0) throw new Error('CSV sem coluna de valor reconhecível');

  const transacoes = [];
  for (const linha of linhas.slice(1)) {
    const cols = ppCsvSplit(linha, sep).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;
    const data = ppNormDataBr(cols[idxData]);
    const desc = (idxDesc >= 0 ? cols[idxDesc] : '').trim();
    let valor = 0;
    if (idxValor >= 0) {
      valor = ppNormValor(cols[idxValor]);
      if (idxTipo >= 0) {
        const t = (cols[idxTipo] || '').toLowerCase();
        if (/d[ée]bito|debit|saida|saída/.test(t)) valor = -Math.abs(valor);
        else if (/cr[ée]dito|credit|entrada/.test(t)) valor = Math.abs(valor);
      }
    } else {
      const debv  = idxDeb  >= 0 ? ppNormValor(cols[idxDeb])  : 0;
      const credv = idxCred >= 0 ? ppNormValor(cols[idxCred]) : 0;
      valor = credv > 0 ? credv : -Math.abs(debv);
    }
    if (!data || valor === 0) continue;
    transacoes.push({ data, descricao: desc, valor, tipoMov: valor >= 0 ? 'CREDITO' : 'DEBITO' });
  }
  const datas = transacoes.map(t => t.data).sort();
  return { transacoes, banco: 'Banco', periodoIni: datas[0] || '', periodoFim: datas.slice(-1)[0] || '' };
}

// ── Entrada principal ────────────────────────────────────
async function ppParseArquivo(file) {
  const text = await file.text();
  const nome = (file.name || '').toLowerCase();
  if (nome.endsWith('.ofx') || /<OFX>/i.test(text.slice(0, 2000))) return ppParseOfx(text);
  if (nome.endsWith('.csv') || /,|;/.test(text.slice(0, 200)))     return ppParseCsv(text);
  throw new Error('Formato não suportado. Use OFX ou CSV.');
}

// Sugere categoria pela descrição (heurística simples)
function ppSugereCategoria(desc, ehEntrada) {
  const d = (desc || '').toLowerCase();
  if (ehEntrada) {
    if (/sal[áa]rio|pagamento|pix recebid|transf.*receb|ted receb/.test(d)) return 'Salário/Renda';
    if (/transf|pix|ted/.test(d)) return 'Transferência';
    return 'Outros';
  }
  if (/ifood|rest|mercado|super|padaria|lanch|burger|pizza/.test(d)) return 'Alimentação';
  if (/uber|99|taxi|posto|combust|gasolin|metro|onibus|ônibus/.test(d)) return 'Transporte';
  if (/farm|drog|consult|hospital|clinic|saude|saúde/.test(d)) return 'Saúde';
  if (/netflix|spotify|prime|disney|hbo|youtube|assinatura/.test(d)) return 'Assinaturas';
  if (/aluguel|condom|luz|energia|agua|água|gas|gás|internet|telefone|claro|vivo|tim/.test(d)) return 'Contas';
  if (/escola|curso|faculdade|livr/.test(d)) return 'Educação';
  if (/cinema|bar|show|viagem|hotel/.test(d)) return 'Lazer';
  return 'Outros';
}
