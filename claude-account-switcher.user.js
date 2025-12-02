// ==UserScript==
// @name         Claude Account Switcher
// @namespace    https://github.com/jordan
// @version      1.1.0
// @description  Gmail-style account switcher for Claude.ai - instantly switch between work and personal accounts
// @match        https://claude.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_cookie
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        storageKey: 'claude_accounts_v2',
        checkInterval: 1000,
        sessionCookieName: 'sessionKey',
    };

    // Inject styles
    GM_addStyle(`
        .account-switcher-trigger {
            position: relative;
            cursor: pointer;
        }

        .account-switcher-trigger::after {
            content: '';
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 12px;
            height: 12px;
            background-color: var(--bg-100, #f5f4ef);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .account-switcher-trigger::before {
            content: '';
            position: absolute;
            bottom: 0;
            right: 0;
            width: 8px;
            height: 8px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-size: contain;
            background-repeat: no-repeat;
            z-index: 1;
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
            background-color: var(--accent-main-100, #f0e6e4);
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

        .account-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
            text-transform: uppercase;
        }

        .account-badge.work {
            background-color: #e3f2fd;
            color: #1565c0;
        }

        .account-badge.personal {
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

        .account-switcher-current {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-300, #e5e5e5);
            background-color: var(--bg-200, #f9f9f9);
        }

        .account-switcher-current-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--text-300, #666);
            margin-bottom: 8px;
            font-weight: 500;
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
            width: 420px;
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
        .account-form-group select {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border-300, #e5e5e5);
            border-radius: 8px;
            font-size: 14px;
            background-color: var(--bg-100, #ffffff);
            color: var(--text-100, #1a1a1a);
            box-sizing: border-box;
        }

        .account-form-group input:focus,
        .account-form-group select:focus {
            outline: none;
            border-color: var(--accent-main-200, #c96442);
            box-shadow: 0 0 0 3px rgba(201, 100, 66, 0.1);
        }

        .account-form-hint {
            font-size: 12px;
            color: var(--text-300, #666);
            margin-top: 6px;
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
            width: 32px;
            height: 32px;
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

        .capture-session-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background-color: #e8f5e9;
            border: 1px dashed #4caf50;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s ease;
            width: 100%;
            justify-content: center;
            color: #2e7d32;
            font-weight: 500;
        }

        .capture-session-btn:hover {
            background-color: #c8e6c9;
        }

        .session-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            margin-top: 8px;
        }

        .session-status.valid {
            color: #2e7d32;
        }

        .session-status.invalid {
            color: #c62828;
        }

        .session-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .session-status-dot.valid {
            background-color: #4caf50;
        }

        .session-status-dot.invalid {
            background-color: #f44336;
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
            this.currentSessionKey = this.getCurrentSessionKey();
            this.init();
        }

        loadAccounts() {
            return GM_getValue(CONFIG.storageKey, []);
        }

        saveAccounts() {
            GM_setValue(CONFIG.storageKey, this.accounts);
        }

        getCurrentSessionKey() {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === CONFIG.sessionCookieName) {
                    return value;
                }
            }
            return null;
        }

        setSessionCookie(sessionKey) {
            // Set the session cookie
            document.cookie = `${CONFIG.sessionCookieName}=${sessionKey}; path=/; domain=.claude.ai; secure; samesite=lax`;
        }

        getActiveAccount() {
            const currentKey = this.getCurrentSessionKey();
            return this.accounts.find(a => a.sessionKey === currentKey);
        }

        generateId() {
            return 'acc_' + Math.random().toString(36).substr(2, 9);
        }

        getInitials(name) {
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }

        init() {
            this.waitForElement();
        }

        waitForElement() {
            const check = () => {
                // Look for the user avatar/profile button in the sidebar
                // Try multiple selectors to find the avatar
                const avatarSelectors = [
                    '[data-testid="user-menu-button"]',
                    'button[aria-label*="Account"]',
                    'button[aria-label*="Profile"]',
                    // The avatar div from your HTML sample
                    '.flex.items-center.justify-center.rounded-full.text-text-200',
                    // Look for the initials avatar
                    '.rounded-full.font-bold.select-none.bg-text-200'
                ];

                let avatarElement = null;
                for (const selector of avatarSelectors) {
                    avatarElement = document.querySelector(selector);
                    if (avatarElement) break;
                }

                if (avatarElement && !avatarElement.dataset.accountSwitcher) {
                    this.attachToAvatar(avatarElement);
                }
            };

            check();
            setInterval(check, CONFIG.checkInterval);

            const observer = new MutationObserver(check);
            observer.observe(document.body, { childList: true, subtree: true });
        }

        attachToAvatar(avatarElement) {
            // Find the clickable parent
            let targetElement = avatarElement.closest('button') || 
                               avatarElement.closest('[role="button"]') || 
                               avatarElement.closest('a') ||
                               avatarElement;

            if (targetElement.dataset.accountSwitcher) return;
            targetElement.dataset.accountSwitcher = 'true';

            // Add visual indicator
            targetElement.classList.add('account-switcher-trigger');

            // Create click handler
            targetElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMenu(targetElement);
            }, true);

            this.createMenu();
        }

        createMenu() {
            if (this.menu) {
                this.menu.remove();
            }

            this.menu = document.createElement('div');
            this.menu.className = 'account-switcher-menu';
            this.updateMenuContent();
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
            const activeAccount = this.getActiveAccount();
            const otherAccounts = this.accounts.filter(a => a.sessionKey !== this.getCurrentSessionKey());

            this.menu.innerHTML = `
                <div class="account-switcher-header">
                    <h3>Accounts</h3>
                    <button class="account-switcher-close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                ${activeAccount ? `
                    <div class="account-switcher-current">
                        <div class="account-switcher-current-label">Signed in as</div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="account-avatar" style="background-color: ${activeAccount.color}">
                                ${this.getInitials(activeAccount.name)}
                            </div>
                            <div class="account-info">
                                <div class="account-name">${activeAccount.name}</div>
                                <div class="account-email">${activeAccount.email}</div>
                            </div>
                            <span class="account-badge ${activeAccount.type}">${activeAccount.type}</span>
                        </div>
                    </div>
                ` : ''}

                <div class="account-switcher-list">
                    ${otherAccounts.length === 0 && !activeAccount ? `
                        <div style="padding: 24px 16px; text-align: center; color: var(--text-300, #666);">
                            <p style="margin: 0 0 8px 0; font-weight: 500;">No accounts saved</p>
                            <p style="margin: 0; font-size: 13px;">Save your current session to enable quick switching</p>
                        </div>
                    ` : otherAccounts.length === 0 ? `
                        <div style="padding: 16px; text-align: center; color: var(--text-300, #666); font-size: 13px;">
                            No other accounts. Add another to switch between them.
                        </div>
                    ` : `
                        <div style="padding: 8px 16px 4px; font-size: 11px; text-transform: uppercase; color: var(--text-300, #666); font-weight: 500;">
                            Switch to
                        </div>
                        ${otherAccounts.map(account => `
                            <div class="account-switcher-item" data-account-id="${account.id}">
                                <div class="account-avatar" style="background-color: ${account.color}">
                                    ${this.getInitials(account.name)}
                                </div>
                                <div class="account-info">
                                    <div class="account-name">${account.name}</div>
                                    <div class="account-email">${account.email}</div>
                                </div>
                                <span class="account-badge ${account.type}">${account.type}</span>
                            </div>
                        `).join('')}
                    `}
                </div>

                <div class="account-switcher-footer">
                    ${!activeAccount && this.getCurrentSessionKey() ? `
                        <div class="account-switcher-action" data-action="save-current">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            Save current session
                        </div>
                    ` : ''}
                    <div class="account-switcher-action" data-action="add">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v8M8 12h8"/>
                        </svg>
                        Add another account
                    </div>
                    <div class="account-switcher-action" data-action="manage">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        Manage accounts
                    </div>
                </div>
            `;

            // Event listeners
            this.menu.querySelector('.account-switcher-close').addEventListener('click', () => this.hideMenu());

            this.menu.querySelectorAll('.account-switcher-item').forEach(item => {
                item.addEventListener('click', () => {
                    const accountId = item.dataset.accountId;
                    this.switchToAccount(accountId);
                });
            });

            const saveCurrentBtn = this.menu.querySelector('[data-action="save-current"]');
            if (saveCurrentBtn) {
                saveCurrentBtn.addEventListener('click', () => {
                    this.hideMenu();
                    this.showSaveCurrentSessionModal();
                });
            }

            this.menu.querySelector('[data-action="add"]').addEventListener('click', () => {
                this.hideMenu();
                this.showAddAccountModal();
            });

            this.menu.querySelector('[data-action="manage"]').addEventListener('click', () => {
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
            if (left < 16) {
                left = 16;
            }

            this.menu.style.left = `${left}px`;
            this.menu.style.top = `${top}px`;

            this.currentSessionKey = this.getCurrentSessionKey();
            this.updateMenuContent();
            this.menu.classList.add('visible');
            this.menuVisible = true;
        }

        hideMenu() {
            this.menu.classList.remove('visible');
            this.menuVisible = false;
        }

        switchToAccount(accountId) {
            const account = this.accounts.find(a => a.id === accountId);
            if (!account) return;

            this.hideMenu();

            // Set the session cookie and reload
            this.setSessionCookie(account.sessionKey);
            window.location.reload();
        }

        showSaveCurrentSessionModal() {
            const currentKey = this.getCurrentSessionKey();
            if (!currentKey) {
                alert('No active session found');
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'account-modal-overlay';

            const selectedColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

            overlay.innerHTML = `
                <div class="account-modal">
                    <div class="account-modal-header">
                        <h2>Save Current Session</h2>
                    </div>
                    <div class="account-modal-body">
                        <p style="margin: 0 0 20px 0; color: var(--text-200, #333); font-size: 14px;">
                            Save your current Claude session to quickly switch back to it later.
                        </p>
                        <div class="account-form-group">
                            <label>Display Name</label>
                            <input type="text" id="account-name" placeholder="e.g., Work Account">
                        </div>
                        <div class="account-form-group">
                            <label>Email Address</label>
                            <input type="email" id="account-email" placeholder="e.g., john@company.com">
                            <div class="account-form-hint">The Google email for this account (for your reference)</div>
                        </div>
                        <div class="account-form-group">
                            <label>Account Type</label>
                            <select id="account-type">
                                <option value="work">Work</option>
                                <option value="personal">Personal</option>
                            </select>
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
                        <button class="account-btn account-btn-secondary" data-action="cancel">Cancel</button>
                        <button class="account-btn account-btn-primary" data-action="save">Save Session</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            let currentColor = selectedColor;

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

                if (!name) {
                    alert('Please enter a display name');
                    return;
                }

                // Check if this session is already saved
                const existing = this.accounts.find(a => a.sessionKey === currentKey);
                if (existing) {
                    alert('This session is already saved as "' + existing.name + '"');
                    return;
                }

                this.accounts.push({
                    id: this.generateId(),
                    name,
                    email: email || 'No email provided',
                    type,
                    color: currentColor,
                    sessionKey: currentKey,
                    savedAt: new Date().toISOString()
                });

                this.saveAccounts();
                closeModal();
                this.updateMenuContent();
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        }

        showAddAccountModal(editAccount = null) {
            const isEdit = !!editAccount;
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
                            <div style="background-color: #fff3e0; border: 1px solid #ffcc80; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                                <p style="margin: 0; color: #e65100; font-size: 13px;">
                                    <strong>Tip:</strong> To add a new account, first log into Claude with that account, 
                                    then use "Save current session" from the menu.
                                </p>
                            </div>
                        ` : ''}
                        <div class="account-form-group">
                            <label>Display Name</label>
                            <input type="text" id="account-name" placeholder="e.g., Work Account" value="${editAccount?.name || ''}">
                        </div>
                        <div class="account-form-group">
                            <label>Email Address</label>
                            <input type="email" id="account-email" placeholder="e.g., john@company.com" value="${editAccount?.email || ''}">
                        </div>
                        <div class="account-form-group">
                            <label>Account Type</label>
                            <select id="account-type">
                                <option value="work" ${editAccount?.type === 'work' ? 'selected' : ''}>Work</option>
                                <option value="personal" ${editAccount?.type === 'personal' ? 'selected' : ''}>Personal</option>
                            </select>
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
                        ${isEdit ? `
                            <div class="account-form-group">
                                <label>Session Key</label>
                                <input type="text" id="account-session" value="${editAccount?.sessionKey || ''}" 
                                       style="font-family: monospace; font-size: 12px;" readonly>
                                <div class="account-form-hint">Session keys cannot be edited for security</div>
                            </div>
                        ` : `
                            <div class="account-form-group">
                                <label>Session Key (Advanced)</label>
                                <input type="text" id="account-session" placeholder="sk-ant-sid01-..." 
                                       style="font-family: monospace; font-size: 12px;">
                                <div class="account-form-hint">Optional: Paste a session key directly if you have one</div>
                            </div>
                        `}
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
                const sessionInput = overlay.querySelector('#account-session');
                const sessionKey = sessionInput ? sessionInput.value.trim() : '';

                if (!name) {
                    alert('Please enter a display name');
                    return;
                }

                if (isEdit) {
                    const index = this.accounts.findIndex(a => a.id === editAccount.id);
                    if (index !== -1) {
                        this.accounts[index] = {
                            ...editAccount,
                            name,
                            email: email || 'No email provided',
                            type,
                            color: currentColor
                        };
                    }
                } else {
                    if (!sessionKey) {
                        alert('Please enter a session key, or use "Save current session" while logged into the account');
                        return;
                    }

                    // Validate session key format
                    if (!sessionKey.startsWith('sk-ant-')) {
                        alert('Invalid session key format. Session keys should start with "sk-ant-"');
                        return;
                    }

                    this.accounts.push({
                        id: this.generateId(),
                        name,
                        email: email || 'No email provided',
                        type,
                        color: currentColor,
                        sessionKey,
                        savedAt: new Date().toISOString()
                    });
                }

                this.saveAccounts();
                closeModal();
                this.updateMenuContent();
            });

            if (isEdit) {
                overlay.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    if (confirm(`Are you sure you want to remove "${editAccount.name}"?`)) {
                        this.accounts = this.accounts.filter(a => a.id !== editAccount.id);
                        this.saveAccounts();
                        closeModal();
                        this.updateMenuContent();
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
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; opacity: 0.5;">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                                <p style="margin: 0 0 8px 0; font-weight: 500;">No accounts saved</p>
                                <p style="margin: 0; font-size: 13px;">Log into Claude and save your session to get started</p>
                            </div>
                        ` : `
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${this.accounts.map(account => `
                                    <div class="account-switcher-item" data-account-id="${account.id}" style="cursor: pointer;">
                                        <div class="account-avatar" style="background-color: ${account.color}">
                                            ${this.getInitials(account.name)}
                                        </div>
                                        <div class="account-info">
                                            <div class="account-name">${account.name}</div>
                                            <div class="account-email">${account.email}</div>
                                        </div>
                                        <span class="account-badge ${account.type}">${account.type}</span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-300, #666);">
                                            <polyline points="9 18 15 12 9 6"/>
                                        </svg>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                    <div class="account-modal-footer">
                        <button class="account-btn account-btn-secondary" data-action="close">Close</button>
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

            overlay.querySelectorAll('.account-switcher-item').forEach(item => {
                item.addEventListener('click', () => {
                    const accountId = item.dataset.accountId;
                    const account = this.accounts.find(a => a.id === accountId);
                    if (account) {
                        closeModal();
                        setTimeout(() => this.showAddAccountModal(account), 250);
                    }
                });
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new AccountSwitcher());
    } else {
        new AccountSwitcher();
    }
})();
