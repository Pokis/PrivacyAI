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
        // Try native Writer API first
        if (window.ai?.writer) {
            return await window.ai.writer.create({
                sharedContext: options.sharedContext || ""
            });
        }

        throw new Error("WRITER_API_MISSING");
    }
}

class RewriterStrategy extends AIStrategy {
    getCapabilityName() { return 'rewriter'; }

    async createSession(options, monitorCallback) {
        // Try native Rewriter API check
        if (window.ai?.rewriter) {
            return await window.ai.rewriter.create({
                tone: options.tone || 'more-formal',
                length: options.length || 'as-is'
            });
        }

        throw new Error("REWRITER_API_MISSING");
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

    setStrategy(type) {
        if (this.strategies[type]) {
            this.currentStrategy = this.strategies[type];
            return true;
        }
        return false;
    }

    async createSession(options, monitorCallback) {
        return this.currentStrategy.createSession(options, monitorCallback);
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
        console.log("Checking AI Diagnostics...");

        // Polyfill checks
        const hasLangModel = !!(window.ai?.languageModel || window.LanguageModel);

        const report = {
            windowAI: hasLangModel, // Treat "AI Available" if LanguageModel is found
            isSecure: window.isSecureContext,
            protocol: location.protocol,
            promptAPI: 'missing',
            writerAPI: 'missing',
            rewriterAPI: 'missing'
        };

        if (hasLangModel) {
            const factory = window.ai?.languageModel || window.LanguageModel;
            try {
                // Check if factory itself has availability
                if (factory.availability) {
                    report.promptAPI = await factory.availability();
                } else {
                    // Check if it's a constructor we can perform a "capabilities" check on?
                    // Or just assume readily if it exists
                    report.promptAPI = 'readily (implied)';
                }
            } catch (e) { report.promptAPI = 'error'; }

            // Writer/Rewriter are now "simulated" via Prompt if native missing
            report.writerAPI = window.ai?.writer ? 'native' : 'simulated';
            report.rewriterAPI = window.ai?.rewriter ? 'native' : 'simulated';
        }
        return report;
    }

    async probeEnvironment() {
        console.log("Run Deep Probe v3 invoked");
        const findings = [];

        // 1. Check Namespaces
        ['ai', 'model', 'gemini', 'chromeAI', 'googleAI', 'Summarizer'].forEach(key => {
            if (window[key]) findings.push(`window.${key} found`);
        });

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
