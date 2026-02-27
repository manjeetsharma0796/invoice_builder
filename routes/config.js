const express = require("express");
const { getConfig, setProvider, getLLM } = require("../services/llm");
const { HumanMessage } = require("@langchain/core/messages");

const router = express.Router();

/**
 * GET /api/config/providers
 * List all available providers and current selection
 */
router.get("/providers", (req, res) => {
    const config = getConfig();
    res.json({ success: true, ...config });
});

/**
 * POST /api/config/set
 * Switch active provider and model
 * Body: { provider: "openai", model: "gpt-4o" }
 */
router.post("/set", (req, res) => {
    try {
        const { provider, model } = req.body;

        if (!provider) {
            return res.status(400).json({
                success: false,
                error: "Provider is required",
            });
        }

        const result = setProvider(provider, model);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/config/test
 * Test if the current provider/model API key works
 * Sends a tiny prompt and checks for a valid response
 */
router.post("/test", async (req, res) => {
    try {
        const { provider, model } = req.body;
        if (provider) {
            setProvider(provider, model);
        }

        const config = getConfig();
        const maskedKey = getApiKey(config.activeProvider);
        console.log(`[TEST] Provider: ${config.activeProvider}`);
        console.log(`[TEST] Model:    ${config.activeModel}`);
        console.log(`[TEST] API Key:  ${maskedKey}`);

        const llm = getLLM();
        const response = await llm.invoke([
            new HumanMessage({ content: "Reply with only the word: OK" }),
        ]);

        const reply = typeof response.content === "string" ? response.content.trim() : "";
        console.log(`[TEST] Reply: ${reply}`);

        if (reply.length > 0) {
            res.json({ success: true, status: "connected", reply });
        } else {
            res.json({ success: false, status: "no_response", error: "Empty response from model" });
        }
    } catch (err) {
        console.error(`[TEST] Error: ${err.message}`);
        res.json({
            success: false,
            status: "error",
            error: err.message || "Connection failed",
        });
    }
});

/** Returns masked API key for the given provider */
function getApiKey(provider) {
    const keyMap = {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        google: process.env.GOOGLE_API_KEY,
        mistral: process.env.MISTRAL_API_KEY,
        groq: process.env.GROQ_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
        together: process.env.TOGETHER_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        nvidia: process.env.NVIDIA_API_KEY,
        ollama: "(no key needed)",
    };
    const key = keyMap[provider] || "(not set)";
    if (key.length > 10) return key.slice(0, 6) + "..." + key.slice(-4);
    return key === "(not set)" || key === "(no key needed)" ? key : "(too short)";
}

module.exports = router;
