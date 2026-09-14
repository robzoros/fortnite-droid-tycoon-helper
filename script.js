const RARITY_ORDER = ['DEFAULT', 'GOLD', 'DIAMOND', 'RAINBOW', 'BESKAR', 'GALACTIC', 'STELLAR'];

const RARITY_TO_UPGRADE_KEY = {
    'COMMON': 'Common',
    'RARE': 'Rare',
    'EPIC': 'Epic',
    'LEGENDARY': 'Legend',
    'MYTHIC': 'Mythic',
    'ICONIC': null,
};

const QUALITY_ORDER = ['DEFAULT', 'GOLD', 'DIAMOND', 'RAINBOW', 'BESKAR', 'GALACTIC', 'STELLAR'];

const RARITY_DISPLAY_ORDER = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'ICONIC'];

let upgradeCosts = {};
let upgradeQualityColumns = [];
let upgradeRarityOrder = [];
let rebirths = [];
let droidTaxonomy = { rarities: [], classes: [] };
let droidNameToMeta = {};
let imageLookup = {};
let superRebirths = [];
let fusions = [];
let fusionIngredientMap = {};
let lastResults = null;

async function fetchText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`No se pudo cargar ${path}: ${res.status}`);
    return res.text();
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    return lines.map(line => {
        const cells = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        cells.push(current.trim());
        return cells;
    });
}

function loadUpgradeCosts(rows) {
    const costs = {};
    const header = rows[0] || [];
    upgradeQualityColumns = header.slice(1).map(q => q.trim().toUpperCase()).filter(Boolean);
    upgradeRarityOrder = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rarityKey = row[0];
        if (!rarityKey) continue;
        const entry = {};
        for (let j = 0; j < upgradeQualityColumns.length; j++) {
            entry[upgradeQualityColumns[j]] = parseInt(row[j + 1], 10);
        }
        costs[rarityKey] = entry;
        upgradeRarityOrder.push(rarityKey);
    }
    return costs;
}

function loadDroids(rows) {
    const droids = new Set();
    for (let i = 0; i < rows.length; i++) {
        const name = rows[i][1] ? rows[i][1].trim() : '';
        if (name) droids.add(name);
    }
    return Array.from(droids).sort((a, b) => a.localeCompare(b));
}

function loadDroidTaxonomy(rows) {
    const rarities = new Set();
    const classes = new Set();
    for (let i = 0; i < rows.length; i++) {
        const rarity = rows[i][0] ? rows[i][0].trim() : '';
        const cls = rows[i][2] ? rows[i][2].trim() : '';
        if (rarity) rarities.add(rarity);
        if (cls) classes.add(cls);
    }
    const orderedRarities = RARITY_DISPLAY_ORDER.filter(r => rarities.has(r))
        .concat(Array.from(rarities).filter(r => !RARITY_DISPLAY_ORDER.includes(r)).sort((a, b) => a.localeCompare(b)));
    return {
        rarities: orderedRarities,
        classes: Array.from(classes).sort((a, b) => a.localeCompare(b)),
    };
}

function loadImageLookup(rows) {
    const lookup = {};
    for (let i = 1; i < rows.length; i++) {
        const name = rows[i][0] ? rows[i][0].trim().toUpperCase() : '';
        const quality = rows[i][1] ? rows[i][1].trim().toUpperCase() : '';
        const file = rows[i][2] ? rows[i][2].trim() : '';
        if (!name || !quality || !file) continue;
        if (!lookup[name]) lookup[name] = {};
        lookup[name][quality] = file;
    }
    return lookup;
}

function loadRebirths(rows, ciclo) {
    const data = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        data.push({
            ciclo: parseInt(row[0], 10),
            renacer: parseInt(row[1], 10),
            creditos: row[2],
            droid1: row[3],
            droid2: row[4],
            droid3: row[5],
        });
    }
    return data;
}

function loadSuperRebirths(rows) {
    const data = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;
        data.push({
            nivel: row[0],
            cristales: row[1],
            ingresos: row[2],
            xp: row[3],
        });
    }
    return data;
}

function loadFusions(rows) {
    const data = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 6) continue;
        if (!row[0]) continue;
        data.push({
            name: row[0],
            type: row[1],
            rarity: row[2],
            droid1: row[3],
            droid2: row[4],
            droid3: row[5],
        });
    }
    return data;
}

function buildFusionIngredientMap() {
    const map = {};
    for (const f of fusions) {
        for (const name of [f.droid1, f.droid2, f.droid3]) {
            const trimmed = name ? name.trim() : '';
            if (!trimmed) continue;
            const key = trimmed.toUpperCase();
            if (!map[key]) map[key] = trimmed;
        }
    }
    return map;
}

function getFusionIngredientRarities() {
    const rarities = new Set();
    for (const key of Object.keys(fusionIngredientMap)) {
        const meta = droidNameToMeta[key];
        if (meta && meta.rarity) rarities.add(meta.rarity);
    }
    return RARITY_DISPLAY_ORDER.filter(r => rarities.has(r))
        .concat(Array.from(rarities).filter(r => !RARITY_DISPLAY_ORDER.includes(r)).sort((a, b) => a.localeCompare(b)));
}

function getFusionIngredientClasses() {
    const classes = new Set();
    for (const key of Object.keys(fusionIngredientMap)) {
        const meta = droidNameToMeta[key];
        if (meta && meta.class) classes.add(meta.class);
    }
    return Array.from(classes).sort((a, b) => a.localeCompare(b));
}

function parseDroidCell(value) {
    const trimmed = value.trim();
    const idx = trimmed.indexOf(' ');
    if (idx === -1) return { rarity: null, name: trimmed };
    return {
        rarity: trimmed.substring(0, idx),
        name: trimmed.substring(idx + 1).trim()
    };
}

function compareRarities(a, b) {
    return RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b);
}

function computeUpgradeCost(upgradeRow, fromRarity, toRarity) {
    if (!upgradeRow) return null;
    if (compareRarities(toRarity, fromRarity) <= 0) {
        return { total: 0, steps: [] };
    }
    let total = 0;
    const steps = [];
    const fromIdx = RARITY_ORDER.indexOf(fromRarity);
    const toIdx = RARITY_ORDER.indexOf(toRarity);
    for (let i = fromIdx + 1; i <= toIdx; i++) {
        const stepRarity = RARITY_ORDER[i];
        const cost = upgradeRow[stepRarity];
        total += cost;
        steps.push({ from: RARITY_ORDER[i - 1], to: stepRarity, cost });
    }
    return { total, steps };
}

async function fetchRebirthFiles() {
    const texts = [];
    for (let n = 1; ; n++) {
        let res;
        try {
            res = await fetch(`renaceres_ciclo_${n}.csv`);
        } catch (e) {
            break;
        }
        if (!res.ok) break;
        texts.push(await res.text());
    }
    return texts;
}

function initCicloDropdown(cycleCount) {
    const select = document.getElementById('ciclo');
    select.innerHTML = '';
    for (let i = 1; i <= cycleCount; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `Ciclo ${i}`;
        select.appendChild(opt);
    }
}

function initRenacerDropdown(maxRenacer) {
    const select = document.getElementById('renacer');
    for (let i = 1; i <= maxRenacer; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `Renacer ${i}`;
        select.appendChild(opt);
    }
}

function initSelectOptions(selectId, values, defaultLabel) {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = defaultLabel;
    select.appendChild(placeholder);
    for (const v of values) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
    }
}

function initDroidDropdown(droidNames) {
    const select = document.getElementById('droide');
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Selecciona droide --';
    select.appendChild(placeholder);
    for (const name of droidNames) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    }
}

function findRebirths(droidName, cicloFilter, renacerFilter) {
    const results = [];
    let maxRarity = null;
    const fromRenacer = parseInt(renacerFilter, 10);
    for (const rb of rebirths) {
        if (String(rb.ciclo) !== cicloFilter) continue;
        if (rb.renacer <= fromRenacer) continue;

        const slots = [
            { cell: rb.droid1, slot: 1 },
            { cell: rb.droid2, slot: 2 },
            { cell: rb.droid3, slot: 3 },
        ];

        const matches = [];
        for (const s of slots) {
            const parsed = parseDroidCell(s.cell);
            if (parsed.name.toUpperCase() === droidName.toUpperCase()) {
                matches.push({ rarity: parsed.rarity, slot: s.slot });
                if (maxRarity === null || compareRarities(parsed.rarity, maxRarity) > 0) {
                    maxRarity = parsed.rarity;
                }
            }
        }

        if (matches.length > 0) {
            results.push({
                ciclo: rb.ciclo,
                renacer: rb.renacer,
                creditos: rb.creditos,
                matches
            });
        }
    }
    results.sort((a, b) => a.ciclo - b.ciclo || a.renacer - b.renacer);
    return { results, maxRarity };
}

function findRemainingRebirths(cicloFilter, renacerFilter) {
    const fromRenacer = parseInt(renacerFilter, 10);
    const remaining = [];
    for (const rb of rebirths) {
        if (String(rb.ciclo) !== cicloFilter) continue;
        if (rb.renacer <= fromRenacer) continue;
        remaining.push({
            renacer: rb.renacer,
            droid1: rb.droid1,
            droid2: rb.droid2,
            droid3: rb.droid3,
        });
    }
    remaining.sort((a, b) => a.renacer - b.renacer);
    return remaining;
}

function buildLastAppearance(cicloFilter) {
    const last = {};
    for (const rb of rebirths) {
        if (String(rb.ciclo) !== cicloFilter) continue;
        for (const cell of [rb.droid1, rb.droid2, rb.droid3]) {
            const parsed = parseDroidCell(cell);
            if (!parsed.name) continue;
            const key = parsed.name.toUpperCase();
            if (last[key] === undefined || rb.renacer > last[key]) {
                last[key] = rb.renacer;
            }
        }
    }
    return last;
}

function rarityBadge(rarity) {
    return `<span class="rarity rarity-${rarity}">${rarity}</span>`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderDroidCell(cell, renacer, lastAppearance) {
    const parsed = parseDroidCell(cell);
    const meta = droidNameToMeta[parsed.name.toUpperCase()] || {};
    const baseRarity = meta.rarity || 'COMMON';
    const rarityClass = `name-${baseRarity}`;
    const lookup = imageLookup[parsed.name.toUpperCase()] || {};
    let file = parsed.rarity ? lookup[parsed.rarity] : null;
    if (!file && parsed.rarity === 'STELLAR') {
        file = lookup['GOLD'];
    }
    if (!file) {
        file = lookup['DEFAULT'];
    }
    const imgSrc = file ? `resources/${escapeHtml(file)}` : 'resources/Droidex-logo.PNG';
    const imgHtml = `<img src="${imgSrc}" alt="${escapeHtml(parsed.name)}" loading="lazy">`;
    const qualityHtml = parsed.rarity ? rarityBadge(parsed.rarity) : '';
    const nameKey = parsed.name.toUpperCase();
    const isLast = lastAppearance && renacer !== undefined && lastAppearance[nameKey] === renacer;
    const lastHtml = isLast ? `<span class="droid-last">ÚLTIMO</span>` : '';
    return `
        <div class="droid-cell">
            ${imgHtml}
            <span class="droid-name ${rarityClass}">${escapeHtml(parsed.name)}</span>
            <span class="droid-quality">${qualityHtml}</span>
            ${lastHtml}
        </div>
    `;
}

function renderResults(payload) {
    const { rebirthResults, maxRarity, droidName, currentRarity, remaining } = payload;

    const resultsSection = document.getElementById('results');
    const emptySection = document.getElementById('empty');
    const errorSection = document.getElementById('error');
    errorSection.classList.add('hidden');
    errorSection.textContent = '';

    if (rebirthResults.length === 0 && remaining.length === 0) {
        resultsSection.classList.add('hidden');
        emptySection.classList.remove('hidden');
        const renacerVal = document.getElementById('renacer').value;
        emptySection.querySelector('p').textContent =
            `No se han encontrado renaceres para ${droidName} a partir del renacer ${renacerVal} en este ciclo.`;
        return;
    }
    emptySection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    const droidRarityRow = RARITY_TO_UPGRADE_KEY[getDroidRarity(droidName)] || null;
    let upgradeRow = null;
    if (droidRarityRow) upgradeRow = upgradeCosts[droidRarityRow];

    const summary = document.getElementById('cost-summary');
    const breakdownTable = document.getElementById('cost-breakdown');
    const breakdownBody = breakdownTable.querySelector('tbody');
    breakdownBody.innerHTML = '';
    breakdownTable.classList.add('hidden');

    if (!upgradeRow) {
        summary.innerHTML = `Tu droide <strong>${escapeHtml(droidName)}</strong> necesita llegar a ${rarityBadge(maxRarity)}. No hay tabla de mejoras disponible para esta rareza base.`;
    } else {
        const cost = computeUpgradeCost(upgradeRow, currentRarity, maxRarity);
        if (cost.total === 0) {
            summary.innerHTML = `Tu droide <strong>${escapeHtml(droidName)}</strong> ya está en ${rarityBadge(currentRarity)}, que es igual o superior a la calidad máxima necesaria (${rarityBadge(maxRarity)}). <strong>0 chips</strong>.`;
        } else {
            summary.innerHTML = `Mejorar <strong>${escapeHtml(droidName)}</strong> de ${rarityBadge(currentRarity)} a ${rarityBadge(maxRarity)} cuesta <strong>${cost.total.toLocaleString('es-ES')}</strong> chips.`;
            for (const step of cost.steps) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${rarityBadge(step.from)}</td>
                    <td>${rarityBadge(step.to)}</td>
                    <td>${step.cost.toLocaleString('es-ES')}</td>
                `;
                breakdownBody.appendChild(tr);
            }
            breakdownTable.classList.remove('hidden');
        }
    }

    const rebirthsBody = document.querySelector('#rebirths-table tbody');
    rebirthsBody.innerHTML = '';
    for (const rb of rebirthResults) {
        for (const match of rb.matches) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${rb.ciclo}</td>
                <td>${rb.renacer}</td>
                <td>${rb.creditos}</td>
                <td>${rarityBadge(match.rarity)}</td>
                <td>Slot ${match.slot}</td>
            `;
            rebirthsBody.appendChild(tr);
        }
    }

    document.getElementById('rebirths-count').textContent =
        rebirthResults.length === 0
            ? 'No se han encontrado renaceres donde se necesite este droide.'
            : `Se han encontrado ${rebirthResults.length} renacer(es) donde se necesita el droide.`;

    const remainingBody = document.querySelector('#remaining-table tbody');
    remainingBody.innerHTML = '';
    const lastAppearance = buildLastAppearance(payload.ciclo);
    for (const rb of remaining) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Renacer ${rb.renacer}</td>
            <td>${renderDroidCell(rb.droid1, rb.renacer, lastAppearance)}</td>
            <td>${renderDroidCell(rb.droid2, rb.renacer, lastAppearance)}</td>
            <td>${renderDroidCell(rb.droid3, rb.renacer, lastAppearance)}</td>
        `;
        remainingBody.appendChild(tr);
    }
    document.getElementById('remaining-count').textContent =
        remaining.length === 0
            ? 'No quedan renaceres superiores en este ciclo.'
            : `Quedan ${remaining.length} renacer(es) por encima del actual en este ciclo.`;
}

function getDroidRarity(droidName) {
    return window._droidRarityMap[droidName.toUpperCase()] || null;
}

function updateDroidDropdown() {
    const rareza = document.getElementById('rareza-select').value;
    const clase = document.getElementById('clase').value;
    const select = document.getElementById('droide');
    const currentValue = select.value;

    const filtered = Object.keys(droidNameToMeta)
        .filter(nameKey => {
            const meta = droidNameToMeta[nameKey];
            if (rareza && meta.rarity !== rareza) return false;
            if (clase && meta.class !== clase) return false;
            return true;
        })
        .map(nameKey => nameKey)
        .sort((a, b) => a.localeCompare(b));

    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = filtered.length === 0
        ? '-- Ningún droide coincide --'
        : '-- Selecciona droide --';
    select.appendChild(placeholder);
    for (const nameKey of filtered) {
        const opt = document.createElement('option');
        opt.value = nameKey;
        opt.textContent = nameKey;
        select.appendChild(opt);
    }

    if (currentValue && filtered.includes(currentValue)) {
        select.value = currentValue;
    }
}

function showError(msg) {
    const errorSection = document.getElementById('error');
    errorSection.textContent = msg;
    errorSection.classList.remove('hidden');
}

function activateTab(tabId) {
    const tabs = [
        { btn: 'tab-necesario', panel: 'panel-necesario' },
        { btn: 'tab-coste', panel: 'panel-coste' },
        { btn: 'tab-restantes', panel: 'panel-restantes' },
    ];
    for (const t of tabs) {
        const btn = document.getElementById(t.btn);
        const panel = document.getElementById(t.panel);
        const isActive = t.btn === tabId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        panel.classList.toggle('hidden', !isActive);
    }
}

function renderCostModalTable() {
    const table = document.getElementById('cost-modal-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';
    const label = q => q.charAt(0) + q.slice(1).toLowerCase();
    const headTr = document.createElement('tr');
    headTr.innerHTML = '<th>Rareza</th>' +
        upgradeQualityColumns.map(q => `<th>${escapeHtml(label(q))}</th>`).join('');
    thead.appendChild(headTr);
    for (const rarity of upgradeRarityOrder) {
        const row = upgradeCosts[rarity];
        if (!row) continue;
        const tr = document.createElement('tr');
        tr.innerHTML = `<th>${escapeHtml(rarity)}</th>` +
            upgradeQualityColumns.map(q => `<td>${row[q].toLocaleString('es-ES')}</td>`).join('');
        tbody.appendChild(tr);
    }
}

function openCostModal() {
    renderCostModalTable();
    document.getElementById('cost-modal').classList.remove('hidden');
}

function closeCostModal() {
    document.getElementById('cost-modal').classList.add('hidden');
}

function statCell(icon, value, label) {
    return `
        <div class="stat-cell">
            <img src="resources/${icon}" alt="${label}" loading="lazy">
            <span>${escapeHtml(value)}</span>
        </div>
    `;
}

function renderSuperRebirthsTable() {
    const tbody = document.querySelector('#super-rebirths-table tbody');
    tbody.innerHTML = '';
    for (const sr of superRebirths) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(sr.nivel)}</td>
            <td>${statCell('Crystal.png', sr.cristales, 'Cristales Nova')}</td>
            <td>${statCell('Credits.webp', sr.ingresos, 'Ingresos')}</td>
            <td>${statCell('XP.png', sr.xp, 'XP')}</td>
        `;
        tbody.appendChild(tr);
    }
}

function openSuperRebirthsModal() {
    renderSuperRebirthsTable();
    document.getElementById('super-rebirths-modal').classList.remove('hidden');
}

function closeSuperRebirthsModal() {
    document.getElementById('super-rebirths-modal').classList.add('hidden');
}

function renderNamedDroidCell(name) {
    const key = name.trim().toUpperCase();
    const meta = droidNameToMeta[key] || {};
    const baseRarity = meta.rarity || 'COMMON';
    const lookup = imageLookup[key] || {};
    let file = lookup['DEFAULT'];
    if (!file && lookup['GOLD']) {
        file = lookup['GOLD'];
    }
    const imgSrc = file ? `resources/${escapeHtml(file)}` : 'resources/Droidex-logo.PNG';
    return `
        <div class="droid-cell">
            <img src="${imgSrc}" alt="${escapeHtml(name)}" loading="lazy">
            <span class="droid-name name-${baseRarity}">${escapeHtml(name)}</span>
        </div>
    `;
}

function renderFusionsTable() {
    const selected = document.getElementById('fusion-droide').value;
    const key = selected ? selected.toUpperCase() : '';
    const tbody = document.querySelector('#fusion-table tbody');
    tbody.innerHTML = '';
    const filtered = key
        ? fusions.filter(f => [f.droid1, f.droid2, f.droid3].some(d => d && d.trim().toUpperCase() === key))
        : fusions;
    for (const f of filtered) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fusion-result">
                    <span class="droid-name name-${f.rarity}">${escapeHtml(f.name)}</span>
                </div>
            </td>
            <td>${rarityBadge(f.rarity)}</td>
            <td>${renderNamedDroidCell(f.droid1)}</td>
            <td>${renderNamedDroidCell(f.droid2)}</td>
            <td>${renderNamedDroidCell(f.droid3)}</td>
        `;
        tbody.appendChild(tr);
    }
}

function updateFusionDroidDropdown() {
    const rareza = document.getElementById('fusion-rareza').value;
    const clase = document.getElementById('fusion-clase').value;
    const select = document.getElementById('fusion-droide');
    const currentValue = select.value;

    const filtered = Object.keys(fusionIngredientMap)
        .filter(key => {
            const meta = droidNameToMeta[key];
            if (!meta) return false;
            if (rareza && meta.rarity !== rareza) return false;
            if (clase && meta.class !== clase) return false;
            return true;
        })
        .sort((a, b) => a.localeCompare(b));

    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = filtered.length === 0 ? '-- Ningún droide coincide --' : '-- Todos --';
    select.appendChild(placeholder);
    for (const key of filtered) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = fusionIngredientMap[key];
        select.appendChild(opt);
    }

    if (currentValue && filtered.includes(currentValue)) {
        select.value = currentValue;
    }
    renderFusionsTable();
}

function initFusionFilters() {
    initSelectOptions('fusion-rareza', getFusionIngredientRarities(), '-- Todas --');
    initSelectOptions('fusion-clase', getFusionIngredientClasses(), '-- Todas --');
    document.getElementById('fusion-droide').value = '';
    updateFusionDroidDropdown();
}

function openFusionModal() {
    initFusionFilters();
    document.getElementById('fusion-modal').classList.remove('hidden');
}

function closeFusionModal() {
    document.getElementById('fusion-modal').classList.add('hidden');
}

async function init() {
    try {
        const [droidsText, upgradesText, imagesText, superText, fusionsText, cycleTexts] = await Promise.all([
            fetchText('droids.csv'),
            fetchText('upgrade_chips.csv'),
            fetchText('images_droids.csv'),
            fetchText('super_rebirths.csv'),
            fetchText('fusion_droids.csv'),
            fetchRebirthFiles(),
        ]);

        if (cycleTexts.length === 0) {
            throw new Error('No se ha encontrado ningún renaceres_ciclo_N.csv');
        }

        const droidsRows = parseCSV(droidsText);
        const upgradesRows = parseCSV(upgradesText);
        const imagesRows = parseCSV(imagesText);

        upgradeCosts = loadUpgradeCosts(upgradesRows);
        imageLookup = loadImageLookup(imagesRows);
        superRebirths = loadSuperRebirths(parseCSV(superText));
        fusions = loadFusions(parseCSV(fusionsText));
        fusionIngredientMap = buildFusionIngredientMap();

        const droidNames = loadDroids(droidsRows);
        initDroidDropdown(droidNames);

        droidTaxonomy = loadDroidTaxonomy(droidsRows);
        initSelectOptions('rareza-select', droidTaxonomy.rarities, '-- Todas --');
        initSelectOptions('clase', droidTaxonomy.classes, '-- Todas --');

        const qualityMap = {};
        droidNameToMeta = {};
        for (let i = 0; i < droidsRows.length; i++) {
            const rarity = droidsRows[i][0] ? droidsRows[i][0].trim() : '';
            const name = droidsRows[i][1] ? droidsRows[i][1].trim() : '';
            const cls = droidsRows[i][2] ? droidsRows[i][2].trim() : '';
            if (!name) continue;
            qualityMap[name.toUpperCase()] = rarity;
            droidNameToMeta[name.toUpperCase()] = { rarity, class: cls };
        }
        window._droidRarityMap = qualityMap;

        rebirths = cycleTexts.flatMap((text, idx) => loadRebirths(parseCSV(text), idx + 1));
        const maxRenacer = rebirths.reduce((max, rb) => Math.max(max, rb.renacer), 0);
        initCicloDropdown(cycleTexts.length);
        initRenacerDropdown(maxRenacer);
    } catch (e) {
        showError(`Error cargando datos: ${e.message}. Asegúrate de servir la app desde un servidor HTTP.`);
        return;
    }

    document.getElementById('rareza-select').addEventListener('change', updateDroidDropdown);
    document.getElementById('clase').addEventListener('change', updateDroidDropdown);

    document.getElementById('buscar').addEventListener('click', () => {
        const droide = document.getElementById('droide').value;
        if (!droide) {
            showError('Selecciona un droide.');
            return;
        }
        const ciclo = document.getElementById('ciclo').value;
        const renacer = document.getElementById('renacer').value;
        const calidad = document.getElementById('calidad').value;

        const { results, maxRarity } = findRebirths(droide, ciclo, renacer);
        const remaining = findRemainingRebirths(ciclo, renacer);
        const payload = { rebirthResults: results, maxRarity, droidName: droide, currentRarity: calidad, remaining, ciclo };
        lastResults = payload;
        activateTab('tab-necesario');
        renderResults(payload);
    });

    document.getElementById('tab-necesario').addEventListener('click', () => activateTab('tab-necesario'));
    document.getElementById('tab-coste').addEventListener('click', () => activateTab('tab-coste'));
    document.getElementById('tab-restantes').addEventListener('click', () => activateTab('tab-restantes'));

    document.getElementById('menu-super-rebirths').addEventListener('click', openSuperRebirthsModal);
    document.getElementById('super-rebirths-close').addEventListener('click', closeSuperRebirthsModal);
    document.getElementById('super-rebirths-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeSuperRebirthsModal();
    });

    document.getElementById('menu-cost-rarity').addEventListener('click', openCostModal);
    document.getElementById('cost-modal-close').addEventListener('click', closeCostModal);
    document.getElementById('cost-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeCostModal();
    });

    document.getElementById('menu-fusions').addEventListener('click', openFusionModal);
    document.getElementById('fusion-modal-close').addEventListener('click', closeFusionModal);
    document.getElementById('fusion-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeFusionModal();
    });
    document.getElementById('fusion-rareza').addEventListener('change', updateFusionDroidDropdown);
    document.getElementById('fusion-clase').addEventListener('change', updateFusionDroidDropdown);
    document.getElementById('fusion-droide').addEventListener('change', renderFusionsTable);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCostModal();
            closeSuperRebirthsModal();
            closeFusionModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', init);