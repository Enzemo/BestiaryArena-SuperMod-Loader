(function() {
  if (typeof api === 'undefined' || !api || !api.ui || !api.ui.components) {
    console.error('[Missing Monsters] BestiaryModAPI not available');
    return;
  }

  const BUTTON_ID = 'missing-monsters-button';
  const MODAL_TITLE = 'Bestiary Helper';

  const cache = {
    wikiNames: null,              // Array<string>
    nameToId: null,               // Map<stringLower, gameId>
    locationMap: null,            // Map<stringLower, string>
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
    // Try to let game utils initialize briefly to improve enumeration
    await waitForUtils(1500);
    await ensureDataLoaded();

    const wrapper = document.createElement('div');
    wrapper.style.minWidth = '520px';
    wrapper.style.maxWidth = '100%';
    wrapper.style.overflowX = 'hidden';

    // Nav buttons
    const nav = document.createElement('div');
    nav.style.display = 'flex';
    nav.style.gap = '8px';
    nav.style.marginBottom = '8px';
    nav.style.flexWrap = 'wrap';
    nav.style.maxWidth = '100%';

    const missingBtn = createNavButton('Missing', true);
    const notMaxBtn = createNavButton('Not Max Tier');

    nav.appendChild(missingBtn);
    nav.appendChild(notMaxBtn);

    const contentArea = api.ui.components.createScrollContainer({ height: '60vh', padding: true });
    wrapper.appendChild(nav);
    const contentHost = contentArea.element || contentArea;
    contentHost.style.maxWidth = '100%';
    contentHost.style.overflowX = 'hidden';
    contentHost.style.boxSizing = 'border-box';
    wrapper.appendChild(contentHost);

    const renderMissing = () => {
      const node = renderMissingMonsters();
      replaceContent(contentArea, node);
      setActive(missingBtn, true);
      setActive(notMaxBtn, false);
    };
    const renderNotMax = () => {
      const node = renderNotMaxTier();
      replaceContent(contentArea, node);
      setActive(missingBtn, false);
      setActive(notMaxBtn, true);
    };

    missingBtn.addEventListener('click', renderMissing);
    notMaxBtn.addEventListener('click', renderNotMax);

    renderMissing();
    return wrapper;
  }

  function createNavButton(label, active = false) {
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
    if (active) btn.style.borderImage = "url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 4 fill stretch";
    btn._setActive = (val) => {
      btn.style.borderImage = val
        ? "url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 4 fill stretch"
        : "url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 4 fill stretch";
    };
    return btn;
  }

  function setActive(btn, val) { if (btn && btn._setActive) btn._setActive(val); }

  function replaceContent(scroll, node) {
    if (scroll.clearContent) scroll.clearContent();
    const host = scroll.element || scroll;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (scroll.addContent) {
      scroll.addContent(node);
    } else {
      host.appendChild(node);
    }
  }

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
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
    grid.style.gap = '10px';
    grid.style.width = '100%';
    grid.style.boxSizing = 'border-box';

    const ownedSpecies = getOwnedBySpecies();
    const ownedIds = new Set(ownedSpecies.keys());

    let entries = [];
    for (const name of cache.wikiNames || []) {
      if (!name) continue;
      const id = findIdForName(name);
      const isOwned = typeof id === 'number' ? ownedIds.has(id) : false;
      if (!isOwned) entries.push({ name, id });
    }
    // If still empty, derive candidates from utils when available
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
      grid.appendChild(card);
    }
    container.appendChild(grid);
    return container;
  }

  function getLocationForName(name) {
    if (!name) return null;
    const key = String(name).toLowerCase();
    // Direct lookup
    let loc = cache.locationMap?.get(key) || null;
    if (loc) return loc;
    // Try removing parenthetical notes or commas
    const simplified = key.replace(/\s*\(.+?\)\s*/g, '').replace(/,.+$/, '').trim();
    if (simplified && simplified !== key) {
      loc = cache.locationMap?.get(simplified) || null;
      if (loc) return loc;
    }
    // Try hyphen/underscore/space normalization
    const normalized = simplified.replace(/[\-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (normalized) {
      loc = cache.locationMap?.get(normalized) || null;
      if (loc) return loc;
    }
    return null;
  }

  function renderNotMaxTier() {
    const container = document.createElement('div');
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
    grid.style.gap = '10px';
    grid.style.width = '100%';
    grid.style.boxSizing = 'border-box';

    const ownedSpecies = getOwnedBySpecies();
    const list = [];
    for (const [gameId, info] of ownedSpecies.entries()) {
      if ((info.maxTier || 0) < 5) {
        const name = findNameForId(gameId);
        if (!name) continue; // Do not show ID-only entries
        const loc = cache.locationMap?.get(name.toLowerCase()) || null;
        list.push({ id: gameId, name, tier: info.maxTier || 0, location: loc });
      }
    }

    list.sort((a, b) => a.name.localeCompare(b.name));

    const header = document.createElement('div');
    header.className = 'pixel-font-16';
    header.style.margin = '0 0 6px 0';
    header.textContent = `Owned but not max tier (5): ${list.length}`;
    container.appendChild(header);

    for (const m of list) {
      const card = renderMonsterCard(m.id, m.name, m.location, m.tier);
      grid.appendChild(card);
    }
    container.appendChild(grid);
    return container;
  }

  function normalizeNameKey(n) {
    return String(n || '').toLowerCase().replace(/\s*\(.+?\)\s*/g, '').replace(/[,·].*$/, '').replace(/[\-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function findIdForName(name) {
    if (!name) return null;
    const key = normalizeNameKey(name);
    let id = cache.nameToId?.get(key);
    if (typeof id === 'number') return id;
    // Try original lowercase key
    id = cache.nameToId?.get(String(name).toLowerCase());
    return typeof id === 'number' ? id : null;
  }

  function findNameForId(gameId) {
    if (!cache.nameToId || cache.nameToId.size === 0) return null;
    for (const [k, id] of cache.nameToId.entries()) {
      if (id === gameId) return k; // key is lowercase normalized; acceptable to display
    }
    // As a last resort, use utils
    try { return globalThis.state?.utils?.getMonster?.(gameId)?.metadata?.name || null; } catch (e) { return null; }
  }

  function renderMonsterCard(gameId, name, location, tierOrNull) {
    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'flex-start';
    card.style.padding = '4px 0';

    let figure = null;
    // Prefer compact portrait to avoid overflow
    if (typeof gameId === 'number' && api?.ui?.components?.createMonsterPortrait) {
      try { figure = api.ui.components.createMonsterPortrait({ monsterId: gameId, level: 1, tier: 1 }); } catch (e) {}
    }
    if (!figure) {
      // Fall back to name-only, never show ID if name is missing
      if (!name) return card;
      const label = document.createElement('div');
      label.textContent = name;
      card.appendChild(label);
    } else {
      const wrap = document.createElement('div');
      wrap.style.width = '100%';
      wrap.style.display = 'flex';
      wrap.style.justifyContent = 'center';
      wrap.style.alignItems = 'flex-start';
      wrap.style.overflow = 'hidden';
      try {
        figure.style.maxWidth = '100%';
      } catch (e) {}
      wrap.appendChild(figure);
      card.appendChild(wrap);
    }

    if (name) {
      const nameEl = document.createElement('div');
      nameEl.className = 'pixel-font-14';
      nameEl.style.marginTop = '4px';
      nameEl.textContent = name;
      card.appendChild(nameEl);
    }

    const meta = document.createElement('div');
    meta.className = 'pixel-font-14';
    meta.style.marginTop = '2px';
    meta.style.opacity = '0.9';
    meta.style.textAlign = 'center';
    const bits = [];
    if (typeof tierOrNull === 'number') bits.push(`Tier ${tierOrNull}/5`);
    if (location) bits.push(`Locations: ${location}`);
    if (bits.length) {
      meta.textContent = bits.join(' · ');
      card.appendChild(meta);
    }

    return card;
  }
  
  async function waitForUtils(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (globalThis.state?.utils?.getMonster) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }

  async function ensureDataLoaded() {
    if (cache.fetching) {
      return new Promise(resolve => {
        const t = setInterval(() => { if (!cache.fetching) { clearInterval(t); resolve(); } }, 100);
      });
    }
    cache.fetching = true;
    try {
      if (!cache.wikiNames || !Array.isArray(cache.wikiNames) || cache.wikiNames.length === 0) {
        let names = await fetchMonsterNamesFromWiki();
        // Fallback if wiki empty: enumerate using utils
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
        // Deduplicate and sort for stability
        cache.wikiNames = Array.from(new Set(names.filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b)));
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
    const maxConsecutiveFailures = 15; // be a bit more lenient
    for (let id = 1; id <= 3000; id++) {
      try {
        const data = utils.getMonster(id);
        const nm = data?.metadata?.name;
        if (nm) {
          map.set(String(nm).toLowerCase(), id);
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
        }
      } catch (e) {
        consecutiveFailures++;
      }
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
      } catch (e) { /* try next base */ }
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
      const map = new Map();

      const tables = Array.from(doc.querySelectorAll('table'));
      for (const table of tables) {
        const headerRow = table.querySelector('tr');
        if (!headerRow) continue;
        const headers = Array.from(headerRow.querySelectorAll('th')).map(h => h.textContent.trim().toLowerCase());
        const creatureIdx = headers.findIndex(h => /creature|monster|name/i.test(h));
        const locationIdx = headers.findIndex(h => /location|where|farm/i.test(h));
        if (creatureIdx === -1 || locationIdx === -1) continue;

        const rows = Array.from(table.querySelectorAll('tr')).slice(1);
        for (const tr of rows) {
          const tds = Array.from(tr.querySelectorAll('td'));
          if (tds.length <= Math.max(creatureIdx, locationIdx)) continue;
          const name = (tds[creatureIdx].textContent || '').replace(/\s+/g,' ').trim();
          const loc = (tds[locationIdx].textContent || '').replace(/\s+/g, ' ').trim();
          if (name) map.set(name.toLowerCase(), loc || null);
        }
      }
      return map;
    } catch (e) {
      return new Map();
    }
  }
})();

