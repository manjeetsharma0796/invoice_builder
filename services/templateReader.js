const { HumanMessage } = require("@langchain/core/messages");
const { getLLM } = require("./llm");
const { fileToBase64 } = require("./fileHandler");

const TEMPLATE_READ_PROMPT = `You are an expert at analyzing invoice/form templates.

Look at this form/invoice template image and identify:
1. All field labels and their positions (which row/column they appear in)
2. The overall layout structure (header, body/line items, footer)
3. Any formatting rules visible (date formats, number formats)

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "title": "Name of the form if visible",
  "header_fields": [
    {
      "label": "Field Label",
      "key": "snake_case_key",
      "row": 1,
      "col": "B",
      "type": "string|number|date"
    }
  ],
  "line_items_start_row": 10,
  "line_item_columns": [
    {
      "label": "Column Header",
      "key": "snake_case_key",
      "col": "A",
      "type": "string|number"
    }
  ],
  "footer_fields": [
    {
      "label": "Field Label",
      "key": "snake_case_key",
      "row": 25,
      "col": "D",
      "type": "number"
    }
  ]
}

Rules:
- Use Excel-style column references (A, B, C, etc.)
- Use approximate row numbers
- key should be a snake_case version of the label
- Only include fields you can actually see in the template`;

/**
 * Read a form/template image and extract its structure using AI vision
 * @param {string} filePath - path to the form/template image
 * @param {string} mimetype - MIME type of the image
 * @returns {object} form structure definition
 */
async function readTemplateImage(filePath, mimetype) {
  const dataUri = fileToBase64(filePath, mimetype);
  const llm = getLLM();

  const messageContent = [
    { type: "text", text: TEMPLATE_READ_PROMPT },
    {
      type: "image_url",
      image_url: { url: dataUri, detail: "high" },
    },
  ];

  const response = await llm.invoke([
    new HumanMessage({ content: messageContent }),
  ]);

  let responseText = response.content;

  // Strip markdown code fences if present
  responseText = responseText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const structure = JSON.parse(responseText);
    return {
      success: true,
      structure,
      rawResponse: response.content,
    };
  } catch (parseErr) {
    return {
      success: false,
      error: "Failed to parse template structure from AI response",
      rawResponse: response.content,
    };
  }
}

module.exports = { readTemplateImage };
