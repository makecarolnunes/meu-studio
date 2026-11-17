// ════════════════════════════════════════════════════════════
// fluxo/scripts/main.js — boot, autenticação e recarga
// Hub (mk_session) libera o módulo e a PJ. A PF mantém o login
// próprio do antigo /pessoal/ (mk_session_pessoal, RPC autenticar_pessoal).
// ════════════════════════════════════════════════════════════

function sessaoValida(chave) {
  try {
    const s = JSON.parse(localStorage.getItem(chave) || 'null');
    if (s && s.expires && Date.now() < s.expires) return s;
  } catch (_) {}
  localStorage.removeItem(chave);
  return null;
}

async function recarregar() {
  document.body.classList.add('carregando');
  try {
    await stCarregar();
    // automático: plano do mês (e do próximo, a partir do dia 20) + fechar meses antigos
    try {
      const feitos = await AC.garantirMeses();
      const criados = feitos.filter(f => f.acao === 'criado').map(f => nomeMes(f.mes));
      if (criados.length) toast('Planejamento criado: ' + criados.join(', '));
    } catch (e) { console.warn('[fluxo] garantirMeses', e); }
  }
  finally { document.body.classList.remove('carregando'); render(); }
}

function boot() {
  const hub = sessaoValida('mk_session');
  if (!hub) { window.location.href = '../'; return; }
  ST.usuario = hub.usuario || '';
  // PF: admin do Início entra direto (a menos que tenha bloqueado neste aparelho);
  // demais usuários precisam do login pessoal.
  ST.pfLiberado = !!sessaoValida('mk_session_pessoal') ||
    (hub.nivel === 'admin' && localStorage.getItem('mk_fluxo_pf_bloqueado') !== '1');
  const qs = new URLSearchParams(location.search);
  if (qs.get('ent') === 'PF' || qs.get('ent') === 'PJ') UI.ent = qs.get('ent');
  if (qs.get('tab')) UI.tab = qs.get('tab');
  if (UI.ent === 'PF' && !ST.pfLiberado && UI.tab !== 'mes') UI.ent = 'PJ';
  stCarregarCache();
  render();
  document.getElementById('loading').style.display = 'none';
  recarregar().then(() => { if (qs.get('ent') === 'PF' && !ST.pfLiberado) abrirLoginPF(); });
}

document.addEventListener('DOMContentLoaded', boot);
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });
