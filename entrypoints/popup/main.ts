const STORAGE_KEY = 'claude_accounts_v3';
const SETTINGS_KEY = 'claude_switcher_settings';
const COLORS = ['#c96442','#e57373','#f06292','#ba68c8','#9575cd','#7986cb','#64b5f6','#4fc3f7','#4db6ac','#81c784'];

interface Account {
  id: string;
  name: string;
  email: string;
  type: 'work' | 'personal';
  color: string;
  sessionKey: string;
  createdAt: string;
}

interface Settings {
  showOnSite: boolean;
  keyboardShortcut: boolean;
  autoSave: boolean;
  confirmSwitch: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  showOnSite: true,
  keyboardShortcut: true,
  autoSave: true,
  confirmSwitch: false
};

let accounts: Account[] = [];
let settings: Settings = { ...DEFAULT_SETTINGS };
let editingIndex: number | null = null;

async function loadAccounts(): Promise<Account[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function saveAccounts(accs: Account[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: accs });
  accounts = accs;
}

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: s });
  settings = s;
}

async function getCurrentSessionKey(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://claude.ai',
      name: 'sessionKey'
    });
    return cookie?.value || null;
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

async function switchToAccount(sessionKey: string, accountName: string): Promise<void> {
  if (settings.confirmSwitch) {
    if (!confirm(`Switch to ${accountName}?`)) return;
  }
  
  await chrome.cookies.remove({ url: 'https://claude.ai', name: 'sessionKey' });
  await chrome.cookies.set({
    url: 'https://claude.ai',
    name: 'sessionKey',
    value: sessionKey,
    domain: '.claude.ai',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax'
  });
  
  // Find Claude tab and reload it, or open new tab
  const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });
  if (tabs.length > 0) {
    await chrome.tabs.reload(tabs[0].id!);
    await chrome.tabs.update(tabs[0].id!, { active: true });
  } else {
    await chrome.tabs.create({ url: 'https://claude.ai' });
  }
  window.close();
}

function renderCurrentAccount(currentKey: string | null): void {
  const container = document.getElementById('current-account')!;
  const currentAccount = currentKey ? accounts.find(a => a.sessionKey === currentKey) : null;
  const currentIdx = currentAccount ? accounts.indexOf(currentAccount) : -1;
  
  if (currentAccount) {
    container.innerHTML = `
      <div class="avatar" style="background:${currentAccount.color}">${getInitials(currentAccount.name)}</div>
      <div class="account-info">
        <div class="account-name">${currentAccount.name}</div>
        <div class="account-email">${currentAccount.email || 'No email'}</div>
      </div>
      <button class="current-edit-btn" data-idx="${currentIdx}" title="Edit">✎</button>
    `;
    container.querySelector('.current-edit-btn')?.addEventListener('click', () => {
      openEditModal(currentIdx);
    });
  } else if (currentKey) {
    container.innerHTML = `
      <div class="avatar" style="background:#c96442">?</div>
      <div class="account-info">
        <div class="account-name">Unknown Account</div>
        <div class="account-email">Visit claude.ai to sync</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="avatar" style="background:#888">?</div>
      <div class="account-info">
        <div class="account-name">Not logged in</div>
        <div class="account-email">Visit claude.ai to add accounts</div>
      </div>
    `;
  }
}

function renderAccountsList(currentKey: string | null): void {
  const list = document.getElementById('accounts-list')!;
  const label = document.getElementById('list-label')!;
  
  const otherAccounts = accounts.filter(a => a.sessionKey !== currentKey);
  
  if (otherAccounts.length === 0) {
    label.style.display = 'none';
    list.innerHTML = '<div class="empty-state">Log into Claude accounts to add them here</div>';
    return;
  }
  
  label.style.display = 'block';
  list.innerHTML = otherAccounts.map(a => {
    const idx = accounts.indexOf(a);
    return `
      <div class="account-item" data-idx="${idx}">
        <div class="avatar" style="background:${a.color}">${getInitials(a.name)}</div>
        <div class="item-info">
          <div class="item-name">${a.name}</div>
          <div class="item-email">${a.email || ''}</div>
        </div>
        <span class="item-badge ${a.type}">${a.type}</span>
        <div class="item-actions">
          <button class="item-btn edit" data-idx="${idx}" title="Edit">✎</button>
          <button class="item-btn delete" data-idx="${idx}" title="Remove">×</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Click to switch
  list.querySelectorAll('.account-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('item-btn')) return;
      const idx = parseInt((el as HTMLElement).dataset.idx!);
      switchToAccount(accounts[idx].sessionKey, accounts[idx].name);
    });
  });
  
  // Edit button
  list.querySelectorAll('.item-btn.edit').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt((el as HTMLElement).dataset.idx!);
      openEditModal(idx);
    });
  });
  
  // Delete button
  list.querySelectorAll('.item-btn.delete').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt((el as HTMLElement).dataset.idx!);
      if (confirm(`Remove "${accounts[idx].name}"?`)) {
        accounts.splice(idx, 1);
        await saveAccounts(accounts);
        const currentKey = await getCurrentSessionKey();
        renderAccountsList(currentKey);
      }
    });
  });
}

function openEditModal(idx: number): void {
  editingIndex = idx;
  const acc = accounts[idx];
  const modal = document.getElementById('edit-modal')!;
  const body = document.getElementById('edit-body')!;
  
  body.innerHTML = `
    <div class="field">
      <label>Name</label>
      <input type="text" id="edit-name" value="${acc.name}">
    </div>
    <div class="field">
      <label>Email</label>
      <input type="email" id="edit-email" value="${acc.email || ''}">
    </div>
    <div class="field">
      <label>Type</label>
      <select id="edit-type">
        <option value="work" ${acc.type === 'work' ? 'selected' : ''}>Work</option>
        <option value="personal" ${acc.type === 'personal' ? 'selected' : ''}>Personal</option>
      </select>
    </div>
    <div class="field">
      <label>Color</label>
      <div class="colors">
        ${COLORS.map(c => `<div class="color-opt ${c === acc.color ? 'selected' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}
      </div>
    </div>
  `;
  
  body.querySelectorAll('.color-opt').forEach(el => {
    el.addEventListener('click', () => {
      body.querySelectorAll('.color-opt').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
  
  modal.classList.add('open');
}

function closeEditModal(): void {
  editingIndex = null;
  document.getElementById('edit-modal')!.classList.remove('open');
}

async function saveEdit(): Promise<void> {
  if (editingIndex === null) return;
  
  const name = (document.getElementById('edit-name') as HTMLInputElement).value.trim();
  const email = (document.getElementById('edit-email') as HTMLInputElement).value.trim();
  const type = (document.getElementById('edit-type') as HTMLSelectElement).value as 'work' | 'personal';
  const colorEl = document.querySelector('.color-opt.selected') as HTMLElement;
  const color = colorEl?.dataset.color || accounts[editingIndex].color;
  
  if (!name) {
    alert('Name is required');
    return;
  }
  
  accounts[editingIndex] = { ...accounts[editingIndex], name, email, type, color };
  await saveAccounts(accounts);
  
  closeEditModal();
  const currentKey = await getCurrentSessionKey();
  renderCurrentAccount(currentKey);
  renderAccountsList(currentKey);
}

function showSettings(): void {
  document.getElementById('main-panel')!.style.display = 'none';
  document.getElementById('settings-panel')!.classList.add('open');
  
  // Update all toggles to reflect current settings
  document.getElementById('toggle-show-on-site')!.classList.toggle('on', settings.showOnSite);
  document.getElementById('toggle-keyboard-shortcut')!.classList.toggle('on', settings.keyboardShortcut);
  document.getElementById('toggle-auto-save')!.classList.toggle('on', settings.autoSave);
  document.getElementById('toggle-confirm-switch')!.classList.toggle('on', settings.confirmSwitch);
}

function hideSettings(): void {
  document.getElementById('main-panel')!.style.display = 'block';
  document.getElementById('settings-panel')!.classList.remove('open');
}

async function init(): Promise<void> {
  accounts = await loadAccounts();
  settings = await loadSettings();
  const currentKey = await getCurrentSessionKey();
  
  renderCurrentAccount(currentKey);
  renderAccountsList(currentKey);
  
  // Open Claude.ai button
  document.getElementById('open-claude-btn')!.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://claude.ai' });
  });
  
  // Settings button
  document.getElementById('settings-btn')!.addEventListener('click', showSettings);
  document.getElementById('back-btn')!.addEventListener('click', hideSettings);
  
  // Settings toggles
  document.getElementById('toggle-show-on-site')!.addEventListener('click', async (e) => {
    const toggle = e.currentTarget as HTMLElement;
    settings.showOnSite = !settings.showOnSite;
    toggle.classList.toggle('on', settings.showOnSite);
    await saveSettings(settings);
  });
  
  document.getElementById('toggle-keyboard-shortcut')!.addEventListener('click', async (e) => {
    const toggle = e.currentTarget as HTMLElement;
    settings.keyboardShortcut = !settings.keyboardShortcut;
    toggle.classList.toggle('on', settings.keyboardShortcut);
    await saveSettings(settings);
  });
  
  document.getElementById('toggle-auto-save')!.addEventListener('click', async (e) => {
    const toggle = e.currentTarget as HTMLElement;
    settings.autoSave = !settings.autoSave;
    toggle.classList.toggle('on', settings.autoSave);
    await saveSettings(settings);
  });
  
  document.getElementById('toggle-confirm-switch')!.addEventListener('click', async (e) => {
    const toggle = e.currentTarget as HTMLElement;
    settings.confirmSwitch = !settings.confirmSwitch;
    toggle.classList.toggle('on', settings.confirmSwitch);
    await saveSettings(settings);
  });
  
  // Export button
  document.getElementById('export-btn')!.addEventListener('click', () => {
    const includeKeys = (document.getElementById('export-include-keys') as HTMLInputElement).checked;
    const exportData = accounts.map(a => {
      const data: any = {
        name: a.name,
        email: a.email,
        type: a.type,
        color: a.color,
        createdAt: a.createdAt
      };
      if (includeKeys) {
        data.sessionKey = a.sessionKey;
      }
      return data;
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = includeKeys ? 'claude-accounts-with-keys.json' : 'claude-accounts.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  
  // Clear button
  document.getElementById('clear-btn')!.addEventListener('click', async () => {
    if (confirm('Remove ALL saved accounts? This cannot be undone.')) {
      accounts = [];
      await saveAccounts(accounts);
      const currentKey = await getCurrentSessionKey();
      renderCurrentAccount(currentKey);
      renderAccountsList(currentKey);
      hideSettings();
    }
  });
  
  // Edit modal
  document.getElementById('edit-close')!.addEventListener('click', closeEditModal);
  document.getElementById('edit-cancel')!.addEventListener('click', closeEditModal);
  document.getElementById('edit-save')!.addEventListener('click', saveEdit);
  
  // Add manually button - open Claude.ai for now
  document.getElementById('add-btn')!.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://claude.ai' });
    window.close();
  });
}

init();
