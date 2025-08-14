(function () {
  const api = context && context.api ? context.api : (window && window.BestiaryModAPI ? window.BestiaryModAPI : null);
  if (!api) return;

  const MOD_ID = 'dice-quick-switch';
  const BUTTON_CONTAINER_ID = `${MOD_ID}-container`;
  const RARITIES = [
    { key: 'common', label: 'Common', rarity: 1 },
    { key: 'uncommon', label: 'Uncommon', rarity: 2 },
    { key: 'rare', label: 'Rare', rarity: 3 },
    { key: 'mythic', label: 'Mythic', rarity: 4 },
    { key: 'legendary', label: 'Legendary', rarity: 5 }
  ];

  let observer = null;
  let currentSelected = null; // { id?: string, name?: string }

  function isDiceScreenOpen() {
    const openDialogs = Array.from(document.querySelectorAll('div[role="dialog"][data-state="open"]'));
    for (const d of openDialogs) {
      const text = (d.textContent || '').toLowerCase();
      if (text.includes('dice') || text.includes('reroll') || text.includes('manipulator')) return d;
      const rollBtn = Array.from(d.querySelectorAll('button')).find(b => /roll|reroll/i.test(b.textContent || ''));
      if (rollBtn) return d;
    }
    const pageText = (document.body.textContent || '').toLowerCase();
    if (pageText.includes('dice') && pageText.includes('roll')) return document.body;
    return null;
  }

  function ensureButtons() {
    const host = isDiceScreenOpen();
    if (!host) { removeButtons(); return; }
    if (document.getElementById(BUTTON_CONTAINER_ID)) return;

    const container = document.createElement('div');
    container.id = BUTTON_CONTAINER_ID;
    container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 12px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    RARITIES.forEach(r => {
      const btn = document.createElement('button');
      btn.textContent = r.label;
      btn.title = `Switch to ${r.label} dice`;
      btn.style.cssText = `
        padding: 2px 7px;
        border: 4px solid transparent;
        background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat;
        color: #ffe066; font-weight: 700; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
        border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 4 fill stretch;
        cursor: pointer; outline: none; display: inline-flex; align-items: center; justify-content: center; font-size: 13px;
      `;
      btn.addEventListener('click', () => switchDiceAndReselect(r));
      container.appendChild(btn);
    });

    document.body.appendChild(container);
  }

  function removeButtons() {
    const el = document.getElementById(BUTTON_CONTAINER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function captureCurrentSelection(host) {
    currentSelected = null;
    const selected = host.querySelector('[data-selected="true"], .selected, .is-selected');
    if (selected) {
      const id = selected.getAttribute('data-id') || selected.getAttribute('data-key');
      const nameEl = selected.querySelector('span, p, .name');
      const name = nameEl ? (nameEl.textContent || '').trim() : null;
      currentSelected = { id, name };
      return;
    }
    const portrait = Array.from(host.querySelectorAll('.monster-portrait, .equipment-portrait, .container-slot'))
      .find(p => /level|lvl/i.test(p.textContent || ''));
    if (portrait) {
      const id = portrait.getAttribute('data-id');
      const nameEl = portrait.querySelector('span, p, .name');
      const name = nameEl ? (nameEl.textContent || '').trim() : null;
      currentSelected = { id, name };
    }
  }

  async function switchDiceAndReselect(rarityObj) {
    const host = isDiceScreenOpen();
    if (!host) return;

    captureCurrentSelection(host);

    let switched = clickByExactText(host, rarityObj.label);
    if (!switched) switched = clickDataRarity(host, rarityObj.rarity);
    if (!switched) switched = clickAnyRarityMatch(host, rarityObj);

    await sleep(250);

    if (currentSelected) reselectSameMonster(isDiceScreenOpen());
  }

  function clickByExactText(scope, text) {
    const btn = Array.from(scope.querySelectorAll('button, [role="tab"], [role="button"]'))
      .find(b => (b.textContent || '').trim().toLowerCase() === text.toLowerCase());
    if (btn) { try { btn.click(); return true; } catch {} }
    return false;
  }

  function clickDataRarity(scope, rarityNum) {
    const el = scope.querySelector(`[data-rarity="${rarityNum}"]`);
    if (el) { try { el.click(); return true; } catch {} }
    return false;
  }

  function clickAnyRarityMatch(scope, r) {
    const match = Array.from(scope.querySelectorAll('*'))
      .find(e => new RegExp(r.label, 'i').test(e.textContent || ''));
    if (match) { try { match.click(); return true; } catch {} }
    return false;
  }

  function reselectSameMonster(host) {
    if (!host || !currentSelected) return false;
    const { id, name } = currentSelected;
    if (id) {
      const el = host.querySelector(`[data-id="${CSS.escape(String(id))}"]`);
      if (el) { try { el.click(); return true; } catch {} }
    }
    if (name) {
      const cand = Array.from(host.querySelectorAll('.monster-portrait, .container-slot, button, div, span'))
        .find(e => (e.textContent || '').trim() === name);
      if (cand) { try { cand.click(); return true; } catch {} }
    }
    return false;
  }

  function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

  function startObserving() {
    stopObserving();
    observer = new MutationObserver(() => {
      const host = isDiceScreenOpen();
      if (host) ensureButtons(); else removeButtons();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const hostNow = isDiceScreenOpen();
    if (hostNow) ensureButtons();
  }

  function stopObserving() { if (observer) { observer.disconnect(); observer = null; } }

  function init() { startObserving(); }
  init();

  if (typeof exports !== 'undefined') {
    exports = {
      reselect: () => reselectSameMonster(isDiceScreenOpen()),
      switchTo: (rarity) => {
        const r = RARITIES.find(x => x.key === rarity || x.rarity === rarity || x.label.toLowerCase() === String(rarity).toLowerCase());
        if (r) return switchDiceAndReselect(r);
      }
    };
  }
})();
