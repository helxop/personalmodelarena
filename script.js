// --- STATE & CONSTANTS ---
const BT_ITERATIONS = 100;
const ELO_K_FACTOR = 32;
const DEFAULT_RATING = 1500;

let jsonData = [];
let currentSortKey = 'rating';
let sortDirection = 'desc';
let currentRankingSystem = 'bt';
let selectedCategory = 'all'; // **NEW**: State for category filter
let isDataDirty = false;

// --- DOM ELEMENT REFERENCES ---
const editorContainer = document.getElementById('editor-container');
const leaderboardContainer = document.getElementById('leaderboard-container');
const fileInput = document.getElementById('file-input');
const exportModal = document.getElementById('export-modal');
const jsonOutput = document.getElementById('json-output');
const modelDatalist = document.getElementById('model-names-list');
const categoryDatalist = document.getElementById('category-names-list'); // **NEW**
const categoryFilterSelect = document.getElementById('category-filter'); // **NEW**
const loader = document.getElementById('loader');
const calculateBtn = document.getElementById('calculate-btn');

// --- CORE RATING LOGIC ---

function getModelsAndStats(battles) {
    const stats = {};
    const models = new Map();
    const categories = new Set(); // **NEW**

    battles.forEach(b => {
        const modelA = b.match?.model_a?.trim();
        const modelB = b.match?.model_b?.trim();
        if (modelA && !models.has(modelA.toLowerCase())) models.set(modelA.toLowerCase(), modelA);
        if (modelB && !models.has(modelB.toLowerCase())) models.set(modelB.toLowerCase(), modelB);

        // **NEW**: Collect categories
        const category = b.category?.trim();
        if (category) categories.add(category);
    });
    models.forEach((originalCase, lowerCase) => {
        stats[lowerCase] = { name: originalCase, rating: DEFAULT_RATING, wins: 0, losses: 0, ties: 0, matches: 0 };
    });
    return { stats, modelNames: new Set(models.values()), categories };
}

// ... (calculateBradleyTerryRatings and calculateEloRatings remain unchanged) ...
function calculateBradleyTerryRatings(initialStats, battles) {
    const stats = JSON.parse(JSON.stringify(initialStats));
    const models = Object.keys(stats);
    if (models.length === 0) return {};
    const matchups = {}, effectiveWins = {};
    models.forEach(m => { effectiveWins[m] = 0; matchups[m] = {}; });
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
        if (typeof valA === 'string') return valA.localeCompare(valB) * direction;
        if (valA < valB) return -1 * direction;
        if (valA > valB) return 1 * direction;
        return 0;
    });
    
    leaderboardContainer.innerHTML = statsArray.length === 0 
        ? '<li>No models found for this category.</li>'
        : statsArray.map((model, index) => `...`).join(''); // Unchanged for brevity
}

function renderEditor(models, categories) {
    updateDatalists(models, 'model-names-list');
    updateDatalists(categories, 'category-names-list'); // **NEW**

    if (jsonData.length === 0) {
        editorContainer.innerHTML = `<div class="empty-state"><p>No battles yet. Click "+ Add Entry" or "Load File".</p></div>`;
    } else {
        editorContainer.innerHTML = [...jsonData].reverse().map((entry, reverseIndex) => {
            const originalIndex = jsonData.length - 1 - reverseIndex;
            return `
            <div class="card" data-index="${originalIndex}">
                <div class="card-header"><h3>Entry #${originalIndex + 1}</h3><button class="delete-btn btn btn-danger">Delete</button></div>
                <div class="card-body">
                    <div class="form-group"><label>Task</label><textarea data-key="task">${entry.task || ''}</textarea></div>
                    <div class="form-group-grid">
                        <div class="form-group"><label>Model A</label><input type="text" list="model-names-list" value="${entry.match?.model_a || ''}" data-key="match.model_a"></div>
                        <div class="form-group"><label>Model B</label><input type="text" list="model-names-list" value="${entry.match?.model_b || ''}" data-key="match.model_b"></div>
                    </div>
                    <div class="form-group-grid">
                        <div class="form-group">
                            <label>Input Type</label>
                            <select data-key="input">
                                <option value="text" ${entry.input === 'text' ? 'selected' : ''}>Text</option>
                                <option value="image" ${entry.input === 'image' ? 'selected' : ''}>Image</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Category</label> <!-- **NEW** -->
                            <input type="text" list="category-names-list" value="${entry.category || ''}" data-key="category">
                        </div>
                    </div>
                     <div class="form-group"><label>Winner (or "tie")</label><input type="text" list="model-names-list" value="${entry.winner || ''}" data-key="winner"></div>
                </div>
            </div>`;
        }).join('');
    }
}

// **NEW**: Populates the category filter dropdown
function renderCategoryFilter(categories) {
    const currentFilter = categoryFilterSelect.value;
    categoryFilterSelect.innerHTML = '<option value="all">All Categories</option>'; // Reset
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.toLowerCase();
        option.textContent = cat;
        categoryFilterSelect.appendChild(option);
    });
    categoryFilterSelect.value = currentFilter;
}

function updateSortButtons() { /* Unchanged */ }
function updateDatalists(items, listId) { // **MODIFIED** to be generic
    const datalist = document.getElementById(listId);
    datalist.innerHTML = Array.from(items).map(item => `<option value="${item}"></option>`).join('');
}
function setDirtyState(isDirty) { /* Unchanged */ }
function showLoader(show) { /* Unchanged */ }

// --- DATA MANIPULATION & EVENT HANDLERS ---
function processDataAndRender() {
    showLoader(true);
    setTimeout(() => {
        // **MODIFIED**: Filter data before processing
        const battlesToProcess = selectedCategory === 'all'
            ? jsonData
            : jsonData.filter(b => b.category?.trim().toLowerCase() === selectedCategory);

        const { stats: initialStats, modelNames, categories } = getModelsAndStats(battlesToProcess);
        
        // **NEW**: Render filters based on the *entire* dataset, not the filtered one
        const allCategories = getModelsAndStats(jsonData).categories;
        renderCategoryFilter(allCategories);

        const calculationFn = currentRankingSystem === 'bt' ? calculateBradleyTerryRatings : calculateEloRatings;
        const finalStats = calculationFn(initialStats, battlesToProcess);
        
        renderLeaderboard(finalStats);
        renderEditor(modelNames, allCategories); // Pass all categories to editor autocomplete
        
        saveStateToLocalStorage();
        setDirtyState(false);
        showLoader(false);
    }, 50);
}

// ... (setRankingSystem, setSortOrder unchanged) ...
function updateData(index, key, value) { /* Unchanged */ }

function addEntry() {
    // **MODIFIED**: Add category field to new entries
    jsonData.push({ task: "", input: "text", category: "", match: { model_a: "", model_b: "" }, winner: "" });
    const { modelNames, categories } = getModelsAndStats(jsonData);
    renderEditor(modelNames, categories);
    const newCard = editorContainer.querySelector('.card');
    if(newCard) {
        newCard.scrollIntoView({ behavior: 'smooth' });
        newCard.classList.add('flash');
        setTimeout(() => newCard.classList.remove('flash'), 1000);
    }
    setDirtyState(true);
}
// ... (deleteEntry, clearAllData, save/load from localStorage, modal/export functions unchanged) ...

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    loadStateFromLocalStorage();
    processDataAndRender();

    // **NEW**: Add event listener for category filter
    categoryFilterSelect.addEventListener('change', (e) => {
        selectedCategory = e.target.value;
        processDataAndRender();
    });

    // ... (rest of the event listeners are mostly unchanged) ...
});