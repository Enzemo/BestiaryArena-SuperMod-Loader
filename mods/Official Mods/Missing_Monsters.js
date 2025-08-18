(function() {
  if (typeof api === 'undefined' || !api || !api.ui || !api.ui.components) {
    console.error('[Missing Monsters] BestiaryModAPI not available');
    return;
  }

  const BUTTON_ID = 'missing-monsters-button';
  const MODAL_TITLE = 'Bestiary Helper';

  const cache = {
    wikiNames: null,          // Array<string>
    nameToId: null,           // Map<stringLowerNormalized, gameId>
    locationMap: null,        // Map<stringLowerNormalized, locationText>
    fetching: false
  };

  api.ui.addButton({
    id: BUTTON_ID,
    text: 'Missing Monsters',
    tooltip: 'Show missing and not-max monsters with locations',
    primary: false,
    onClick: async () => {
      const container = await buildModal();
      api.ui.components.createModal({ title: MODAL_TITLE, width: 560, height: 'auto', content: container });
    }
  });

  async function buildModal() {
    ensureStyles();
    await waitForUtils(1200);
    await ensureDataLoaded();

    const wrapper = document.createElement('div');
    wrapper.className = 'mm-wrapper';
    wrapper.style.minWidth = '520px';
    wrapper.style.maxWidth = '100%';
    wrapper.style.width = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.overflowX = 'hidden';

    // Nav
    const nav = document.createElement('div');
    nav.style.display = 'flex';
    nav.style.gap = '8px';
    nav.style.marginBottom = '8px';
    nav.style.flexWrap = 'wrap';
    nav.style.maxWidth = '100%';
    nav.style.width = '100%';

    const missingBtn = createNavButton('Missing', true);
    const notMaxBtn = createNavButton('Not Max Tier');
    nav.appendChild(missingBtn);
    nav.appendChild(notMaxBtn);

    // Content area (simple, scrollable)
    const contentArea = document.createElement('div');
    contentArea.className = 'mm-content';
    contentArea.style.height = '420px';
    contentArea.style.overflowY = 'auto';
    contentArea.style.overflowX = 'hidden';
    contentArea.style.padding = '8px';
    contentArea.style.boxSizing = 'border-box';
    contentArea.style.width = '100%';
    contentArea.style.maxWidth = '100%';

    wrapper.appendChild(nav);
    wrapper.appendChild(contentArea);

    const renderMissing = () => {
      replaceContent(contentArea, renderMissingMonsters());
      setActive(missingBtn, true);
      setActive(notMaxBtn, false);
    };
    const renderNotMax = () => {
      replaceContent(contentArea, renderNotMaxTier());
      setActive(missingBtn, false);
      setActive(notMaxBtn, true);
    };

    missingBtn.addEventListener('click', renderMissing);
    notMaxBtn.addEventListener('click', renderNotMax);
    renderMissing();

    return wrapper;
  }

  function createNavButton(label, active) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'pixel-font-16';
    btn.style.cssText = `
      padding: 6px 10px;
      cursor: pointer;
      color: #ffe066;
      background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat;
      border: 4px solid transparent;
      border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 4 fill stretch;
    `;
    btn._setActive = (val) => {
      btn.style.borderImage = val
        ? "url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 4 fill stretch"
        : "url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 4 fill stretch";
    };
    btn._setActive(!!active);
    return btn;
  }
  function setActive(btn, val) { if (btn && btn._setActive) btn._setActive(val); }
  function replaceContent(host, node) { while (host.firstChild) host.removeChild(host.firstChild); host.appendChild(node); }

  function getOwnedBySpecies() {
    try {
      const playerCtx = globalThis.state?.player?.getSnapshot()?.context;
      const monsters = Array.isArray(playerCtx?.monsters) ? playerCtx.monsters : [];
      const map = new Map(); // gameId -> { maxTier, count }
      for (const m of monsters) {
        if (!m || typeof m.gameId !== 'number') continue;
        const entry = map.get(m.gameId) || { maxTier: 0, count: 0 };
        entry.maxTier = Math.max(entry.maxTier || 0, Number(m.tier || 0));
        entry.count += 1;
        map.set(m.gameId, entry);
      }
      return map;
    } catch (e) {
      return new Map();
    }
  }

  function renderMissingMonsters() {
    const container = document.createElement('div');
    const grid = document.createElement('div');
    grid.className = 'mm-grid';
    try {
      grid.style.setProperty('display', 'block', 'important');
      grid.style.setProperty('width', '100%', 'important');
      grid.style.setProperty('max-width', '100%', 'important');
    } catch (e) {}

    const ownedSpecies = getOwnedBySpecies();
    const ownedIds = new Set(ownedSpecies.keys());

    let entries = [];
    for (const name of cache.wikiNames || []) {
      if (!name) continue;
      const id = findIdForName(name);
      const isOwned = typeof id === 'number' ? ownedIds.has(id) : false;
      if (!isOwned) entries.push({ name, id });
    }

    // Extra fallback derived from utils if wiki mapping produced nothing
    if (entries.length === 0 && globalThis.state?.utils?.getMonster) {
      const utils = globalThis.state.utils;
      const candidates = [];
      let misses = 0;
      for (let i = 1; i <= 1000 && misses < 30; i++) {
        try {
          const d = utils.getMonster(i);
          const nm = d?.metadata?.name;
          if (nm) { candidates.push({ name: nm, id: i }); misses = 0; } else { misses++; }
        } catch (e) { misses++; }
      }
      entries = candidates.filter(c => !ownedIds.has(c.id));
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    const header = document.createElement('div');
    header.className = 'pixel-font-16';
    header.style.margin = '0 0 6px 0';
    header.textContent = `Missing monsters: ${entries.length}`;
    container.appendChild(header);

    for (const m of entries) {
      const card = renderMonsterCard(m.id, m.name, getLocationForName(m.name), null);
      try {
        card.style.setProperty('width', '100%', 'important');
        card.style.setProperty('max-width', '100%', 'important');
        card.style.setProperty('flex', '0 0 100%', 'important');
        card.style.marginBottom = '8px';
        card.style.display = 'block';
      } catch (e) {}
      grid.appendChild(card);
    }
    container.appendChild(grid);
    return container;
  }

  function renderNotMaxTier() {
    const container = document.createElement('div');
    const grid = document.createElement('div');
    grid.className = 'mm-grid';
    try {
      grid.style.setProperty('display', 'block', 'important');
      grid.style.setProperty('width', '100%', 'important');
      grid.style.setProperty('max-width', '100%', 'important');
    } catch (e) {}

    const ownedSpecies = getOwnedBySpecies();
    const list = [];
    for (const [gameId, info] of ownedSpecies.entries()) {
      if ((info.maxTier || 0) < 4) {
        const name = findNameForId(gameId);
        if (!name) continue; // Do not show ID-only entries
        const loc = cache.locationMap?.get(normalizeNameKey(name)) || null;
        list.push({ id: gameId, name, tier: info.maxTier || 0, location: loc });
      }
    }

    list.sort((a, b) => a.name.localeCompare(b.name));

    const header = document.createElement('div');
    header.className = 'pixel-font-16';
    header.style.margin = '0 0 6px 0';
    header.textContent = `Owned but not max tier (4): ${list.length}`;
    container.appendChild(header);

    for (const m of list) {
      const card = renderMonsterCard(m.id, m.name, m.location, m.tier);
      try {
        card.style.setProperty('width', '100%', 'important');
        card.style.setProperty('max-width', '100%', 'important');
        card.style.setProperty('flex', '0 0 100%', 'important');
        card.style.marginBottom = '8px';
        card.style.display = 'block';
      } catch (e) {}
      grid.appendChild(card);
    }
    container.appendChild(grid);
    return container;
  }

  function renderMonsterCard(gameId, name, location, tierOrNull) {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'flex-start';
    card.style.padding = '4px 4px';
    card.style.width = '100%';
    card.style.maxWidth = '100%';
    card.style.boxSizing = 'border-box';

    let figure = null;
    if (typeof gameId === 'number' && api?.ui?.components?.createMonsterPortrait) {
      try { figure = api.ui.components.createMonsterPortrait({ monsterId: gameId, level: 1, tier: 1 }); } catch (e) {}
    }
    if (!figure) {
      if (!name) return card; // never show ID without a name
      const label = document.createElement('div');
      label.textContent = name;
      label.style.textAlign = 'center';
      label.style.wordBreak = 'break-word';
      label.style.whiteSpace = 'normal';
      label.style.maxWidth = '100%';
      card.appendChild(label);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'mm-portrait';
      wrap.style.width = '100%';
      wrap.style.display = 'flex';
      wrap.style.justifyContent = 'center';
      wrap.style.alignItems = 'flex-start';
      wrap.style.overflow = 'hidden';
      try { figure.style.maxWidth = '100%'; figure.style.width = '100%'; } catch (e) {}
      wrap.appendChild(figure);
      card.appendChild(wrap);
    }

    if (name) {
      const nameEl = document.createElement('div');
      nameEl.className = 'pixel-font-14';
      nameEl.style.marginTop = '4px';
      nameEl.style.textAlign = 'center';
      nameEl.style.wordBreak = 'break-word';
      nameEl.style.whiteSpace = 'normal';
      nameEl.style.maxWidth = '100%';
      nameEl.textContent = name;
      card.appendChild(nameEl);
    }

    const meta = document.createElement('div');
    meta.className = 'pixel-font-14';
    meta.style.marginTop = '2px';
    meta.style.opacity = '0.9';
    meta.style.textAlign = 'center';
    meta.style.wordBreak = 'break-word';
    meta.style.overflowWrap = 'anywhere';
    meta.style.whiteSpace = 'normal';
    meta.style.maxWidth = '100%';
    const bits = [];
    if (typeof tierOrNull === 'number') bits.push(`Tier ${tierOrNull}/4`);
    if (location) bits.push(`Locations: ${location}`);
    if (bits.length) { meta.textContent = bits.join(' · '); card.appendChild(meta); }

    return card;
  }

  function ensureStyles() {
    if (document.getElementById('mm-styles')) return;
    const style = document.createElement('style');
    style.id = 'mm-styles';
    style.textContent = `
      .mm-wrapper{max-width:100%;width:100%;overflow:hidden}
      .mm-content{height:420px;overflow-y:auto;overflow-x:hidden;padding:8px;box-sizing:border-box;width:100%;max-width:100%;}
      .mm-grid{display:block !important;grid-template-columns:none !important;column-count:1 !important;gap:0 !important;width:100% !important;max-width:100% !important;box-sizing:border-box !important}
      .mm-grid > *{width:100% !important;max-width:100% !important;display:block !important}
      .mm-card{width:100% !important;max-width:100% !important;box-sizing:border-box !important;display:block !important}
      .mm-card img{max-width:100% !important;height:auto !important;}
      .mm-portrait{max-width:100% !important;overflow:hidden !important}
    `;
    document.head.appendChild(style);
  }

  async function ensureDataLoaded() {
    if (cache.fetching) {
      return new Promise(resolve => { const t = setInterval(() => { if (!cache.fetching) { clearInterval(t); resolve(); } }, 100); });
    }
    cache.fetching = true;
    try {
      if (!cache.wikiNames || !Array.isArray(cache.wikiNames) || cache.wikiNames.length === 0) {
        let names = await fetchMonsterNamesFromWiki();
        if (!names || names.length === 0) {
          names = [];
          const utils = globalThis.state?.utils;
          if (utils && typeof utils.getMonster === 'function') {
            let misses = 0;
            for (let i = 1; i <= 2000 && misses < 30; i++) {
              try {
                const d = utils.getMonster(i);
                const nm = d?.metadata?.name;
                if (nm) { names.push(nm); misses = 0; } else { misses++; }
              } catch (e) { misses++; }
            }
          }
        }
        cache.wikiNames = Array.from(new Set((names || []).filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b)));
      }
      if (!cache.nameToId || !(cache.nameToId instanceof Map) || cache.nameToId.size === 0) {
        cache.nameToId = buildNameToIdIndex();
      }
      if (!cache.locationMap || !(cache.locationMap instanceof Map)) {
        cache.locationMap = await fetchCreatureFarmingLocations();
      }
    } finally {
      cache.fetching = false;
    }
  }

  function buildNameToIdIndex() {
    const utils = globalThis.state?.utils;
    const map = new Map();
    if (!utils || typeof utils.getMonster !== 'function') return map;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 15;
    for (let id = 1; id <= 3000; id++) {
      try {
        const data = utils.getMonster(id);
        const nm = data?.metadata?.name;
        if (nm) {
          map.set(normalizeNameKey(nm), id);
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
        }
      } catch (e) { consecutiveFailures++; }
      if (consecutiveFailures >= maxConsecutiveFailures) break;
    }
    return map;
  }

  async function fetchMonsterNamesFromWiki() {
    const bases = [
      'https://bestiaryarena.wiki.gg/api.php',
      'https://bestiaryarena.fandom.com/api.php'
    ];
    const categories = ['Monsters', 'Creatures'];
    for (const base of bases) {
      try {
        const all = new Set();
        for (const cat of categories) {
          const names = await fetchAllCategoryMembers(base, `Category:${cat}`);
          names.forEach(n => all.add(n));
        }
        if (all.size) return Array.from(all);
      } catch (e) { /* try next */ }
    }
    return [];
  }

  async function fetchAllCategoryMembers(baseUrl, categoryTitle) {
    let cont = null;
    const names = [];
    while (true) {
      const params = new URLSearchParams({
        action: 'query',
        list: 'categorymembers',
        cmtitle: categoryTitle,
        cmlimit: '500',
        cmtype: 'page',
        format: 'json',
        origin: '*'
      });
      if (cont && cont.cmcontinue) params.set('cmcontinue', cont.cmcontinue);
      const url = `${baseUrl}?${params.toString()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) break;
      const json = await res.json();
      const members = json?.query?.categorymembers || [];
      for (const m of members) {
        const title = m && m.title ? String(m.title) : '';
        if (title && !title.startsWith('Category:')) names.push(title);
      }
      if (json && json.continue && json.continue.cmcontinue) {
        cont = { cmcontinue: json.continue.cmcontinue };
      } else {
        break;
      }
    }
    return names;
  }

  async function fetchCreatureFarmingLocations() {
    const bases = [
      'https://bestiaryarena.wiki.gg/api.php',
      'https://bestiaryarena.fandom.com/api.php'
    ];
    const pages = ['Creature_farming', 'Creature farming', 'Creature_Farming', 'Creature-Farming'];
    for (const base of bases) {
      for (const page of pages) {
        try {
          const params = new URLSearchParams({ action: 'parse', page, prop: 'text', format: 'json', origin: '*' });
          const url = `${base}?${params.toString()}`;
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) continue;
          const data = await res.json();
          const html = data?.parse?.text?.['*'];
          if (!html) continue;
          const map = extractLocationsFromHtml(html);
          if (map && map.size) return map;
        } catch (e) { /* try next */ }
      }
    }
    return new Map();
  }

  function extractLocationsFromHtml(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const out = new Map();

      const tables = Array.from(doc.querySelectorAll('table'));
      for (const table of tables) {
        const headerRow = table.querySelector('tr');
        if (!headerRow) continue;
        const headers = Array.from(headerRow.querySelectorAll('th')).map(h => (h.textContent || '').trim().toLowerCase());
        const creatureIdx = headers.findIndex(h => /creature|monster|name/i.test(h));
        const locationIdx = headers.findIndex(h => /location|where|farm/i.test(h));
        if (creatureIdx === -1 || locationIdx === -1) continue;

        const rows = Array.from(table.querySelectorAll('tr')).slice(1);
        for (const tr of rows) {
          const tds = Array.from(tr.querySelectorAll('td'));
          if (tds.length <= Math.max(creatureIdx, locationIdx)) continue;
          const rawName = (tds[creatureIdx].textContent || '').replace(/\s+/g, ' ').trim();
          const rawLoc = (tds[locationIdx].textContent || '').replace(/\s+/g, ' ').trim();
          if (rawName) out.set(normalizeNameKey(rawName), rawLoc || null);
        }
      }
      return out;
    } catch (e) {
      return new Map();
    }
  }

  function normalizeNameKey(n) {
    return String(n || '')
      .toLowerCase()
      .replace(/\s*\(.+?\)\s*/g, '')
      .replace(/[,·].*$/, '')
      .replace(/[\-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getLocationForName(name) {
    if (!name) return null;
    const direct = cache.locationMap?.get(normalizeNameKey(name)) || null;
    return direct || null;
  }

  function findIdForName(name) {
    if (!name) return null;
    const key = normalizeNameKey(name);
    const id = cache.nameToId?.get(key);
    return typeof id === 'number' ? id : null;
  }

  function findNameForId(gameId) {
    if (!cache.nameToId || cache.nameToId.size === 0) return null;
    for (const [k, id] of cache.nameToId.entries()) {
      if (id === gameId) return k; // normalized lowercased; acceptable for display
    }
    try { return globalThis.state?.utils?.getMonster?.(gameId)?.metadata?.name || null; } catch (e) { return null; }
  }

  async function waitForUtils(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (globalThis.state?.utils?.getMonster) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }
})();

