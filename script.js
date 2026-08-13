const RARITY_ORDER = ['DEFAULT', 'GOLD', 'DIAMOND', 'RAINBOW', 'BESKAR', 'GALACTIC'];

const RARITY_TO_UPGRADE_KEY = {
    'COMMON': 'Common',
    'RARE': 'Rare',
    'EPIC': 'Epic',
    'LEGENDARY': 'Legend',
    'MYTHIC': 'Mythic',
    'ICONIC': null,
};

const QUALITY_ORDER = ['DEFAULT', 'GOLD', 'DIAMOND', 'RAINBOW', 'BESKAR', 'GALACTIC'];

const RARITY_DISPLAY_ORDER = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'ICONIC'];

let upgradeCosts = {};
let rebirths = [];
let droidTaxonomy = { rarities: [], classes: [] };
let droidNameToMeta = {};
let imageLookup = {};
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
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rarityKey = row[0];
        costs[rarityKey] = {
            GOLD: parseInt(row[1], 10),
            DIAMOND: parseInt(row[2], 10),
            RAINBOW: parseInt(row[3], 10),
            BESKAR: parseInt(row[4], 10),
            GALACTIC: parseInt(row[5], 10),
        };
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

function initRenacerDropdown() {
    const select = document.getElementById('renacer');
    for (let i = 1; i <= 30; i++) {
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
        if (rb.renacer < fromRenacer) continue;

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

function renderDroidCell(cell) {
    const parsed = parseDroidCell(cell);
    const meta = droidNameToMeta[parsed.name.toUpperCase()] || {};
    const baseRarity = meta.rarity || 'COMMON';
    const rarityClass = `name-${baseRarity}`;
    const lookup = imageLookup[parsed.name.toUpperCase()];
    const file = lookup && parsed.rarity ? lookup[parsed.rarity] : null;
    const imgHtml = file
        ? `<img src="resources/${escapeHtml(file)}" alt="${escapeHtml(parsed.name)}" loading="lazy">`
        : `<img src="" alt="${escapeHtml(parsed.name)}" hidden>`;
    const qualityHtml = parsed.rarity ? rarityBadge(parsed.rarity) : '';
    return `
        <div class="droid-cell">
            ${imgHtml}
            <span class="droid-name ${rarityClass}">${escapeHtml(parsed.name)}</span>
            <span class="droid-quality">${qualityHtml}</span>
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
    for (const rb of remaining) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Renacer ${rb.renacer}</td>
            <td>${renderDroidCell(rb.droid1)}</td>
            <td>${renderDroidCell(rb.droid2)}</td>
            <td>${renderDroidCell(rb.droid3)}</td>
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
    const tbody = document.querySelector('#cost-modal-table tbody');
    tbody.innerHTML = '';
    const headers = ['Gold', 'Diamond', 'Rainbow', 'Beskar', 'Galactic'];
    const rarityOrder = ['Common', 'Rare', 'Epic', 'Legend', 'Mythic'];
    for (const rarity of rarityOrder) {
        const row = upgradeCosts[rarity];
        if (!row) continue;
        const tr = document.createElement('tr');
        tr.innerHTML = `<th>${rarity}</th>` +
            headers.map(h => `<td>${row[h.toUpperCase()].toLocaleString('es-ES')}</td>`).join('');
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

async function init() {
    initRenacerDropdown();

    try {
        const [droidsText, upgradesText, imagesText, c1Text, c2Text, c3Text, c4Text] = await Promise.all([
            fetchText('droids.csv'),
            fetchText('upgrade_chips.csv'),
            fetchText('images_droids.csv'),
            fetchText('renaceres_ciclo_1.csv'),
            fetchText('renaceres_ciclo_2.csv'),
            fetchText('renaceres_ciclo_3.csv'),
            fetchText('renaceres_ciclo_4.csv'),
        ]);

        const droidsRows = parseCSV(droidsText);
        const upgradesRows = parseCSV(upgradesText);
        const imagesRows = parseCSV(imagesText);

        upgradeCosts = loadUpgradeCosts(upgradesRows);
        imageLookup = loadImageLookup(imagesRows);

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

        rebirths = [
            ...loadRebirths(parseCSV(c1Text), 1),
            ...loadRebirths(parseCSV(c2Text), 2),
            ...loadRebirths(parseCSV(c3Text), 3),
            ...loadRebirths(parseCSV(c4Text), 4),
        ];
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
        const payload = { rebirthResults: results, maxRarity, droidName: droide, currentRarity: calidad, remaining };
        lastResults = payload;
        activateTab('tab-necesario');
        renderResults(payload);
    });

    document.getElementById('tab-necesario').addEventListener('click', () => activateTab('tab-necesario'));
    document.getElementById('tab-coste').addEventListener('click', () => activateTab('tab-coste'));
    document.getElementById('tab-restantes').addEventListener('click', () => activateTab('tab-restantes'));

    document.getElementById('ver-costes').addEventListener('click', openCostModal);
    document.getElementById('cost-modal-close').addEventListener('click', closeCostModal);
    document.getElementById('cost-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeCostModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCostModal();
    });
}

document.addEventListener('DOMContentLoaded', init);