export default defineContentScript({
  matches: ['https://claude.ai/*'],
  runAt: 'document_end',
  main() {
    console.log('[CAS] Content script loaded');
    init();
  },
});

const STORAGE_KEY = 'claude_accounts_v3';
const SETTINGS_KEY = 'claude_switcher_settings';
const COLORS = ['#c96442','#e57373','#f06292','#ba68c8','#9575cd','#7986cb','#64b5f6','#4fc3f7','#4db6ac','#81c784'];
const SIDEBAR_EXPANDED_WIDTH = 220;
const SIDEBAR_COLLAPSED_WIDTH = 16;

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

let settings: Settings = { ...DEFAULT_SETTINGS };

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

interface Account {
  id: string;
  name: string;
  email: string;
  type: 'work' | 'personal';
  color: string;
  sessionKey: string;
  createdAt: string;
}

interface CurrentAccount {
  name: string;
  email: string;
  uuid: string;
}

let accounts: Account[] = [];
let currentAccount: CurrentAccount | null = null;
let currentSessionKey: string | null = null;
let popup: HTMLElement | null = null;
let modalBg: HTMLElement | null = null;
let sidebarCollapsed = false;

// Storage helpers
async function loadAccounts(): Promise<Account[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function saveAccounts(accs: Account[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: accs });
  accounts = accs;
}

// Get current session key from background script
async function getCurrentSessionKey(): Promise<string | null> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION_COOKIE' });
  return response?.success ? response.sessionKey : null;
}

// Try to get email from DOM with multiple selectors
function getEmailFromDOM(): string {
  // Try various selectors that Claude might use for email display
  const selectors = [
    '.text-text-500.truncate',
    '[class*="text-text-500"][class*="truncate"]',
    '[class*="overflow-ellipsis"][class*="truncate"]',
    '.pt-1.px-2.pb-2.truncate',
    '[data-testid="user-email"]'
  ];
  
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent?.trim() || '';
      // Basic email validation
      if (text.includes('@') && text.includes('.')) {
        console.log('[CAS] Got email from DOM with selector:', selector, text);
        return text;
      }
    }
  }
  return '';
}

// Fetch current account info from /api/account with DOM fallback for email
async function fetchCurrentAccountInfo(): Promise<CurrentAccount | null> {
  try {
    const response = await fetch('/api/account');
    if (!response.ok) throw new Error('Failed to fetch account');
    const data = await response.json();
    console.log('[CAS] Account data:', data);
    
    let email = data.email || data.email_address || '';
    
    // Fallback: try to get email from DOM if API didn't return it
    if (!email) {
      email = getEmailFromDOM();
    }
    
    return {
      name: data.name || data.full_name || 'Unknown',
      email,
      uuid: data.uuid || data.id || ''
    };
  } catch (e) {
    console.error('[CAS] Error fetching account:', e);
    return null;
  }
}

// Retry fetching email from DOM after a delay (for SPA loading)
async function retryEmailDetection(): Promise<void> {
  if (currentAccount && !currentAccount.email) {
    // Wait for DOM to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    const email = getEmailFromDOM();
    if (email) {
      currentAccount.email = email;
      console.log('[CAS] Email detected on retry:', email);
      
      // Update saved account if exists
      const savedIdx = accounts.findIndex(a => a.sessionKey === currentSessionKey);
      if (savedIdx !== -1 && !accounts[savedIdx].email) {
        accounts[savedIdx].email = email;
        await saveAccounts(accounts);
        console.log('[CAS] Updated saved account with email');
      }
    }
  }
}

// Auto-save current account if not already in the list
async function autoSaveCurrentAccount(): Promise<void> {
  if (!currentAccount || !currentSessionKey) return;
  if (!settings.autoSave) return;
  
  // Check if already saved (by email or sessionKey)
  const existingByEmail = accounts.find(a => 
    a.email && currentAccount!.email && 
    a.email.toLowerCase() === currentAccount!.email.toLowerCase()
  );
  const existingByKey = accounts.find(a => a.sessionKey === currentSessionKey);
  
  if (existingByEmail || existingByKey) {
    // Update sessionKey if email matches but key changed
    if (existingByEmail && existingByEmail.sessionKey !== currentSessionKey) {
      existingByEmail.sessionKey = currentSessionKey;
      await saveAccounts(accounts);
      console.log('[CAS] Updated session key for existing account:', existingByEmail.name);
    }
    return;
  }
  
  // Auto-save new account
  const newAccount: Account = {
    id: Date.now().toString(36),
    name: currentAccount.name,
    email: currentAccount.email,
    type: 'work',
    color: COLORS[accounts.length % COLORS.length],
    sessionKey: currentSessionKey,
    createdAt: new Date().toISOString()
  };
  
  accounts.push(newAccount);
  await saveAccounts(accounts);
  console.log('[CAS] Auto-saved current account:', newAccount.name);
}

// Switch account using chrome.cookies API
async function switchTo(i: number): Promise<void> {
  const acc = accounts[i];
  if (!acc?.sessionKey) {
    alert('No session key for this account.');
    return;
  }
  
  if (settings.confirmSwitch) {
    if (!confirm(`Switch to ${acc.name}?`)) return;
  }
  
  console.log('[CAS] Switching to account:', acc.name);
  
  const response = await chrome.runtime.sendMessage({
    type: 'SET_SESSION_COOKIE',
    sessionKey: acc.sessionKey
  });
  
  if (response?.success) {
    console.log('[CAS] Cookie set successfully, reloading...');
    window.location.reload();
  } else {
    console.error('[CAS] Failed to set cookie:', response?.error);
    alert('Failed to switch account: ' + (response?.error || 'Unknown error'));
  }
}

// Remove account from list
async function removeAccount(i: number): Promise<void> {
  const acc = accounts[i];
  if (confirm(`Remove "${acc.name}" from saved accounts?`)) {
    accounts.splice(i, 1);
    await saveAccounts(accounts);
    renderCurrentAccount();
    renderList();
  }
}

// Edit account
function editAccount(i: number): void {
  openEditModal(i);
}

// Check if sidebar is collapsed
function checkSidebarState(): boolean {
  const sidebar = document.querySelector('[class*="sidebar"]') || 
                 document.querySelector('nav') ||
                 document.querySelector('[data-sidebar]');
  
  if (sidebar) {
    const rect = sidebar.getBoundingClientRect();
    return rect.width < 100;
  }
  
  const collapsed = document.querySelector('[class*="collapsed"]') ||
                   document.querySelector('[data-collapsed="true"]');
  return !!collapsed;
}

function updateSidebarState(): void {
  const collapsed = checkSidebarState();
  if (collapsed !== sidebarCollapsed) {
    sidebarCollapsed = collapsed;
    const btn = document.getElementById('cas-btn');
    const popupEl = document.getElementById('cas-popup');
    if (btn) btn.classList.toggle('sidebar-collapsed', collapsed);
    if (popupEl) popupEl.classList.toggle('sidebar-collapsed', collapsed);
  }
}

function findCurrentAccountIndex(): number {
  if (!currentSessionKey) return -1;
  return accounts.findIndex(a => a.sessionKey === currentSessionKey);
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Inject CSS
function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    #cas-btn {
      position: fixed;
      bottom: 16px;
      left: ${SIDEBAR_EXPANDED_WIDTH}px;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #c96442;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      transition: left 0.2s ease;
    }
    #cas-btn.sidebar-collapsed { left: ${SIDEBAR_COLLAPSED_WIDTH}px; }
    #cas-btn:hover { background: #b85a3a; }
    #cas-btn svg { width: 18px; height: 18px; color: white; }

    #cas-popup {
      position: fixed;
      left: ${SIDEBAR_EXPANDED_WIDTH}px;
      bottom: 56px;
      width: 320px;
      background: #1e1e1c;
      border: 1px solid #3f3f3c;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      z-index: 999999;
      display: none;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: left 0.2s ease;
    }
    #cas-popup.sidebar-collapsed { left: ${SIDEBAR_COLLAPSED_WIDTH}px; }
    #cas-popup.open { display: flex; }
    #cas-popup-header {
      padding: 14px 16px;
      border-bottom: 1px solid #3f3f3c;
      font-weight: 600;
      font-size: 14px;
      color: #f5f4ef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #cas-popup-close {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }
    #cas-popup-close:hover { color: #fff; }

    #cas-current {
      padding: 12px 16px;
      background: #252522;
      border-bottom: 1px solid #3f3f3c;
    }
    #cas-current-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    #cas-current-account {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    #cas-current-account .cas-avatar {
      width: 36px;
      height: 36px;
      font-size: 14px;
    }
    #cas-current-info { flex: 1; min-width: 0; }
    #cas-current-name {
      font-size: 14px;
      font-weight: 500;
      color: #f5f4ef;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #cas-current-email { font-size: 11px; color: #888; }
    .cas-current-edit {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 4px;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .cas-current-edit:hover { color: #fff; }
    #cas-current-account:hover .cas-current-edit { opacity: 1; }

    #cas-list { max-height: 200px; overflow-y: auto; }
    #cas-list-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #888;
      padding: 12px 16px 8px;
      letter-spacing: 0.5px;
    }
    .cas-item {
      display: flex;
      align-items: center;
      padding: 10px 16px;
      gap: 10px;
      cursor: pointer;
      border-bottom: 1px solid #2a2a28;
      position: relative;
    }
    .cas-item:last-child { border-bottom: none; }
    .cas-item:hover { background: #2a2a28; }
    .cas-item:hover .cas-item-actions { opacity: 1; }
    .cas-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 12px;
      color: #fff;
      flex-shrink: 0;
    }
    .cas-item-info { flex: 1; min-width: 0; }
    .cas-item-name {
      font-size: 13px;
      font-weight: 500;
      color: #f5f4ef;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cas-item-email {
      font-size: 11px;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cas-item-badge {
      font-size: 9px;
      padding: 2px 5px;
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .cas-item-badge.work { background: rgba(21,101,192,0.2); color: #64b5f6; }
    .cas-item-badge.personal { background: rgba(123,31,162,0.2); color: #ce93d8; }
    .cas-item-actions {
      opacity: 0;
      display: flex;
      gap: 4px;
      transition: opacity 0.15s;
    }
    .cas-item-edit, .cas-item-remove {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      line-height: 1;
      transition: opacity 0.15s;
    }
    .cas-item-edit:hover { color: #fff; }
    .cas-item-remove:hover { color: #e53e3e; }

    #cas-actions { padding: 12px 16px; display: flex; gap: 8px; }
    #cas-add-btn {
      flex: 1;
      padding: 10px;
      border: 1px dashed #3f3f3c;
      border-radius: 8px;
      background: transparent;
      color: #888;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s;
    }
    #cas-add-btn:hover {
      border-color: #c96442;
      color: #c96442;
      background: rgba(201,100,66,0.1);
    }
    .cas-empty {
      padding: 24px 16px;
      text-align: center;
      color: #888;
      font-size: 13px;
    }

    #cas-modal-bg {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 9999999;
      display: none;
      align-items: center;
      justify-content: center;
    }
    #cas-modal-bg.open { display: flex; }
    #cas-modal {
      background: #1e1e1c;
      border: 1px solid #3f3f3c;
      border-radius: 12px;
      width: 400px;
      max-width: 90vw;
    }
    #cas-modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid #3f3f3c;
      font-weight: 600;
      font-size: 15px;
      color: #f5f4ef;
    }
    #cas-modal-body { padding: 16px 20px; }
    #cas-modal-footer {
      padding: 12px 20px;
      border-top: 1px solid #3f3f3c;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .cas-field { margin-bottom: 14px; }
    .cas-field:last-child { margin-bottom: 0; }
    .cas-field label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #aaa;
      margin-bottom: 5px;
    }
    .cas-field input, .cas-field select, .cas-field textarea {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #3f3f3c;
      border-radius: 6px;
      background: #2b2a27;
      color: #f5f4ef;
      font-size: 13px;
      box-sizing: border-box;
    }
    .cas-field input:disabled, .cas-field textarea:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .cas-field textarea {
      font-family: monospace;
      font-size: 11px;
      min-height: 60px;
      resize: vertical;
    }
    .cas-field input:focus, .cas-field select:focus, .cas-field textarea:focus {
      outline: none;
      border-color: #c96442;
    }
    .cas-hint { font-size: 10px; color: #666; margin-top: 4px; }
    .cas-info-box {
      background: rgba(255,193,7,0.1);
      border: 1px solid rgba(255,193,7,0.3);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 14px;
      font-size: 11px;
      color: #ffc107;
      line-height: 1.4;
    }
    .cas-info-box.success {
      background: rgba(72,187,120,0.1);
      border-color: rgba(72,187,120,0.3);
      color: #48bb78;
    }
    .cas-info-box.error {
      background: rgba(229,62,62,0.1);
      border-color: rgba(229,62,62,0.3);
      color: #e53e3e;
    }
    .cas-btn {
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: none;
    }
    .cas-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .cas-btn-cancel { background: #3f3f3c; color: #f5f4ef; }
    .cas-btn-cancel:hover:not(:disabled) { background: #4a4a47; }
    .cas-btn-save { background: #c96442; color: #fff; }
    .cas-btn-save:hover:not(:disabled) { background: #b85a3a; }
    .cas-colors { display: flex; gap: 5px; flex-wrap: wrap; }
    .cas-color-opt {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
    }
    .cas-color-opt:hover { transform: scale(1.1); }
    .cas-color-opt.sel { border-color: #fff; }
    .cas-advanced-toggle {
      font-size: 11px;
      color: #888;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 10px;
    }
    .cas-advanced-toggle:hover { color: #aaa; }
    .cas-advanced-content { display: none; }
    .cas-advanced-content.open { display: block; }
    
    /* Settings Modal */
    #cas-settings-bg {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 9999999;
      display: none;
      align-items: center;
      justify-content: center;
    }
    #cas-settings-bg.open { display: flex; }
    #cas-settings-modal {
      background: #1e1e1c;
      border: 1px solid #3f3f3c;
      border-radius: 12px;
      width: 360px;
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
    }
    .cas-settings-header {
      padding: 14px 16px;
      border-bottom: 1px solid #3f3f3c;
      font-weight: 600;
      font-size: 14px;
      color: #f5f4ef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cas-settings-close {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 18px;
    }
    .cas-settings-close:hover { color: #fff; }
    .cas-settings-section {
      padding: 16px;
      border-bottom: 1px solid #3f3f3c;
    }
    .cas-settings-section:last-child { border-bottom: none; }
    .cas-settings-title {
      font-size: 10px;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    .cas-setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }
    .cas-setting-label { font-size: 13px; color: #f5f4ef; }
    .cas-setting-desc { font-size: 11px; color: #888; margin-top: 2px; }
    .cas-toggle {
      width: 40px;
      height: 22px;
      background: #3f3f3c;
      border-radius: 11px;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .cas-toggle.on { background: #c96442; }
    .cas-toggle::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      background: #fff;
      border-radius: 50%;
      top: 2px;
      left: 2px;
      transition: left 0.2s;
    }
    .cas-toggle.on::after { left: 20px; }
  `;
  document.head.appendChild(style);
}

function createPopup(): void {
  const old = document.getElementById('cas-popup');
  if (old) old.remove();

  popup = document.createElement('div');
  popup.id = 'cas-popup';
  if (sidebarCollapsed) popup.classList.add('sidebar-collapsed');
  
  popup.innerHTML = `
    <div id="cas-popup-header">
      <span>Switch Account</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="cas-popup-settings" title="Settings" style="background:none;border:none;color:#888;cursor:pointer;padding:4px;display:flex;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
        <button id="cas-popup-close">&times;</button>
      </div>
    </div>
    <div id="cas-current"></div>
    <div id="cas-list-label">Other Accounts</div>
    <div id="cas-list"></div>
    <div id="cas-actions"></div>
  `;
  document.body.appendChild(popup);

  popup.querySelector('#cas-popup-close')!.addEventListener('click', () => popup!.classList.remove('open'));
  popup.querySelector('#cas-popup-settings')!.addEventListener('click', () => openSettingsModal());
  
  renderCurrentAccount();
  renderList();
  renderActions();
}

function renderCurrentAccount(): void {
  if (!popup) return;
  const container = popup.querySelector('#cas-current')!;
  const currentIdx = findCurrentAccountIndex();
  const acc = currentIdx !== -1 ? accounts[currentIdx] : null;
  const displayAcc = currentAccount || { name: 'Loading...', email: '' };
  const color = acc?.color || COLORS[0];

  container.innerHTML = `
    <div id="cas-current-label">Current Session</div>
    <div id="cas-current-account">
      <div class="cas-avatar" style="background:${color}">${getInitials(displayAcc.name)}</div>
      <div id="cas-current-info">
        <div id="cas-current-name">${displayAcc.name}</div>
        <div id="cas-current-email">${displayAcc.email || 'No email'}</div>
      </div>
      ${currentIdx !== -1 ? `<button class="cas-current-edit" data-idx="${currentIdx}" title="Edit">✎</button>` : ''}
    </div>
  `;
  
  // Bind edit button for current account
  const editBtn = container.querySelector('.cas-current-edit');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      openEditModal(currentIdx);
    });
  }
}

function renderList(): void {
  if (!popup) return;
  const list = popup.querySelector('#cas-list')!;
  const label = popup.querySelector('#cas-list-label') as HTMLElement;
  const currentIdx = findCurrentAccountIndex();
  
  const otherAccounts = accounts.filter((_, i) => i !== currentIdx);
  
  if (otherAccounts.length === 0) {
    label.style.display = 'none';
    list.innerHTML = '<div class="cas-empty">Log into another Claude account to add it here</div>';
    return;
  }
  
  label.style.display = 'block';
  list.innerHTML = otherAccounts.map((a) => {
    const realIdx = accounts.indexOf(a);
    return `
      <div class="cas-item" data-i="${realIdx}">
        <div class="cas-avatar" style="background:${a.color}">${getInitials(a.name)}</div>
        <div class="cas-item-info">
          <div class="cas-item-name">${a.name}</div>
          <div class="cas-item-email">${a.email || ''}</div>
        </div>
        <span class="cas-item-badge ${a.type || 'work'}">${a.type || 'work'}</span>
        <div class="cas-item-actions">
          <button class="cas-item-edit" data-i="${realIdx}" title="Edit account">✎</button>
          <button class="cas-item-remove" data-i="${realIdx}" title="Remove account">&times;</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.cas-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('cas-item-remove') || target.classList.contains('cas-item-edit')) return;
      const idx = parseInt((el as HTMLElement).dataset.i!);
      switchTo(idx);
    });
  });
  
  list.querySelectorAll('.cas-item-edit').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt((el as HTMLElement).dataset.i!);
      openEditModal(idx);
    });
  });
  
  list.querySelectorAll('.cas-item-remove').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt((el as HTMLElement).dataset.i!);
      removeAccount(idx);
    });
  });
}

function renderActions(): void {
  if (!popup) return;
  const container = popup.querySelector('#cas-actions')!;
  
  container.innerHTML = `<button id="cas-add-btn">+ Add Account Manually</button>`;
  container.querySelector('#cas-add-btn')!.addEventListener('click', () => openModal());
}

function createModal(): void {
  const old = document.getElementById('cas-modal-bg');
  if (old) old.remove();

  modalBg = document.createElement('div');
  modalBg.id = 'cas-modal-bg';
  modalBg.innerHTML = `
    <div id="cas-modal">
      <div id="cas-modal-header">Add Account Manually</div>
      <div id="cas-modal-body"></div>
      <div id="cas-modal-footer"></div>
    </div>
  `;
  document.body.appendChild(modalBg);
  modalBg.addEventListener('click', (e) => { if (e.target === modalBg) closeModal(); });
}

let settingsBg: HTMLElement | null = null;

function createSettingsModal(): void {
  const old = document.getElementById('cas-settings-bg');
  if (old) old.remove();

  settingsBg = document.createElement('div');
  settingsBg.id = 'cas-settings-bg';
  settingsBg.innerHTML = `
    <div id="cas-settings-modal">
      <div class="cas-settings-header">
        <span>Settings</span>
        <button class="cas-settings-close">&times;</button>
      </div>
      <div class="cas-settings-section">
        <div class="cas-settings-title">Appearance</div>
        <div class="cas-setting-row">
          <div>
            <div class="cas-setting-label">Show on Claude.ai</div>
            <div class="cas-setting-desc">Display floating button</div>
          </div>
          <div class="cas-toggle" data-setting="showOnSite"></div>
        </div>
        <div class="cas-setting-row">
          <div>
            <div class="cas-setting-label">Keyboard Shortcut</div>
            <div class="cas-setting-desc">Alt+S to toggle switcher</div>
          </div>
          <div class="cas-toggle" data-setting="keyboardShortcut"></div>
        </div>
      </div>
      <div class="cas-settings-section">
        <div class="cas-settings-title">Behavior</div>
        <div class="cas-setting-row">
          <div>
            <div class="cas-setting-label">Auto-save Accounts</div>
            <div class="cas-setting-desc">Save new accounts on login</div>
          </div>
          <div class="cas-toggle" data-setting="autoSave"></div>
        </div>
        <div class="cas-setting-row">
          <div>
            <div class="cas-setting-label">Confirm Before Switch</div>
            <div class="cas-setting-desc">Ask before switching</div>
          </div>
          <div class="cas-toggle" data-setting="confirmSwitch"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(settingsBg);
  
  settingsBg.addEventListener('click', (e) => { if (e.target === settingsBg) closeSettingsModal(); });
  settingsBg.querySelector('.cas-settings-close')!.addEventListener('click', closeSettingsModal);
  
  // Bind toggle clicks
  settingsBg.querySelectorAll('.cas-toggle').forEach(el => {
    el.addEventListener('click', async () => {
      const setting = (el as HTMLElement).dataset.setting as keyof Settings;
      (settings as any)[setting] = !(settings as any)[setting];
      el.classList.toggle('on', (settings as any)[setting]);
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    });
  });
}

function openSettingsModal(): void {
  if (!settingsBg) createSettingsModal();
  
  // Update toggles to reflect current settings
  settingsBg!.querySelectorAll('.cas-toggle').forEach(el => {
    const setting = (el as HTMLElement).dataset.setting as keyof Settings;
    el.classList.toggle('on', (settings as any)[setting]);
  });
  
  popup?.classList.remove('open');
  settingsBg!.classList.add('open');
}

function closeSettingsModal(): void {
  settingsBg?.classList.remove('open');
}

function openModal(editIdx: number | null = null): void {
  if (!popup || !modalBg) return;
  popup.classList.remove('open');
  const isEdit = editIdx !== null;
  const acc = isEdit ? accounts[editIdx!] : null;
  const selColor = acc?.color || COLORS[Math.floor(Math.random() * COLORS.length)];

  modalBg.querySelector('#cas-modal-header')!.textContent = isEdit ? 'Edit Account' : 'Add Account Manually';
  
  modalBg.querySelector('#cas-modal-body')!.innerHTML = `
    <div id="cas-modal-status"></div>
    <div class="cas-info-box">
      <strong>Tip:</strong> The easiest way to add accounts is to simply log into them on Claude.ai - they'll be saved automatically!
    </div>
    <div class="cas-field">
      <label>Name *</label>
      <input type="text" id="cas-f-name" value="${acc?.name || ''}" placeholder="Work Account">
    </div>
    <div class="cas-field">
      <label>Email</label>
      <input type="email" id="cas-f-email" value="${acc?.email || ''}" placeholder="you@company.com">
    </div>
    <div class="cas-field">
      <label>Type</label>
      <select id="cas-f-type">
        <option value="work" ${(acc?.type || 'work') === 'work' ? 'selected' : ''}>Work</option>
        <option value="personal" ${acc?.type === 'personal' ? 'selected' : ''}>Personal</option>
      </select>
    </div>
    <div class="cas-field">
      <label>Color</label>
      <div class="cas-colors">
        ${COLORS.map(c => `<div class="cas-color-opt ${c === selColor ? 'sel' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}
      </div>
    </div>
    <div class="cas-advanced-toggle" id="cas-advanced-toggle">
      ▶ Advanced: Session Key
    </div>
    <div class="cas-advanced-content" id="cas-advanced-content">
      <div class="cas-field">
        <label>Session Key ${isEdit ? '' : '*'}</label>
        <textarea id="cas-f-key" placeholder="sk-ant-sid01-...">${acc?.sessionKey || ''}</textarea>
        <div class="cas-hint">DevTools (F12) → Application/Storage → Cookies → https://claude.ai → Copy 'sessionKey'</div>
      </div>
    </div>
  `;

  // Advanced toggle
  const advToggle = modalBg.querySelector('#cas-advanced-toggle')!;
  const advContent = modalBg.querySelector('#cas-advanced-content')!;
  advToggle.addEventListener('click', () => {
    const isOpen = advContent.classList.toggle('open');
    advToggle.textContent = (isOpen ? '▼' : '▶') + ' Advanced: Session Key';
  });

  let color = selColor;
  modalBg.querySelectorAll('.cas-color-opt').forEach(el => {
    el.addEventListener('click', () => {
      modalBg!.querySelectorAll('.cas-color-opt').forEach(e => e.classList.remove('sel'));
      el.classList.add('sel');
      color = (el as HTMLElement).dataset.c!;
    });
  });

  modalBg.querySelector('#cas-modal-footer')!.innerHTML = `
    <button class="cas-btn cas-btn-cancel">Cancel</button>
    <button class="cas-btn cas-btn-save">Save</button>
  `;

  modalBg.querySelector('.cas-btn-cancel')!.addEventListener('click', closeModal);

  modalBg.querySelector('.cas-btn-save')!.addEventListener('click', async () => {
    const name = (modalBg!.querySelector('#cas-f-name') as HTMLInputElement).value.trim();
    const email = (modalBg!.querySelector('#cas-f-email') as HTMLInputElement).value.trim();
    const type = (modalBg!.querySelector('#cas-f-type') as HTMLSelectElement).value as 'work' | 'personal';
    const sessionKey = (modalBg!.querySelector('#cas-f-key') as HTMLTextAreaElement).value.trim();
    const statusEl = modalBg!.querySelector('#cas-modal-status')!;

    if (!name) {
      statusEl.innerHTML = '<div class="cas-info-box error">Name is required</div>';
      return;
    }
    if (!sessionKey && !isEdit) {
      statusEl.innerHTML = '<div class="cas-info-box error">Session key is required for manual accounts</div>';
      return;
    }
    if (sessionKey && !sessionKey.startsWith('sk-ant-')) {
      statusEl.innerHTML = '<div class="cas-info-box error">Invalid session key format (should start with sk-ant-)</div>';
      return;
    }

    if (isEdit && editIdx !== null) {
      accounts[editIdx] = { ...acc!, name, email, type, color, sessionKey: sessionKey || acc!.sessionKey };
    } else {
      accounts.push({ 
        id: Date.now().toString(36), 
        name, 
        email, 
        type, 
        color, 
        sessionKey, 
        createdAt: new Date().toISOString() 
      });
    }
    await saveAccounts(accounts);
    renderCurrentAccount();
    renderList();
    closeModal();
  });

  modalBg.classList.add('open');
}

function closeModal(): void {
  modalBg?.classList.remove('open');
}

// Alias for editing existing accounts
function openEditModal(idx: number): void {
  openModal(idx);
}

function injectButton(): boolean {
  if (document.getElementById('cas-btn')) return true;

  const btn = document.createElement('button');
  btn.id = 'cas-btn';
  if (sidebarCollapsed) btn.classList.add('sidebar-collapsed');
  btn.title = 'Switch Account (Alt+S)';
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>`;
  btn.addEventListener('click', () => popup?.classList.toggle('open'));

  document.body.appendChild(btn);
  console.log('[CAS] Button injected');
  return true;
}

async function init(): Promise<void> {
  console.log('[CAS] v3.1.0 initializing...');
  
  // Load settings first
  settings = await loadSettings();
  
  // Load saved accounts
  accounts = await loadAccounts();
  
  // Get current session info
  currentSessionKey = await getCurrentSessionKey();
  currentAccount = await fetchCurrentAccountInfo();
  console.log('[CAS] Current account:', currentAccount);
  console.log('[CAS] Session key exists:', !!currentSessionKey);
  
  // Auto-save current account if logged in
  if (currentAccount && currentSessionKey) {
    await autoSaveCurrentAccount();
  }
  
  // Retry email detection after DOM loads (for SPA)
  retryEmailDetection();
  
  // Only show UI on site if setting is enabled
  if (!settings.showOnSite) {
    console.log('[CAS] UI on site disabled via settings');
    return;
  }
  
  injectStyles();
  updateSidebarState();
  createPopup();
  createModal();
  createSettingsModal();
  injectButton();

  const observer = new MutationObserver(() => {
    if (!document.getElementById('cas-popup')) createPopup();
    if (!document.getElementById('cas-modal-bg')) createModal();
    if (!document.getElementById('cas-btn')) injectButton();
    updateSidebarState();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setInterval(updateSidebarState, 1000);

  document.addEventListener('keydown', (e) => {
    if (settings.keyboardShortcut && e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      popup?.classList.toggle('open');
    }
    if (e.key === 'Escape') {
      if (popup?.classList.contains('open')) popup.classList.remove('open');
      if (settingsBg?.classList.contains('open')) settingsBg.classList.remove('open');
    }
  });

  document.addEventListener('click', (e) => {
    if (popup?.classList.contains('open') && 
        !popup.contains(e.target as Node) && 
        !document.getElementById('cas-btn')?.contains(e.target as Node)) {
      popup.classList.remove('open');
    }
  });
}
