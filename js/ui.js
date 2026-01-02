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
            div.textContent = p.name;
            div.dataset.id = p.id;
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

    setHardwareStatus(statusKey) { // Dictionary Key
        const dict = locales[currentLang];
        const text = dict[statusKey] || statusKey;
        elements.hardwareStatus.textContent = text;

        if (statusKey === 'status_ready') {
            elements.hardwareStatus.style.background = 'rgba(76, 175, 80, 0.1)';
            elements.hardwareStatus.style.color = 'var(--status-green)';
        } else {
            elements.hardwareStatus.style.background = 'rgba(244, 67, 54, 0.1)';
            elements.hardwareStatus.style.color = 'var(--status-red)';
        }
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

    // Landing Page State Management
    setLandingState(state) {
        // state: 'loading' | 'ready' | 'setup'
        elements.landingLoading.classList.add('hidden');
        elements.landingReady.classList.add('hidden');
        elements.landingSetup.classList.add('hidden');

        if (state === 'loading') elements.landingLoading.classList.remove('hidden');
        if (state === 'ready') elements.landingReady.classList.remove('hidden');
        if (state === 'setup') elements.landingSetup.classList.remove('hidden');
    },

    switchView(mode) {
        // mode: 'chat' | 'writer' | 'rewriter' | 'welcome'
        elements.chatInterface.classList.add('hidden');
        elements.rewriterSplit.classList.add('hidden');
        elements.welcomeScreen.classList.add('hidden');

        if (mode === 'welcome') {
            elements.welcomeScreen.classList.remove('hidden');
        } else if (mode === 'rewriter') {
            elements.rewriterSplit.classList.remove('hidden');
        } else {
            elements.chatInterface.classList.remove('hidden');
        }

        if (mode !== 'welcome') {
            this.updateModeDescription(mode);
        }
    },

    showInputModal(title, callback) {
        const titleEl = document.getElementById('input-modal-title');
        if (titleEl) titleEl.textContent = title;

        const input = document.getElementById('custom-input-field');
        input.value = '';
        document.getElementById('input-modal-overlay').classList.remove('hidden');
        input.focus();

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

    closeInputModal() {
        document.getElementById('input-modal-overlay').classList.add('hidden');
    }
};

// Global Bindings
elements.closeModalBtn.addEventListener('click', () => UI.closeInputModal());
