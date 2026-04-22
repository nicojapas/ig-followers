const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const results = document.getElementById('results');
const loading = document.getElementById('loading');
const resultsContent = document.getElementById('resultsContent');
const errorDiv = document.getElementById('error');
const searchBox = document.getElementById('searchBox');
const userList = document.getElementById('userList');
const resetBtn = document.getElementById('resetBtn');
const showIgnoredCheckbox = document.getElementById('showIgnored');
const hiddenBadge = document.getElementById('hiddenBadge');
const exportIgnoreListBtn = document.getElementById('exportIgnoreList');
const importIgnoreListBtn = document.getElementById('importIgnoreListBtn');
const importIgnoreListInput = document.getElementById('importIgnoreList');
const clearIgnoreListBtn = document.getElementById('clearIgnoreList');

let notFollowingBack = [];
let ignoreList = new Set();

const STORAGE_KEY = 'ig-analyzer-ignore-list';

// Load ignore list from localStorage
function loadIgnoreList() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            ignoreList = new Set(JSON.parse(saved));
        }
    } catch (e) {
        console.error('Failed to load ignore list:', e);
    }
}

// Save ignore list to localStorage
function saveIgnoreList() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...ignoreList]));
    } catch (e) {
        console.error('Failed to save ignore list:', e);
    }
}

// Initialize
loadIgnoreList();

// Drag and drop handlers
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
});

// Search functionality
searchBox.addEventListener('input', (e) => {
    renderUserList(e.target.value.toLowerCase());
});

// Show/hide ignored toggle
showIgnoredCheckbox.addEventListener('change', () => {
    renderUserList(searchBox.value.toLowerCase());
});

// Reset button
resetBtn.addEventListener('click', () => {
    results.classList.remove('visible');
    errorDiv.style.display = 'none';
    fileInput.value = '';
    searchBox.value = '';
    notFollowingBack = [];
});

// Export ignore list
exportIgnoreListBtn.addEventListener('click', () => {
    const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        ignoreList: [...ignoreList]
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ig-ignore-list-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// Import ignore list
importIgnoreListBtn.addEventListener('click', () => {
    importIgnoreListInput.click();
});

importIgnoreListInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        let importedList = [];
        if (Array.isArray(data)) {
            // Simple array format
            importedList = data;
        } else if (data.ignoreList && Array.isArray(data.ignoreList)) {
            // Object format with ignoreList property
            importedList = data.ignoreList;
        } else {
            throw new Error('Invalid format');
        }

        // Merge with existing list
        const beforeCount = ignoreList.size;
        importedList.forEach(user => ignoreList.add(user));
        saveIgnoreList();

        const addedCount = ignoreList.size - beforeCount;
        alert(`Imported ${addedCount} new account(s). Total ignored: ${ignoreList.size}`);

        updateIgnoreCount();
        renderUserList(searchBox.value.toLowerCase());
    } catch (err) {
        alert('Failed to import: Invalid file format. Please use a JSON file exported from this tool.');
    }

    importIgnoreListInput.value = '';
});

// Clear ignore list
clearIgnoreListBtn.addEventListener('click', () => {
    if (ignoreList.size === 0) {
        alert('The ignore list is already empty.');
        return;
    }

    if (confirm(`Are you sure you want to clear all ${ignoreList.size} ignored account(s)? This cannot be undone.`)) {
        ignoreList.clear();
        localStorage.removeItem(STORAGE_KEY);
        updateIgnoreCount();
        renderUserList(searchBox.value.toLowerCase());
    }
});

// Toggle ignore for a user
function toggleIgnore(username) {
    if (ignoreList.has(username)) {
        ignoreList.delete(username);
    } else {
        ignoreList.add(username);
    }
    saveIgnoreList();
    updateIgnoreCount();
    renderUserList(searchBox.value.toLowerCase());
}

// Update ignore count display
function updateIgnoreCount() {
    const ignoredInResults = notFollowingBack.filter(user => ignoreList.has(user)).length;
    const notIgnoredCount = notFollowingBack.length - ignoredInResults;

    document.getElementById('ignoredCount').textContent = ignoredInResults;
    document.getElementById('notFollowingBackCount').textContent = notIgnoredCount;

    if (!showIgnoredCheckbox.checked && ignoredInResults > 0) {
        hiddenBadge.textContent = `${ignoredInResults} hidden`;
        hiddenBadge.style.display = 'inline';
    } else {
        hiddenBadge.style.display = 'none';
    }
}

async function processFile(file) {
    if (!file.name.endsWith('.zip')) {
        showError('Please upload a ZIP file.');
        return;
    }

    results.classList.add('visible');
    loading.style.display = 'block';
    resultsContent.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
        const zip = await JSZip.loadAsync(file);

        // Find the followers and following files
        let followersData = null;
        let followingData = null;

        for (const [path, zipEntry] of Object.entries(zip.files)) {
            if (path.includes('followers_and_following/followers_1.json') ||
                path.endsWith('followers_1.json')) {
                const content = await zipEntry.async('string');
                followersData = JSON.parse(content);
            }
            if (path.includes('followers_and_following/following.json') ||
                path.endsWith('following.json')) {
                const content = await zipEntry.async('string');
                followingData = JSON.parse(content);
            }
        }

        if (!followersData) {
            throw new Error('Could not find followers_1.json in the ZIP file.');
        }
        if (!followingData) {
            throw new Error('Could not find following.json in the ZIP file.');
        }

        // Extract usernames
        const followers = extractFollowers(followersData);
        const following = extractFollowing(followingData);

        // Find who doesn't follow back
        const followersSet = new Set(followers);
        notFollowingBack = following.filter(user => !followersSet.has(user));

        // Update UI
        document.getElementById('followingCount').textContent = following.length;
        document.getElementById('followersCount').textContent = followers.length;

        updateIgnoreCount();
        renderUserList('');

        loading.style.display = 'none';
        resultsContent.style.display = 'block';

    } catch (error) {
        loading.style.display = 'none';
        resultsContent.style.display = 'none';
        showError(error.message);
    }
}

function extractFollowers(data) {
    // followers_1.json is an array with string_list_data[0].value
    return data.map(item => {
        if (item.string_list_data && item.string_list_data[0]) {
            return item.string_list_data[0].value;
        }
        return null;
    }).filter(Boolean);
}

function extractFollowing(data) {
    // following.json has relationships_following array with title
    if (data.relationships_following) {
        return data.relationships_following.map(item => item.title);
    }
    return [];
}

function renderUserList(searchTerm) {
    const showIgnored = showIgnoredCheckbox.checked;

    let filtered = notFollowingBack;

    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(user => user.toLowerCase().includes(searchTerm));
    }

    // Sort: non-ignored first, then ignored
    filtered = filtered.sort((a, b) => {
        const aIgnored = ignoreList.has(a);
        const bIgnored = ignoreList.has(b);
        if (aIgnored === bIgnored) return 0;
        return aIgnored ? 1 : -1;
    });

    // Filter out ignored if toggle is off
    if (!showIgnored) {
        filtered = filtered.filter(user => !ignoreList.has(user));
    }

    userList.innerHTML = filtered.map(user => {
        const isIgnored = ignoreList.has(user);
        return `
            <div class="user-item ${isIgnored ? 'ignored' : ''}">
                <span class="user-name">@${user}</span>
                <div class="user-actions">
                    <button class="ignore-btn ${isIgnored ? 'ignored' : ''}" onclick="toggleIgnore('${user}')">
                        ${isIgnored ? 'Unignore' : 'Ignore'}
                    </button>
                    <a href="https://www.instagram.com/${user}" target="_blank" rel="noopener" class="user-link">
                        View
                    </a>
                </div>
            </div>
        `;
    }).join('');

    if (filtered.length === 0) {
        if (searchTerm) {
            userList.innerHTML = '<p class="empty-message">No users match your search.</p>';
        } else if (!showIgnored && notFollowingBack.length > 0) {
            userList.innerHTML = '<p class="empty-message">All accounts are ignored. Toggle "Show ignored accounts" to see them.</p>';
        }
    }

    updateIgnoreCount();
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    results.classList.remove('visible');
}
