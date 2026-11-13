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
const snapshotInfo = document.getElementById('snapshotInfo');
const clearSnapshotBtn = document.getElementById('clearSnapshot');
const unfollowersSection = document.getElementById('unfollowersSection');
const unfollowersTitle = document.getElementById('unfollowersTitle');
const unfollowersList = document.getElementById('unfollowersList');

let notFollowingBack = [];
let ignoreList = new Set();

const STORAGE_KEY = 'ig-analyzer-ignore-list';
const SNAPSHOT_KEY = 'ig-analyzer-snapshot';

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

function loadSnapshot() {
    try {
        const saved = localStorage.getItem(SNAPSHOT_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.error('Failed to load snapshot:', e);
        return null;
    }
}

function saveSnapshot(snapshot) {
    try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (e) {
        console.error('Failed to save snapshot:', e);
    }
}

function renderSnapshotInfo() {
    const snapshot = loadSnapshot();
    if (!snapshot) {
        snapshotInfo.textContent = 'No previous export saved. The next export you load will be saved to compare against later.';
        clearSnapshotBtn.style.display = 'none';
        return;
    }
    snapshotInfo.textContent = `Last export loaded on ${new Date(snapshot.savedAt).toLocaleDateString()} (${snapshot.followers.length} followers). New exports are compared against it.`;
    clearSnapshotBtn.style.display = 'inline-block';
}

clearSnapshotBtn.addEventListener('click', () => {
    if (confirm('Delete the saved previous export from this browser?')) {
        localStorage.removeItem(SNAPSHOT_KEY);
        renderSnapshotInfo();
    }
});

// Initialize
loadIgnoreList();
renderSnapshotInfo();

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
        const exported = await readExport(zip);

        if (!exported.hasFollowers) throw new Error('Could not find followers_1.json in the ZIP file.');
        if (!exported.hasFollowing) throw new Error('Could not find following.json in the ZIP file.');

        const followers = Object.keys(exported.followers);
        const following = Object.keys(exported.following);
        const previous = loadSnapshot();
        const followersSet = new Set(followers);
        const unfollowers = previous ? previous.followers.filter(user => !followersSet.has(user)) : [];

        if (previous && unfollowers.length > previous.followers.length / 2 &&
            !confirm(`This export is missing ${unfollowers.length} of your ${previous.followers.length} previous followers. That usually means it isn't an all-time export. Continue anyway?`)) {
            throw new Error('Cancelled. Please use an export with the date range set to "All time".');
        }

        notFollowingBack = following.filter(user => !followersSet.has(user));

        document.getElementById('followingCount').textContent = following.length;
        document.getElementById('followersCount').textContent = followers.length;
        renderUnfollowers(previous, unfollowers);

        saveSnapshot({ followers, savedAt: new Date().toISOString() });
        renderSnapshotInfo();

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

async function readExport(zip) {
    const result = {
        followers: {},
        following: {},
        hasFollowers: false,
        hasFollowing: false
    };

    for (const [path, zipEntry] of Object.entries(zip.files)) {
        const name = path.split('/').pop();
        if (/^followers_\d+\.json$/.test(name)) {
            Object.assign(result.followers, extractUsers(JSON.parse(await zipEntry.async('string'))));
            result.hasFollowers = true;
        } else if (name === 'following.json') {
            Object.assign(result.following, extractUsers(JSON.parse(await zipEntry.async('string'))));
            result.hasFollowing = true;
        }
    }

    return result;
}

function extractUsers(data) {
    const items = Array.isArray(data) ? data : (Object.values(data).find(Array.isArray) || []);
    const users = {};
    for (const item of items) {
        const entry = (item.string_list_data && item.string_list_data[0]) || {};
        const username = item.title || entry.value || usernameFromHref(entry.href);
        if (username) users[username] = entry.timestamp || 0;
    }
    return users;
}

function usernameFromHref(href) {
    if (!href) return null;
    const match = href.match(/instagram\.com\/(?:_u\/)?([^/?#]+)/);
    return match ? match[1] : null;
}

function renderUnfollowers(previous, unfollowers) {
    if (!previous) {
        unfollowersSection.style.display = 'none';
        return;
    }
    unfollowersSection.style.display = 'block';
    unfollowersTitle.textContent = `Unfollowed you since ${new Date(previous.savedAt).toLocaleDateString()} (${unfollowers.length})`;
    unfollowersList.innerHTML = unfollowers.length
        ? unfollowers.map(user => `
            <div class="user-item">
                <span class="user-name">@${user}</span>
                <div class="user-actions">
                    <a href="https://www.instagram.com/${user}" target="_blank" rel="noopener" class="user-link">View</a>
                </div>
            </div>
        `).join('')
        : '<p class="empty-message">Nobody unfollowed you.</p>';
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
