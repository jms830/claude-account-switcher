// ==UserScript==
// @name         Claude Account Switcher
// @namespace    https://github.com/jms830
// @version      3.0.0
// @description  Gmail-style account switcher for Claude.ai with auto-detection
// @match        https://claude.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api.claude.ai
// @run-at       document-end
// @license      MIT
// @downloadURL  https://github.com/jms830/claude-account-switcher/raw/main/claude-account-switcher.user.js
// @updateURL    https://github.com/jms830/claude-account-switcher/raw/main/claude-account-switcher.user.js
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'claude_accounts_v3';
    const COLORS = ['#c96442','#e57373','#f06292','#ba68c8','#9575cd','#7986cb','#64b5f6','#4fc3f7','#4db6ac','#81c784'];
    const SIDEBAR_EXPANDED_WIDTH = 220;
    const SIDEBAR_COLLAPSED_WIDTH = 16;

    let accounts = [];
    let currentAccount = null;
    let popup = null;
    let modalBg = null;
    let sidebarCollapsed = false;

    // Load/save accounts
    function loadAccounts() {
        return GM_getValue(STORAGE_KEY, []);
    }
    function saveAccounts(accs) {
        GM_setValue(STORAGE_KEY, accs);
        accounts = accs;
    }

    // Inject CSS
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

        /* Current account section */
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
        #cas-current-info {
            flex: 1;
            min-width: 0;
        }
        #cas-current-name {
            font-size: 14px;
            font-weight: 500;
            color: #f5f4ef;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        #cas-current-email {
            font-size: 11px;
            color: #888;
        }
        #cas-current-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(72,187,120,0.2);
            color: #48bb78;
        }
        #cas-current-status.unsaved {
            background: rgba(255,193,7,0.2);
            color: #ffc107;
        }

        #cas-list {
            max-height: 200px;
            overflow-y: auto;
        }
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
        }
        .cas-item:last-child { border-bottom: none; }
        .cas-item:hover { background: #2a2a28; }
        .cas-item.active { background: rgba(201,100,66,0.15); }
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
        .cas-item-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #888;
            flex-shrink: 0;
        }
        .cas-item-status.valid { background: #48bb78; }
        .cas-item-status.invalid { background: #e53e3e; }
        .cas-item-status.checking { background: #888; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

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

        #cas-actions {
            padding: 12px 16px;
            display: flex;
            gap: 8px;
        }
        #cas-add-btn, #cas-save-current-btn {
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
        #cas-add-btn:hover, #cas-save-current-btn:hover {
            border-color: #c96442;
            color: #c96442;
            background: rgba(201,100,66,0.1);
        }
        #cas-save-current-btn {
            border-style: solid;
            background: rgba(201,100,66,0.1);
            color: #c96442;
            border-color: #c96442;
        }
        .cas-empty {
            padding: 24px 16px;
            text-align: center;
            color: #888;
            font-size: 13px;
        }

        /* Modal */
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
        .cas-hint {
            font-size: 10px;
            color: #666;
            margin-top: 4px;
        }
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
        .cas-info-box code {
            background: rgba(255,255,255,0.1);
            padding: 1px 4px;
            border-radius: 3px;
        }
        .cas-btn {
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            border: none;
        }
        .cas-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .cas-btn-cancel { background: #3f3f3c; color: #f5f4ef; }
        .cas-btn-cancel:hover:not(:disabled) { background: #4a4a47; }
        .cas-btn-save { background: #c96442; color: #fff; }
        .cas-btn-save:hover:not(:disabled) { background: #b85a3a; }
        .cas-btn-delete { background: #dc3545; color: #fff; margin-right: auto; }
        .cas-btn-delete:hover:not(:disabled) { background: #c82333; }
        .cas-btn-test { background: #3f3f3c; color: #f5f4ef; }
        .cas-btn-test:hover:not(:disabled) { background: #4a4a47; }
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
    `;
    document.head.appendChild(style);

    // Fetch current account info from /api/account
    async function fetchCurrentAccountInfo() {
        try {
            const response = await fetch('/api/account');
            if (!response.ok) throw new Error('Failed to fetch account');
            const data = await response.json();
            console.log('[CAS] Account data:', data);
            return {
                name: data.name || data.full_name || 'Unknown',
                email: data.email || data.email_address || '',
                uuid: data.uuid || data.id || ''
            };
        } catch (e) {
            console.error('[CAS] Error fetching account:', e);
            return null;
        }
    }

    // Validate a session key by calling /api/organizations
    function validateSessionKey(sessionKey) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://api.claude.ai/api/organizations',
                headers: {
                    'accept': 'application/json',
                    'cookie': `sessionKey=${sessionKey}`,
                },
                onload: (response) => {
                    try {
                        if (response.status !== 200) {
                            resolve({ valid: false, error: `HTTP ${response.status}` });
                            return;
                        }
                        const text = response.responseText;
                        if (text.toLowerCase().includes('unauthorized')) {
                            resolve({ valid: false, error: 'Unauthorized' });
                            return;
                        }
                        const orgs = JSON.parse(text);
                        if (orgs && orgs.length > 0) {
                            resolve({ valid: true, orgs });
                        } else {
                            resolve({ valid: false, error: 'No organizations' });
                        }
                    } catch (e) {
                        resolve({ valid: false, error: 'Parse error' });
                    }
                },
                onerror: () => resolve({ valid: false, error: 'Network error' }),
                ontimeout: () => resolve({ valid: false, error: 'Timeout' })
            });
        });
    }

    // Check if sidebar is collapsed
    function checkSidebarState() {
        // Claude's sidebar has data-is-collapsed or similar, or we detect by width
        const sidebar = document.querySelector('[class*="sidebar"]') || 
                       document.querySelector('nav') ||
                       document.querySelector('[data-sidebar]');
        
        if (sidebar) {
            const rect = sidebar.getBoundingClientRect();
            return rect.width < 100;
        }
        
        // Fallback: check for collapsed class patterns
        const collapsed = document.querySelector('[class*="collapsed"]') ||
                         document.querySelector('[data-collapsed="true"]');
        return !!collapsed;
    }

    function updateSidebarState() {
        const collapsed = checkSidebarState();
        if (collapsed !== sidebarCollapsed) {
            sidebarCollapsed = collapsed;
            const btn = document.getElementById('cas-btn');
            const popup = document.getElementById('cas-popup');
            if (btn) btn.classList.toggle('sidebar-collapsed', collapsed);
            if (popup) popup.classList.toggle('sidebar-collapsed', collapsed);
            console.log('[CAS] Sidebar collapsed:', collapsed);
        }
    }

    // Check if current session matches a saved account
    function findCurrentAccountInSaved() {
        if (!currentAccount) return -1;
        return accounts.findIndex(a => 
            a.email && currentAccount.email && 
            a.email.toLowerCase() === currentAccount.email.toLowerCase()
        );
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    // Create popup
    function createPopup() {
        const old = document.getElementById('cas-popup');
        if (old) old.remove();

        popup = document.createElement('div');
        popup.id = 'cas-popup';
        if (sidebarCollapsed) popup.classList.add('sidebar-collapsed');
        
        popup.innerHTML = `
            <div id="cas-popup-header">
                <span>Switch Account</span>
                <button id="cas-popup-close">&times;</button>
            </div>
            <div id="cas-current"></div>
            <div id="cas-list-label">Other Accounts</div>
            <div id="cas-list"></div>
            <div id="cas-actions"></div>
        `;
        document.body.appendChild(popup);

        popup.querySelector('#cas-popup-close').onclick = () => popup.classList.remove('open');
        
        renderCurrentAccount();
        renderList();
        renderActions();
    }

    function renderCurrentAccount() {
        const container = popup.querySelector('#cas-current');
        const savedIdx = findCurrentAccountInSaved();
        const isSaved = savedIdx !== -1;
        const acc = currentAccount || { name: 'Loading...', email: '' };
        const color = isSaved ? accounts[savedIdx].color : COLORS[0];

        container.innerHTML = `
            <div id="cas-current-label">Current Session</div>
            <div id="cas-current-account">
                <div class="cas-avatar" style="background:${color}">${getInitials(acc.name)}</div>
                <div id="cas-current-info">
                    <div id="cas-current-name">${acc.name}</div>
                    <div id="cas-current-email">${acc.email || 'No email'}</div>
                </div>
                <span id="cas-current-status" class="${isSaved ? '' : 'unsaved'}">${isSaved ? 'Saved' : 'Not Saved'}</span>
            </div>
        `;
    }

    function renderList() {
        const list = popup.querySelector('#cas-list');
        const label = popup.querySelector('#cas-list-label');
        const currentIdx = findCurrentAccountInSaved();
        
        // Filter out current account from list
        const otherAccounts = accounts.filter((_, i) => i !== currentIdx);
        
        if (otherAccounts.length === 0) {
            label.style.display = 'none';
            list.innerHTML = '';
            return;
        }
        
        label.style.display = 'block';
        list.innerHTML = otherAccounts.map((a, displayIdx) => {
            const realIdx = accounts.indexOf(a);
            return `
                <div class="cas-item" data-i="${realIdx}">
                    <div class="cas-avatar" style="background:${a.color}">${getInitials(a.name)}</div>
                    <div class="cas-item-info">
                        <div class="cas-item-name">${a.name}</div>
                        <div class="cas-item-email">${a.email || ''}</div>
                    </div>
                    <div class="cas-item-status ${a.validated ? 'valid' : ''}" title="${a.validated ? 'Valid' : 'Not validated'}"></div>
                    <span class="cas-item-badge ${a.type || 'work'}">${a.type || 'work'}</span>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.cas-item').forEach(el => {
            el.onclick = (e) => {
                if (e.shiftKey) {
                    openModal(parseInt(el.dataset.i));
                } else {
                    switchTo(parseInt(el.dataset.i));
                }
            };
        });
    }

    function renderActions() {
        const container = popup.querySelector('#cas-actions');
        const isSaved = findCurrentAccountInSaved() !== -1;
        
        container.innerHTML = `
            ${!isSaved && currentAccount ? `<button id="cas-save-current-btn">Save Current</button>` : ''}
            <button id="cas-add-btn">+ Add Account</button>
        `;
        
        const saveBtn = container.querySelector('#cas-save-current-btn');
        if (saveBtn) {
            saveBtn.onclick = () => openModal(null, true); // true = prefill current
        }
        
        container.querySelector('#cas-add-btn').onclick = () => openModal();
    }

    function switchTo(i) {
        const acc = accounts[i];
        if (!acc?.sessionKey) {
            alert('No session key. Shift+click to edit.');
            return;
        }
        document.cookie = `sessionKey=${acc.sessionKey}; path=/; domain=.claude.ai; secure; samesite=lax`;
        location.reload();
    }

    // Modal
    function createModal() {
        const old = document.getElementById('cas-modal-bg');
        if (old) old.remove();

        modalBg = document.createElement('div');
        modalBg.id = 'cas-modal-bg';
        modalBg.innerHTML = `
            <div id="cas-modal">
                <div id="cas-modal-header">Add Account</div>
                <div id="cas-modal-body"></div>
                <div id="cas-modal-footer"></div>
            </div>
        `;
        document.body.appendChild(modalBg);
        modalBg.onclick = (e) => { if (e.target === modalBg) closeModal(); };
    }

    function openModal(editIdx = null, prefillCurrent = false) {
        popup.classList.remove('open');
        const isEdit = editIdx !== null;
        const acc = isEdit ? accounts[editIdx] : null;
        
        // For new accounts, optionally prefill with current session info
        const prefill = prefillCurrent && currentAccount ? currentAccount : null;
        const selColor = acc?.color || prefill?.color || COLORS[Math.floor(Math.random() * COLORS.length)];

        modalBg.querySelector('#cas-modal-header').textContent = isEdit ? 'Edit Account' : (prefillCurrent ? 'Save Current Account' : 'Add Account');
        
        const showKeyInstructions = !isEdit && !prefillCurrent;
        
        modalBg.querySelector('#cas-modal-body').innerHTML = `
            <div id="cas-modal-status"></div>
            ${showKeyInstructions ? `<div class="cas-info-box">
                <strong>To get session key:</strong><br>
                DevTools (F12) &rarr; Application &rarr; Cookies &rarr; claude.ai &rarr; <code>sessionKey</code>
            </div>` : ''}
            ${prefillCurrent ? `<div class="cas-info-box success">
                Auto-detected from current session. Just paste your session key to save!
            </div>` : ''}
            <div class="cas-field">
                <label>Name *</label>
                <input type="text" id="cas-f-name" value="${acc?.name || prefill?.name || ''}" placeholder="Work Account">
            </div>
            <div class="cas-field">
                <label>Email</label>
                <input type="email" id="cas-f-email" value="${acc?.email || prefill?.email || ''}" placeholder="you@company.com">
            </div>
            <div class="cas-field">
                <label>Type</label>
                <select id="cas-f-type">
                    <option value="work" ${(acc?.type || 'work') === 'work' ? 'selected' : ''}>Work</option>
                    <option value="personal" ${acc?.type === 'personal' ? 'selected' : ''}>Personal</option>
                </select>
            </div>
            <div class="cas-field">
                <label>Session Key *</label>
                <textarea id="cas-f-key" placeholder="sk-ant-sid01-...">${acc?.sessionKey || ''}</textarea>
                <div class="cas-hint">Starts with sk-ant-sid</div>
            </div>
            <div class="cas-field">
                <label>Color</label>
                <div class="cas-colors">
                    ${COLORS.map(c => `<div class="cas-color-opt ${c === selColor ? 'sel' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}
                </div>
            </div>
        `;

        let color = selColor;
        modalBg.querySelectorAll('.cas-color-opt').forEach(el => {
            el.onclick = () => {
                modalBg.querySelectorAll('.cas-color-opt').forEach(e => e.classList.remove('sel'));
                el.classList.add('sel');
                color = el.dataset.c;
            };
        });

        modalBg.querySelector('#cas-modal-footer').innerHTML = `
            ${isEdit ? '<button class="cas-btn cas-btn-delete">Delete</button>' : ''}
            <button class="cas-btn cas-btn-test">Test Key</button>
            <button class="cas-btn cas-btn-cancel">Cancel</button>
            <button class="cas-btn cas-btn-save">Save</button>
        `;

        modalBg.querySelector('.cas-btn-cancel').onclick = closeModal;
        
        // Test button
        modalBg.querySelector('.cas-btn-test').onclick = async () => {
            const key = modalBg.querySelector('#cas-f-key').value.trim();
            const statusEl = modalBg.querySelector('#cas-modal-status');
            
            if (!key) {
                statusEl.innerHTML = '<div class="cas-info-box error">Please enter a session key first</div>';
                return;
            }
            
            statusEl.innerHTML = '<div class="cas-info-box">Testing session key...</div>';
            const result = await validateSessionKey(key);
            
            if (result.valid) {
                statusEl.innerHTML = '<div class="cas-info-box success">Session key is valid!</div>';
            } else {
                statusEl.innerHTML = `<div class="cas-info-box error">Invalid session key: ${result.error}</div>`;
            }
        };

        // Save button
        modalBg.querySelector('.cas-btn-save').onclick = async () => {
            const name = modalBg.querySelector('#cas-f-name').value.trim();
            const email = modalBg.querySelector('#cas-f-email').value.trim();
            const type = modalBg.querySelector('#cas-f-type').value;
            const sessionKey = modalBg.querySelector('#cas-f-key').value.trim();
            const statusEl = modalBg.querySelector('#cas-modal-status');

            if (!name) {
                statusEl.innerHTML = '<div class="cas-info-box error">Name is required</div>';
                return;
            }
            if (!sessionKey && !isEdit) {
                statusEl.innerHTML = '<div class="cas-info-box error">Session key is required</div>';
                return;
            }
            if (sessionKey && !sessionKey.startsWith('sk-ant-')) {
                statusEl.innerHTML = '<div class="cas-info-box error">Invalid session key format (should start with sk-ant-)</div>';
                return;
            }

            // Validate before saving if new key
            let validated = acc?.validated || false;
            if (sessionKey && sessionKey !== acc?.sessionKey) {
                statusEl.innerHTML = '<div class="cas-info-box">Validating session key...</div>';
                const result = await validateSessionKey(sessionKey);
                validated = result.valid;
                if (!validated) {
                    statusEl.innerHTML = `<div class="cas-info-box error">Invalid session key: ${result.error}. Save anyway?</div>`;
                    // Still allow saving but mark as not validated
                }
            }

            if (isEdit) {
                accounts[editIdx] = { ...acc, name, email, type, color, sessionKey: sessionKey || acc.sessionKey, validated };
            } else {
                accounts.push({ 
                    id: Date.now().toString(36), 
                    name, 
                    email, 
                    type, 
                    color, 
                    sessionKey, 
                    validated,
                    createdAt: new Date().toISOString() 
                });
            }
            saveAccounts(accounts);
            renderCurrentAccount();
            renderList();
            renderActions();
            closeModal();
        };

        if (isEdit) {
            modalBg.querySelector('.cas-btn-delete').onclick = () => {
                if (confirm(`Delete "${acc.name}"?`)) {
                    accounts.splice(editIdx, 1);
                    saveAccounts(accounts);
                    renderCurrentAccount();
                    renderList();
                    renderActions();
                    closeModal();
                }
            };
        }

        modalBg.classList.add('open');
    }

    function closeModal() {
        modalBg.classList.remove('open');
    }

    // Inject floating button
    function injectButton() {
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
        btn.onclick = () => popup.classList.toggle('open');

        document.body.appendChild(btn);
        console.log('[CAS] Button injected');
        return true;
    }

    // Initialize
    async function init() {
        console.log('[CAS] v3.0.0 initializing...');
        
        accounts = loadAccounts();
        
        // Fetch current account info
        currentAccount = await fetchCurrentAccountInfo();
        console.log('[CAS] Current account:', currentAccount);
        
        // Check initial sidebar state
        updateSidebarState();
        
        createPopup();
        createModal();
        injectButton();

        // Watch for DOM changes (SPA navigation)
        const observer = new MutationObserver(() => {
            if (!document.getElementById('cas-popup')) createPopup();
            if (!document.getElementById('cas-modal-bg')) createModal();
            if (!document.getElementById('cas-btn')) injectButton();
            updateSidebarState();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Also poll for sidebar changes (backup)
        setInterval(updateSidebarState, 1000);

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                popup.classList.toggle('open');
            }
            if (e.key === 'Escape' && popup.classList.contains('open')) {
                popup.classList.remove('open');
            }
        });

        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (popup.classList.contains('open') && 
                !popup.contains(e.target) && 
                !document.getElementById('cas-btn').contains(e.target)) {
                popup.classList.remove('open');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
