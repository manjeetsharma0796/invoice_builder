const { ChatOpenAI } = require("@langchain/openai");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");

// Runtime config — changed via API at runtime
const DEFAULT_PROVIDER = "google";
let activeProvider = process.env.ACTIVE_PROVIDER || DEFAULT_PROVIDER;
let activeModel = process.env.ACTIVE_MODEL || "gpt-4o";

// Vision-capable model name patterns (used to guard image_url messages)
const VISION_MODEL_PATTERNS = [
    /vision/i,
    /llava/i,
    /bakllava/i,
    /llama-3\.2/i,   // llama-3.2-11b-vision, llama-3.2-90b-vision
    /llama-4/i,       // llama-4-scout, llama-4-maverick (natively multimodal)
    /gemini/i,        // all gemini models support vision
    /gpt-4o/i,        // gpt-4o, gpt-4o-mini
    /gpt-4-turbo/i,
    /claude-3/i,      // all claude-3 models support vision
    /claude-3-5/i,
    /pixtral/i,
    /qwen.*vl/i,      // Qwen VL models
    /-vl-/i,          // nemotron-nano-vl
    /mistral-large/i, // latest mistral-large supports vision
    /mistral-small/i,
    /gemma3/i,        // gemma3 supports vision
];

/**
 * Returns true if the given model name supports vision/image input.
 * Used by extractor to gate image_url messages.
 */
function isVisionCapable(model) {
    return VISION_MODEL_PATTERNS.some((p) => p.test(model));
}

// Default LLM timeout — 90 seconds (long invoices can take a while)
const LLM_TIMEOUT_MS = 90_000;

const providers = {
    // Google: maxRetries:0 because 429 quota-exhausted retries are pointless
    //         and cause the server to hang for minutes.
    google: () =>
        new ChatGoogleGenerativeAI({
            model: activeModel,
            apiKey: process.env.GOOGLE_API_KEY,
            maxRetries: 0,
        }),

    // NVIDIA uses the OpenAI-compatible interface
    nvidia: () =>
        new ChatOpenAI({
            model: activeModel,
            apiKey: process.env.NVIDIA_API_KEY,
            configuration: { baseURL: "https://integrate.api.nvidia.com/v1" },
            timeout: LLM_TIMEOUT_MS,
            maxRetries: 1,
        }),
};

/**
 * Get LLM instance for the active provider
 */
function getLLM() {
    const factory = providers[activeProvider];
    if (!factory) {
        // Fallback to default provider if an invalid one is configured
        const fallback = providers[DEFAULT_PROVIDER];
        if (!fallback) {
            throw new Error(
                `Unknown provider: "${activeProvider}". Available: ${Object.keys(providers).join(", ")}`
            );
        }
        activeProvider = DEFAULT_PROVIDER;
        return fallback();
    }
    return factory();
}

/**
 * Set active provider and model at runtime
 */
function setProvider(provider, model) {
    if (!providers[provider]) {
        throw new Error(
            `Unknown provider: "${provider}". Available: ${Object.keys(providers).join(", ")}`
        );
    }
    activeProvider = provider;
    if (model) activeModel = model;
    return { provider: activeProvider, model: activeModel };
}

/**
 * Get current config
 */
function getConfig() {
    return {
        activeProvider,
        activeModel,
        availableProviders: Object.keys(providers),
    };
}

module.exports = { getLLM, setProvider, getConfig, isVisionCapable };
