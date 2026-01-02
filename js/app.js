import { storage } from './storage.js';
import { aiSwitchboard } from './ai.js';
import { UI } from './ui.js';
import { locales } from './locales.js';

// State
let currentProject = null;
let currentSession = null;
let appReady = false;

const UUID = () => crypto.randomUUID();

async function init() {
    await storage.init();

    // Load Settings (Lang)
    const savedLang = await storage.getSetting('language');
    if (savedLang) {
        if (UI.langSelector) UI.langSelector.value = savedLang;
        UI.setLanguage(savedLang);
    } else {
        UI.setLanguage('en');
    }

    // Initial State: Welcome Screen -> Loading
    UI.switchView('welcome');
    UI.setLandingState('loading');

    // Check Hardware
    const status = await aiSwitchboard.checkAvailability();

    if (status === 'readily' || status === 'after-download') {
        appReady = true;
        UI.setHardwareStatus(status === 'readily' ? 'status_ready' : 'status_needs_dl');
        UI.setLandingState('ready');
    } else {
        appReady = false;
        const diag = await aiSwitchboard.getDiagnostics();
        UI.setHardwareStatus('status_unsupported');
        UI.setLandingState('setup', diag);
    }

    // Event Listeners
    setupEventListeners();
}

async function enterApp() {
    if (!appReady) return;

    // Load Projects
    await refreshProjects();

    // Switch to Project View
    // refreshProjects calls loadProject which switches view
}

async function refreshProjects() {
    const projects = await storage.getAllProjects();
    const dict = locales[UI.langSelector.value];

    if (projects.length === 0) {
        const newProj = {
            id: UUID(),
            name: dict.new_chat.replace("+ ", "") || "General Chat", // localized default
            systemPrompt: "You are a helpful AI assistant.",
            history: [],
            apiMode: 'prompt'
        };
        await storage.saveProject(newProj);
        projects.push(newProj);
    }

    if (!currentProject && projects.length > 0) {
        await loadProject(projects[0].id);
    }

    UI.renderProjects(projects, currentProject ? currentProject.id : null);
}

async function loadProject(id) {
    currentProject = await storage.getProject(id);

    UI.clearChat();
    UI.apiSelector.value = currentProject.apiMode || 'prompt';
    UI.switchView(currentProject.apiMode);

    aiSwitchboard.setStrategy(currentProject.apiMode);

    if (currentProject.apiMode !== 'rewriter' && currentProject.history) {
        currentProject.history.forEach(msg => {
            if (msg.role === 'user') UI.appendUserMessage(msg.content);
            else {
                const con = UI.createModelMessageContainer();
                UI.updateMessageContent(con, msg.content);
            }
        });
    }

    currentSession = null;
}

function setupEventListeners() {

    // Landing Page Buttons
    document.getElementById('enter-btn').addEventListener('click', () => enterApp());
    document.getElementById('retry-btn').addEventListener('click', () => window.location.reload());

    // Language
    UI.langSelector.addEventListener('change', async (e) => {
        const lang = e.target.value;
        UI.setLanguage(lang);
        await storage.saveSetting('language', lang);
        // Refresh project list to maybe update standard UI (not project names)
        if (currentProject) UI.renderProjects(await storage.getAllProjects(), currentProject.id);

        // Update hardware status text
        const status = await aiSwitchboard.checkAvailability();
        if (status === 'readily') UI.setHardwareStatus('status_ready');
        else if (status === 'after-download') UI.setHardwareStatus('status_needs_dl');
        else UI.setHardwareStatus('status_unsupported');
    });

    // API Selector
    UI.apiSelector.addEventListener('change', async (e) => {
        if (!currentProject) return;
        currentProject.apiMode = e.target.value;
        await storage.saveProject(currentProject);

        aiSwitchboard.setStrategy(e.target.value);
        UI.switchView(e.target.value);
        currentSession = null;
    });

    // New Project
    document.getElementById('new-project-btn').addEventListener('click', () => {
        const dict = locales[UI.langSelector.value];
        UI.showInputModal(dict.modal_new_chat, async (name) => {
            const p = {
                id: UUID(),
                name: name,
                systemPrompt: "You are a helpful AI.",
                history: [],
                apiMode: 'prompt'
            };
            await storage.saveProject(p);
            await refreshProjects();
            await loadProject(p.id);
        });
    });

    // Project List Clicks
    document.getElementById('project-list').addEventListener('click', async (e) => {
        const item = e.target.closest('.project-item');
        if (item) {
            const id = item.dataset.id;
            await loadProject(id);
            UI.renderProjects(await storage.getAllProjects(), id);
        }
    });

    // Execute
    document.getElementById('execute-btn').addEventListener('click', executeCommand);
    document.getElementById('user-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeCommand();
        }
    });

    // Help
    document.getElementById('help-toggle').addEventListener('click', () => {
        // Go back to welcome screen (landing state depends on readiness)
        UI.switchView('welcome');
        if (appReady) UI.setLandingState('ready');
        else UI.setLandingState('setup');
    });

    // Reset App
    document.getElementById('reset-toggle').addEventListener('click', async () => {
        const dict = locales[UI.langSelector.value];
        const c = confirm(dict.confirm_reset);
        if (c) {
            const projs = await storage.getAllProjects();
            for (let p of projs) await storage.deleteProject(p.id);
            window.location.reload();
        }
    });
}

async function executeCommand() {
    const mode = currentProject.apiMode;

    if (mode === 'rewriter') {
        const input = UI.rewriterInput.value;
        if (!input) return;

        UI.rewriterOutput.textContent = "Processing..."; // Localize?
        try {
            if (!currentSession) {
                currentSession = await aiSwitchboard.createSession({
                    tone: 'more-formal',
                    length: 'as-is'
                }, monitorDownload);
            }
            const result = await currentSession.rewrite(input);
            UI.rewriterOutput.textContent = result;
        } catch (e) {
            monitorError(e);
            UI.rewriterOutput.textContent = "Error: " + e.message;
        }
        return;
    }

    const input = UI.userInput.value.trim();
    if (!input) return;

    UI.userInput.value = '';
    UI.appendUserMessage(input);

    currentProject.history.push({ role: 'user', content: input });
    await storage.saveProject(currentProject);

    await runGenerativeLoop(input);
}

async function runGenerativeLoop(input) {
    const responseContainer = UI.createModelMessageContainer();
    let fullResponse = "";

    try {
        if (!currentSession) {
            currentSession = await aiSwitchboard.createSession({
                systemPrompt: currentProject.systemPrompt
            }, monitorDownload);
        }

        const stream = currentSession.promptStreaming(input);

        for await (const chunk of stream) {
            fullResponse = chunk;
            UI.updateMessageContent(responseContainer, fullResponse);
        }

        currentProject.history.push({ role: 'model', content: fullResponse });
        await storage.saveProject(currentProject);

    } catch (e) {
        monitorError(e);
        responseContainer.textContent += `\n[Error]: ${e.message}`;
    }
}

function monitorDownload(m) {
    m.addEventListener('downloadprogress', (e) => {
        UI.showLoader(true);
        UI.updateProgress(e.loaded, e.total);
        if (e.loaded === e.total) {
            setTimeout(() => UI.showLoader(false), 1000);
        }
    });
}

function monitorError(e) {
    console.error(e);
    if (e.message.includes('download') || e.message === 'Target model not ready') {
        UI.showLoader(true);
    }
}

// Boot
init().catch(console.error);
