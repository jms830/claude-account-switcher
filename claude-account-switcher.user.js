// ==UserScript==
// @name         Claude Account Switcher
// @namespace    https://github.com/jms830
// @version      1.3.1
// @description  Gmail-style account switcher for Claude.ai - adds "Switch Account" to user menu
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
        checkInterval: 300,
    };

    // Inject styles
    GM_addStyle(`
        /* Switch Account menu item */
        .account-switch-item {
            font-size: 14px;
            min-height: 32px;
            padding: 6px 8px;
            border-radius: 8px;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: center;
            outline: none;
            user-select: none;
        }

        .account-switch-item:hover {
            background-color: var(--bg-200, rgba(0,0,0,0.05));
        }

        .account-switch-inner {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
        }

        .account-switch-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }

        .account-switch-label {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Submenu styles */
        .account-submenu {
            position: absolute;
            right: 100%;
            top: 0;
            margin-right: 4px;
            background-color: var(--bg-000, #1a1a1a);
            border: 0.5px solid var(--border-200, #333);
            border-radius: 12px;
            min-width: 280px;
            max-width: 320px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
            z-index: 10001;
            overflow: hidden;
            opacity: 0;
            transform: translateX(8px);
            transition: opacity 0.15s ease, transform 0.15s ease;
            pointer-events: none;
        }

        .account-submenu.visible {
            opacity: 1;
            transform: translateX(0);
            pointer-events: auto;
        }

        .account-submenu-header {
            padding: 12px 12px 8px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            color: var(--text-500, #888);
            letter-spacing: 0.5px;
        }

        .account-submenu-list {
            max-height: 240px;
            overflow-y: auto;
        }

        .account-submenu-item {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            gap: 12px;
            cursor: pointer;
            transition: background-color 0.1s ease;
        }

        .account-submenu-item:hover {
            background-color: var(--bg-200, rgba(255,255,255,0.05));
        }

        .account-submenu-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 13px;
            color: #fff;
            flex-shrink: 0;
        }

        .account-submenu-info {
            flex: 1;
            min-width: 0;
        }

        .account-submenu-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-100, #fff);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .account-submenu-email {
            font-size: 12px;
            color: var(--text-400, #888);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .account-submenu-badge {
            font-size: 9px;
            padding: 2px 5px;
            border-radius: 3px;
            font-weight: 600;
            text-transform: uppercase;
            flex-shrink: 0;
        }

        .account-submenu-badge.work {
            background-color: rgba(21, 101, 192, 0.2);
            color: #64b5f6;
        }

        .account-submenu-badge.personal {
            background-color: rgba(123, 31, 162, 0.2);
            color: #ce93d8;
        }

        .account-submenu-footer {
            border-top: 0.5px solid var(--border-200, #333);
            padding: 8px;
        }

        .account-submenu-action {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            color: var(--text-300, #aaa);
            transition: background-color 0.1s ease;
        }

        .account-submenu-action:hover {
            background-color: var(--bg-200, rgba(255,255,255,0.05));
            color: var(--text-100, #fff);
        }

        .account-submenu-action svg {
            width: 16px;
            height: 16px;
            opacity: 0.7;
        }

        .account-submenu-empty {
            padding: 20px 16px;
            text-align: center;
            color: var(--text-400, #888);
            font-size: 13px;
        }

        /* Modal styles */
        .account-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 10002;
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
            background-color: var(--bg-000, #1e1e1c);
            border: 1px solid var(--border-200, #3f3f3c);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            width: 420px;
            max-width: 90vw;
            max-height: 85vh;
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
            border-bottom: 1px solid var(--border-200, #3f3f3c);
        }

        .account-modal-header h2 {
            margin: 0;
            font-size: 17px;
            font-weight: 600;
            color: var(--text-100, #f5f4ef);
        }

        .account-modal-body {
            padding: 20px 24px;
            overflow-y: auto;
            flex: 1;
        }

        .account-form-group {
            margin-bottom: 18px;
        }

        .account-form-group:last-child {
            margin-bottom: 0;
        }

        .account-form-group label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-200, #ccc);
            margin-bottom: 6px;
        }

        .account-form-group input,
        .account-form-group select,
        .account-form-group textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border-300, #3f3f3c);
            border-radius: 8px;
            font-size: 14px;
            background-color: var(--bg-100, #2b2a27);
            color: var(--text-100, #f5f4ef);
            box-sizing: border-box;
            font-family: inherit;
        }

        .account-form-group textarea {
            font-family: monospace;
            font-size: 12px;
            resize: vertical;
            min-height: 70px;
        }

        .account-form-group input:focus,
        .account-form-group select:focus,
        .account-form-group textarea:focus {
            outline: none;
            border-color: #c96442;
            box-shadow: 0 0 0 2px rgba(201, 100, 66, 0.2);
        }

        .account-form-hint {
            font-size: 11px;
            color: var(--text-400, #888);
            margin-top: 5px;
            line-height: 1.4;
        }

        .account-modal-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border-200, #3f3f3c);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .account-btn {
            padding: 9px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            border: none;
        }

        .account-btn-secondary {
            background-color: var(--bg-200, #3f3f3c);
            color: var(--text-100, #f5f4ef);
        }

        .account-btn-secondary:hover {
            background-color: var(--bg-300, #4a4a47);
        }

        .account-btn-primary {
            background-color: #c96442;
            color: #fff;
        }

        .account-btn-primary:hover {
            background-color: #b85a3a;
        }

        .account-btn-danger {
            background-color: #dc3545;
            color: #fff;
        }

        .account-btn-danger:hover {
            background-color: #c82333;
        }

        .account-color-picker {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .account-color-option {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent;
            transition: transform 0.1s ease, border-color 0.1s ease;
        }

        .account-color-option:hover {
            transform: scale(1.15);
        }

        .account-color-option.selected {
            border-color: #fff;
        }

        .info-box {
            background-color: rgba(255, 193, 7, 0.1);
            border: 1px solid rgba(255, 193, 7, 0.3);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 18px;
        }

        .info-box p {
            margin: 0;
            color: #ffc107;
            font-size: 12px;
            line-height: 1.5;
        }

        .info-box code {
            background-color: rgba(255, 255, 255, 0.1);
            padding: 1px 5px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 11px;
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
            this.submenu = null;
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
            console.log('[Account Switcher] Initialized v1.3.1');
            this.createSubmenu();
            this.watchForMenu();
        }

        createSubmenu() {
            this.submenu = document.createElement('div');
            this.submenu.className = 'account-submenu';
            document.body.appendChild(this.submenu);
        }

        updateSubmenu() {
            const hasAccounts = this.accounts.length > 0;

            this.submenu.innerHTML = `
                ${hasAccounts ? `
                    <div class="account-submenu-header">Switch to</div>
                    <div class="account-submenu-list">
                        ${this.accounts.map((account, index) => `
                            <div class="account-submenu-item" data-index="${index}">
                                <div class="account-submenu-avatar" style="background-color: ${account.color}">
                                    ${this.getInitials(account.name)}
                                </div>
                                <div class="account-submenu-info">
                                    <div class="account-submenu-name">${account.name}</div>
                                    <div class="account-submenu-email">${account.email || 'No email'}</div>
                                </div>
                                <span class="account-submenu-badge ${account.type}">${account.type}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="account-submenu-empty">
                        No saved accounts yet.<br>
                        Add one to start switching!
                    </div>
                `}
                <div class="account-submenu-footer">
                    <div class="account-submenu-action" data-action="add">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v8M8 12h8"/>
                        </svg>
                        Add account
                    </div>
                    ${hasAccounts ? `
                        <div class="account-submenu-action" data-action="manage">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
                                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                            </svg>
                            Manage accounts
                        </div>
                    ` : ''}
                </div>
            `;

            // Bind events
            this.submenu.querySelectorAll('.account-submenu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(item.dataset.index);
                    this.switchToAccount(index);
                });
            });

            this.submenu.querySelector('[data-action="add"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideSubmenu();
                this.showAddAccountModal();
            });

            this.submenu.querySelector('[data-action="manage"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideSubmenu();
                this.showManageAccountsModal();
            });
        }

        showSubmenu(anchorElement) {
            this.updateSubmenu();
            
            const rect = anchorElement.getBoundingClientRect();
            const menuRect = anchorElement.closest('[role="menu"]')?.getBoundingClientRect();
            
            // Calculate position - try to show to the left of the menu
            let left, top;
            const submenuWidth = 290;
            
            if (menuRect) {
                top = rect.top;
                left = menuRect.left - submenuWidth - 4;
                
                // If would go off-screen left, show to the right instead
                if (left < 10) {
                    left = menuRect.right + 4;
                }
            } else {
                top = rect.top;
                left = rect.left - submenuWidth - 4;
            }
            
            // Ensure doesn't go off bottom of screen
            const submenuHeight = 300; // approximate
            if (top + submenuHeight > window.innerHeight) {
                top = window.innerHeight - submenuHeight - 10;
            }
            
            this.submenu.style.top = `${Math.max(10, top)}px`;
            this.submenu.style.left = `${Math.max(10, left)}px`;

            this.submenu.classList.add('visible');
            console.log('[Account Switcher] Submenu shown at', { top, left });
        }

        hideSubmenu() {
            this.submenu.classList.remove('visible');
        }

        watchForMenu() {
            const observer = new MutationObserver(() => {
                this.checkAndInjectMenuItem();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Also check periodically
            setInterval(() => this.checkAndInjectMenuItem(), CONFIG.checkInterval);
        }

        checkAndInjectMenuItem() {
            // Look for the user menu (the dropdown that appears when clicking the profile)
            const menu = document.querySelector('[role="menu"][data-radix-menu-content]');
            if (!menu) {
                this.hideSubmenu();
                return;
            }

            // Check if we've already injected our item
            if (menu.querySelector('.account-switch-item')) {
                return;
            }

            // Find the first separator to inject after the account section
            const separators = menu.querySelectorAll('[role="separator"]');
            if (separators.length === 0) return;

            const firstSeparator = separators[0];

            // Create our menu item
            const switchItem = document.createElement('div');
            switchItem.className = 'account-switch-item';
            switchItem.setAttribute('role', 'menuitem');
            switchItem.setAttribute('tabindex', '-1');
            switchItem.innerHTML = `
                <div class="account-switch-inner">
                    <div class="account-switch-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M22 21v-2a4 4 0 00-3-3.87"/>
                            <path d="M16 3.13a4 4 0 010 7.75"/>
                        </svg>
                    </div>
                    <span class="account-switch-label">Switch account</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/>
                </svg>
            `;

            // Insert before the first separator
            firstSeparator.parentNode.insertBefore(switchItem, firstSeparator);

            // Click to show submenu (more reliable than hover on some systems)
            switchItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (this.submenu.classList.contains('visible')) {
                    this.hideSubmenu();
                } else {
                    this.showSubmenu(switchItem);
                }
            });

            // Also support hover
            let hoverTimeout;
            switchItem.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                this.showSubmenu(switchItem);
            });

            switchItem.addEventListener('mouseleave', (e) => {
                // Check if we're moving to the submenu
                const toElement = e.relatedTarget;
                if (toElement && this.submenu.contains(toElement)) {
                    return;
                }
                hoverTimeout = setTimeout(() => this.hideSubmenu(), 150);
            });

            this.submenu.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
            });

            this.submenu.addEventListener('mouseleave', () => {
                hoverTimeout = setTimeout(() => this.hideSubmenu(), 150);
            });

            // Hide submenu when menu closes
            const menuObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.removedNodes) {
                        if (node === menu || node.contains?.(menu)) {
                            this.hideSubmenu();
                            menuObserver.disconnect();
                            return;
                        }
                    }
                }
            });

            menuObserver.observe(document.body, { childList: true, subtree: true });
        }

        switchToAccount(index) {
            const account = this.accounts[index];
            if (!account || !account.sessionKey) {
                alert('No session key for this account. Please edit the account and add a session key.');
                return;
            }

            this.hideSubmenu();
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
                                    <strong>To get your session key:</strong><br>
                                    1. Open DevTools (F12) → Application tab<br>
                                    2. Cookies → claude.ai → find <code>sessionKey</code><br>
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
                            <div class="account-form-hint">For your reference only</div>
                        </div>
                        
                        <div class="account-form-group">
                            <label>Type</label>
                            <select id="account-type">
                                <option value="work" ${editAccount?.type === 'work' ? 'selected' : ''}>Work</option>
                                <option value="personal" ${editAccount?.type === 'personal' ? 'selected' : ''}>Personal</option>
                            </select>
                        </div>
                        
                        <div class="account-form-group">
                            <label>Session Key *</label>
                            <textarea id="account-session" placeholder="sk-ant-sid01-..." ${isEdit ? 'readonly style="opacity: 0.6;"' : ''}>${editAccount?.sessionKey || ''}</textarea>
                            ${isEdit ? '<div class="account-form-hint">Cannot be edited. Delete and re-add to change.</div>' : ''}
                        </div>
                        
                        <div class="account-form-group">
                            <label>Color</label>
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
                        <button class="account-btn account-btn-primary" data-action="save">${isEdit ? 'Save' : 'Add'}</button>
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
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

            overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
                const name = overlay.querySelector('#account-name').value.trim();
                const email = overlay.querySelector('#account-email').value.trim();
                const type = overlay.querySelector('#account-type').value;
                const sessionKey = overlay.querySelector('#account-session').value.trim();

                if (!name) { alert('Please enter a display name'); return; }
                if (!isEdit && !sessionKey) { alert('Please enter a session key'); return; }
                if (!isEdit && !sessionKey.startsWith('sk-ant-')) { alert('Invalid session key format'); return; }

                if (isEdit) {
                    this.accounts[editIndex] = { ...editAccount, name, email, type, color: currentColor };
                } else {
                    this.accounts.push({
                        id: this.generateId(),
                        name, email, type,
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
                    if (confirm(`Delete "${editAccount.name}"?`)) {
                        this.accounts.splice(editIndex, 1);
                        this.saveAccounts();
                        closeModal();
                    }
                });
            }
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
                            <div style="padding: 32px; text-align: center; color: var(--text-400, #888);">
                                No accounts saved
                            </div>
                        ` : `
                            <div style="max-height: 350px; overflow-y: auto;">
                                ${this.accounts.map((account, index) => `
                                    <div class="account-submenu-item" data-index="${index}" style="cursor: pointer;">
                                        <div class="account-submenu-avatar" style="background-color: ${account.color}">
                                            ${this.getInitials(account.name)}
                                        </div>
                                        <div class="account-submenu-info">
                                            <div class="account-submenu-name">${account.name}</div>
                                            <div class="account-submenu-email">${account.email || 'No email'}</div>
                                        </div>
                                        <span class="account-submenu-badge ${account.type}">${account.type}</span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.5;">
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
                setTimeout(() => this.showAddAccountModal(), 200);
            });

            overlay.querySelectorAll('.account-submenu-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.index);
                    const account = this.accounts[index];
                    closeModal();
                    setTimeout(() => this.showAddAccountModal(account, index), 200);
                });
            });

            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new AccountSwitcher());
    } else {
        new AccountSwitcher();
    }
})();
