const fs = require("fs");
const path = require("path");
const { HumanMessage } = require("@langchain/core/messages");
const { getLLM } = require("./llm");
const { prepareForLLM } = require("./fileHandler");

// Load invoice schema
const invoiceSchema = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "schema", "invoiceSchema.json"),
    "utf-8"
  )
);

const EXTRACTION_PROMPT = `You are an expert invoice data extraction AI. 
Analyze the provided invoice and extract ALL available information.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):

${JSON.stringify(invoiceSchema, null, 2)}

Rules:
- Extract every field you can find in the invoice
- Use null for fields not present in the invoice
- Dates must be in YYYY-MM-DD format
- Numbers must be actual numbers, not strings
- Currency should be a 3-letter code (INR, USD, EUR, etc.)
- Line items must be an array even if there's only one item
- Do NOT invent or hallucinate data — only extract what is visible
- Return ONLY the JSON object, nothing else`;

/**
 * Extract invoice data from a file using AI
 * @param {string} filePath - path to the uploaded invoice file
 * @param {string} mimetype - MIME type of the file
 * @returns {object} extracted invoice data
 */
async function extractInvoice(filePath, mimetype) {
  const prepared = await prepareForLLM(filePath, mimetype);
  const llm = getLLM();

  let messageContent;

  if (prepared.type === "image") {
    // Vision-based extraction
    messageContent = [
      { type: "text", text: EXTRACTION_PROMPT },
      {
        type: "image_url",
        image_url: { url: prepared.dataUri, detail: "high" },
      },
    ];
  } else {
    // Text-based extraction (text PDF)
    messageContent = [
      {
        type: "text",
        text: `${EXTRACTION_PROMPT}\n\n--- INVOICE TEXT ---\n${prepared.content}`,
      },
    ];
  }

  const response = await llm.invoke([new HumanMessage({ content: messageContent })]);

  // Parse the JSON from the response
  let responseText = response.content;

  // Strip markdown code fences if present
  responseText = responseText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const data = JSON.parse(responseText);
    return {
      success: true,
      data,
      rawResponse: response.content,
    };
  } catch (parseErr) {
    return {
      success: false,
      error: "Failed to parse AI response as JSON",
      rawResponse: response.content,
    };
  }
}

module.exports = { extractInvoice };
