// ==UserScript==
// @name         Claude Account Switcher
// @namespace    https://github.com/jms830
// @version      1.2.1
// @description  Gmail-style account switcher for Claude.ai - instantly switch between work and personal accounts
// @match        https://claude.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// @downloadURL  https://github.com/jms830/claude-account-switcher/raw/main/claude-account-switcher.user.js
// @updateURL    https://github.com/jms830/claude-account-switcher/raw/main/claude-account-switcher.user.js
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        storageKey: 'claude_accounts_v2',
        checkInterval: 1000,
    };

    // Inject styles
    GM_addStyle(`
        .account-switcher-trigger {
            position: relative;
            cursor: pointer;
        }

        .account-switcher-badge {
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 14px;
            height: 14px;
            background-color: var(--accent-main-200, #c96442);
            border-radius: 50%;
            border: 2px solid var(--bg-100, #fff);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .account-switcher-badge svg {
            width: 8px;
            height: 8px;
            color: white;
        }

        .account-switcher-menu {
            position: fixed;
            background-color: var(--bg-100, #ffffff);
            border: 1px solid var(--border-300, #e5e5e5);
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
            min-width: 300px;
            max-width: 340px;
            z-index: 10000;
            overflow: hidden;
            opacity: 0;
            transform: translateY(-8px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            pointer-events: none;
        }

        .account-switcher-menu.visible {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }

        .account-switcher-header {
            padding: 16px;
            border-bottom: 1px solid var(--border-300, #e5e5e5);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .account-switcher-header h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-100, #1a1a1a);
        }

        .account-switcher-close {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            color: var(--text-300, #666);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .account-switcher-close:hover {
            background-color: var(--bg-200, #f0f0f0);
        }

        .account-switcher-list {
            max-height: 300px;
            overflow-y: auto;
        }

        .account-switcher-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            cursor: pointer;
            transition: background-color 0.15s ease;
            gap: 12px;
            position: relative;
        }

        .account-switcher-item:hover {
            background-color: var(--bg-200, #f5f5f5);
        }

        .account-switcher-item.active {
            background-color: rgba(201, 100, 66, 0.1);
        }

        .account-switcher-item.active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background-color: var(--accent-main-200, #c96442);
        }

        .account-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
            color: #fff;
            flex-shrink: 0;
        }

        .account-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .account-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-100, #1a1a1a);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .account-email {
            font-size: 12px;
            color: var(--text-300, #666);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .account-type-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
            text-transform: uppercase;
        }

        .account-type-badge.work {
            background-color: #e3f2fd;
            color: #1565c0;
        }

        .account-type-badge.personal {
            background-color: #f3e5f5;
            color: #7b1fa2;
        }

        .account-check {
            color: var(--accent-main-200, #c96442);
            flex-shrink: 0;
        }

        .account-switcher-footer {
            border-top: 1px solid var(--border-300, #e5e5e5);
            padding: 8px;
        }

        .account-switcher-action {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.15s ease;
            color: var(--text-200, #333);
            font-size: 14px;
        }

        .account-switcher-action:hover {
            background-color: var(--bg-200, #f5f5f5);
        }

        .account-switcher-action svg {
            width: 20px;
            height: 20px;
            color: var(--text-300, #666);
        }

        /* Modal styles */
        .account-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        }

        .account-modal-overlay.visible {
            opacity: 1;
            pointer-events: auto;
        }

        .account-modal {
            background-color: var(--bg-100, #ffffff);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            width: 440px;
            max-width: 90vw;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transform: scale(0.95);
            transition: transform 0.2s ease;
        }

        .account-modal-overlay.visible .account-modal {
            transform: scale(1);
        }

        .account-modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border-300, #e5e5e5);
            flex-shrink: 0;
        }

        .account-modal-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--text-100, #1a1a1a);
        }

        .account-modal-body {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }

        .account-form-group {
            margin-bottom: 20px;
        }

        .account-form-group:last-child {
            margin-bottom: 0;
        }

        .account-form-group label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: var(--text-100, #1a1a1a);
            margin-bottom: 8px;
        }

        .account-form-group input,
        .account-form-group select,
        .account-form-group textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border-300, #e5e5e5);
            border-radius: 8px;
            font-size: 14px;
            background-color: var(--bg-100, #ffffff);
            color: var(--text-100, #1a1a1a);
            box-sizing: border-box;
            font-family: inherit;
        }

        .account-form-group textarea {
            font-family: monospace;
            font-size: 12px;
            resize: vertical;
            min-height: 80px;
        }

        .account-form-group input:focus,
        .account-form-group select:focus,
        .account-form-group textarea:focus {
            outline: none;
            border-color: var(--accent-main-200, #c96442);
            box-shadow: 0 0 0 3px rgba(201, 100, 66, 0.1);
        }

        .account-form-hint {
            font-size: 12px;
            color: var(--text-300, #666);
            margin-top: 6px;
        }

        .account-form-hint a {
            color: var(--accent-main-200, #c96442);
        }

        .account-modal-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border-300, #e5e5e5);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            flex-shrink: 0;
        }

        .account-btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            border: none;
        }

        .account-btn-secondary {
            background-color: var(--bg-200, #f5f5f5);
            border: 1px solid var(--border-300, #e5e5e5);
            color: var(--text-100, #1a1a1a);
        }

        .account-btn-secondary:hover {
            background-color: var(--bg-300, #e5e5e5);
        }

        .account-btn-primary {
            background-color: var(--accent-main-200, #c96442);
            color: #ffffff;
        }

        .account-btn-primary:hover {
            background-color: #b85a3a;
        }

        .account-btn-danger {
            background-color: #dc3545;
            color: #ffffff;
        }

        .account-btn-danger:hover {
            background-color: #c82333;
        }

        .account-color-picker {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .account-color-option {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent;
            transition: transform 0.15s ease, border-color 0.15s ease;
        }

        .account-color-option:hover {
            transform: scale(1.1);
        }

        .account-color-option.selected {
            border-color: var(--text-100, #1a1a1a);
        }

        .info-box {
            background-color: #fff8e1;
            border: 1px solid #ffcc80;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
        }

        .info-box p {
            margin: 0;
            color: #e65100;
            font-size: 13px;
            line-height: 1.5;
        }

        .info-box code {
            background-color: rgba(0,0,0,0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
        }
    `);

    // Avatar colors
    const AVATAR_COLORS = [
        '#c96442', '#e57373', '#f06292', '#ba68c8', '#9575cd',
        '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac',
        '#81c784', '#aed581', '#dce775', '#fff176', '#ffd54f',
        '#ffb74d', '#ff8a65', '#a1887f', '#90a4ae', '#78909c'
    ];

    class AccountSwitcher {
        constructor() {
            this.accounts = this.loadAccounts();
            this.menuVisible = false;
            this.menu = null;
            this.init();
        }

        loadAccounts() {
            return GM_getValue(CONFIG.storageKey, []);
        }

        saveAccounts() {
            GM_setValue(CONFIG.storageKey, this.accounts);
        }

        setSessionCookie(sessionKey) {
            document.cookie = `sessionKey=${sessionKey}; path=/; domain=.claude.ai; secure; samesite=lax`;
        }

        generateId() {
            return 'acc_' + Math.random().toString(36).substr(2, 9);
        }

        getInitials(name) {
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }

        init() {
            this.createMenu();
            this.waitForElement();
        }

        waitForElement() {
            const check = () => {
                // Target the user menu button specifically
                const userMenuButton = document.querySelector('[data-testid="user-menu-button"]');
                
                if (userMenuButton && !userMenuButton.dataset.accountSwitcherAttached) {
                    this.attachToAvatar(userMenuButton);
                }
            };

            // Run immediately
            check();
            
            // Also run after a short delay to catch late-loading elements
            setTimeout(check, 500);
            setTimeout(check, 1500);
            setTimeout(check, 3000);
            
            // Keep checking periodically
            setInterval(check, CONFIG.checkInterval);

            // Watch for DOM changes
            const observer = new MutationObserver(check);
            observer.observe(document.body, { childList: true, subtree: true });
        }

        attachToAvatar(button) {
            // Mark as attached using both old and new attribute names for compatibility
            button.dataset.accountSwitcherAttached = 'true';
            button.dataset.accountSwitcher = 'true';
            button.classList.add('account-switcher-trigger');

            console.log('[Account Switcher] Attached to button:', button);

            // Add visual badge if not already present
            if (!button.querySelector('.account-switcher-badge')) {
                const badge = document.createElement('div');
                badge.className = 'account-switcher-badge';
                badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>`;
                button.style.position = 'relative';
                button.appendChild(badge);
            }

            // Intercept clicks - use capture phase to intercept before other handlers
            button.addEventListener('click', (e) => {
                console.log('[Account Switcher] Click intercepted');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.toggleMenu(button);
                return false;
            }, true);
        }

        createMenu() {
            this.menu = document.createElement('div');
            this.menu.className = 'account-switcher-menu';
            document.body.appendChild(this.menu);

            document.addEventListener('click', (e) => {
                if (this.menuVisible && !this.menu.contains(e.target) && !e.target.closest('.account-switcher-trigger')) {
                    this.hideMenu();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.menuVisible) {
                    this.hideMenu();
                }
            });
        }

        updateMenuContent() {
            const hasAccounts = this.accounts.length > 0;

            this.menu.innerHTML = `
                <div class="account-switcher-header">
                    <h3>Switch Account</h3>
                    <button class="account-switcher-close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <div class="account-switcher-list">
                    ${!hasAccounts ? `
                        <div style="padding: 24px 16px; text-align: center; color: var(--text-300, #666);">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            <p style="margin: 0 0 8px 0; font-weight: 500;">No accounts saved</p>
                            <p style="margin: 0; font-size: 13px;">Add your accounts to switch between them instantly</p>
                        </div>
                    ` : this.accounts.map((account, index) => `
                        <div class="account-switcher-item" data-account-index="${index}">
                            <div class="account-avatar" style="background-color: ${account.color}">
                                ${this.getInitials(account.name)}
                            </div>
                            <div class="account-info">
                                <div class="account-name">${account.name}</div>
                                <div class="account-email">${account.email || 'No email'}</div>
                            </div>
                            <span class="account-type-badge ${account.type}">${account.type}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="account-switcher-footer">
                    <div class="account-switcher-action" data-action="add">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v8M8 12h8"/>
                        </svg>
                        Add account
                    </div>
                    ${hasAccounts ? `
                        <div class="account-switcher-action" data-action="manage">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                            Manage accounts
                        </div>
                    ` : ''}
                </div>
            `;

            // Event listeners
            this.menu.querySelector('.account-switcher-close').addEventListener('click', () => this.hideMenu());

            this.menu.querySelectorAll('.account-switcher-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.accountIndex);
                    this.switchToAccount(index);
                });
            });

            this.menu.querySelector('[data-action="add"]')?.addEventListener('click', () => {
                this.hideMenu();
                this.showAddAccountModal();
            });

            this.menu.querySelector('[data-action="manage"]')?.addEventListener('click', () => {
                this.hideMenu();
                this.showManageAccountsModal();
            });
        }

        toggleMenu(trigger) {
            if (this.menuVisible) {
                this.hideMenu();
            } else {
                this.showMenu(trigger);
            }
        }

        showMenu(trigger) {
            const rect = trigger.getBoundingClientRect();
            const menuWidth = 320;

            let left = rect.left;
            let top = rect.bottom + 8;

            if (left + menuWidth > window.innerWidth) {
                left = window.innerWidth - menuWidth - 16;
            }
            if (left < 16) left = 16;

            this.menu.style.left = `${left}px`;
            this.menu.style.top = `${top}px`;

            this.updateMenuContent();
            this.menu.classList.add('visible');
            this.menuVisible = true;
        }

        hideMenu() {
            this.menu.classList.remove('visible');
            this.menuVisible = false;
        }

        switchToAccount(index) {
            const account = this.accounts[index];
            if (!account || !account.sessionKey) {
                alert('No session key for this account');
                return;
            }

            this.hideMenu();
            this.setSessionCookie(account.sessionKey);
            window.location.reload();
        }

        showAddAccountModal(editAccount = null, editIndex = null) {
            const isEdit = editAccount !== null;
            const overlay = document.createElement('div');
            overlay.className = 'account-modal-overlay';

            const selectedColor = editAccount?.color || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

            overlay.innerHTML = `
                <div class="account-modal">
                    <div class="account-modal-header">
                        <h2>${isEdit ? 'Edit Account' : 'Add Account'}</h2>
                    </div>
                    <div class="account-modal-body">
                        ${!isEdit ? `
                            <div class="info-box">
                                <p>
                                    <strong>How to get your session key:</strong><br>
                                    1. Open DevTools (F12) → Application tab<br>
                                    2. Under Cookies → claude.ai, find <code>sessionKey</code><br>
                                    3. Copy the value (starts with <code>sk-ant-</code>)
                                </p>
                            </div>
                        ` : ''}
                        
                        <div class="account-form-group">
                            <label>Display Name *</label>
                            <input type="text" id="account-name" placeholder="e.g., Work Account" value="${editAccount?.name || ''}">
                        </div>
                        
                        <div class="account-form-group">
                            <label>Email (optional)</label>
                            <input type="email" id="account-email" placeholder="e.g., john@company.com" value="${editAccount?.email || ''}">
                            <div class="account-form-hint">Just for your reference to identify the account</div>
                        </div>
                        
                        <div class="account-form-group">
                            <label>Account Type</label>
                            <select id="account-type">
                                <option value="work" ${editAccount?.type === 'work' ? 'selected' : ''}>Work</option>
                                <option value="personal" ${editAccount?.type === 'personal' ? 'selected' : ''}>Personal</option>
                            </select>
                        </div>
                        
                        <div class="account-form-group">
                            <label>Session Key *</label>
                            <textarea id="account-session" placeholder="sk-ant-sid01-..." ${isEdit ? 'readonly style="opacity: 0.7; cursor: not-allowed;"' : ''}>${editAccount?.sessionKey || ''}</textarea>
                            ${isEdit ? 
                                '<div class="account-form-hint">Session keys cannot be edited. Delete and re-add to change.</div>' :
                                '<div class="account-form-hint">Get this from DevTools → Application → Cookies → sessionKey</div>'
                            }
                        </div>
                        
                        <div class="account-form-group">
                            <label>Avatar Color</label>
                            <div class="account-color-picker">
                                ${AVATAR_COLORS.map(color => `
                                    <div class="account-color-option ${color === selectedColor ? 'selected' : ''}" 
                                         data-color="${color}" 
                                         style="background-color: ${color}">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="account-modal-footer">
                        ${isEdit ? `<button class="account-btn account-btn-danger" data-action="delete" style="margin-right: auto;">Delete</button>` : ''}
                        <button class="account-btn account-btn-secondary" data-action="cancel">Cancel</button>
                        <button class="account-btn account-btn-primary" data-action="save">${isEdit ? 'Save' : 'Add Account'}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            let currentColor = selectedColor;

            // Color picker
            overlay.querySelectorAll('.account-color-option').forEach(option => {
                option.addEventListener('click', () => {
                    overlay.querySelectorAll('.account-color-option').forEach(o => o.classList.remove('selected'));
                    option.classList.add('selected');
                    currentColor = option.dataset.color;
                });
            });

            const closeModal = () => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 200);
            };

            overlay.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);

            overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
                const name = overlay.querySelector('#account-name').value.trim();
                const email = overlay.querySelector('#account-email').value.trim();
                const type = overlay.querySelector('#account-type').value;
                const sessionKey = overlay.querySelector('#account-session').value.trim();

                if (!name) {
                    alert('Please enter a display name');
                    return;
                }

                if (!isEdit && !sessionKey) {
                    alert('Please enter a session key');
                    return;
                }

                if (!isEdit && !sessionKey.startsWith('sk-ant-')) {
                    alert('Invalid session key format. It should start with "sk-ant-"');
                    return;
                }

                if (isEdit) {
                    this.accounts[editIndex] = {
                        ...editAccount,
                        name,
                        email,
                        type,
                        color: currentColor
                    };
                } else {
                    this.accounts.push({
                        id: this.generateId(),
                        name,
                        email,
                        type,
                        color: currentColor,
                        sessionKey,
                        createdAt: new Date().toISOString()
                    });
                }

                this.saveAccounts();
                closeModal();
            });

            if (isEdit) {
                overlay.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    if (confirm(`Delete "${editAccount.name}"? This cannot be undone.`)) {
                        this.accounts.splice(editIndex, 1);
                        this.saveAccounts();
                        closeModal();
                    }
                });
            }

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        }

        showManageAccountsModal() {
            const overlay = document.createElement('div');
            overlay.className = 'account-modal-overlay';

            overlay.innerHTML = `
                <div class="account-modal">
                    <div class="account-modal-header">
                        <h2>Manage Accounts</h2>
                    </div>
                    <div class="account-modal-body" style="padding: 0;">
                        ${this.accounts.length === 0 ? `
                            <div style="padding: 32px; text-align: center; color: var(--text-300, #666);">
                                <p style="margin: 0;">No accounts saved yet</p>
                            </div>
                        ` : `
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${this.accounts.map((account, index) => `
                                    <div class="account-switcher-item" data-account-index="${index}" style="cursor: pointer;">
                                        <div class="account-avatar" style="background-color: ${account.color}">
                                            ${this.getInitials(account.name)}
                                        </div>
                                        <div class="account-info">
                                            <div class="account-name">${account.name}</div>
                                            <div class="account-email">${account.email || 'No email'}</div>
                                        </div>
                                        <span class="account-type-badge ${account.type}">${account.type}</span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-300, #666); flex-shrink: 0;">
                                            <polyline points="9 18 15 12 9 6"/>
                                        </svg>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                    <div class="account-modal-footer">
                        <button class="account-btn account-btn-secondary" data-action="close">Close</button>
                        <button class="account-btn account-btn-primary" data-action="add">Add Account</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            const closeModal = () => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 200);
            };

            overlay.querySelector('[data-action="close"]').addEventListener('click', closeModal);
            
            overlay.querySelector('[data-action="add"]').addEventListener('click', () => {
                closeModal();
                setTimeout(() => this.showAddAccountModal(), 250);
            });

            overlay.querySelectorAll('.account-switcher-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.accountIndex);
                    const account = this.accounts[index];
                    closeModal();
                    setTimeout(() => this.showAddAccountModal(account, index), 250);
                });
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        }
    }

    // Initialize
    console.log('[Account Switcher] Script loaded, version 1.2.1');
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[Account Switcher] DOM ready, initializing...');
            new AccountSwitcher();
        });
    } else {
        console.log('[Account Switcher] DOM already ready, initializing...');
        new AccountSwitcher();
    }
})();
