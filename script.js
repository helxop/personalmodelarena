// --- STATE & CONSTANTS ---
const BT_ITERATIONS = 100;
const ELO_K_FACTOR = 32;
const DEFAULT_RATING = 1500;

let jsonData = [];
let currentSortKey = 'rating';
let sortDirection = 'desc';
let currentRankingSystem = 'bt';
let isDataDirty = false;

// --- DOM ELEMENT REFERENCES ---
const editorContainer = document.getElementById('editor-container');
const leaderboardContainer = document.getElementById('leaderboard-container');
const fileInput = document.getElementById('file-input');
const exportModal = document.getElementById('export-modal');
const jsonOutput = document.getElementById('json-output');
const modelDatalist = document.getElementById('model-names-list');
const loader = document.getElementById('loader');
const calculateBtn = document.getElementById('calculate-btn');

// --- CORE RATING LOGIC ---

function getModelsAndStats(battles) {
    const stats = {};
    const models = new Map();
    battles.forEach(b => {
        const modelA = b.match?.model_a?.trim();
        const modelB = b.match?.model_b?.trim();
        if (modelA && !models.has(modelA.toLowerCase())) models.set(modelA.toLowerCase(), modelA);
        if (modelB && !models.has(modelB.toLowerCase())) models.set(modelB.toLowerCase(), modelB);
    });
    models.forEach((originalCase, lowerCase) => {
        stats[lowerCase] = { name: originalCase, rating: DEFAULT_RATING, wins: 0, losses: 0, ties: 0, matches: 0 };
    });
    // Return both the stats object and a Set of original-cased names for the datalist
    return { stats, modelNames: new Set(models.values()) };
}

function calculateBradleyTerryRatings(initialStats, battles) {
    const stats = JSON.parse(JSON.stringify(initialStats));
    const models = Object.keys(stats);
    if (models.length === 0) return {};

    const matchups = {};
    const effectiveWins = {};
    models.forEach(m => { 
        effectiveWins[m] = 0;
        matchups[m] = {};
    });

    battles.forEach(b => {
        const model_a = b.match?.model_a?.trim().toLowerCase();
        const model_b = b.match?.model_b?.trim().toLowerCase();
        const winner = b.winner?.trim().toLowerCase();
        if (!model_a || !model_b || !winner || !stats[model_a] || !stats[model_b]) return;

        if (!matchups[model_a][model_b]) matchups[model_a][model_b] = 0;
        if (!matchups[model_b][model_a]) matchups[model_b][model_a] = 0;
        matchups[model_a][model_b]++;
        matchups[model_b][model_a]++;

        if (winner === model_a) { stats[model_a].wins++; stats[model_b].losses++; effectiveWins[model_a]++; } 
        else if (winner === model_b) { stats[model_b].wins++; stats[model_a].losses++; effectiveWins[model_b]++; }
        else if (winner === 'tie') { stats[model_a].ties++; stats[model_b].ties++; effectiveWins[model_a] += 0.5; effectiveWins[model_b] += 0.5; }
        stats[model_a].matches++; stats[model_b].matches++;
    });
    
    let strengths = {};
    models.forEach(m => { strengths[m] = 1.0; });

    for (let i = 0; i < BT_ITERATIONS; i++) {
        const newStrengths = {};
        models.forEach(m => {
            let denominator = 0;
            for (const opponent in matchups[m]) {
                denominator += matchups[m][opponent] / (strengths[m] + strengths[opponent]);
            }
            newStrengths[m] = denominator > 0 ? effectiveWins[m] / denominator : 0;
        });
        strengths = newStrengths;
    }

    models.forEach(m => {
        stats[m].rating = strengths[m] > 0 ? Math.round(DEFAULT_RATING + 400 * Math.log10(strengths[m])) : DEFAULT_RATING;
    });

    return stats;
}

function calculateEloRatings(initialStats, battles) {
    const stats = JSON.parse(JSON.stringify(initialStats)); 

    battles.forEach(b => {
        const model_a = b.match?.model_a?.trim().toLowerCase();
        const model_b = b.match?.model_b?.trim().toLowerCase();
        const winner = b.winner?.trim().toLowerCase();
        if (!model_a || !model_b || !winner || !stats[model_a] || !stats[model_b]) return;

        const ratingA = stats[model_a].rating;
        const ratingB = stats[model_b].rating;
        const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
        const expectedB = 1 - expectedA;

        let actualA, actualB;
        if (winner === model_a) { actualA = 1; actualB = 0; stats[model_a].wins++; stats[model_b].losses++; } 
        else if (winner === model_b) { actualA = 0; actualB = 1; stats[model_b].wins++; stats[model_a].losses++; }
        else if (winner === 'tie') { actualA = 0.5; actualB = 0.5; stats[model_a].ties++; stats[model_b].ties++; }
        else { return; }

        stats[model_a].rating = Math.round(ratingA + ELO_K_FACTOR * (actualA - expectedA));
        stats[model_b].rating = Math.round(ratingB + ELO_K_FACTOR * (actualB - expectedB));
        stats[model_a].matches++; stats[model_b].matches++;
    });
    return stats;
}

// --- UI RENDERING & DOM MANIPULATION ---
function renderLeaderboard(stats) {
    const statsArray = Object.values(stats).map(s => ({...s, winrate: s.matches > 0 ? s.wins / s.matches : 0 }));
    const direction = sortDirection === 'asc' ? 1 : -1;
    statsArray.sort((a, b) => {
        const valA = a[currentSortKey];
        const valB = b[currentSortKey];
        if (typeof valA === 'string') {
            return valA.localeCompare(valB) * direction;
        }
        if (valA < valB) return -1 * direction;
        if (valA > valB) return 1 * direction;
        return 0;
    });
    
    leaderboardContainer.innerHTML = statsArray.length === 0 
        ? '<li>No battle data loaded.</li>'
        : statsArray.map((model, index) => `
            <li>
                <span class="rank rank-${index + 1}">${index + 1}</span>
                <div class="model-details">
                    <div class="model-name">${model.name}</div>
                    <div class="stats-row">
                        <span class="rating"><strong>${model.rating}</strong></span>
                        <span>${model.wins}W / ${model.losses}L / ${model.ties}T</span>
                        <span>${(model.winrate * 100).toFixed(1)}%</span>
                        <span>${model.matches} matches</span>
                    </div>
                </div>
            </li>`).join('');
    updateSortButtons();
}

function renderEditor(models) {
    updateDatalists(models);
    if (jsonData.length === 0) {
        editorContainer.innerHTML = `<div class="empty-state"><p>No battles yet. Click "+ Add Entry" or "Load File".</p></div>`;
    } else {
        editorContainer.innerHTML = [...jsonData].reverse().map((entry, reverseIndex) => {
            const originalIndex = jsonData.length - 1 - reverseIndex;
            return `
            <div class="card" data-index="${originalIndex}">
                <div class="card-header">
                    <h3>Entry #${originalIndex + 1}</h3>
                    <button class="btn btn-danger delete-btn">Delete</button>
                </div>
                <div class="card-body">
                    <div class="form-group"><label>Task</label><textarea data-key="task">${entry.task || ''}</textarea></div>
                    <div class="form-group-grid">
                        <div class="form-group"><label>Model A</label><input type="text" list="model-names-list" value="${entry.match?.model_a || ''}" data-key="match.model_a"></div>
                        <div class="form-group"><label>Model B</label><input type="text" list="model-names-list" value="${entry.match?.model_b || ''}" data-key="match.model_b"></div>
                    </div>
                    <div class="form-group"><label>Winner (or "tie")</label><input type="text" list="model-names-list" value="${entry.winner || ''}" data-key="winner"></div>
                </div>
            </div>`;
        }).join('');
    }
}

function updateSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
        const arrowSpan = btn.querySelector('span');
        if (btn.dataset.key === currentSortKey) {
            btn.classList.add('active');
            arrowSpan.textContent = sortDirection === 'desc' ? '▼' : '▲';
        } else {
            arrowSpan.textContent = '';
        }
    });
}

function updateDatalists(models) {
    modelDatalist.innerHTML = Array.from(models).map(m => `<option value="${m}"></option>`).join('');
}

function setDirtyState(isDirty) {
    isDataDirty = isDirty;
    calculateBtn.classList.toggle('dirty-state', isDirty);
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

// --- DATA & EVENT HANDLERS ---
function processDataAndRender() {
    showLoader(true);
    // Use a short timeout to allow the UI to update with the loader before the heavy computation starts
    setTimeout(() => {
        const { stats: initialStats, modelNames } = getModelsAndStats(jsonData);
        const calculationFn = currentRankingSystem === 'bt' ? calculateBradleyTerryRatings : calculateEloRatings;
        const finalStats = calculationFn(initialStats, jsonData);
        renderLeaderboard(finalStats);
        renderEditor(modelNames);
        saveStateToLocalStorage();
        setDirtyState(false);
        showLoader(false);
    }, 50);
}

function setRankingSystem(system) {
    currentRankingSystem = system;
    document.querySelectorAll('#ranking-selector .btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.system === system);
    });
    processDataAndRender();
}

function setSortOrder(key) {
    if (currentSortKey === key) {
        sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
        currentSortKey = key;
        sortDirection = 'desc';
    }
    processDataAndRender();
}

function updateData(index, key, value) {
    const keys = key.split('.');
    let obj = jsonData[index];
    keys.forEach((k, i) => {
        if (i === keys.length - 1) obj[k] = value;
        else {
            if (!obj[k]) obj[k] = {};
            obj = obj[k];
        }
    });
    setDirtyState(true);
}

function addEntry() {
    jsonData.push({ task: "", match: { model_a: "", model_b: "" }, winner: "" });
    // Just re-render the editor part, not the whole expensive calculation
    const { modelNames } = getModelsAndStats(jsonData);
    renderEditor(modelNames);
    const newCard = editorContainer.querySelector('.card');
    if(newCard) {
        newCard.scrollIntoView({ behavior: 'smooth' });
        newCard.classList.add('flash');
        setTimeout(() => newCard.classList.remove('flash'), 1000);
    }
    setDirtyState(true);
}

function deleteEntry(index) {
    if (confirm(`Are you sure you want to delete Entry #${index + 1}?`)) {
        jsonData.splice(index, 1);
        setDirtyState(true);
        processDataAndRender();
    }
}

function clearAllData() {
    if (confirm("Are you sure you want to delete ALL battle data? This cannot be undone.")) {
        jsonData = [];
        processDataAndRender();
    }
}

function saveStateToLocalStorage() {
    try { localStorage.setItem('llmBattleData', JSON.stringify(jsonData)); } 
    catch (e) { console.error("Failed to save to localStorage", e); }
}

function loadStateFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('llmBattleData');
        if (savedData) jsonData = JSON.parse(savedData);
    } catch (e) {
        console.error("Failed to load from localStorage", e);
        jsonData = [];
    }
}

function showExportModal() {
    jsonOutput.value = JSON.stringify(jsonData, null, 2);
    exportModal.style.display = "block";
}

function copyJsonToClipboard(button) {
    navigator.clipboard.writeText(jsonOutput.value).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => { button.textContent = originalText; }, 2000);
    }).catch(err => alert('Failed to copy JSON: ' + err));
}

function exportToFile() {
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'battle_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;
    showLoader(true);
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            jsonData = JSON.parse(e.target.result);
            if (!Array.isArray(jsonData)) throw new Error('JSON data must be an array.');
            processDataAndRender();
        } catch (error) {
            alert('Error parsing JSON file: ' + error.message);
            showLoader(false);
        } finally {
            fileInput.value = '';
        }
    };
    reader.readAsText(file);
}

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    loadStateFromLocalStorage();
    processDataAndRender();

    // Attach event listeners
    document.getElementById('load-file-btn').addEventListener('click', () => fileInput.click());
    document.getElementById('add-entry-btn').addEventListener('click', addEntry);
    calculateBtn.addEventListener('click', processDataAndRender);
    document.getElementById('export-btn').addEventListener('click', showExportModal);
    document.getElementById('clear-all-btn').addEventListener('click', clearAllData);
    
    document.getElementById('ranking-selector').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') setRankingSystem(e.target.dataset.system);
    });

    document.querySelector('.leaderboard-controls').addEventListener('click', (e) => {
        if (e.target.closest('.sort-btn')) setSortOrder(e.target.closest('.sort-btn').dataset.key);
    });

    editorContainer.addEventListener('input', (e) => {
        if (e.target.matches('input, textarea')) {
            const card = e.target.closest('.card');
            if (card) {
                const index = parseInt(card.dataset.index, 10);
                const key = e.target.dataset.key;
                updateData(index, key, e.target.value);
            }
        }
    });

    editorContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const card = e.target.closest('.card');
            if (card) {
                const index = parseInt(card.dataset.index, 10);
                deleteEntry(index);
            }
        }
    });

    // Modal listeners
    document.getElementById('download-file-btn').addEventListener('click', exportToFile);
    document.getElementById('copy-json-btn').addEventListener('click', (e) => copyJsonToClipboard(e.target));
    document.getElementById('close-modal-btn').addEventListener('click', () => exportModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === exportModal) exportModal.style.display = 'none'; });

    fileInput.addEventListener('change', handleFileLoad);
});
