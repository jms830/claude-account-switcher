// ==UserScript==
// @name         Claude Account Switcher
// @namespace    https://github.com/jms830
// @version      2.0.0
// @description  Gmail-style account switcher for Claude.ai - standalone floating button
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
        positionKey: 'claude_switcher_position',
    };

    const COLORS = [
        '#c96442', '#e57373', '#f06292', '#ba68c8', '#9575cd',
        '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac',
        '#81c784', '#aed581', '#dce775', '#fff176', '#ffd54f',
        '#ffb74d', '#ff8a65', '#a1887f', '#90a4ae', '#78909c'
    ];

    // All styles in one place
    GM_addStyle(`
        /* Floating trigger button */
        #cas-trigger {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #c96442, #a85636);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 99998;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        #cas-trigger:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        #cas-trigger svg {
            width: 24px;
            height: 24px;
            color: white;
        }
        #cas-trigger .cas-badge {
            position: absolute;
            top: -4px;
            right: -4px;
            background: #4caf50;
            color: white;
            font-size: 11px;
            font-weight: 600;
            min-width: 18px;
            height: 18px;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #1a1a1a;
        }

        /* Main panel */
        #cas-panel {
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 320px;
            background: #1e1e1c;
            border: 1px solid #3f3f3c;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            z-index: 99999;
            overflow: hidden;
            display: none;
            flex-direction: column;
            max-height: calc(100vh - 120px);
        }
        #cas-panel.visible {
            display: flex;
        }

        /* Panel header */
        .cas-header {
            padding: 16px;
            border-bottom: 1px solid #3f3f3c;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .cas-header h3 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: #f5f4ef;
        }
        .cas-close {
            background: none;
            border: none;
            color: #888;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
        }
        .cas-close:hover {
            background: #3f3f3c;
            color: #fff;
        }

        /* Account list */
        .cas-list {
            flex: 1;
            overflow-y: auto;
            max-height: 300px;
        }
        .cas-empty {
            padding: 32px 16px;
            text-align: center;
            color: #888;
            font-size: 13px;
        }
        .cas-account {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            gap: 12px;
            cursor: pointer;
            transition: background 0.15s;
            border-bottom: 1px solid #2a2a28;
        }
        .cas-account:last-child {
            border-bottom: none;
        }
        .cas-account:hover {
            background: #2a2a28;
        }
        .cas-avatar {
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
        .cas-info {
            flex: 1;
            min-width: 0;
        }
        .cas-name {
            font-size: 14px;
            font-weight: 500;
            color: #f5f4ef;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cas-email {
            font-size: 12px;
            color: #888;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cas-type {
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .cas-type.work {
            background: rgba(21, 101, 192, 0.2);
            color: #64b5f6;
        }
        .cas-type.personal {
            background: rgba(123, 31, 162, 0.2);
            color: #ce93d8;
        }
        .cas-edit {
            background: none;
            border: none;
            color: #666;
            cursor: pointer;
            padding: 6px;
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.15s;
        }
        .cas-account:hover .cas-edit {
            opacity: 1;
        }
        .cas-edit:hover {
            background: #3f3f3c;
            color: #fff;
        }

        /* Panel footer */
        .cas-footer {
            padding: 12px;
            border-top: 1px solid #3f3f3c;
        }
        .cas-add-btn {
            width: 100%;
            padding: 10px;
            border: 1px dashed #3f3f3c;
            border-radius: 8px;
            background: transparent;
            color: #888;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.15s;
        }
        .cas-add-btn:hover {
            border-color: #c96442;
            color: #c96442;
            background: rgba(201, 100, 66, 0.1);
        }

        /* Modal */
        .cas-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
        }
        .cas-modal-overlay.visible {
            opacity: 1;
            pointer-events: auto;
        }
        .cas-modal {
            background: #1e1e1c;
            border: 1px solid #3f3f3c;
            border-radius: 16px;
            width: 400px;
            max-width: 90vw;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transform: scale(0.95);
            transition: transform 0.2s;
        }
        .cas-modal-overlay.visible .cas-modal {
            transform: scale(1);
        }
        .cas-modal-header {
            padding: 20px;
            border-bottom: 1px solid #3f3f3c;
        }
        .cas-modal-header h3 {
            margin: 0;
            font-size: 17px;
            font-weight: 600;
            color: #f5f4ef;
        }
        .cas-modal-body {
            padding: 20px;
            overflow-y: auto;
        }
        .cas-modal-footer {
            padding: 16px 20px;
            border-top: 1px solid #3f3f3c;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        /* Form elements */
        .cas-form-group {
            margin-bottom: 16px;
        }
        .cas-form-group:last-child {
            margin-bottom: 0;
        }
        .cas-form-group label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #ccc;
            margin-bottom: 6px;
        }
        .cas-form-group input,
        .cas-form-group select,
        .cas-form-group textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #3f3f3c;
            border-radius: 8px;
            font-size: 14px;
            background: #2b2a27;
            color: #f5f4ef;
            box-sizing: border-box;
            font-family: inherit;
        }
        .cas-form-group textarea {
            font-family: monospace;
            font-size: 12px;
            resize: vertical;
            min-height: 60px;
        }
        .cas-form-group input:focus,
        .cas-form-group select:focus,
        .cas-form-group textarea:focus {
            outline: none;
            border-color: #c96442;
        }
        .cas-hint {
            font-size: 11px;
            color: #666;
            margin-top: 4px;
        }
        .cas-info-box {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid rgba(255, 193, 7, 0.3);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 12px;
            color: #ffc107;
            line-height: 1.5;
        }
        .cas-info-box code {
            background: rgba(255,255,255,0.1);
            padding: 1px 4px;
            border-radius: 3px;
            font-family: monospace;
        }

        /* Buttons */
        .cas-btn {
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: background 0.15s;
        }
        .cas-btn-secondary {
            background: #3f3f3c;
            color: #f5f4ef;
        }
        .cas-btn-secondary:hover {
            background: #4a4a47;
        }
        .cas-btn-primary {
            background: #c96442;
            color: #fff;
        }
        .cas-btn-primary:hover {
            background: #b85a3a;
        }
        .cas-btn-danger {
            background: #dc3545;
            color: #fff;
        }
        .cas-btn-danger:hover {
            background: #c82333;
        }

        /* Color picker */
        .cas-colors {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .cas-color {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent;
            transition: transform 0.1s;
        }
        .cas-color:hover {
            transform: scale(1.15);
        }
        .cas-color.selected {
            border-color: #fff;
        }

        /* Keyboard shortcut hint */
        .cas-shortcut {
            font-size: 11px;
            color: #666;
            text-align: center;
            padding: 8px;
            border-top: 1px solid #3f3f3c;
        }
        .cas-shortcut kbd {
            background: #3f3f3c;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: inherit;
        }
    `);

    class AccountSwitcher {
        constructor() {
            this.accounts = this.loadAccounts();
            this.panelVisible = false;
            this.init();
        }

        loadAccounts() {
            return GM_getValue(CONFIG.storageKey, []);
        }

        saveAccounts() {
            GM_setValue(CONFIG.storageKey, this.accounts);
        }

        init() {
            console.log('[Account Switcher] v2.0.0 - Standalone mode');
            this.createUI();
            this.bindKeyboard();
        }

        createUI() {
            // Floating trigger button
            this.trigger = document.createElement('button');
            this.trigger.id = 'cas-trigger';
            this.trigger.title = 'Switch Account (Alt+S)';
            this.trigger.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 00-3-3.87"/>
                    <path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                ${this.accounts.length > 0 ? `<span class="cas-badge">${this.accounts.length}</span>` : ''}
            `;
            this.trigger.addEventListener('click', () => this.togglePanel());
            document.body.appendChild(this.trigger);

            // Panel
            this.panel = document.createElement('div');
            this.panel.id = 'cas-panel';
            document.body.appendChild(this.panel);

            // Close panel when clicking outside
            document.addEventListener('click', (e) => {
                if (this.panelVisible && 
                    !this.panel.contains(e.target) && 
                    !this.trigger.contains(e.target)) {
                    this.hidePanel();
                }
            });

            this.renderPanel();
        }

        renderPanel() {
            const hasAccounts = this.accounts.length > 0;

            this.panel.innerHTML = `
                <div class="cas-header">
                    <h3>Switch Account</h3>
                    <button class="cas-close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="cas-list">
                    ${hasAccounts ? this.accounts.map((acc, i) => `
                        <div class="cas-account" data-index="${i}">
                            <div class="cas-avatar" style="background:${acc.color}">${this.getInitials(acc.name)}</div>
                            <div class="cas-info">
                                <div class="cas-name">${acc.name}</div>
                                <div class="cas-email">${acc.email || 'No email'}</div>
                            </div>
                            <span class="cas-type ${acc.type}">${acc.type}</span>
                            <button class="cas-edit" data-edit="${i}" title="Edit">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                        </div>
                    `).join('') : `
                        <div class="cas-empty">
                            No saved accounts yet.<br>
                            Add your first account to start switching!
                        </div>
                    `}
                </div>
                <div class="cas-footer">
                    <button class="cas-add-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v8M8 12h8"/>
                        </svg>
                        Add Account
                    </button>
                </div>
                <div class="cas-shortcut">Press <kbd>Alt</kbd> + <kbd>S</kbd> to toggle</div>
            `;

            // Bind events
            this.panel.querySelector('.cas-close').addEventListener('click', () => this.hidePanel());
            this.panel.querySelector('.cas-add-btn').addEventListener('click', () => this.showModal());

            this.panel.querySelectorAll('.cas-account').forEach(el => {
                el.addEventListener('click', (e) => {
                    if (e.target.closest('.cas-edit')) return;
                    this.switchTo(parseInt(el.dataset.index));
                });
            });

            this.panel.querySelectorAll('.cas-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showModal(parseInt(btn.dataset.edit));
                });
            });

            // Update badge
            const badge = this.trigger.querySelector('.cas-badge');
            if (badge) badge.textContent = this.accounts.length;
        }

        togglePanel() {
            this.panelVisible ? this.hidePanel() : this.showPanel();
        }

        showPanel() {
            this.renderPanel();
            this.panel.classList.add('visible');
            this.panelVisible = true;
        }

        hidePanel() {
            this.panel.classList.remove('visible');
            this.panelVisible = false;
        }

        bindKeyboard() {
            document.addEventListener('keydown', (e) => {
                // Alt+S to toggle panel
                if (e.altKey && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.togglePanel();
                }
                // Escape to close
                if (e.key === 'Escape' && this.panelVisible) {
                    this.hidePanel();
                }
            });
        }

        switchTo(index) {
            const account = this.accounts[index];
            if (!account?.sessionKey) {
                alert('No session key for this account. Please edit and add one.');
                return;
            }
            this.hidePanel();
            document.cookie = `sessionKey=${account.sessionKey}; path=/; domain=.claude.ai; secure; samesite=lax`;
            window.location.reload();
        }

        getInitials(name) {
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }

        showModal(editIndex = null) {
            const isEdit = editIndex !== null;
            const account = isEdit ? this.accounts[editIndex] : null;
            const selectedColor = account?.color || COLORS[Math.floor(Math.random() * COLORS.length)];

            const overlay = document.createElement('div');
            overlay.className = 'cas-modal-overlay';
            overlay.innerHTML = `
                <div class="cas-modal">
                    <div class="cas-modal-header">
                        <h3>${isEdit ? 'Edit Account' : 'Add Account'}</h3>
                    </div>
                    <div class="cas-modal-body">
                        ${!isEdit ? `
                            <div class="cas-info-box">
                                <strong>To get your session key:</strong><br>
                                1. Open DevTools (F12) → Application tab<br>
                                2. Cookies → claude.ai → find <code>sessionKey</code><br>
                                3. Copy the value (starts with <code>sk-ant-</code>)
                            </div>
                        ` : ''}
                        <div class="cas-form-group">
                            <label>Display Name *</label>
                            <input type="text" id="cas-name" value="${account?.name || ''}" placeholder="e.g., Work Account">
                        </div>
                        <div class="cas-form-group">
                            <label>Email (optional)</label>
                            <input type="email" id="cas-email" value="${account?.email || ''}" placeholder="e.g., john@company.com">
                            <div class="cas-hint">For your reference only</div>
                        </div>
                        <div class="cas-form-group">
                            <label>Type</label>
                            <select id="cas-type">
                                <option value="work" ${account?.type === 'work' ? 'selected' : ''}>Work</option>
                                <option value="personal" ${account?.type === 'personal' ? 'selected' : ''}>Personal</option>
                            </select>
                        </div>
                        <div class="cas-form-group">
                            <label>Session Key *</label>
                            <textarea id="cas-session" placeholder="sk-ant-sid01-...">${account?.sessionKey || ''}</textarea>
                            ${isEdit ? '<div class="cas-hint">Leave unchanged to keep current key</div>' : ''}
                        </div>
                        <div class="cas-form-group">
                            <label>Color</label>
                            <div class="cas-colors">
                                ${COLORS.map(c => `
                                    <div class="cas-color ${c === selectedColor ? 'selected' : ''}" 
                                         data-color="${c}" style="background:${c}"></div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="cas-modal-footer">
                        ${isEdit ? '<button class="cas-btn cas-btn-danger" data-action="delete" style="margin-right:auto">Delete</button>' : ''}
                        <button class="cas-btn cas-btn-secondary" data-action="cancel">Cancel</button>
                        <button class="cas-btn cas-btn-primary" data-action="save">${isEdit ? 'Save' : 'Add'}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            let color = selectedColor;

            // Color selection
            overlay.querySelectorAll('.cas-color').forEach(el => {
                el.addEventListener('click', () => {
                    overlay.querySelectorAll('.cas-color').forEach(c => c.classList.remove('selected'));
                    el.classList.add('selected');
                    color = el.dataset.color;
                });
            });

            const close = () => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 200);
            };

            overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

            overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
                const name = overlay.querySelector('#cas-name').value.trim();
                const email = overlay.querySelector('#cas-email').value.trim();
                const type = overlay.querySelector('#cas-type').value;
                const sessionKey = overlay.querySelector('#cas-session').value.trim();

                if (!name) { alert('Please enter a display name'); return; }
                if (!isEdit && !sessionKey) { alert('Please enter a session key'); return; }
                if (!isEdit && !sessionKey.startsWith('sk-ant-')) { 
                    alert('Invalid session key format. It should start with sk-ant-'); 
                    return; 
                }

                if (isEdit) {
                    this.accounts[editIndex] = {
                        ...account,
                        name, email, type, color,
                        sessionKey: sessionKey || account.sessionKey
                    };
                } else {
                    this.accounts.push({
                        id: 'acc_' + Math.random().toString(36).substr(2, 9),
                        name, email, type, color, sessionKey,
                        createdAt: new Date().toISOString()
                    });
                }

                this.saveAccounts();
                this.renderPanel();
                this.updateTriggerBadge();
                close();
            });

            if (isEdit) {
                overlay.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    if (confirm(`Delete "${account.name}"?`)) {
                        this.accounts.splice(editIndex, 1);
                        this.saveAccounts();
                        this.renderPanel();
                        this.updateTriggerBadge();
                        close();
                    }
                });
            }
        }

        updateTriggerBadge() {
            let badge = this.trigger.querySelector('.cas-badge');
            if (this.accounts.length > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'cas-badge';
                    this.trigger.appendChild(badge);
                }
                badge.textContent = this.accounts.length;
            } else if (badge) {
                badge.remove();
            }
        }
    }

    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new AccountSwitcher());
    } else {
        new AccountSwitcher();
    }
})();
