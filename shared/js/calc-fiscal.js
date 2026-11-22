// ════════════════════════════════════════════════════════════
// shared/js/calc-fiscal.js
// FONTE ÚNICA DE CÁLCULO MEI — usada por:
//   - financeiro/scripts/views.js (Resumo)
//   - financeiro/scripts/fiscal/fiscal-mei.js (Painel Fiscal)
//
// Regra canônica de FATURAMENTO REALIZADO:
//   entries com status === 'Realizado' (inclusive auto)
//   filtradas pelo ano de e.dataPag
//
// auto=true só diz que o sistema criou o lançamento (restante de sinal ou de
// noiva). Enquanto Previsto não entra; Realizado é dinheiro recebido e entra.
// ════════════════════════════════════════════════════════════

(function () {
  'use strict';

  function _toDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function _toNum(v) {
    return parseFloat(v) || 0;
  }

  // Faturamento realizado total no ano
  function faturamentoRealizadoAno(entries, ano) {
    if (!Array.isArray(entries)) return 0;
    let total = 0;
    for (const e of entries) {
      if (!e) continue;
      if (e.status !== 'Realizado') continue;
      const d = _toDate(e.dataPag);
      if (!d || d.getFullYear() !== ano) continue;
      total += _toNum(e.valor);
    }
    return total;
  }

  // Faturamento previsto total no ano (não-realizado, inclui auto+manual)
  function faturamentoPrevistoAno(entries, ano) {
    if (!Array.isArray(entries)) return 0;
    let total = 0;
    for (const e of entries) {
      if (!e) continue;
      if (e.status !== 'Previsto') continue;
      const d = _toDate(e.dataPag);
      if (!d || d.getFullYear() !== ano) continue;
      total += _toNum(e.valor);
    }
    return total;
  }

  // Faturamento realizado por mês (vetor de 12) no ano
  function faturamentoRealizadoMeses(entries, ano) {
    const m = new Array(12).fill(0);
    if (!Array.isArray(entries)) return m;
    for (const e of entries) {
      if (!e) continue;
      if (e.status !== 'Realizado') continue;
      const d = _toDate(e.dataPag);
      if (!d || d.getFullYear() !== ano) continue;
      m[d.getMonth()] += _toNum(e.valor);
    }
    return m;
  }

  // Faturamento previsto por mês (vetor de 12) no ano
  function faturamentoPrevistoMeses(entries, ano) {
    const m = new Array(12).fill(0);
    if (!Array.isArray(entries)) return m;
    for (const e of entries) {
      if (!e) continue;
      if (e.status !== 'Previsto') continue;
      const d = _toDate(e.dataPag);
      if (!d || d.getFullYear() !== ano) continue;
      m[d.getMonth()] += _toNum(e.valor);
    }
    return m;
  }

  // Teto MEI efetivo (proporcional ao 1º ano se data de abertura foi nesse ano)
  function tetoEfetivo(cfg, ano) {
    const teto = _toNum(cfg && cfg.tetoAnual) || 81000;
    const abertura = _toDate(cfg && cfg.dataAbertura);
    if (!abertura || abertura.getFullYear() !== ano) return teto;
    const mesesAtivos = 12 - abertura.getMonth();
    return Math.round((teto / 12) * mesesAtivos * 100) / 100;
  }

  window.mkFiscal = {
    faturamentoRealizadoAno,
    faturamentoPrevistoAno,
    faturamentoRealizadoMeses,
    faturamentoPrevistoMeses,
    tetoEfetivo,
  };
})();
