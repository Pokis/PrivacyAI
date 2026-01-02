/**
 * PrivacyAI AI Service
 * Implements Strategy Pattern for different AI Capabilities.
 */

// Strategy Interface
// Strategy Interface
class AIStrategy {
    async createSession(options, monitorCallback) {
        throw new Error("Method 'createSession' must be implemented.");
    }
    getCapabilityName() { return 'languageModel'; }
}

class ChatStrategy extends AIStrategy {
    getCapabilityName() { return 'languageModel'; }

    async createSession(options, monitorCallback) {
        // Support both old window.ai.languageModel and new window.LanguageModel
        const factory = window.ai?.languageModel || window.LanguageModel;

        if (!factory) {
            throw new Error("AI_FLAGS_MISSING");
        }

        const config = {
            systemPrompt: options.systemPrompt || "You are a helpful assistant.",
        };

        if (monitorCallback && options.monitor) {
            config.monitor = options.monitor;
        }

        // Factory pattern might vary (create vs new)
        if (factory.create) return await factory.create(config);
        return new factory(config);
    }
}

// Fallback Writer that uses the generic Language Model if dedicated Writer API is missing
class WriterStrategy extends AIStrategy {
    getCapabilityName() { return 'writer'; }

    async createSession(options, monitorCallback) {
        if (!window.Writer) throw new Error("WRITER_API_MISSING");

        const session = await window.Writer.create({
            sharedContext: options.sharedContext || "",
            monitor(m) {
                m.addEventListener("downloadprogress", e => {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    console.log(`Writer Download: ${percent}%`);
                    if (window.UI && UI.showDownloadProgress) UI.showDownloadProgress(percent);
                });
            }
        });

        // Adapter to match app.js expectation of promptStreaming
        return {
            session: session,
            promptStreaming: async function* (prompt) {
                const stream = session.writeStreaming(prompt);
                for await (const chunk of stream) {
                    yield chunk;
                }
            },
            destroy: () => session.destroy()
        };
    }
}

class RewriterStrategy extends AIStrategy {
    getCapabilityName() { return 'rewriter'; }

    async createSession(options, monitorCallback) {
        if (!window.Rewriter) throw new Error("REWRITER_API_MISSING");

        const session = await window.Rewriter.create({
            tone: options.tone || 'more-formal',
            length: options.length || 'as-is',
            monitor(m) {
                m.addEventListener("downloadprogress", e => {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    console.log(`Rewriter Download: ${percent}%`);
                    if (window.UI && UI.showDownloadProgress) UI.showDownloadProgress(percent);
                });
            }
        });

        // Adapter to match app.js expectation of promptStreaming
        return {
            session: session,
            // Expose rewrite for app.js direct usage
            rewrite: (text, options) => session.rewrite(text, options),
            promptStreaming: async function* (input) {
                const stream = session.rewriteStreaming(input);
                for await (const chunk of stream) {
                    yield chunk;
                }
            },
            destroy: () => session.destroy()
        };
    }
}

class AISwitchboard {
    constructor() {
        this.strategies = {
            'prompt': new ChatStrategy(),
            'writer': new WriterStrategy(),
            'rewriter': new RewriterStrategy()
        };
        this.currentStrategy = this.strategies['prompt'];
    }

    setStrategy(mode) {
        if (this.strategies[mode]) {
            this.currentStrategy = this.strategies[mode];
            console.log("Strategy set to:", mode);
        }
    }

    async createSession(options, monitorCallback) {
        return await this.currentStrategy.createSession(options, monitorCallback);
    }

    async checkAvailability() {
        console.log("AI: Checking availability...");

        // Check for any valid AI entry point
        const hasAI = window.ai || window.LanguageModel || window.Summarizer;

        let attempts = 0;
        while (!hasAI && attempts < 10 && !window.LanguageModel) { // Poll specifically for LanguageModel
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }

        if (window.LanguageModel || window.ai?.languageModel) {
            try {
                // Check capability availability
                const factory = window.ai?.languageModel || window.LanguageModel;
                // Availability API might be on factory or instance? 
                // Spec is flux. Usually factory.availability()
                if (factory.availability) {
                    const status = await factory.availability();
                    console.log("LanguageModel availability:", status);
                    return status;
                }
                return 'readily'; // Assume ready if constructor exists but no availability method
            } catch (e) {
                console.warn("Error checking availability:", e);
                return 'readily'; // Optimistic fallback
            }
        }

        return 'no';
    }
    async getDiagnostics() {
        const report = {
            isSecure: window.isSecureContext,
            protocol: window.location.protocol,
            // Broad check for any AI capability
            windowAI: !!(window.ai || window.Writer || window.Rewriter || window.LanguageModel),
            promptAPI: 'checking...',
            writerAPI: 'checking...',
            rewriterAPI: 'checking...'
        };

        // Check Prompt API (LangaugeModel)
        try {
            const lm = window.ai?.languageModel || window.LanguageModel;
            if (lm) {
                if (lm.capabilities) {
                    const capabilities = await lm.capabilities();
                    report.promptAPI = capabilities.available === 'readily' ? 'available' : capabilities.available;
                } else {
                    report.promptAPI = 'available'; // Implied if class exists
                }
            } else {
                report.promptAPI = 'missing';
            }
        } catch (e) { report.promptAPI = 'error'; }

        // Check Writer
        try {
            if (window.Writer) {
                const wStatus = await window.Writer.availability();
                report.writerAPI = wStatus === 'readily' ? 'available' : wStatus;
            } else {
                report.writerAPI = 'missing';
            }
        } catch (e) { report.writerAPI = 'error'; }

        // Check Rewriter
        try {
            if (window.Rewriter) {
                const rStatus = await window.Rewriter.availability();
                report.rewriterAPI = rStatus === 'readily' ? 'available' : rStatus;
            } else {
                report.rewriterAPI = 'missing';
            }
        } catch (e) { report.rewriterAPI = 'error'; }

        return report;
    }

    async probeEnvironment() {
        console.log("Run Deep Probe v3 invoked");
        const findings = [];

        // 1. Check Namespaces
        if (window.ai) {
            findings.push(`window.ai found (Keys: ${Object.keys(window.ai).join(', ')})`);

            // Explicit checks
            if (window.ai.writer) findings.push(`window.ai.writer: ${typeof window.ai.writer}`);
            else findings.push('window.ai.writer: UNDEFINED');

            if (window.ai.rewriter) findings.push(`window.ai.rewriter: ${typeof window.ai.rewriter}`);
            else findings.push('window.ai.rewriter: UNDEFINED');

        } else {
            findings.push('window.ai MISSING');
        }

        // 2. Check Constructors
        if (window.LanguageModel) findings.push('window.LanguageModel found');
        if (window.AI) findings.push('window.AI found');
        if (navigator.ai) findings.push('navigator.ai found');

        // 3. Check Security Headers
        if (window.crossOriginIsolated) findings.push('Security: crossOriginIsolated (OK)');
        else findings.push('Security: NOT Isolated (Missing COOP/COEP headers)');

        if (window.SharedArrayBuffer) findings.push('Buffer: SharedArrayBuffer (OK)');
        else findings.push('Buffer: SharedArrayBuffer MISSING');

        // 4. Storage Quota
        let storageType = 'Standard';
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                if (est.quota < 400000000) storageType = 'Low Quota/Incognito';
            }
        } catch (e) { }

        const result = {
            findings: findings.length ? findings.join(', ') : 'No AI Objects Found',
            headers: window.crossOriginIsolated ? 'OK' : 'MISSING',
            storage: storageType,
            userAgent: navigator.userAgent
        };
        console.log("Deep Probe Result:", result);
        return result;
    }
}

export const aiSwitchboard = new AISwitchboard();
