const fs = require("fs");
const path = require("path");
const { HumanMessage } = require("@langchain/core/messages");
const { getLLM, getConfig, isVisionCapable } = require("./llm");
const { prepareForLLM } = require("./fileHandler");

// Load invoice schema
const invoiceSchema = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "..", "schema", "invoiceSchema.json"),
        "utf-8"
    )
);

// Build the extraction prompt with the schema embedded
function buildExtractionPrompt() {
    return `You are an invoice data extraction API. Your ONLY output must be a single RFC-8259 compliant JSON object.

CRITICAL RULES — VIOLATION CAUSES SYSTEM FAILURE:
1. Output MUST start with { and end with }
2. NO markdown, NO bullet points, NO explanations, NO prose text
3. NO text before or after the JSON
4. NO \`\`\`json fences or any code fences
5. ONLY the raw JSON object — nothing else

Extract every visible field from the invoice into this exact schema:

${JSON.stringify(invoiceSchema, null, 2)}

Field rules:
- Use null for any field not visible in the invoice
- Dates: YYYY-MM-DD format
- Numbers: actual numbers (not strings)
- Currency: 3-letter ISO code (INR, USD, EUR, GBP, etc.)
- line_items: always an array, even for a single item
- Do NOT invent or guess data — extract only what is visible

REMEMBER: Your entire response must be ONLY the JSON object. Start with { immediately.`;
}

// Rescue prompt: convert a markdown/prose answer back to JSON
function buildRescuePrompt(markdownResponse) {
    return `You previously described an invoice in markdown/prose format instead of JSON. Convert it to the required JSON schema.

The schema is:
${JSON.stringify(invoiceSchema, null, 2)}

The markdown description you produced was:
---
${markdownResponse.slice(0, 3000)}
---

Now output ONLY the JSON object. Start with { immediately. No markdown, no explanation.`;
}

/**
 * Extract invoice data from a file using AI
 * @param {string} filePath - path to the uploaded invoice file
 * @param {string} mimetype - MIME type of the file
 * @returns {object} extracted invoice data
 */
async function extractInvoice(filePath, mimetype, contextId) {
    const logPrefix = contextId ? `[${contextId}] ` : "";
    const startedAt = Date.now();

    const cfg = getConfig();
    console.log(`${logPrefix}━━━ EXTRACTION START ━━━`);
    console.log(`${logPrefix}Provider : ${cfg.activeProvider}`);
    console.log(`${logPrefix}Model    : ${cfg.activeModel}`);
    console.log(`${logPrefix}File     : ${path.basename(filePath)} (${mimetype})`);
    console.log(`${logPrefix}━━━━━━━━━━━━━━━━━━━━━━━━`);

    const prepared = await prepareForLLM(filePath, mimetype);
    const llm = getLLM();

    let messageContent;

    if (prepared.type === "image") {
        // Check if the selected model actually supports vision
        if (!isVisionCapable(cfg.activeModel)) {
            console.warn(`${logPrefix}⚠️  Model "${cfg.activeModel}" does not support vision.`);
            console.warn(`${logPrefix}   Invoices that are images or scanned PDFs require a vision model.`);
            return {
                success: false,
                error: `Model "${cfg.activeModel}" does not support image/vision input.`,
                parseError: `This invoice is an image or scanned PDF. Please switch to a vision-capable model (e.g. gemini-2.0-flash, gpt-4o, claude-3-5-sonnet, meta/llama-3.2-11b-vision-instruct).`,
                rawResponse: null,
            };
        }
        // Vision-based extraction
        console.log(`${logPrefix}Using vision extraction (image/pdf)`);
        messageContent = [
            { type: "text", text: buildExtractionPrompt() },
            {
                type: "image_url",
                image_url: { url: prepared.dataUri, detail: "high" },
            },
        ];
    } else {
        // Text-based extraction (text PDF)
        console.log(`${logPrefix}Using text extraction (PDF text, length=${prepared.content.length})`);
        messageContent = [
            {
                type: "text",
                text: `${buildExtractionPrompt()}\n\n--- INVOICE TEXT ---\n${prepared.content}`,
            },
        ];
    }

    let response;
    try {
        response = await llm.invoke([new HumanMessage({ content: messageContent })]);
    } catch (llmErr) {
        const msg = llmErr.message || "";
        const status = llmErr.status || llmErr.statusCode || 0;
        console.error(`${logPrefix}❌ LLM call failed: ${msg.slice(0, 300)}`);

        // Classify common errors
        let friendlyError = "LLM API call failed";
        let friendlyDetail = msg.slice(0, 400);

        if (status === 429 || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate limit")) {
            friendlyError = `API quota or rate limit exceeded for ${cfg.activeProvider}`;
            friendlyDetail = "Your free-tier quota is exhausted. Please wait, upgrade your plan, or switch to a different provider/model.";
        } else if (status === 401 || msg.includes("401") || msg.includes("Unauthorized") || msg.includes("Invalid API key")) {
            friendlyError = `Invalid or missing API key for ${cfg.activeProvider}`;
            friendlyDetail = `Set ${cfg.activeProvider.toUpperCase()}_API_KEY in your .env file.`;
        } else if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("ECONNRESET")) {
            friendlyError = `Request to ${cfg.activeProvider} timed out`;
            friendlyDetail = "The API did not respond in time. Try again or switch to a faster model.";
        } else if (status === 400 || msg.includes("400")) {
            friendlyError = `Bad request to ${cfg.activeProvider}`;
            friendlyDetail = msg.includes("does not support") || msg.includes("multimodal")
                ? `Model "${cfg.activeModel}" does not support image input. Please select a vision model.`
                : msg.slice(0, 300);
        }

        return { success: false, error: friendlyError, parseError: friendlyDetail, rawResponse: null };
    }
    const elapsed = Date.now() - startedAt;
    console.log(`${logPrefix}LLM response received in ${elapsed} ms`);

    // ── VERBOSE: full raw response ──────────────────────────────────────
    const rawContent = response.content;
    console.log(`${logPrefix}━━━ RAW AI RESPONSE (${rawContent.length} chars) ━━━`);
    console.log(rawContent);
    console.log(`${logPrefix}━━━ END RAW RESPONSE ━━━`);

    // ── Pass 1: strip fences and try direct parse ──────────────────────
    const parsed1 = tryParseJSON(rawContent, logPrefix, "Pass 1 (direct)");
    if (parsed1) {
        return { success: true, data: parsed1, rawResponse: rawContent };
    }

    // ── Pass 2: find first { ... } JSON block in the text ─────────────
    console.log(`${logPrefix}Pass 2: scanning for embedded JSON block...`);
    const jsonBlock = extractJSONBlock(rawContent);
    if (jsonBlock) {
        const parsed2 = tryParseJSON(jsonBlock, logPrefix, "Pass 2 (embedded block)");
        if (parsed2) {
            return { success: true, data: parsed2, rawResponse: rawContent };
        }
    }

    // ── Pass 3: rescue LLM call — convert markdown → JSON ─────────────
    console.log(`${logPrefix}Pass 3: asking LLM to convert its markdown response to JSON...`);
    try {
        const rescueResponse = await llm.invoke([
            new HumanMessage({ content: buildRescuePrompt(rawContent) }),
        ]);
        const rescueRaw = rescueResponse.content;
        console.log(`${logPrefix}Rescue response (${rescueRaw.length} chars): ${rescueRaw.slice(0, 200)}`);

        const parsed3 = tryParseJSON(rescueRaw, logPrefix, "Pass 3 (rescue)");
        if (parsed3) {
            return { success: true, data: parsed3, rawResponse: rawContent };
        }

        // last attempt: extract block from rescue response
        const rescueBlock = extractJSONBlock(rescueRaw);
        if (rescueBlock) {
            const parsed4 = tryParseJSON(rescueBlock, logPrefix, "Pass 4 (rescue block)");
            if (parsed4) {
                return { success: true, data: parsed4, rawResponse: rawContent };
            }
        }
    } catch (rescueErr) {
        console.error(`${logPrefix}Rescue call failed: ${rescueErr.message}`);
    }

    // ── All passes failed ──────────────────────────────────────────────
    console.error(`${logPrefix}❌ All JSON parse attempts failed.`);
    return {
        success: false,
        error: "Failed to parse AI response as JSON",
        parseError: "Model returned non-JSON text (markdown/prose). All 4 repair passes failed.",
        rawResponse: rawContent,
    };
}

/** Strip code fences and try JSON.parse. Returns parsed object or null. */
function tryParseJSON(text, logPrefix, label) {
    const cleaned = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

    // Quick sanity: must start with {
    if (!cleaned.startsWith("{")) {
        console.log(`${logPrefix}${label}: skipped (does not start with {) — starts with: ${JSON.stringify(cleaned.slice(0, 30))}`);
        return null;
    }

    try {
        const data = JSON.parse(cleaned);
        console.log(`${logPrefix}✅ ${label}: JSON parsed OK. Keys: ${Object.keys(data).join(", ")}`);
        return data;
    } catch (e) {
        const badPos = parseInt((e.message.match(/position (\d+)/) || [])[1]);
        console.log(`${logPrefix}${label}: parse failed — ${e.message}${!isNaN(badPos) ? ` (near: ...${cleaned.slice(Math.max(0, badPos - 30), badPos + 30)}...)` : ""}`);
        return null;
    }
}

/** Find the outermost { ... } JSON object in a string. */
function extractJSONBlock(text) {
    const start = text.indexOf("{");
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\" && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

module.exports = { extractInvoice };
