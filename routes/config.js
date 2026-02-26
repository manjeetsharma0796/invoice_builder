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
    // Optionally switch provider before testing
    const { provider, model } = req.body;
    if (provider) {
      setProvider(provider, model);
    }

    const llm = getLLM();
    const response = await llm.invoke([
      new HumanMessage({ content: "Reply with only the word: OK" }),
    ]);

    const reply = typeof response.content === "string" ? response.content.trim() : "";

    if (reply.length > 0) {
      res.json({ success: true, status: "connected", reply });
    } else {
      res.json({ success: false, status: "no_response", error: "Empty response from model" });
    }
  } catch (err) {
    res.json({
      success: false,
      status: "error",
      error: err.message || "Connection failed",
    });
  }
});

module.exports = router;
