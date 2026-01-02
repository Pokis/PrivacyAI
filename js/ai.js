/**
 * PrivacyAI AI Service
 * Implements Strategy Pattern for different AI Capabilities.
 */

// Strategy Interface
class AIStrategy {
    async createSession(options, monitorCallback) {
        throw new Error("Method 'createSession' must be implemented.");
    }

    // For availability check
    getCapabilityName() {
        throw new Error("Method 'getCapabilityName' must be implemented.");
    }
}

class ChatStrategy extends AIStrategy {
    getCapabilityName() { return 'languageModel'; }

    async createSession(options, monitorCallback) {
        if (!window.ai || !window.ai.languageModel) {
            throw new Error("AI_FLAGS_MISSING");
        }

        const config = {
            systemPrompt: options.systemPrompt || "You are a helpful assistant.",
        };

        if (monitorCallback) {
            config.monitor = monitorCallback;
        }

        return await window.ai.languageModel.create(config);
    }
}

class WriterStrategy extends AIStrategy {
    getCapabilityName() { return 'writer'; }

    async createSession(options, monitorCallback) {
        if (!window.ai || !window.ai.writer) {
            throw new Error("WRITER_API_MISSING");
        }

        // Writer API typically takes context or sharedContext
        const config = {
            sharedContext: options.sharedContext || ""
        };

        if (monitorCallback) {
            config.monitor = monitorCallback;
        }

        return await window.ai.writer.create(config);
    }
}

class RewriterStrategy extends AIStrategy {
    getCapabilityName() { return 'rewriter'; }

    async createSession(options, monitorCallback) {
        if (!window.ai || !window.ai.rewriter) {
            throw new Error("REWRITER_API_MISSING");
        }

        const config = {
            tone: options.tone || 'more-formal',
            length: options.length || 'as-is'
        };

        if (monitorCallback) {
            config.monitor = monitorCallback;
        }

        return await window.ai.rewriter.create(config);
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

        // Poll for window.ai for up to 3 seconds
        let attempts = 0;
        while (!window.ai && attempts < 30) {
            await new Promise(r => setTimeout(r, 100)); // 100ms * 30 = 3000ms
            attempts++;
        }

        console.log(`AI: window.ai present after ${attempts * 100}ms?`, !!window.ai);

        if (!window.ai) {
            console.warn("AI: window.ai missing after polling.");
            return 'no';
        }

        try {
            const capability = this.currentStrategy.getCapabilityName();
            if (!window.ai[capability]) {
                console.warn(`AI: window.ai.${capability} missing`);
                return 'no';
            }

            // Add timeout implementation to prevent hanging indefinitely
            const checkPromise = window.ai[capability].availability();
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 2000));

            const result = await Promise.race([checkPromise, timeoutPromise]);

            console.log("AI: Availability result:", result);

            if (result === 'timeout') {
                console.warn("AI Availability check timed out");
                return 'no'; // Fallback to setup
            }
            return result;
        } catch (e) {
            console.warn("Availability check failed", e);
            return 'no'; // Safest fallback
        }
    }
    async getDiagnostics() {
        console.log("Checking AI Diagnostics...");

        // Polyfill/Alias check for newer Chrome versions which might use window.model
        if (!window.ai && window.model) {
            console.log("Found window.model, aliasing to window.ai");
            window.ai = window.model;
        }

        console.log("window.ai:", window.ai);
        console.log("Environment:", {
            secure: window.isSecureContext,
            protocol: location.protocol,
            host: location.host
        });

        if (window.ai) {
            console.log("window.ai capabilities:", Object.keys(window.ai));
        }

        const report = {
            windowAI: !!window.ai,
            isSecure: window.isSecureContext,
            protocol: location.protocol,
            promptAPI: 'missing',
            writerAPI: 'missing',
            rewriterAPI: 'missing'
        };

        if (window.ai) {
            const check = async (cap) => {
                if (!window.ai[cap]) return 'missing';
                try {
                    // race with timeout
                    const p = window.ai[cap].availability();
                    const t = new Promise(r => setTimeout(() => r('timeout'), 1000));
                    return await Promise.race([p, t]);
                } catch (e) { return 'error'; }
            };

            report.promptAPI = await check('languageModel');
            report.writerAPI = await check('writer');
            report.rewriterAPI = await check('rewriter');
        }
        return report;
    }
}

export const aiSwitchboard = new AISwitchboard();
