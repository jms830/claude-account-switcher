// ==UserScript==
// @name         Claude Account Switcher
// @namespace    https://github.com/jms830
// @version      2.1.0
// @description  Gmail-style account switcher for Claude.ai
// @match        https://claude.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @license      MIT
// @downloadURL  https://github.com/jms830/claude-account-switcher/raw/main/claude-account-switcher.user.js
// @updateURL    https://github.com/jms830/claude-account-switcher/raw/main/claude-account-switcher.user.js
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'claude_accounts_v2';
    const COLORS = ['#c96442','#e57373','#f06292','#ba68c8','#9575cd','#7986cb','#64b5f6','#4fc3f7','#4db6ac','#81c784'];

    // Load/save accounts
    function loadAccounts() {
        return GM_getValue(STORAGE_KEY, []);
    }
    function saveAccounts(accounts) {
        GM_setValue(STORAGE_KEY, accounts);
    }

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
        #cas-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: #c96442;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 8px;
            flex-shrink: 0;
        }
        #cas-btn:hover { background: #b85a3a; }
        #cas-btn svg { width: 18px; height: 18px; color: white; }

        #cas-popup {
            position: fixed;
            left: 270px;
            bottom: 60px;
            width: 300px;
            background: #1e1e1c;
            border: 1px solid #3f3f3c;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 999999;
            display: none;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
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
        #cas-list {
            max-height: 250px;
            overflow-y: auto;
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
        }
        .cas-item-badge {
            font-size: 9px;
            padding: 2px 5px;
            border-radius: 3px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .cas-item-badge.work { background: rgba(21,101,192,0.2); color: #64b5f6; }
        .cas-item-badge.personal { background: rgba(123,31,162,0.2); color: #ce93d8; }
        #cas-add-btn {
            margin: 12px 16px;
            padding: 10px;
            border: 1px dashed #3f3f3c;
            border-radius: 8px;
            background: transparent;
            color: #888;
            cursor: pointer;
            font-size: 13px;
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
            width: 380px;
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
        .cas-field textarea {
            font-family: monospace;
            font-size: 11px;
            min-height: 50px;
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
        .cas-btn-cancel { background: #3f3f3c; color: #f5f4ef; }
        .cas-btn-cancel:hover { background: #4a4a47; }
        .cas-btn-save { background: #c96442; color: #fff; }
        .cas-btn-save:hover { background: #b85a3a; }
        .cas-btn-delete { background: #dc3545; color: #fff; margin-right: auto; }
        .cas-btn-delete:hover { background: #c82333; }
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

    let accounts = loadAccounts();
    let popup = null;
    let modalBg = null;

    // Create popup
    function createPopup() {
        popup = document.createElement('div');
        popup.id = 'cas-popup';
        popup.innerHTML = `
            <div id="cas-popup-header">
                <span>Switch Account</span>
                <button id="cas-popup-close">&times;</button>
            </div>
            <div id="cas-list"></div>
            <button id="cas-add-btn">+ Add Account</button>
        `;
        document.body.appendChild(popup);

        popup.querySelector('#cas-popup-close').onclick = () => popup.classList.remove('open');
        popup.querySelector('#cas-add-btn').onclick = () => openModal();

        renderList();
    }

    function renderList() {
        const list = popup.querySelector('#cas-list');
        if (accounts.length === 0) {
            list.innerHTML = '<div class="cas-empty">No accounts saved.<br>Add one to start switching!</div>';
            return;
        }
        list.innerHTML = accounts.map((a, i) => `
            <div class="cas-item" data-i="${i}">
                <div class="cas-avatar" style="background:${a.color}">${getInitials(a.name)}</div>
                <div class="cas-item-info">
                    <div class="cas-item-name">${a.name}</div>
                    <div class="cas-item-email">${a.email || ''}</div>
                </div>
                <span class="cas-item-badge ${a.type}">${a.type}</span>
            </div>
        `).join('');

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

    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

    function openModal(editIdx = null) {
        popup.classList.remove('open');
        const isEdit = editIdx !== null;
        const acc = isEdit ? accounts[editIdx] : null;
        const selColor = acc?.color || COLORS[Math.floor(Math.random() * COLORS.length)];

        modalBg.querySelector('#cas-modal-header').textContent = isEdit ? 'Edit Account' : 'Add Account';
        modalBg.querySelector('#cas-modal-body').innerHTML = `
            ${!isEdit ? `<div class="cas-info-box">
                <strong>To get session key:</strong><br>
                DevTools (F12) → Application → Cookies → claude.ai → <code>sessionKey</code>
            </div>` : ''}
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
                    <option value="work" ${acc?.type === 'work' ? 'selected' : ''}>Work</option>
                    <option value="personal" ${acc?.type === 'personal' ? 'selected' : ''}>Personal</option>
                </select>
            </div>
            <div class="cas-field">
                <label>Session Key *</label>
                <textarea id="cas-f-key" placeholder="sk-ant-...">${acc?.sessionKey || ''}</textarea>
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
            <button class="cas-btn cas-btn-cancel">Cancel</button>
            <button class="cas-btn cas-btn-save">Save</button>
        `;

        modalBg.querySelector('.cas-btn-cancel').onclick = closeModal;
        modalBg.querySelector('.cas-btn-save').onclick = () => {
            const name = modalBg.querySelector('#cas-f-name').value.trim();
            const email = modalBg.querySelector('#cas-f-email').value.trim();
            const type = modalBg.querySelector('#cas-f-type').value;
            const sessionKey = modalBg.querySelector('#cas-f-key').value.trim();

            if (!name) return alert('Name required');
            if (!isEdit && !sessionKey) return alert('Session key required');
            if (!isEdit && !sessionKey.startsWith('sk-ant-')) return alert('Invalid session key');

            if (isEdit) {
                accounts[editIdx] = { ...acc, name, email, type, color, sessionKey: sessionKey || acc.sessionKey };
            } else {
                accounts.push({ id: Date.now().toString(36), name, email, type, color, sessionKey, createdAt: new Date().toISOString() });
            }
            saveAccounts(accounts);
            renderList();
            closeModal();
        };

        if (isEdit) {
            modalBg.querySelector('.cas-btn-delete').onclick = () => {
                if (confirm(`Delete "${acc.name}"?`)) {
                    accounts.splice(editIdx, 1);
                    saveAccounts(accounts);
                    renderList();
                    closeModal();
                }
            };
        }

        modalBg.classList.add('open');
    }

    function closeModal() {
        modalBg.classList.remove('open');
    }

    // Find sidebar and inject button
    function injectButton() {
        // Look for the user profile button area in the sidebar
        const sidebar = document.querySelector('nav, [class*="sidebar"], aside');
        if (!sidebar) {
            console.log('[CAS] Sidebar not found, retrying...');
            return false;
        }

        // Find the bottom section with user info
        const userSection = sidebar.querySelector('[class*="user"], [class*="profile"], [class*="account"]') 
            || sidebar.querySelector('button[class*="truncate"]')?.parentElement
            || sidebar.lastElementChild;

        if (!userSection || document.getElementById('cas-btn')) {
            return !!document.getElementById('cas-btn');
        }

        const btn = document.createElement('button');
        btn.id = 'cas-btn';
        btn.title = 'Switch Account';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>`;
        btn.onclick = () => {
            popup.classList.toggle('open');
        };

        // Try to insert it nicely
        if (userSection.parentElement) {
            userSection.parentElement.style.display = 'flex';
            userSection.parentElement.style.alignItems = 'center';
            userSection.after(btn);
        } else {
            userSection.appendChild(btn);
        }

        console.log('[CAS] Button injected!');
        return true;
    }

    // Initialize
    function init() {
        console.log('[CAS] v2.1.0 initializing...');
        createPopup();
        createModal();

        // Try to inject button, retry if needed
        if (!injectButton()) {
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (injectButton() || attempts > 30) {
                    clearInterval(interval);
                    if (attempts > 30) console.log('[CAS] Could not find sidebar after 30 attempts');
                }
            }, 500);
        }

        // Also watch for DOM changes (SPA navigation)
        const observer = new MutationObserver(() => {
            if (!document.getElementById('cas-btn')) {
                injectButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                popup.classList.toggle('open');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
