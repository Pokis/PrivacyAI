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
        if (!window.ai) return 'no';

        try {
            const capability = this.currentStrategy.getCapabilityName();
            if (!window.ai[capability]) return 'no';

            // Add timeout implementation to prevent hanging indefinitely
            const checkPromise = window.ai[capability].availability();
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 2000));

            const result = await Promise.race([checkPromise, timeoutPromise]);

            if (result === 'timeout') {
                console.warn("AI Availability check timed out");
                return 'no'; // or 'readily' if we want to be optimistic, but 'no' forces setup guide which might be safer
            }
            return result;
        } catch (e) {
            console.warn("Availability check failed", e);
            return 'no'; // Safest fallback
        }
    }
}

export const aiSwitchboard = new AISwitchboard();
