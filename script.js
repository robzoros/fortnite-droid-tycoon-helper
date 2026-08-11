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

let upgradeCosts = {};
let rebirths = [];
let droidTaxonomy = { rarities: [], classes: [] };
let droidNameToMeta = {};

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
    const headers = rows[0];
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
    for (let i = 1; i < rows.length; i++) {
        const rarity = rows[i][0].trim();
        const name = rows[i][1].trim();
        if (name) droids.add(name);
    }
    return Array.from(droids).sort((a, b) => a.localeCompare(b));
}

function loadDroidTaxonomy(rows) {
    const rarities = new Set();
    const classes = new Set();
    for (let i = 1; i < rows.length; i++) {
        const rarity = rows[i][0].trim();
        const cls = rows[i][2] ? rows[i][2].trim() : '';
        if (rarity) rarities.add(rarity);
        if (cls) classes.add(cls);
    }
    return {
        rarities: Array.from(rarities).sort((a, b) => a.localeCompare(b)),
        classes: Array.from(classes).sort((a, b) => a.localeCompare(b)),
    };
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

function rarityBadge(rarity) {
    return `<span class="rarity rarity-${rarity}">${rarity}</span>`;
}

function renderResults(rebirthResults, maxRarity, droidName, currentRarity) {
    const resultsSection = document.getElementById('results');
    const emptySection = document.getElementById('empty');
    const errorSection = document.getElementById('error');
    errorSection.classList.add('hidden');
    errorSection.textContent = '';

    if (rebirthResults.length === 0) {
        resultsSection.classList.add('hidden');
        emptySection.classList.remove('hidden');
        const renacerVal = document.getElementById('renacer').value;
        let msg = `No se han encontrado renaceres para ${droidName} a partir del renacer ${renacerVal} en este ciclo.`;
        emptySection.querySelector('p').textContent = msg;
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
        summary.innerHTML = `Tu droide <strong>${droidName}</strong> necesita llegar a ${rarityBadge(maxRarity)}. No hay tabla de mejoras disponible para esta rareza base.`;
    } else {
        const cost = computeUpgradeCost(upgradeRow, currentRarity, maxRarity);
        if (cost.total === 0) {
            summary.innerHTML = `Tu droide <strong>${droidName}</strong> ya está en ${rarityBadge(currentRarity)}, que es igual o superior a la calidad máxima necesaria (${rarityBadge(maxRarity)}). <strong>0 chips</strong>.`;
        } else {
            summary.innerHTML = `Mejorar <strong>${droidName}</strong> de ${rarityBadge(currentRarity)} a ${rarityBadge(maxRarity)} cuesta <strong>${cost.total.toLocaleString('es-ES')}</strong> chips.`;
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
        `Se han encontrado ${rebirthResults.length} renacer(es) donde se necesita el droide.`;
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

async function init() {
    initRenacerDropdown();

    try {
        const [droidsText, upgradesText, c1Text, c2Text, c3Text, c4Text] = await Promise.all([
            fetchText('droids.csv'),
            fetchText('upgrade_chips.csv'),
            fetchText('renaceres_ciclo_1.csv'),
            fetchText('renaceres_ciclo_2.csv'),
            fetchText('renaceres_ciclo_3.csv'),
            fetchText('renaceres_ciclo_4.csv'),
        ]);

        const droidsRows = parseCSV(droidsText);
        const upgradesRows = parseCSV(upgradesText);

        upgradeCosts = loadUpgradeCosts(upgradesRows);

        const droidNames = loadDroids(droidsRows);
        initDroidDropdown(droidNames);

        droidTaxonomy = loadDroidTaxonomy(droidsRows);
        initSelectOptions('rareza-select', droidTaxonomy.rarities, '-- Todas --');
        initSelectOptions('clase', droidTaxonomy.classes, '-- Todas --');

        const qualityMap = {};
        droidNameToMeta = {};
        for (let i = 1; droidsRows[i] && droidsRows[i].length > 0; i++) {
            const rarity = droidsRows[i][0].trim();
            const name = droidsRows[i][1].trim();
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
        renderResults(results, maxRarity, droide, calidad);
    });
}

document.addEventListener('DOMContentLoaded', init);