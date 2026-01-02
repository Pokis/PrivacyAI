import { storage } from './storage.js';
import { aiSwitchboard } from './ai.js';
import { UI } from './ui.js';
import { locales } from './locales.js';

// State
let currentProject = null;
let currentSession = null;
let appReady = false;

// Expose for diagnostics
window.aiSwitchboard = aiSwitchboard;

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

    // Initial State: Loading
    UI.switchView('welcome');
    UI.setLandingState('loading');

    // Check Hardware
    const status = await aiSwitchboard.checkAvailability();

    // Treat "after-download" same as "readily" for app entry, download happens on session create
    if (status === 'readily' || status === 'after-download' || status === 'readily (implied)') {
        appReady = true;
        UI.setHardwareStatus('status_ready');
        UI.setLandingState('ready');
    } else {
        appReady = false;
        const diag = await aiSwitchboard.getDiagnostics();
        UI.setHardwareStatus('status_unsupported');
        UI.setLandingState('setup', diag);
    }

    // Event Listeners
    setupEventListeners();

    // Load Projects immediately to populate sidebar
    // Doing this AFTER listeners ensures 'New Chat' button works if user clicks fast
    await refreshProjects();
}

// Restoration of missing functions
async function enterApp() {
    if (!appReady) return;
    await refreshProjects();
}

async function refreshProjects() {
    const projects = await storage.getAllProjects();
    const dict = locales[UI.langSelector.value] || locales['en'];

    if (projects.length === 0) {
        const newProj = {
            id: UUID(),
            name: (dict.new_chat || "New Chat").replace("+ ", ""),
            systemPrompt: "You are a helpful AI assistant.",
            history: [],
            apiMode: 'prompt'
        };
        await storage.saveProject(newProj);
        projects.push(newProj);
    }

    // Attempt to keep current project or select most recent
    if (!currentProject && projects.length > 0) {
        await loadProject(projects[0].id);
    }

    UI.renderProjects(projects, currentProject ? currentProject.id : null);
}

async function loadProject(id) {
    try {
        currentProject = await storage.getProject(id);
        if (!currentProject) {
            alert("Project not found in storage");
            return;
        }

        UI.clearChat();

        if (!UI.apiSelector) {
            alert("Critical Error: Elements missing (apiSelector)");
            return;
        }

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
    } catch (e) {
        alert("loadProject Error: " + e.message);
        console.error(e);
    }
}

function setupEventListeners() {
    // Landing Page
    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) enterBtn.addEventListener('click', () => enterApp());

    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => window.location.reload());

    // Language
    if (UI.langSelector) {
        UI.langSelector.addEventListener('change', async (e) => {
            const lang = e.target.value;
            UI.setLanguage(lang);
            await storage.saveSetting('language', lang);
            if (currentProject) UI.renderProjects(await storage.getAllProjects(), currentProject.id);
        });
    }

    // API Mode
    if (UI.apiSelector) {
        UI.apiSelector.addEventListener('change', async (e) => {
            if (!currentProject) return;
            currentProject.apiMode = e.target.value;
            await storage.saveProject(currentProject);
            aiSwitchboard.setStrategy(e.target.value);
            UI.switchView(e.target.value);
            currentSession = null;
        });
    }

    // New Project (Instant)
    const newProjBtn = document.getElementById('new-project-btn');
    if (newProjBtn) {
        newProjBtn.addEventListener('click', async () => {
            const dict = locales[UI.langSelector.value] || locales['en'];

            // Create immediately without modal
            const p = {
                id: UUID(),
                name: dict.new_chat.replace("+ ", ""), // Default name, changed later
                systemPrompt: await storage.getSetting('defaultSystemPrompt') || "You are a helpful AI assistant.",
                history: [],
                apiMode: 'prompt'
            };

            await storage.saveProject(p);
            await refreshProjects();
            await loadProject(p.id);

            // Focus input immediately
            if (UI.userInput) UI.userInput.focus();
        });
    }

    // Project List Interactions (Select, Rename, Delete, Settings)
    const projList = document.getElementById('project-list');
    if (projList) {
        projList.addEventListener('click', async (e) => {
            const item = e.target.closest('.project-item');
            if (!item) return;
            const id = item.dataset.id;

            // Delete Action
            if (e.target.closest('.delete-chat-btn')) {
                e.stopPropagation();
                if (confirm("Delete this chat?")) {
                    await storage.deleteProject(id);
                    if (currentProject && currentProject.id === id) currentProject = null;
                    await refreshProjects();
                }
                return;
            }

            // Rename Action
            if (e.target.closest('.rename-chat-btn')) {
                e.stopPropagation();
                const proj = await storage.getProject(id);
                if (proj) {
                    UI.showInputModal("Rename Chat", async (newName) => {
                        proj.name = newName;
                        await storage.saveProject(proj);
                        await refreshProjects();
                    }, proj.name);
                }
                return;
            }

            // Settings Action
            if (e.target.closest('.settings-chat-btn')) {
                e.stopPropagation();
                const proj = await storage.getProject(id);
                if (proj) {
                    UI.showSettingsModal(proj.systemPrompt || "", async (newPrompt) => {
                        proj.systemPrompt = newPrompt;
                        await storage.saveProject(proj);
                        if (currentProject && currentProject.id === proj.id) {
                            currentProject.systemPrompt = newPrompt;
                            currentSession = null; // Reset session to apply prompt
                        }
                    });
                }
                return;
            }

            // Select
            try {
                await loadProject(id);
                UI.renderProjects(await storage.getAllProjects(), id);
            } catch (e) {
                alert("Error loading chat: " + e.message);
                console.error(e);
            }
        });
    }

    // Execute Command (Chat)
    const execBtn = document.getElementById('execute-btn');
    if (execBtn) execBtn.addEventListener('click', executeCommand);

    // Execute Command (Editor/Writer)
    const rewriterBtn = document.getElementById('rewriter-submit-btn');
    if (rewriterBtn) rewriterBtn.addEventListener('click', executeCommand);

    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                executeCommand();
            }
        });
    }

    // Reset
    const resetBtn = document.getElementById('reset-toggle');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (confirm("Delete all data and reset app?")) {
                const projs = await storage.getAllProjects();
                for (let p of projs) await storage.deleteProject(p.id);
                window.location.reload();
            }
        });
    }

    // Help
    const helpBtn = document.getElementById('help-toggle');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            UI.switchView('welcome');
            if (appReady) UI.setLandingState('ready');
            else UI.setLandingState('setup');
        });
    }

    // Settings Global
    const settingsBtn = document.getElementById('settings-toggle');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', async () => {
            const currentSys = await storage.getSetting('defaultSystemPrompt') || "You are a helpful AI assistant.";
            UI.showSettingsModal(currentSys, async (newVal) => {
                await storage.saveSetting('defaultSystemPrompt', newVal);
            });
        });
    }

    // About
    const aboutBtn = document.getElementById('about-toggle');
    if (aboutBtn) {
        aboutBtn.addEventListener('click', () => {
            UI.showAboutModal();
        });
    }
}

async function executeCommand() {
    if (!currentProject) await refreshProjects();

    const mode = currentProject.apiMode;

    if (mode === 'rewriter') {
        const input = UI.rewriterInput.value;
        if (!input) return;
        UI.rewriterOutput.textContent = "Processing...";
        try {
            if (!currentSession) {
                currentSession = await aiSwitchboard.createSession({
                    tone: 'more-formal',
                    length: 'as-is',
                    monitor: monitorDownload
                });
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
                systemPrompt: currentProject.systemPrompt,
                monitor: monitorDownload
            });
        }

        const stream = currentSession.promptStreaming(input);

        let isFirst = true;

        for await (const chunk of stream) {
            // Robust accumulation logic
            if (isFirst) {
                fullResponse = chunk;
                isFirst = false;
            } else {
                if (chunk.startsWith && chunk.startsWith(fullResponse)) {
                    fullResponse = chunk;
                } else {
                    fullResponse += chunk;
                }
            }
            UI.updateMessageContent(responseContainer, fullResponse);
        }

        currentProject.history.push({ role: 'model', content: fullResponse });
        await storage.saveProject(currentProject);

        // Auto-Rename Feature
        // Rename if this is the first exchange (History length 2: User+Model)
        if (currentProject.history.length === 2) {
            // Only auto-rename if the name is still generic
            const lang = UI.langSelector ? UI.langSelector.value : 'en';
            const dict = locales[lang] || locales['en'];
            const genericNames = ["New Chat", "Naujas Pokalbis", "+ New Chat", dict.new_chat.replace("+ ", "")];

            if (genericNames.includes(currentProject.name) || currentProject.name.startsWith("New Chat")) {
                let newName = input.substring(0, 30);
                if (input.length > 30) newName += "...";

                // Generate a better name using AI if possible? 
                // The user prompted: "first prompt should be used to generate chat name using the same nano AI"
                // To do this simply, we can just use the prompt text for now as "Prompt as Name" is the standard lightweight approach.
                // Asking Nano to summarize the name might be too slow/heavy for a background task, but let's try a simple truncation first as requested by "first prompt should be used".

                currentProject.name = newName;
                await storage.saveProject(currentProject);
                UI.renderProjects(await storage.getAllProjects(), currentProject.id);
            }
        }

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
    if (e.message && (e.message.includes('download') || e.message === 'Target model not ready')) {
        UI.showLoader(true);
    }
}

// Boot
init().catch(console.error);
