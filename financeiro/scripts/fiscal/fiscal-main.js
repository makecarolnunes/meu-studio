// ════════════════════════════════════════════════════════════
// financeiro/scripts/fiscal/fiscal-main.js
// Boot + roteamento + modal de config/onboarding.
// ════════════════════════════════════════════════════════════

// ── Boot ────────────────────────────────────────────────────
async function fiscalBoot() {
  if (!fsCheckAuth()) {
    window.location.href = '../';
    return;
  }
  document.getElementById('fs-loading').style.display = 'none';
  document.getElementById('fiscal-app').style.display = 'block';

  // Carrega cache primeiro (UI responsiva)
  FS.config     = fsLoadCachedConfig();
  FS.entries    = fsLoadCachedEntries();
  FS.orcamentos = fsLoadCachedOrcamentos();
  FS.saidas     = fsLoadCachedSaidas();
  FS.despesas   = fsLoadCachedDespesas();
  FS.documentos = fsLoadCachedDocs();
  FS.das        = fsLoadCachedDas();
  fiscalRender();

  // Sincroniza com Supabase
  await fiscalRefresh();

  // Se ainda não tem config, abre onboarding
  if (!FS.config) fiscalOpenOnboarding();
}

async function fiscalRefresh() {
  try {
    const [cfg, entries, orcamentos, saidas, despesas, regras, documentos, das] = await Promise.all([
      DB.fiscal.config.get(),
      DB.entries.list(),
      DB.orcamentos.list().catch(() => []),
      DB.saidas.list().catch(() => []),
      DB.fiscal.despesas.list().catch(() => []),
      DB.fiscal.regras.list().catch(() => []),
      DB.fiscal.documentos.list().catch(() => []),
      DB.fiscal.das.list().catch(() => []),
    ]);
    FS.config     = cfg;
    FS.entries    = entries || [];
    FS.orcamentos = orcamentos || [];
    FS.saidas     = saidas || [];
    FS.despesas   = despesas || [];
    FS.regras     = regras || [];
    FS.documentos = documentos || [];
    FS.das        = das || [];
    if (cfg) fsCacheConfig(cfg);
    try { localStorage.setItem(FS.CK_ENTRIES,  JSON.stringify(FS.entries)); } catch(_) {}
    try { localStorage.setItem(FS.CK_ORC,      JSON.stringify(FS.orcamentos)); } catch(_) {}
    try { localStorage.setItem(FS.CK_SAIDAS,   JSON.stringify(FS.saidas)); } catch(_) {}
    try { localStorage.setItem(FS.CK_DESPESAS, JSON.stringify(FS.despesas)); } catch(_) {}
    try { localStorage.setItem(FS.CK_DOCS,     JSON.stringify(FS.documentos)); } catch(_) {}
    try { localStorage.setItem(FS.CK_DAS,      JSON.stringify(FS.das)); } catch(_) {}
    fiscalRender();
  } catch (err) {
    console.error('[fiscal] refresh falhou:', err);
    fsToast('Sem conexão — mostrando dados em cache');
  }
}

// ── Roteamento ──────────────────────────────────────────────
function fiscalGo(tab) {
  FS.screen = tab;
  ['painel','despesas','ir'].forEach(t => {
    const btn = document.getElementById('fs-nav-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  fiscalRender();
}

function fiscalRender() {
  if (FS.screen === 'painel')   return fsRenderPainel();
  if (FS.screen === 'despesas') return fsRenderDespesas();
  if (FS.screen === 'ir')       return fsRenderIR();
}

// ── Modal helpers ───────────────────────────────────────────
function fiscalModalOpen(html) {
  document.getElementById('fs-modal-inner').innerHTML = html;
  document.getElementById('fs-modal-bg').style.display = 'flex';
}
function fiscalModalClose() {
  document.getElementById('fs-modal-bg').style.display = 'none';
  document.getElementById('fs-modal-inner').innerHTML = '';
}

// Fecha modal clicando fora
document.addEventListener('click', (e) => {
  const bg = document.getElementById('fs-modal-bg');
  if (e.target === bg) fiscalModalClose();
});

// ── Onboarding (1ª vez) ─────────────────────────────────────
function fiscalOpenOnboarding() {
  const c = FS.config || { regime: 'MEI', tetoAnual: 81000 };
  fiscalModalOpen(`
    <h2>Vamos configurar</h2>
    <p>Esses dados ficam guardados e podem ser alterados depois nas configurações.</p>

    <div class="fs-field">
      <label>Regime</label>
      <div class="fs-regime-pills" id="fs-regime-pills">
        <button type="button" class="fs-regime-pill ${c.regime === 'MEI' ? 'selected' : ''}" data-regime="MEI">MEI</button>
        <button type="button" class="fs-regime-pill ${c.regime === 'SIMPLES' ? 'selected' : ''}" data-regime="SIMPLES">Simples</button>
        <button type="button" class="fs-regime-pill ${c.regime === 'AUTONOMO' ? 'selected' : ''}" data-regime="AUTONOMO">Autônoma</button>
      </div>
    </div>

    <div class="fs-field">
      <label>Teto anual</label>
      <input type="number" id="fs-cfg-teto" value="${c.tetoAnual || 81000}" step="100" inputmode="decimal">
      <div class="fs-field-hint">Limite atual do MEI: R$ 81.000. Pode ajustar caso mude.</div>
    </div>

    <div class="fs-field">
      <label>Data de abertura <span style="text-transform:none;letter-spacing:0;color:var(--text-subtle)">(opcional)</span></label>
      <input type="date" id="fs-cfg-abertura" value="${c.dataAbertura || ''}">
      <div class="fs-field-hint">Usado para calcular o teto proporcional no 1º ano.</div>
    </div>

    <div class="fs-modal-actions">
      ${FS.config ? `<button class="fs-btn fs-btn-ghost" onclick="fiscalModalClose()">Cancelar</button>` : ''}
      <button class="fs-btn fs-btn-primary" onclick="fiscalSaveConfig()">Salvar</button>
    </div>
  `);

  // Pills de regime
  document.querySelectorAll('#fs-regime-pills .fs-regime-pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#fs-regime-pills .fs-regime-pill').forEach(x => x.classList.remove('selected'));
      p.classList.add('selected');
    });
  });
}

function fiscalOpenConfig() { fiscalOpenOnboarding(); }

async function fiscalSaveConfig() {
  const regimeEl = document.querySelector('#fs-regime-pills .fs-regime-pill.selected');
  const regime   = regimeEl ? regimeEl.dataset.regime : 'MEI';
  const teto     = parseFloat(document.getElementById('fs-cfg-teto').value) || 81000;
  const abertura = document.getElementById('fs-cfg-abertura').value || '';

  const cfg = {
    regime,
    tetoAnual: teto,
    dataAbertura: abertura,
    cnpj: (FS.config && FS.config.cnpj) || '',
    atividade: (FS.config && FS.config.atividade) || '',
  };

  // UI otimista
  FS.config = cfg;
  fsCacheConfig(cfg);
  fiscalModalClose();
  fiscalRender();
  fsToast('Configuração salva');

  try {
    await DB.fiscal.config.save(cfg);
  } catch (err) {
    console.error('[fiscal] save config falhou:', err);
    fsToast('Erro ao salvar — tentando novamente em breve');
  }
}

// ── Auto-boot apenas quando estiver na página fiscal ────────
// Em outros contextos (financeiro), os mesmos scripts são carregados
// só pra suportar o fluxo de import — fiscalBoot não roda.
function _fsAutoBoot() {
  if (!document.getElementById('fiscal-app')) return;
  fiscalBoot();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _fsAutoBoot);
} else {
  _fsAutoBoot();
}
