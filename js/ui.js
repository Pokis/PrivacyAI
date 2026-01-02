/**
 * PrivacyAI UI Module
 * Handles DOM manipulations, Localization, and View updates.
 */
import { locales } from './locales.js';

// DOM Elements
const elements = {
    projectList: document.getElementById('project-list'),
    outputStream: document.getElementById('output-stream'),
    userInput: document.getElementById('user-input'),
    progressBar: document.getElementById('download-progress'),
    modelLoader: document.getElementById('model-loader'),
    loaderStatus: document.querySelector('.loader-status'),
    chatInterface: document.getElementById('chat-interface'),
    rewriterSplit: document.getElementById('re-writer-split'),
    rewriterInput: document.getElementById('rewriter-input'),
    rewriterOutput: document.getElementById('rewriter-output'),
    apiSelector: document.getElementById('api-selector'),
    hardwareStatus: document.querySelector('.hardware-status'),
    closeModalBtn: document.querySelector('.close-modal'), // For input modal
    langSelector: document.getElementById('lang-selector'),
    modeDesc: document.getElementById('mode-description'),

    // Landing Page Elements
    welcomeScreen: document.getElementById('welcome-screen'),
    landingLoading: document.getElementById('landing-loading'),
    landingReady: document.getElementById('landing-ready'),
    landingSetup: document.getElementById('landing-setup'),
};

let currentLang = 'en';

export const UI = {
    ...elements,

    setLanguage(lang) {
        if (!locales[lang]) return;
        currentLang = lang;
        const dict = locales[lang];

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = dict[key];
                } else {
                    el.textContent = dict[key];
                }
            }
        });

        // Update placeholders dynamically
        elements.userInput.placeholder = dict.input_placeholder;
        elements.rewriterInput.placeholder = dict.editor_placeholder;

        // Update Mode Description
        this.updateModeDescription(elements.apiSelector.value);

        // Update FAQ if visible
        this.renderFAQ();

        // Update Diagnostics if visible
        const diagContainer = document.getElementById('diag-container');
        if (diagContainer && window.aiSwitchboard) {
            window.aiSwitchboard.getDiagnostics().then(report => {
                this.renderDiagnostics(report);
            });
        }
    },

    updateModeDescription(mode) {
        const dict = locales[currentLang];
        let text = "";
        if (mode === 'prompt') text = dict.mode_desc_chat;
        else if (mode === 'writer') text = dict.mode_desc_writer;
        else if (mode === 'rewriter') text = dict.mode_desc_editor;
        elements.modeDesc.textContent = text;
    },

    renderProjects(projects, activeId) {
        elements.projectList.innerHTML = '';
        projects.forEach(p => {
            const div = document.createElement('div');
            div.className = `project-item ${p.id === activeId ? 'active' : ''}`;
            div.dataset.id = p.id;

            // Icon based on Mode
            const iconMock = {
                'prompt': '💬',
                'writer': '📝',
                'rewriter': '✂️'
            };
            const modeIcon = document.createElement('span');
            modeIcon.textContent = iconMock[p.apiMode] || '💬';
            modeIcon.style.marginRight = '8px';
            modeIcon.style.opacity = '0.7';

            // Name
            const span = document.createElement('span');
            span.className = 'project-name';
            span.textContent = p.name;

            // Actions
            const actions = document.createElement('div');
            actions.className = 'project-actions';
            actions.innerHTML = `
                <button class="rename-chat-btn" title="Rename">✏️</button>
                <button class="delete-chat-btn" title="Delete">🗑️</button>
            `;

            div.appendChild(modeIcon);
            div.appendChild(span);
            div.appendChild(actions);
            elements.projectList.appendChild(div);
        });
    },

    clearChat() {
        elements.outputStream.innerHTML = '';
        // Removed generic system message to keep it clean
    },

    appendUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'message user';
        div.textContent = text;
        elements.outputStream.appendChild(div);
        this.scrollToBottom();
    },

    createModelMessageContainer() {
        const div = document.createElement('div');
        div.className = 'message model';
        elements.outputStream.appendChild(div);
        return div;
    },

    updateMessageContent(container, markdownText) {
        if (window.marked) {
            container.innerHTML = window.marked.parse(markdownText);
        } else {
            container.textContent = markdownText;
        }
        this.scrollToBottom();
    },

    scrollToBottom() {
        elements.outputStream.scrollTop = elements.outputStream.scrollHeight;
    },

    setHardwareStatus(statusKey) {
        // Element removed, no-op
    },

    showLoader(show) {
        if (show) elements.modelLoader.classList.remove('hidden');
        else elements.modelLoader.classList.add('hidden');
    },

    updateProgress(loaded, total) {
        if (total === 0) return;
        const percent = Math.round((loaded / total) * 100);
        elements.progressBar.style.width = `${percent}%`;
        elements.loaderStatus.textContent = `${percent}%`;
    },

    setLandingState(state, report = null) {
        elements.landingLoading.classList.add('hidden');
        elements.landingReady.classList.add('hidden');
        elements.landingSetup.classList.add('hidden');

        if (state === 'loading') elements.landingLoading.classList.remove('hidden');
        if (state === 'ready') {
            elements.landingReady.classList.remove('hidden');
            this.renderFAQ(); // Ensure FAQ is visible
        }
        if (state === 'setup') {
            elements.landingSetup.classList.remove('hidden');
            if (report) this.renderDiagnostics(report);
            this.renderFAQ();
        }
    },

    renderDiagnostics(report) {
        let container = document.getElementById('diag-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'diag-container';
            container.className = 'diag-box';
            const btn = document.getElementById('retry-btn');
            btn.parentNode.insertBefore(container, btn);
        }

        const dict = locales[currentLang];
        const getLabel = (status) => {
            if (status === 'readily' || status === 'available') return `<span class="ok">✅ ${dict.status_readily || 'Available'}</span>`;
            if (status === 'simulated') return `<span class="ok">✅ ${dict.status_simulated || 'Simulated'}</span>`;
            if (status === 'after-download') return `<span class="warn">⬇️ ${dict.status_after_download}</span>`;
            if (status === 'missing') return `<span class="err">❌ ${dict.status_missing}</span>`;
            if (status === 'no') return `<span class="err">❌ ${dict.status_no}</span>`;
            if (status === 'timeout') return `<span class="warn">⚠️ ${dict.status_timeout}</span>`;
            return `<span class="warn">⚠️ ${status}</span>`;
        };

        let baseCheck = "";
        // ... (rest of baseCheck logic is fine)
        if (!report.windowAI) {
            baseCheck = `
                <div class="diag-item" style="display:block; margin-bottom:10px;">
                    <span class="err" style="font-weight:bold">WINDOW.AI MISSING</span>
                    <div style="font-size:0.85em; opacity:0.8; margin-top:4px;">
                        <strong>Environment Check warning:</strong><br>
                        Secure Context: ${report.isSecure ? '<span class="ok">YES</span>' : '<span class="err">NO</span>'}<br>
                        Protocol: ${report.protocol} (must be https: or localhost)<br>
                        <br>
                        <hr style="opacity:0.2; margin:5px 0">
                        1. <strong>Incognito Mode?</strong> (AI disabled in Incognito)<br>
                        2. <strong>Flags enabled?</strong> (Prompt API, Optimization Guide)<br>
                        3. <strong>chrome://components</strong> -> Check 'Optimization Guide On Device Model'<br>
                        <br>
                         <button id="deep-probe-btn" style="background:#333; color:#fff; border:1px solid #555; padding:4px 8px; cursor:pointer; font-size:0.8em;">🔬 Run Deep Probe</button>
                    </div>
                    <div id="probe-result" style="font-size:0.8em; margin-top:5px; color:#aaa; white-space: pre-wrap;"></div>
                </div>`;
        }

        container.innerHTML = `
            ${baseCheck}
            <div class="diag-item"><span>${dict.diag_prompt}:</span> ${getLabel(report.promptAPI)}</div>
            <div class="diag-item"><span>${dict.diag_writer}:</span> ${getLabel(report.writerAPI)}</div>
            <div class="diag-item"><span>${dict.diag_rewriter}:</span> ${getLabel(report.rewriterAPI)}</div>
         `;

        const probeBtn = document.getElementById('deep-probe-btn');
        if (probeBtn) {
            probeBtn.onclick = async () => {
                const res = await window.aiSwitchboard.probeEnvironment();
                document.getElementById('probe-result').textContent = JSON.stringify(res, null, 2);
            };
        }
    },

    switchView(mode) {
        console.log("Switching view to:", mode);
        elements.chatInterface.classList.add('hidden');
        elements.rewriterSplit.classList.add('hidden');
        elements.welcomeScreen.classList.add('hidden');

        if (mode === 'welcome') {
            elements.welcomeScreen.classList.remove('hidden');
        } else if (mode === 'rewriter') {
            elements.rewriterSplit.classList.remove('hidden');
        } else {
            console.log("Showing chat interface");
            elements.chatInterface.classList.remove('hidden');
        }

        if (mode !== 'welcome') {
            this.updateModeDescription(mode);
        }
    },

    showHelpModal() {
        // Create or get modal
        const overlay = document.getElementById('input-modal-overlay');
        let modal = document.getElementById('help-modal');
        const dict = locales[currentLang];

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'help-modal';
            modal.className = 'modal-window large hidden'; // 'large' class for wider modal
            modal.style.cssText = "max-width: 600px; width: 90%; max-height: 85vh; display: flex; flex-direction: column; background: #1a1a1a; box-shadow: 0 0 50px rgba(0,0,0,0.8);";

            modal.innerHTML = `
                <div class="modal-header">
                    <span id="help-title">${dict.help || 'Help'}</span>
                    <button class="close-modal" aria-label="Close">×</button>
                </div>
                <div class="modal-body" style="overflow-y: auto; padding-right: 10px;">
                    <!-- Setup Steps Section (Restored) -->
                    <div style="margin-bottom: 25px; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px;">
                        <h4 style="margin-top:0; color:var(--primary-color);">🛠️ ${dict.welcome_setup_title || 'Setup'}</h4>
                        <ol style="padding-left: 20px; line-height: 1.6; margin-bottom:0;">
                            <li>${dict.step_1}</li>
                            <li>${dict.step_2}</li>
                            <li>${dict.step_3}</li>
                            <li>${dict.step_4}</li>
                        </ol>
                    </div>

                    <!-- Diagnostics Section -->
                    <h4 style="margin: 0 0 10px 0;">📊 System Status</h4>
                    <div id="help-diag-container" class="diag-box" style="margin-bottom: 20px;"></div>
                    
                    <!-- FAQ Section -->
                    <div class="faq-container-modal"></div>
                </div>
                <div class="modal-actions" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; margin-top: auto;">
                     <button class="primary-btn close-modal-btn">Close</button>
                </div>
            `;
            overlay.appendChild(modal);

            const close = () => {
                modal.classList.add('hidden');
                overlay.classList.add('hidden');
            };

            modal.querySelector('.close-modal').addEventListener('click', close);
            modal.querySelector('.close-modal-btn').addEventListener('click', close);
        }

        // Render Content

        // 1. Diagnostics (Reuse existing logic if possible, or fetch fresh)
        if (window.aiSwitchboard) {
            window.aiSwitchboard.getDiagnostics().then(report => {
                // Temporarily hijack renderDiagnostics target or manually render here
                // Let's manually render to avoid messing with main UI container
                const diagBox = modal.querySelector('#help-diag-container');
                const getLabel = (status) => {
                    if (status === 'readily' || status === 'available') return `<span class="ok">✅ ${dict.status_readily || 'Available'}</span>`;
                    if (status === 'missing') return `<span class="err">❌ ${dict.status_missing}</span>`;
                    if (status === 'no') return `<span class="err">❌ ${dict.status_no}</span>`;
                    return `<span class="warn">⚠️ ${status}</span>`;
                };

                diagBox.innerHTML = `
                    <div class="diag-item"><span>${dict.diag_prompt}:</span> ${getLabel(report.promptAPI)}</div>
                    <div class="diag-item"><span>${dict.diag_writer}:</span> ${getLabel(report.writerAPI)}</div>
                    <div class="diag-item"><span>${dict.diag_rewriter}:</span> ${getLabel(report.rewriterAPI)}</div>
                `;
            });
        }

        // 2. FAQ
        const faqBox = modal.querySelector('.faq-container-modal');
        if (dict.faq_items) {
            faqBox.innerHTML = `<h3>${dict.faq_title || 'FAQ'}</h3>` + dict.faq_items.map(item => `
                <details style="margin-bottom: 10px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                    <summary style="cursor: pointer; font-weight: bold;">${item.q}</summary>
                    <p style="margin-top: 8px; opacity: 0.8;">${item.a}</p>
                </details>
            `).join('');
        }

        // Show
        overlay.classList.remove('hidden');
        document.querySelectorAll('.modal-window').forEach(m => m.classList.add('hidden'));
        modal.classList.remove('hidden');
    },

    renderFAQ() { // Keep original for Landing Setup
        const container = document.querySelector('.faq-container');
        if (!container) return;
        const dict = locales[currentLang];
        if (!dict.faq_items) return;


        const html = dict.faq_items.map(item => `
            <details>
                <summary>${item.q}</summary>
                <p>${item.a}</p>
            </details>
        `).join('');

        container.innerHTML = `<h3>${dict.faq_title || 'FAQ'}</h3>` + html;
    },

    showDownloadProgress(percent) {
        let toast = document.getElementById('download-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'download-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--surface-card);
                border: 1px solid var(--primary-color);
                color: var(--text-main);
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 9999;
                font-family: var(--font-sans);
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            document.body.appendChild(toast);
        }

        toast.innerHTML = `
            <span class="spinner" style="width:16px; height:16px; border:2px solid var(--text-muted); border-top-color:var(--primary-color); border-radius:50%; animation:spin 1s linear infinite;"></span>
            <span>Downloading Model: <strong>${percent}%</strong></span>
        `;

        // Auto-remove when done (optional, but good UX)
        if (percent >= 100) {
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 2000); // Keep for 2s after completion
        }
    },

    showAboutModal() {
        const dict = locales[currentLang];
        const overlay = document.getElementById('input-modal-overlay');

        let aboutModal = document.getElementById('about-modal');
        if (!aboutModal) {
            aboutModal = document.createElement('div');
            aboutModal.id = 'about-modal';
            aboutModal.className = 'modal-window medium hidden';
            aboutModal.innerHTML = `
                <div class="modal-header">
                    <span id="about-title">About</span>
                    <button class="close-modal" aria-label="Close">×</button>
                </div>
                <div class="modal-body" id="about-body" style="line-height:1.6; opacity:0.9;">
                </div>
                <div class="modal-actions">
                     <button class="primary-btn close-modal-btn">Close</button>
                </div>
            `;
            overlay.appendChild(aboutModal);

            const close = () => {
                aboutModal.classList.add('hidden');
                overlay.classList.add('hidden');
            };

            aboutModal.querySelector('.close-modal').addEventListener('click', close);
            aboutModal.querySelector('.close-modal-btn').addEventListener('click', close);
        }

        document.getElementById('about-title').textContent = dict.about_title || "About";
        document.getElementById('about-body').innerHTML = dict.about_content || "PrivacyAI";

        overlay.classList.remove('hidden');
        document.querySelectorAll('.modal-window').forEach(m => m.classList.add('hidden'));
        aboutModal.classList.remove('hidden');
    },

    showSettingsModal(currentPrompt, onSave) {
        const dict = locales[currentLang];
        const overlay = document.getElementById('input-modal-overlay');
        const modal = document.getElementById('settings-modal');
        const input = document.getElementById('system-prompt-input');
        const saveBtn = document.getElementById('settings-save-btn');

        input.value = currentPrompt;

        // Update label text
        modal.querySelector('.modal-header span').textContent = dict.settings;
        modal.querySelector('.input-label').textContent = dict.system_prompt_label;
        saveBtn.textContent = dict.save;

        overlay.classList.remove('hidden');
        document.querySelectorAll('.modal-window').forEach(m => m.classList.add('hidden'));
        modal.classList.remove('hidden');

        // Wiring
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);

        newSave.addEventListener('click', () => {
            onSave(input.value);
            overlay.classList.add('hidden');
            modal.classList.add('hidden');
        });

        const closeBtn = modal.querySelector('.close-modal');
        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);

        newClose.addEventListener('click', () => {
            overlay.classList.add('hidden');
            modal.classList.add('hidden');
        });
    },

    showInputModal(title, callback, defaultValue = '') {
        const titleEl = document.getElementById('input-modal-title');
        if (titleEl) titleEl.textContent = title;

        const input = document.getElementById('custom-input-field');
        input.value = defaultValue; // Pre-fill

        const overlay = document.getElementById('input-modal-overlay');
        const modal = document.getElementById('input-modal');

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden'); // Ensure inner modal is shown

        input.focus();
        if (defaultValue) input.select(); // Select text for easy overwrite

        const confirmBtn = document.getElementById('input-confirm-btn');
        const cancelBtn = document.getElementById('input-cancel-btn');

        // Remove old listeners by cloning
        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newConfirm.addEventListener('click', () => {
            const val = input.value.trim();
            if (val) {
                this.closeInputModal();
                callback(val);
            }
        });

        // Enter key
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const val = input.value.trim();
                if (val) {
                    this.closeInputModal();
                    callback(val);
                }
            }
        };

        newCancel.addEventListener('click', () => this.closeInputModal());
    },

    showThinking() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
            indicator.textContent = locales[currentLang]?.typing || "AI is thinking...";
        }
    },

    hideThinking() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    },

    closeInputModal() {
        document.getElementById('input-modal-overlay').classList.add('hidden');
        document.getElementById('input-modal').classList.add('hidden');
    }
};

// Global Bindings
elements.closeModalBtn.addEventListener('click', () => UI.closeInputModal());
