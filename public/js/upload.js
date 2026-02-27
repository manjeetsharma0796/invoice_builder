// Model suggestions per provider
const MODEL_SUGGESTIONS = {
  // Official providers
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
  ],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-haiku-20240307",
  ],
  // Google Gemini (direct API — needs GOOGLE_API_KEY)
  google: [
    "gemini-2.5-flash",          // best price-performance, free tier
    "gemini-2.5-pro",            // most advanced, free tier
    "gemini-2.5-flash-lite",     // fastest & cheapest, free tier
    "gemini-3-flash-preview",    // latest Gemini 3, free tier
  ],
  mistral: [
    "mistral-large-latest",
    "mistral-small-latest",
    "open-mixtral-8x22b",
    "open-mistral-nemo",
  ],

  // OpenAI-compatible providers
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.2-11b-vision-preview",   // vision — for image invoices
    "llama-3.2-90b-vision-preview",   // vision — high quality
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ],
  deepseek: [
    "deepseek-chat",
    "deepseek-reasoner",
  ],
  together: [
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",  // vision
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "Qwen/Qwen2.5-7B-Instruct-Turbo",
  ],
  openrouter: [
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.5-flash",
    "meta-llama/llama-4-scout",
    "mistralai/mistral-small-3.1-24b-instruct",
  ],

  // NVIDIA NIM (serverless — all use NVIDIA_API_KEY)
  nvidia: [
    // === Text / JSON extraction ===
    "meta/llama-3.3-70b-instruct",              // ★ recommended default
    "meta/llama-3.1-70b-instruct",
    "meta/llama-3.1-8b-instruct",
    "meta/llama-3.1-405b-instruct",             // highest quality text
    "meta/llama3-70b-instruct",
    "meta/llama3-8b-instruct",
    "nvidia/llama-3.3-nemotron-super-49b-v1",
    "nvidia/llama-3.3-nemotron-super-49b-v1.5", // newer, higher accuracy
    "nvidia/llama-3.1-nemotron-ultra-253b-v1",  // largest nemotron
    "nvidia/llama-3.1-nemotron-nano-8b-v1",
    "nvidia/nvidia-nemotron-nano-9b-v2",        // hybrid transformer-mamba
    "nvidia/nemotron-3-nano-30b-a3b",           // 1M context MoE
    "mistralai/mistral-small-24b-instruct",
    "mistralai/mistral-nemotron",               // function calling
    "qwen/qwen2.5-7b-instruct",
    "qwen/qwq-32b",                             // reasoning
    "qwen/qwen3-235b-a22b",                     // advanced reasoning MoE
    "deepseek-ai/deepseek-r1-distill-qwen-14b",
    "deepseek-ai/deepseek-r1-distill-qwen-32b",
    "deepseek-ai/deepseek-v3.1",
    "openai/gpt-oss-120b",                      // OpenAI OSS reasoning
    "openai/gpt-oss-20b",
    "microsoft/phi-4-mini-instruct",            // lightweight
    "ibm/granite-3.3-8b-instruct",
    "moonshotai/kimi-k2-instruct",              // long context agentic
    // === Vision / Image & Scanned invoice ===
    "meta/llama-3.2-11b-vision-instruct",       // vision — fast
    "meta/llama-3.2-90b-vision-instruct",       // vision — best quality
    "meta/llama-4-scout-17b-16e-instruct",      // vision — latest multimodal
    "meta/llama-4-maverick-17b-128e-instruct",  // vision — 128 experts
    "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",  // vision — doc/OCR
    "nvidia/nemotron-nano-12b-v2-vl",           // vision — multi-image
    "nvidia/nemotron-parse",                    // ★ document parsing (text+table extraction)
    "nvidia/cosmos-nemotron-34b",               // VLM — image/video
    "mistralai/mistral-small-3.1-24b-instruct-2503", // multimodal vision
    "mistralai/mistral-medium-3-instruct",      // multimodal
    "mistralai/mistral-large-3-675b-instruct-2512",  // VLM 675B
    "mistralai/ministral-14b-instruct-2512",    // VLM
    "microsoft/phi-3.5-vision-instruct",        // vision
    "microsoft/phi-4-multimodal-instruct",      // vision + audio
    "google/gemma-3-27b-it",                    // multimodal vision
    "moonshotai/kimi-k2.5",                     // 1T multimodal MoE
    "minimaxai/minimax-m2.1",                   // multimodal
  ],

  ollama: [
    "llama3.3",
    "llama3.2-vision",   // vision — for image invoices
    "mistral",
    "qwen2.5",
    "phi4",
    "gemma3",
  ],
};

// Escape HTML for safe display in error box
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("invoiceForm");
  const rawInput = document.getElementById("rawInvoiceInput");
  const formInput = document.getElementById("formImageInput");
  const rawBox = document.getElementById("rawInvoiceBox");
  const formBox = document.getElementById("formImageBox");
  const rawFileName = document.getElementById("rawFileName");
  const formFileName = document.getElementById("formFileName");
  const submitBtn = document.getElementById("submitBtn");
  const errorBox = document.getElementById("errorBox");

  // Provider selector elements
  const providerSelect = document.getElementById("providerSelect");
  const modelInput = document.getElementById("modelInput");
  const testBtn = document.getElementById("testBtn");
  const statusLight = document.getElementById("statusLight").querySelector(".light");
  const statusText = document.getElementById("statusText");
  const modelChips = document.getElementById("modelChips");
  const templateSelect = document.getElementById("templateSelect");

  // ===== Load templates =====
  function loadTemplates() {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          // Clear current options except the first one
          const firstOption = templateSelect.options[0];
          templateSelect.innerHTML = "";
          templateSelect.appendChild(firstOption);

          data.templates.forEach((t) => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            templateSelect.appendChild(opt);
          });
        }
      })
      .catch((err) => console.error("Error loading templates:", err));
  }

  loadTemplates();

  // ===== Load providers =====
  fetch("/api/config/providers")
    .then((r) => r.json())
    .then((data) => {
      providerSelect.innerHTML = "";
      data.availableProviders.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        if (p === data.activeProvider) opt.selected = true;
        providerSelect.appendChild(opt);
      });
      modelInput.value = data.activeModel;
      showModelChips(data.activeProvider);
    })
    .catch(() => {
      providerSelect.innerHTML = '<option value="">Error loading</option>';
    });

  // ===== Provider change → update chips + auto-set model =====
  providerSelect.addEventListener("change", () => {
    const provider = providerSelect.value;
    showModelChips(provider);
    const suggestions = MODEL_SUGGESTIONS[provider];
    if (suggestions && suggestions.length > 0) {
      modelInput.value = suggestions[0];
    }
    // Reset test light on provider change
    setLight("gray", "Not tested");
  });

  // ===== Model input change → reset light =====
  modelInput.addEventListener("input", () => {
    setLight("gray", "Not tested");
  });

  // ===== Show model suggestion chips =====
  // Vision-capable model detection
  function isVisionModel(model) {
    const lower = model.toLowerCase();
    return (
      lower.includes("vision") ||
      lower.includes("llama-4-scout") ||
      lower.includes("llama-4-maverick") ||
      lower.includes("-vl") ||
      lower.includes("vl-") ||
      lower.includes("v2-vl") ||
      lower.includes("multimodal") ||
      lower.includes("phi-3.5-vision") ||
      lower.includes("phi-4-multimodal") ||
      lower.includes("kimi-k2.5") ||
      lower.includes("gemma-3n") ||
      lower.includes("gemma-3-27b") ||
      lower.includes("mistral-large-3") ||
      lower.includes("ministral-14b") ||
      lower.includes("mistral-small-3.1") ||
      lower.includes("mistral-medium-3") ||
      lower.includes("nemotron-parse") ||
      lower.includes("cosmos-nemotron") ||
      lower.includes("minimax-m2.1") ||
      lower.includes("paligemma") ||
      lower.includes("llama3.2-vision") ||
      lower.includes("llama3-vision")
    );
  }

  function showModelChips(provider) {
    const suggestions = MODEL_SUGGESTIONS[provider] || [];
    modelChips.innerHTML = suggestions
      .map((m) => {
        const vision = isVisionModel(m);
        return `<button type="button" class="model-chip${vision ? ' model-chip-vision' : ''}" data-model="${m}" title="${vision ? '👁 Vision/Multimodal — can process invoice images' : 'Text model — PDF/text invoices'}">${m}${vision ? ' <span class="chip-badge">👁</span>' : ''}</button>`;
      })
      .join("");

    modelChips.querySelectorAll(".model-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        modelInput.value = chip.dataset.model;
        setLight("gray", "Not tested");
      });
    });
  }

  // ===== Test button =====
  testBtn.addEventListener("click", async () => {
    const provider = providerSelect.value;
    const model = modelInput.value.trim();

    if (!provider || !model) {
      setLight("red", "Select provider & model");
      return;
    }

    // Set to testing state
    testBtn.disabled = true;
    testBtn.classList.add("testing");
    testBtn.textContent = "Testing...";
    setLight("yellow", "Testing...");

    try {
      const res = await fetch("/api/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });

      const data = await res.json();

      if (data.success) {
        setLight("green", "Connected");
      } else {
        setLight("red", data.error || "Failed");
      }
    } catch (err) {
      setLight("red", `Error: ${err.message}`);
    } finally {
      testBtn.disabled = false;
      testBtn.classList.remove("testing");
      testBtn.textContent = "Test";
    }
  });

  // ===== Set status light =====
  function setLight(color, text) {
    statusLight.className = `light ${color}`;
    statusText.textContent = text;
    statusText.className = `status-text ${
      color === "green" ? "connected" : color === "red" ? "failed" : color === "yellow" ? "testing" : ""
    }`;
  }

  // File input handlers
  rawInput.addEventListener("change", () => {
    if (rawInput.files.length > 0) {
      rawFileName.textContent = rawInput.files[0].name;
      rawBox.classList.add("has-file");
    }
  });

  formInput.addEventListener("change", () => {
    if (formInput.files.length > 0) {
      formFileName.textContent = formInput.files[0].name;
      formBox.classList.add("has-file");
    }
  });

  // Drag & drop
  [rawBox, formBox].forEach((box) => {
    box.addEventListener("dragover", (e) => {
      e.preventDefault();
      box.classList.add("dragover");
    });
    box.addEventListener("dragleave", () => {
      box.classList.remove("dragover");
    });
    box.addEventListener("drop", (e) => {
      e.preventDefault();
      box.classList.remove("dragover");
    });
  });

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";

    if (!rawInput.files.length) {
      errorBox.textContent = "Please upload a raw invoice file.";
      errorBox.style.display = "block";
      return;
    }

    // Disable button, show loading
    submitBtn.disabled = true;
    submitBtn.querySelector(".btn-text").style.display = "none";
    submitBtn.querySelector(".btn-loading").style.display = "inline";

    const formData = new FormData();
    formData.append("raw_invoice", rawInput.files[0]);
    if (formInput.files.length > 0) {
      formData.append("form_image", formInput.files[0]);
    }
    if (templateSelect.value) {
      formData.append("template_name", templateSelect.value);
    }

    try {
      // Set provider/model before processing
      await fetch("/api/config/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerSelect.value,
          model: modelInput.value.trim(),
        }),
      });

      const res = await fetch("/api/invoice/process", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        // Redirect to result page
        window.location.href = `/result/${data.invoiceId}`;
      } else {
        // Build detailed error display
        let html = `<strong>❌ ${data.error || "Something went wrong."}</strong>`;
        if (data.provider || data.model) {
          html += `<br><span class="err-meta">Provider: <b>${data.provider}</b> &nbsp;|&nbsp; Model: <b>${data.model}</b></span>`;
        }
        if (data.parseError) {
          html += `<br><span class="err-meta">Parse error: ${data.parseError}</span>`;
        }
        if (data.rawResponseSnippet) {
          html += `<br><details><summary style="cursor:pointer;font-size:0.8rem;margin-top:0.5rem;">Show AI raw response ▼</summary><pre class="err-raw">${escapeHtml(data.rawResponseSnippet)}</pre></details>`;
        }
        errorBox.innerHTML = html;
        errorBox.style.display = "block";
      }
    } catch (err) {
      errorBox.textContent = `Network error: ${err.message}`;
      errorBox.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector(".btn-text").style.display = "inline";
      submitBtn.querySelector(".btn-loading").style.display = "none";
    }
  });
});
