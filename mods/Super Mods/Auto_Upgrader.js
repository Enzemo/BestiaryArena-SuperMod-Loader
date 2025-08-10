(function () {
  const defaultConfig = {
    enabled: false,
    levelThreshold: 50,
    reserveCountPerSpecies: 1,
    minFodderTier: 1,
    maxFodderTier: 4,
    targetSpeciesIds: [],
    concurrentUpgrades: 1
  };

  const api = context && context.api ? context.api : (window && window.BestiaryModAPI ? window.BestiaryModAPI : null);
  const config = Object.assign({}, defaultConfig, context && context.config ? context.config : {});

  const MOD_ID = 'auto-upgrader';
  const MAIN_BUTTON_ID = `${MOD_ID}-button`;
  const SETTINGS_BUTTON_ID = `${MOD_ID}-settings-button`;
  const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

  let isProcessing = false;
  let processingQueue = [];
  let playerUnsubscribe = null;

  function getPlayerContext() {
    try {
      return globalThis.state?.player?.getSnapshot()?.context || {};
    } catch {
      return {};
    }
  }

  function getPlayerMonsters() {
    const ctx = getPlayerContext();
    return Array.isArray(ctx.monsters) ? ctx.monsters : [];
  }

  function getSpeciesKey(monster) {
    return typeof monster?.gameId === 'number' ? monster.gameId : monster?.metadata?.gameId;
  }

  function isAtOrAboveLevelThreshold(monster) {
    const level = Number(monster?.level || 0);
    return level >= Number(config.levelThreshold || 50);
  }

  function getEligibleBaseForSpecies(speciesId) {
    const monsters = getPlayerMonsters().filter(m => getSpeciesKey(m) === speciesId);
    const candidates = monsters.filter(m => isAtOrAboveLevelThreshold(m) && Number(m?.tier || 1) < 5);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.tier || 1) - (a.tier || 1) || (b.level || 0) - (a.level || 0));
    return candidates[0];
  }

  function getFodderForSpecies(speciesId, baseId) {
    const all = getPlayerMonsters().filter(m => getSpeciesKey(m) === speciesId);
    const reserveCount = Math.max(0, Number(config.reserveCountPerSpecies || 0));
    const candidates = all
      .filter(m => m.id !== baseId)
      .filter(m => (m.tier || 1) >= Number(config.minFodderTier)
        && (m.tier || 1) <= Number(config.maxFodderTier))
      .sort((a, b) => (a.tier || 1) - (b.tier || 1) || (a.level || 0) - (b.level || 0));

    const keep = Math.max(0, reserveCount);
    const usable = candidates.slice(keep);
    return usable;
  }

  function enqueueSpecies(speciesId) {
    if (!processingQueue.includes(speciesId)) {
      processingQueue.push(speciesId);
      processQueue();
    }
  }

  async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;
    try {
      while (processingQueue.length > 0) {
        const speciesId = processingQueue.shift();
        const base = getEligibleBaseForSpecies(speciesId);
        if (!base) continue;
        await performUpgradeSequence(speciesId, base);
        await sleep(300);
      }
    } finally {
      isProcessing = false;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function tryOpenMountainFortressViaMenu() {
    try {
      if (globalThis.state?.menu?.send) {
        globalThis.state.menu.send({
          type: 'setState',
          fn: (prev) => ({
            ...prev,
            mode: 'mountainFortress'
          })
        });
        return true;
      }
    } catch {}
    return false;
  }

  async function openMountainFortress() {
    const openedViaMenu = tryOpenMountainFortressViaMenu();
    if (openedViaMenu) {
      for (let i = 0; i < 20; i++) {
        if (findFortressModal()) return true;
        await sleep(150);
      }
    }

    const icon = document.querySelector('img[src*="mountainfortress"]');
    if (icon) {
      icon.click();
      for (let i = 0; i < 20; i++) {
        if (findFortressModal()) return true;
        await sleep(150);
      }
    }

    const fortressText = Array.from(document.querySelectorAll('button, div, span, p, h2, h3'))
      .find(el => /mountain\s*fortress/i.test(el.textContent || ''));
    if (fortressText && fortressText.closest('button')) {
      fortressText.closest('button').click();
      for (let i = 0; i < 20; i++) {
        if (findFortressModal()) return true;
        await sleep(150);
      }
    }

    return !!findFortressModal();
  }

  function findFortressModal() {
    const openDialogs = Array.from(document.querySelectorAll('div[role="dialog"][data-state="open"]'));
    return openDialogs.find(d => /fortress/i.test(d.textContent || '')) || null;
  }

  function findButtonIn(container, regex) {
    if (!container) return null;
    const buttons = container.querySelectorAll('button');
    for (const btn of buttons) {
      const txt = (btn.textContent || '').trim();
      if (regex.test(txt)) return btn;
    }
    return null;
  }

  function pickBaseMonsterInUI(modalEl, base) {
    if (!modalEl) return false;
    const portraits = Array.from(modalEl.querySelectorAll('[class*="portrait"], .container-slot, .equipment-portrait, .monster-portrait'));
    const matched = portraits.find(p => (p.getAttribute('data-id') === String(base.id)) || new RegExp(`\\b${base.id}\\b`).test(p.outerHTML));
    if (matched) {
      matched.click();
      return true;
    }
    const lists = Array.from(modalEl.querySelectorAll('div, section')); 
    for (const list of lists) {
      const items = list.querySelectorAll('button, div');
      for (const it of items) {
        if (/select|choose|base|upgrade target/i.test(it.textContent || '')) {
          try { it.click(); return true; } catch {}
        }
      }
    }
    return false;
  }

  function addFodderInUI(modalEl, fodders) {
    if (!modalEl || fodders.length === 0) return 0;
    let added = 0;
    const pool = Array.from(modalEl.querySelectorAll('[class*="portrait"], .container-slot, button'));
    for (const f of fodders) {
      const found = pool.find(p => (p.getAttribute('data-id') === String(f.id)) || new RegExp(`\\b${f.id}\\b`).test(p.outerHTML));
      if (found) {
        try { found.click(); added++; } catch {}
      }
    }
    return added;
  }

  async function confirmUpgrade(modalEl) {
    let btn = findButtonIn(modalEl, /upgrade|evolve|confirm|apply/i);
    if (!btn) btn = document.querySelector('button:has(svg[aria-label="confirm"])');
    if (btn) {
      btn.click();
      for (let i = 0; i < 40; i++) {
        await sleep(150);
        const success = /success|upgraded|tier\s*up|evolved/i.test((modalEl.textContent || ''));
        if (success) return true;
      }
    }
    return false;
  }

  function closeFortressModal(modalEl) {
    if (!modalEl) return true;
    let btn = findButtonIn(modalEl, /close|done|ok|back/i);
    if (!btn) btn = modalEl.querySelector('button[aria-label="Close"], button[aria-label="close"]');
    if (btn) { try { btn.click(); return true; } catch {} }
    if (modalEl && modalEl.parentNode) { try { modalEl.parentNode.removeChild(modalEl); } catch {} }
    return true;
  }

  async function performUpgradeSequence(speciesId, baseMonster) {
    try {
      const opened = await openMountainFortress();
      if (!opened) {
        notify(`Could not open Mountain Fortress. Please open it manually and try again.`, 'error');
        return;
      }

      const modal = findFortressModal();
      if (!modal) {
        notify(`Mountain Fortress UI not detected.`, 'error');
        return;
      }

      const picked = pickBaseMonsterInUI(modal, baseMonster);
      await sleep(200);

      const fodders = getFodderForSpecies(speciesId, baseMonster.id).slice(0, 3);
      const added = addFodderInUI(modal, fodders);
      await sleep(200);

      const confirmed = await confirmUpgrade(modal);
      await sleep(200);

      closeFortressModal(modal);

      if (picked && (added > 0) && confirmed) {
        notify(`Upgraded ${speciesId} successfully.`, 'success');
      } else {
        notify(`Attempted upgrade for ${speciesId}. Check game UI.`, 'warning');
      }
    } catch (e) {
      notify(`Upgrade sequence error: ${e?.message || e}`, 'error');
    }
  }

  function notify(message, type = 'info') {
    if (api?.ui?.notify) {
      api.ui.notify({ message, type, duration: 4000 });
      return;
    }
    api?.ui?.components?.createModal({ title: type, content: message, buttons: [{ text: 'OK', primary: true }] });
  }

  function startMonitoring() {
    stopMonitoring();
    const board = globalThis.state?.player;
    if (!board || typeof board.subscribe !== 'function') return;
    playerUnsubscribe = board.subscribe(({ context: ctx }) => {
      if (!config.enabled) return;
      if (!Array.isArray(config.targetSpeciesIds) || config.targetSpeciesIds.length === 0) return;
      const speciesSet = new Set(config.targetSpeciesIds);
      const monsters = Array.isArray(ctx?.monsters) ? ctx.monsters : [];
      for (const m of monsters) {
        const speciesId = getSpeciesKey(m);
        if (!speciesSet.has(speciesId)) continue;
        if ((m.tier || 1) >= 5) continue;
        if (!isAtOrAboveLevelThreshold(m)) continue;
        enqueueSpecies(speciesId);
      }
    });
  }

  function stopMonitoring() {
    if (typeof playerUnsubscribe === 'function') {
      try { playerUnsubscribe(); } catch {}
    }
    playerUnsubscribe = null;
  }

  function buildConfigContent() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '12px';

    const left = document.createElement('div');
    left.style.flex = '1 1 0';
    left.style.minWidth = '260px';

    const right = document.createElement('div');
    right.style.flex = '1 1 0';

    const monsters = getPlayerMonsters();
    const bySpecies = new Map();
    for (const m of monsters) {
      const key = getSpeciesKey(m);
      if (!bySpecies.has(key)) bySpecies.set(key, []);
      bySpecies.get(key).push(m);
    }

    const scroll = api.ui.components.createScrollContainer({ height: 360, padding: true, content: '' });
    const selectedSet = new Set(config.targetSpeciesIds || []);

    bySpecies.forEach((arr, speciesId) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.margin = '2px 0';

      const representative = arr[0];
      const tier = Math.max(...arr.map(x => x.tier || 1));
      const portrait = api.ui.components.createMonsterPortrait({
        monsterId: getSpeciesKey(representative),
        level: representative.level || 1,
        tier: tier || 1,
        onClick: () => toggleSpecies(speciesId)
      });

      const label = document.createElement('span');
      label.style.flex = '1 1 0';
      label.style.color = 'white';
      label.style.cursor = 'pointer';
      label.textContent = `Species ${speciesId} (x${arr.length})`;
      label.addEventListener('click', () => toggleSpecies(speciesId));

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedSet.has(speciesId);
      checkbox.addEventListener('change', () => toggleSpecies(speciesId));

      row.appendChild(portrait);
      row.appendChild(label);
      row.appendChild(checkbox);
      scroll.addContent(row);
    });

    function toggleSpecies(speciesId) {
      const idx = config.targetSpeciesIds.indexOf(speciesId);
      if (idx === -1) config.targetSpeciesIds.push(speciesId); else config.targetSpeciesIds.splice(idx, 1);
    }

    left.appendChild(scroll.element);

    const settingsBox = document.createElement('div');
    settingsBox.style.display = 'grid';
    settingsBox.style.gap = '8px';

    const enabledRow = document.createElement('label');
    enabledRow.style.color = 'white';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = !!config.enabled;
    enabledInput.addEventListener('change', () => { config.enabled = enabledInput.checked; });
    enabledRow.appendChild(enabledInput);
    enabledRow.appendChild(document.createTextNode(' Enable Auto-Upgrader'));

    const levelRow = document.createElement('div');
    levelRow.style.display = 'flex';
    levelRow.style.gap = '8px';
    const levelLabel = document.createElement('label');
    levelLabel.style.color = 'white';
    levelLabel.textContent = 'Level threshold:';
    const levelInput = document.createElement('input');
    levelInput.type = 'number';
    levelInput.min = '1';
    levelInput.max = '50';
    levelInput.value = String(config.levelThreshold);
    levelInput.addEventListener('input', () => { config.levelThreshold = Number(levelInput.value || 50); });
    levelRow.appendChild(levelLabel);
    levelRow.appendChild(levelInput);

    const reserveRow = document.createElement('div');
    reserveRow.style.display = 'flex';
    reserveRow.style.gap = '8px';
    const reserveLabel = document.createElement('label');
    reserveLabel.style.color = 'white';
    reserveLabel.textContent = 'Reserve per species:';
    const reserveInput = document.createElement('input');
    reserveInput.type = 'number';
    reserveInput.min = '0';
    reserveInput.max = '10';
    reserveInput.value = String(config.reserveCountPerSpecies);
    reserveInput.addEventListener('input', () => { config.reserveCountPerSpecies = Number(reserveInput.value || 0); });
    reserveRow.appendChild(reserveLabel);
    reserveRow.appendChild(reserveInput);

    const tierRow = document.createElement('div');
    tierRow.style.display = 'flex';
    tierRow.style.gap = '8px';
    const minTierLabel = document.createElement('label');
    minTierLabel.style.color = 'white';
    minTierLabel.textContent = 'Min fodder tier:';
    const minTierInput = document.createElement('input');
    minTierInput.type = 'number';
    minTierInput.min = '1';
    minTierInput.max = '5';
    minTierInput.value = String(config.minFodderTier);
    minTierInput.addEventListener('input', () => { config.minFodderTier = Number(minTierInput.value || 1); });

    const maxTierLabel = document.createElement('label');
    maxTierLabel.style.color = 'white';
    maxTierLabel.textContent = 'Max fodder tier:';
    const maxTierInput = document.createElement('input');
    maxTierInput.type = 'number';
    maxTierInput.min = '1';
    maxTierInput.max = '5';
    maxTierInput.value = String(config.maxFodderTier);
    maxTierInput.addEventListener('input', () => { config.maxFodderTier = Number(maxTierInput.value || 4); });

    tierRow.appendChild(minTierLabel);
    tierRow.appendChild(minTierInput);
    tierRow.appendChild(maxTierLabel);
    tierRow.appendChild(maxTierInput);

    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '8px';

    const testButton = document.createElement('button');
    testButton.textContent = 'Run Next Upgrade';
    testButton.addEventListener('click', async () => {
      const species = (config.targetSpeciesIds || [])[0];
      if (!species) { notify('No target species selected', 'warning'); return; }
      const base = getEligibleBaseForSpecies(species);
      if (!base) { notify('No eligible base monster found at threshold', 'warning'); return; }
      await performUpgradeSequence(species, base);
    });

    settingsBox.appendChild(enabledRow);
    settingsBox.appendChild(levelRow);
    settingsBox.appendChild(reserveRow);
    settingsBox.appendChild(tierRow);
    actionsRow.appendChild(testButton);
    settingsBox.appendChild(actionsRow);

    right.appendChild(settingsBox);

    container.appendChild(left);
    container.appendChild(right);
    return container;
  }

  function openConfigPanel() {
    const content = buildConfigContent();
    const modal = api.ui.components.createModal({
      title: 'Auto Upgrader',
      width: 970,
      height: 600,
      content: content,
      buttons: [
        {
          text: 'Save',
          primary: true,
          onClick: () => {
            if (api?.service && context?.hash) {
              api.service.updateScriptConfig(context.hash, config);
              notify('Settings saved', 'success');
              if (config.enabled) startMonitoring(); else stopMonitoring();
            }
          }
        },
        { text: 'Close', primary: false }
      ]
    });

    // Ensure width/height are applied even with fallback modal
    setTimeout(() => {
      const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
      if (dialog) {
        dialog.style.width = '970px';
        dialog.style.minWidth = '970px';
        dialog.style.maxWidth = '970px';
        dialog.style.height = '600px';
        dialog.style.minHeight = '600px';
        dialog.style.maxHeight = '600px';
        const contentElem = dialog.querySelector('.modal-content, [data-content], .content, .modal-body');
        if (contentElem) {
          contentElem.style.width = '970px';
          contentElem.style.height = '600px';
          contentElem.style.display = 'flex';
          contentElem.style.flexDirection = 'column';
        }
      }
    }, 100);
  }

  function initUI() {
    api.ui.addButton({
      id: MAIN_BUTTON_ID,
      text: 'Upgrader',
      modId: MOD_ID,
      primary: !!config.enabled,
      tooltip: 'Auto-upgrade selected species at max level',
      onClick: () => {
        config.enabled = !config.enabled;
        api.ui.updateButton(MAIN_BUTTON_ID, { primary: !!config.enabled });
        if (api?.service && context?.hash) api.service.updateScriptConfig(context.hash, config);
        if (config.enabled) startMonitoring(); else stopMonitoring();
        notify(`Auto-Upgrader ${config.enabled ? 'enabled' : 'disabled'}`, 'info');
      }
    });

    api.ui.addButton({
      id: SETTINGS_BUTTON_ID,
      icon: '⚙️',
      tooltip: 'Auto Upgrader Settings',
      modId: MOD_ID,
      onClick: openConfigPanel
    });
  }

  function init() {
    if (!api) return;
    initUI();
    if (config.enabled) startMonitoring();
  }

  init();

  if (typeof exports !== 'undefined') {
    exports = {
      openSettings: openConfigPanel,
      enable: () => { config.enabled = true; startMonitoring(); },
      disable: () => { config.enabled = false; stopMonitoring(); },
      queueSpecies: enqueueSpecies
    };
  }
})();