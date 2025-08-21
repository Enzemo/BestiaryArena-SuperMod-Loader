(function() {
  if (typeof api === 'undefined' || !api || !api.ui || !api.ui.components) {
    console.error('[Missing Monsters] BestiaryModAPI not available');
    return;
  }

  const BUTTON_ID = 'missing-monsters-button';
  const MODAL_TITLE = 'Collection Helper';

  // Hardcoded unobtainable monsters list
  const UNOBTAINABLE_MONSTERS = [
    'Black Knight',
    'Dead Tree',
    'Earth Crystal',
    'Energy Crystal',
    'Lavahole',
    'Magma Crystal',
    'Old Giant Spider',
    'Orc',
    'Willi Wasp',
    'Sweaty Cyclops'
  ];

  // Hardcoded equipment list
  const EQUIPMENT_LIST = [
    'Amazon Armor',
    'Amazon Helmet',
    'Amazon Shield',
    'Amulet of Loss',
    'Bear Skin',
    'Bloody Edge',
    'Blue Robe',
    'Bonelord Helmet',
    'Boots of Haste',
    'Chain Bolter',
    'Cranial Basher',
    'Dwarven Helmet',
    'Dwarven Legs',
    'Ectoplasmic Shield',
    'Epee',
    'Fire Axe',
    'Giant Sword',
    'Glacial Rod',
    'Glass of Goo',
    'Hailstorm Rod',
    'Ice Rapier',
    'Jester Hat',
    'Medusa Shield',
    'Ratana',
    'Royal Scale Robe',
    'Rubber Cap',
    'Skull Helmet',
    'Skullcracker Armor',
    'Springsprout Rod',
    'Steel Boots',
    'Stealth Ring',
    'Vampire Shield',
    'Wand of Decay',
    'White Skull'
  ];

  // Official creature locations from wiki (https://bestiaryarena.wiki.gg/wiki/Creature_farming)
  const CREATURE_LOCATIONS = {
    'banshee': 'Carlin → Banshee\'s Last Room',
    'bear': 'Rookgaard → Bear Room',
    'bog raider': 'Kazordoon → Awash Steamship',
    'bug': 'Carlin → City Boardgames / Carlin Sewers',
    'cyclops': 'Carlin → Labyrinth Depths',
    'deer': 'Folda → Santa Claus Home',
    'demon skeleton': 'Carlin → Demon Skeleton Hell',
    'dragon': 'Rookgaard → Lonesome Dragon',
    'dragon lord': 'Carlin → Maze Gates / Folda → Vega Mountain',
    'druid': 'Carlin → Teleporter Trap / Folda → Folda Boat',
    'dwarf': 'Kazordoon → Dwarven Brewery',
    'dwarf geomancer': 'Kazordoon → Emperor Kruzak\'s Treasure Room',
    'dwarf guard': 'Kazordoon → Emperor Kruzak\'s Treasure Room',
    'dwarf soldier': 'Kazordoon → Mine Hub',
    'elf': 'Ab\'Dendriel → Hedge Maze',
    'elf arcanist': 'Ab\'Dendriel → Elvenbane',
    'elf scout': 'Ab\'Dendriel → Hedge Maze',
    'fire devil': 'Carlin → Ghostlands Ritual Site',
    'fire elemental': 'Folda → Folda Boat',
    'frost troll': 'Folda → Cave Entrance',
    'ghost': 'Carlin → Demonrage Seal',
    'ghoul': 'Carlin → Ghostlands Library / Ghostlands Ritual Site / Maze Gates',
    'goblin': 'Rookgaard → Goblin Bridge',
    'goblin assassin': 'Ab\'Dendriel → Femor Hills',
    'goblin scavenger': 'Ab\'Dendriel → Femor Hills',
    'knight': 'Kazordoon → The Farms',
    'minotaur': 'Rookgaard → Minotaur Mage Room / Minotaur Hell',
    'minotaur archer': 'Carlin → Labyrinth Depths',
    'minotaur guard': 'Carlin → Maze Gates',
    'minotaur mage': 'Rookgaard → Bear Room',
    'monk': 'Carlin → Isle of Kings',
    'mummy': 'Carlin → Zathroth\'s Throne',
    'nightstalker': 'Kazordoon → Robson\'s Isle Ruins',
    'orc berserker': 'Ab\'Dendriel → Orcish Barracks',
    'orc leader': 'Ab\'Dendriel → Orcsmith Orcshop',
    'orc rider': 'Ab\'Dendriel → The Orc King Hall',
    'orc shaman': 'Ab\'Dendriel → A Shamanic Ritual',
    'orc spearman': 'Rookgaard → Goblin Temple',
    'orc warlord': 'Ab\'Dendriel → Shore Camp',
    'poison spider': 'Rookgaard → Spider Lair / Carlin → Ghostlands Library',
    'polar bear': 'Folda → Permafrosted Hole',
    'rat': 'Rookgaard → Sewers',
    'rorc': 'Kazordoon → Orc Fortress Outskirts',
    'rotworm': 'Rookgaard → Rotten Graveyard',
    'scorpion': 'Carlin → Zathroth\'s Throne',
    'sheep': 'Rookgaard → Evergreen Fields',
    'skeleton': 'Rookgaard → Rotten Graveyard',
    'slime': 'Carlin → Carlin Sewers',
    'snake': 'Rookgaard → Wheat Field',
    'spider': 'Rookgaard → Spider Lair',
    'stalker': 'Carlin → Zathroth\'s Throne',
    'troll': 'Rookgaard → Katana Quest',
    'warlock': 'Carlin → Hidden City of Demona',
    'wasp': 'Ab\'Dendriel → Ab\'Dendriel Hive',
    'water elemental': 'Folda → Frozen Aquifer',
    'winter wolf': 'Folda → Cave Entrance / Santa Claus Home',
    'wolf': 'Rookgaard → Wolf\'s Den',
    'wyvern': 'Folda → Vega Mountain',

    'firestarter': 'Scroll',
    'tortoise': 'Scroll',
    'swamp troll': 'Scroll'

  };

  const cache = {
    wikiNames: null,          // Array<string>
    nameToId: null,           // Map<stringLowerNormalized, gameId>
    locationMap: null,        // Map<stringLowerNormalized, locationText>
    unobtainableSet: null,    // Set<stringLowerNormalized>
    fetching: false
  };

  api.ui.addButton({
    id: BUTTON_ID,
    text: 'Collection Helper',
    tooltip: 'Show missing monsters, equipment, and not-max items',
    primary: false,
    onClick: async () => {
      const container = await buildModal();
      api.ui.components.createModal({ title: MODAL_TITLE, width: 1200, height: 'auto', content: container });
    }
  });

  async function buildModal() {
    ensureStyles();
    await waitForUtils(1200);
    await ensureDataLoaded();

    const wrapper = document.createElement('div');
    wrapper.className = 'mm-wrapper';
    wrapper.style.cssText = `
      width: 100%;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    `;

    // Nav
    const nav = document.createElement('div');
    nav.style.cssText = `
      display: grid;
      gap: 4px;
      margin-bottom: 12px;
      flex-wrap: wrap;
      max-width: 100%;
      width: 100%;
      justify-content: center;
      align-items: center;
      padding: 8px;
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
      grid-template-columns: repeat(2, 1fr)
    `;

    const missingBtn = createNavButton('Missing Monsters', true);
    const notMaxBtn = createNavButton('Monsters Not Max Tier');
    const missingEquipBtn = createNavButton('Missing Equipment');
    const equipNotMaxBtn = createNavButton('Equipment Not Max Tier');
    nav.appendChild(missingBtn);
    nav.appendChild(notMaxBtn);
    nav.appendChild(missingEquipBtn);
    nav.appendChild(equipNotMaxBtn);

    // Content area - single column layout
    const contentArea = document.createElement('div');
    contentArea.className = 'mm-content';
    contentArea.style.cssText = `
      height: 420px;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0;
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
      direction: ltr;
    `;

    wrapper.appendChild(nav);
    wrapper.appendChild(contentArea);

    const renderMissing = () => {
      replaceContent(contentArea, renderMissingMonsters());
      setActive(missingBtn, true);
      setActive(notMaxBtn, false);
      setActive(missingEquipBtn, false);
      setActive(equipNotMaxBtn, false);
    };
    const renderNotMax = () => {
      replaceContent(contentArea, renderNotMaxTier());
      setActive(missingBtn, false);
      setActive(notMaxBtn, true);
      setActive(missingEquipBtn, false);
      setActive(equipNotMaxBtn, false);
    };
    const renderMissingEquip = () => {
      replaceContent(contentArea, renderMissingEquipment());
      setActive(missingBtn, false);
      setActive(notMaxBtn, false);
      setActive(missingEquipBtn, true);
      setActive(equipNotMaxBtn, false);
    };
    const renderEquipNotMax = () => {
      replaceContent(contentArea, renderEquipmentNotMaxTier());
      setActive(missingBtn, false);
      setActive(notMaxBtn, false);
      setActive(missingEquipBtn, false);
      setActive(equipNotMaxBtn, true);
    };

    missingBtn.addEventListener('click', renderMissing);
    notMaxBtn.addEventListener('click', renderNotMax);
    missingEquipBtn.addEventListener('click', renderMissingEquip);
    equipNotMaxBtn.addEventListener('click', renderEquipNotMax);
    renderMissing();

    return wrapper;
  }

  function createNavButton(label, active) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'pixel-font-14';
    btn.style.cssText = `
      padding: 8px 12px;
      margin: 2px;
      cursor: pointer;
      color: #ffe066;
      background: linear-gradient(145deg, #4a4a4a, #2a2a2a);
      border: 2px solid #666;
      border-radius: 4px;
      flex-shrink: 0;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
      min-width: 120px;
      text-align: center;
    `;
    btn._setActive = (val) => {
      if (val) {
        btn.style.background = 'linear-gradient(145deg, #5a5a2a, #3a3a1a)';
        btn.style.borderColor = '#ffe066';
        btn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.5)';
      } else {
        btn.style.background = 'linear-gradient(145deg, #4a4a4a, #2a2a2a)';
        btn.style.borderColor = '#666';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      }
    };
    btn.addEventListener('mouseenter', () => {
      if (!btn._isActive) {
        btn.style.background = 'linear-gradient(145deg, #5a5a5a, #3a3a3a)';
        btn.style.borderColor = '#888';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn._isActive) {
        btn.style.background = 'linear-gradient(145deg, #4a4a4a, #2a2a2a)';
        btn.style.borderColor = '#666';
      }
    });
    btn._setActive(!!active);
    btn._isActive = !!active;
    return btn;
  }
  function setActive(btn, val) { 
    if (btn && btn._setActive) {
      btn._setActive(val);
      btn._isActive = val;
    }
  }
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

  function getOwnedEquipment() {
    try {
      // Use the correct equipment path from Cyclopedia.js
      const equipment = globalThis.state?.player?.getSnapshot?.().context?.equips || [];
      
      ////console.log('[Equipment Debug] Found equipment array:', equipment.length, 'items');
      if (equipment.length > 0) {
        ////console.log('[Equipment Debug] Sample equipment item:', equipment[0]);
      }
      
      const map = new Map(); // gameId -> { maxTier, count }
      for (const e of equipment) {
        if (!e || typeof e.gameId !== 'number') continue;
        const entry = map.get(e.gameId) || { maxTier: 0, count: 0 };
        entry.maxTier = Math.max(entry.maxTier || 0, Number(e.tier || 0));
        entry.count += 1;
        map.set(e.gameId, entry);
      }
      
      ////console.log('[Equipment Debug] Processed equipment map size:', map.size);
      return map;
    } catch (e) {
      //console.error('[Equipment Debug] Error:', e);
      return new Map();
    }
  }

  function findEquipmentIdForName(name) {
    if (!name) return null;
    try {
      const utils = globalThis.state?.utils;
      if (!utils || typeof utils.getEquipment !== 'function') return null;
      
      // Try to find equipment by iterating through IDs
      for (let i = 1; i <= 1000; i++) {
        try {
          const data = utils.getEquipment(i);
          const equipName = data?.metadata?.name;
          if (equipName && normalizeNameKey(equipName) === normalizeNameKey(name)) {
            return i;
          }
        } catch (e) {
          continue;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function findEquipmentNameForId(gameId) {
    try {
      const utils = globalThis.state?.utils;
      if (!utils || typeof utils.getEquipment !== 'function') return null;
      const data = utils.getEquipment(gameId);
      return data?.metadata?.name || null;
    } catch (e) {
      return null;
    }
  }

  function getEquipmentSpriteId(gameId) {
    try {
      const utils = globalThis.state?.utils;
      if (!utils || typeof utils.getEquipment !== 'function') return null;
      const data = utils.getEquipment(gameId);
      return data?.metadata?.spriteId || null;
    } catch (e) {
      return null;
    }
  }

  function renderMissingMonsters() {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const listEl = document.createElement('div');
    listEl.className = 'mm-list';
    listEl.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const ownedSpecies = getOwnedBySpecies();
    const ownedIds = new Set(ownedSpecies.keys());

    let entries = [];
    for (const name of cache.wikiNames || []) {
      if (!name) continue;
      const normalizedName = normalizeNameKey(name);
      // Skip if unobtainable
      if (cache.unobtainableSet && cache.unobtainableSet.has(normalizedName)) continue;
      
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
          if (nm) { 
            const normalizedName = normalizeNameKey(nm);
            // Skip if unobtainable
            if (cache.unobtainableSet && cache.unobtainableSet.has(normalizedName)) continue;
            candidates.push({ name: nm, id: i }); 
            misses = 0; 
          } else { 
            misses++; 
          }
        } catch (e) { misses++; }
      }
      entries = candidates.filter(c => {
        if (ownedIds.has(c.id)) return false;
        const normalizedName = normalizeNameKey(c.name);
        return !cache.unobtainableSet || !cache.unobtainableSet.has(normalizedName);
      });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    const header = document.createElement('div');
    header.className = 'pixel-font-16';
    header.style.cssText = `
      margin: 0 0 12px 0;
      text-align: left;
      width: 100%;
    `;
    header.textContent = `Missing monsters: ${entries.length}`;
    container.appendChild(header);

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pixel-font-14';
      empty.style.textAlign = 'left';
      empty.textContent = 'No missing creatures found.';
      container.appendChild(empty);
    } else {
      for (const m of entries) {
        const card = renderMonsterCard(m.id, m.name, getLocationForName(m.name), null);
        listEl.appendChild(card);
      }
    }
    container.appendChild(listEl);
    return container;
  }

  function renderNotMaxTier() {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const listEl = document.createElement('div');
    listEl.className = 'mm-list';
    listEl.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

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
    header.style.cssText = `
      margin: 0 0 12px 0;
      text-align: left;
      width: 100%;
    `;
    header.textContent = `Owned but not max tier: ${list.length}`;
    container.appendChild(header);

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pixel-font-14';
      empty.style.textAlign = 'left';
      empty.textContent = 'All owned creatures are at max tier.';
      container.appendChild(empty);
    } else {
      for (const m of list) {
        const card = renderMonsterCard(m.id, m.name, m.location, m.tier);
        listEl.appendChild(card);
      }
    }
    container.appendChild(listEl);
    return container;
  }

  function renderMissingEquipment() {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const listEl = document.createElement('div');
    listEl.className = 'mm-list';
    listEl.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const ownedEquipment = getOwnedEquipment();
    ////console.log('[Missing Equipment Debug] Owned equipment map:', ownedEquipment);
    
    // Create a set of owned equipment names (normalized)
    const ownedNames = new Set();
    for (const [gameId, info] of ownedEquipment.entries()) {
      const name = findEquipmentNameForId(gameId);
      if (name) {
        ownedNames.add(normalizeNameKey(name));
      }
    }
    
    ////console.log('[Missing Equipment Debug] Owned equipment names:', Array.from(ownedNames));

    let entries = [];
    for (const equipName of EQUIPMENT_LIST) {
      if (!equipName) continue;
      const normalizedName = normalizeNameKey(equipName);
      const isOwned = ownedNames.has(normalizedName);
      ////console.log(`[Missing Equipment Debug] ${equipName} (${normalizedName}): owned = ${isOwned}`);
      if (!isOwned) {
        const id = findEquipmentIdForName(equipName);
        entries.push({ name: equipName, id });
      }
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    const header = document.createElement('div');
    header.className = 'pixel-font-16';
    header.style.cssText = `
      margin: 0 0 12px 0;
      text-align: left;
      width: 100%;
    `;
    header.textContent = `Missing equipment: ${entries.length}`;
    container.appendChild(header);

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pixel-font-14';
      empty.style.textAlign = 'left';
      empty.textContent = 'No missing equipment found.';
      container.appendChild(empty);
    } else {
      for (const e of entries) {
        const card = renderEquipmentCard(e.id, e.name, null, null);
        listEl.appendChild(card);
      }
    }
    container.appendChild(listEl);
    return container;
  }

  function renderEquipmentNotMaxTier() {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const listEl = document.createElement('div');
    listEl.className = 'mm-list';
    listEl.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const ownedEquipment = getOwnedEquipment();
    //console.log('[Equipment Not Max Debug] Owned equipment entries:', ownedEquipment.size);
    
    const list = [];
    for (const [gameId, info] of ownedEquipment.entries()) {
      //console.log(`[Equipment Not Max Debug] ID ${gameId}: tier ${info.maxTier}, checking if < 5`);
      if ((info.maxTier || 0) < 5) { // Max tier for equipment is 5
        let name = findEquipmentNameForId(gameId);
        //console.log(`[Equipment Not Max Debug] Found name for ID ${gameId}: ${name}`);
        
        if (!name) {
          // Try to find name in our equipment list by ID matching
          for (const equipName of EQUIPMENT_LIST) {
            const equipId = findEquipmentIdForName(equipName);
            if (equipId === gameId) {
              name = equipName;
              //console.log(`[Equipment Not Max Debug] Matched ${equipName} to ID ${gameId}`);
              break;
            }
          }
        }
        
        if (name) {
          list.push({ id: gameId, name, tier: info.maxTier || 0 });
          //console.log(`[Equipment Not Max Debug] Added ${name} with tier ${info.maxTier}`);
        } else {
          //console.log(`[Equipment Not Max Debug] Could not find name for ID ${gameId}, skipping`);
        }
      }
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    //console.log(`[Equipment Not Max Debug] Final list has ${list.length} items`);

    const header = document.createElement('div');
    header.className = 'pixel-font-16';
    header.style.cssText = `
      margin: 0 0 12px 0;
      text-align: left;
      width: 100%;
    `;
    header.textContent = `Owned equipment not at max tier: ${list.length}`;
    container.appendChild(header);

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pixel-font-14';
      empty.style.textAlign = 'left';
      empty.textContent = 'All owned equipment is at max tier.';
      container.appendChild(empty);
    } else {
      for (const e of list) {
        const card = renderEquipmentCard(e.id, e.name, null, e.tier);
        listEl.appendChild(card);
      }
    }
    container.appendChild(listEl);
    return container;
  }

  function renderMonsterCard(gameId, name, location, tierOrNull) {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.style.position = 'relative';

    // Portrait first - positioned absolutely to avoid layout issues
    if (typeof gameId === 'number' && api?.ui?.components?.createMonsterPortrait) {
      try { 
        const figure = api.ui.components.createMonsterPortrait({ monsterId: gameId });
        if (figure) {
          figure.style.cssText = `
            position: absolute !important;
            top: 8px !important;
            left: 8px !important;
            width: 40px !important;
            height: 40px !important;
            z-index: 1 !important;
          `;
          
          // Aggressively hide level indicators with CSS
          figure.style.setProperty('--level-display', 'none', 'important');
          
          // Multiple approaches to hide level text
          setTimeout(() => {
            // Hide by content
            figure.querySelectorAll('*').forEach(el => {
              const text = el.textContent?.trim();
              if (text === '1' || text === 'Lv.1' || text === 'Level 1' || text === 'Lv 1') {
                el.remove();
              }
            });
            
            // Hide by common class patterns
            figure.querySelectorAll('.level, .monster-level, [class*="level"], [class*="Level"]').forEach(el => {
              el.remove();
            });
          }, 10);
          
          card.appendChild(figure);
        }
      } catch (e) {}
    }

    // Text content with left padding for portrait
    const textDiv = document.createElement('div');
    textDiv.style.cssText = `
      padding: 8px 8px 8px 56px !important;
      min-height: 98px !important;
      display: block !important;
      position: relative !important;
      z-index: 2 !important;
      word-wrap: break-word !important;
      overflow-wrap: anywhere !important;
      white-space: normal !important;
      width: calc(100% - 64px) !important;
      max-width: calc(100% - 64px) !important;
      box-sizing: border-box !important;
    `;

    let html = '';
    if (name) {
      html += `<div style="font-size: 16px; font-weight: bold; color: white; margin-bottom: 8px;">${name}</div>`;
    }

    if (typeof tierOrNull === 'number') {
      html += `<div style="font-size: 14px; opacity: 0.8; color: white; margin-bottom: 4px;">Tier ${tierOrNull}/4</div>`;
    }
    
    if (location) {
      html += `<div style="font-size: 12px; opacity: 0.8; color: white; word-wrap: break-word; overflow-wrap: anywhere; white-space: normal; max-width: 100%; width: 100%; box-sizing: border-box; line-height: 1.4; hyphens: auto;">Location: ${location}</div>`;
    }

    textDiv.innerHTML = html;
    card.appendChild(textDiv);
    return card;
  }

  function renderEquipmentCard(gameId, name, location, tierOrNull) {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.style.position = 'relative';

    // Equipment portrait - positioned absolutely to avoid layout issues
    if (typeof gameId === 'number' && api?.ui?.components?.createItemPortrait) {
      try { 
        const spriteId = getEquipmentSpriteId(gameId);
        if (spriteId) {
          const figure = api.ui.components.createItemPortrait({ 
            itemId: spriteId,
            tier: tierOrNull || 1
          });
          if (figure) {
            figure.style.cssText = `
              position: absolute !important;
              top: 8px !important;
              left: 8px !important;
              width: 40px !important;
              height: 40px !important;
              z-index: 1 !important;
            `;
            
            card.appendChild(figure);
          }
        }
      } catch (e) {}
    }

    // Text content with left padding for portrait
    const textDiv = document.createElement('div');
    textDiv.style.cssText = `
      padding: 8px 8px 8px 56px !important;
      min-height: 98px !important;
      display: block !important;
      position: relative !important;
      z-index: 2 !important;
      word-wrap: break-word !important;
      overflow-wrap: anywhere !important;
      white-space: normal !important;
      width: calc(100% - 64px) !important;
      max-width: calc(100% - 64px) !important;
      box-sizing: border-box !important;
    `;

    let html = '';
    if (name) {
      html += `<div style="font-size: 16px; font-weight: bold; color: white; margin-bottom: 8px;">${name}</div>`;
    }

    if (typeof tierOrNull === 'number') {
      html += `<div style="font-size: 14px; opacity: 0.8; color: white; margin-bottom: 4px;">Tier ${tierOrNull}/5</div>`;
    }

    textDiv.innerHTML = html;
    card.appendChild(textDiv);
    return card;
  }

  function ensureStyles() {
    if (document.getElementById('mm-styles')) return;
    const style = document.createElement('style');
    style.id = 'mm-styles';
    style.textContent = `
      .mm-wrapper {
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
      }
      .mm-content {
        height: 420px;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        direction: ltr;
        scrollbar-width: thin;
      }
      .mm-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      .mm-card {
        width: calc(100% - 16px) !important;
        max-width: calc(100% - 16px) !important;
        box-sizing: border-box !important;
        display: block !important;
        overflow: hidden !important;
        text-align: left !important;
        background: rgba(0, 0, 0, 0.1);
        border: none !important;
        border-radius: 4px;
        margin: 0 8px 0 8px !important;
        padding: 12px !important;
        min-height: 110px !important;
        contain: layout style size !important;
        position: relative !important;
        word-wrap: break-word !important;
        overflow-wrap: anywhere !important;
        white-space: normal !important;
      }
      .mm-card img {
        max-width: 48px !important;
        max-height: 48px !important;
        width: auto !important;
        height: auto !important;
      }
      .mm-portrait {
        max-width: 48px !important;
        max-height: 48px !important;
        overflow: hidden !important;
        flex-shrink: 0 !important;
      }
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
        // Use static creature list from game data instead of wiki API
        const staticNames = [
          'Amazon', 'Banshee', 'Bear', 'Bog Raider', 'Bug', 'Corym Charlatan', 'Corym Skirmisher', 'Corym Vanguard', 'Cyclops', 'Deer', 'Demon Skeleton', 'Dragon', 'Dragon Lord',
          'Druid', 'Dwarf', 'Dwarf Geomancer', 'Dwarf Guard', 'Dwarf Soldier', 'Elf', 'Elf Arcanist', 'Elf Scout',
          'Fire Devil', 'Fire Elemental', 'Firestarter', 'Frost Troll', 'Ghost', 'Ghoul', 'Giant Spider', 'Goblin', 'Goblin Assassin',
          'Goblin Scavenger', 'Knight', 'Minotaur', 'Minotaur Archer', 'Minotaur Guard', 'Minotaur Mage', 'Monk',
          'Mummy', 'Nightstalker', 'Orc Berserker', 'Orc Leader', 'Orc Rider', 'Orc Shaman', 'Orc Spearman',
          'Orc Warlord', 'Poison Spider', 'Polar Bear', 'Rat', 'Rorc', 'Rotworm', 'Scorpion', 'Sheep', 'Skeleton',
          'Slime', 'Snake', 'Spider', 'Stalker', 'Swamp Troll', 'Tortoise', 'Troll', 'Valkyrie', 'Warlock', 'Wasp', 'Water Elemental',
          'Witch', 'Winter Wolf', 'Wolf', 'Wyvern'
        ];
        
        let names = [...staticNames];
        
        // Fallback to utils if needed for additional monsters
        const utils = globalThis.state?.utils;
        if (utils && typeof utils.getMonster === 'function') {
          let misses = 0;
          for (let i = 1; i <= 2000 && misses < 30; i++) {
            try {
              const d = utils.getMonster(i);
              const nm = d?.metadata?.name;
              if (nm && !names.includes(nm)) { 
                names.push(nm); 
                misses = 0; 
              } else { 
                misses++; 
              }
            } catch (e) { misses++; }
          }
        }
        
        cache.wikiNames = names || [];
        //console.log(`[Monster Names] Loaded ${cache.wikiNames.length} monster names (${staticNames.length} static + ${cache.wikiNames.length - staticNames.length} from utils)`);
      }
      if (!cache.nameToId) {
        cache.nameToId = buildNameToIdIndex();
      }
      if (!cache.locationMap) {
        // Use hardcoded location data
        cache.locationMap = new Map();
        for (const [creatureName, location] of Object.entries(CREATURE_LOCATIONS)) {
          cache.locationMap.set(normalizeNameKey(creatureName), location);
        }
        //console.log(`[Location Map] Loaded ${cache.locationMap.size} hardcoded creature locations`);
      }
      if (!cache.unobtainableSet) {
        // Use hardcoded list instead of wiki API
        cache.unobtainableSet = new Set(
          UNOBTAINABLE_MONSTERS.map(name => normalizeNameKey(name))
        );
        //console.log(`[Unobtainable] Loaded ${cache.unobtainableSet.size} hardcoded unobtainable monsters`);
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

  // Removed fetchMonsterNamesFromWiki - now using static data

  // Removed fetchAllCategoryMembers - no longer needed

  // Removed fetchCreatureFarmingLocations - using default "Scroll" location

  // Removed extractLocationsFromHtml - no longer needed

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
    const normalizedName = normalizeNameKey(name);
    const direct = cache.locationMap?.get(normalizedName) || null;
    
    // If no location found and not unobtainable, default to "Scroll"
    if (!direct && cache.unobtainableSet && !cache.unobtainableSet.has(normalizedName)) {
      return "Scroll";
    }
    
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

  // Removed fetchUnobtainableMonsters - now using hardcoded list

  async function waitForUtils(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (globalThis.state?.utils?.getMonster) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }
})();
