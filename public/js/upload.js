// Model suggestions per provider
const MODEL_SUGGESTIONS = {
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  google: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  together: ["meta-llama/Llama-3-70b-chat-hf"],
  openrouter: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet"],
  nvidia: ["meta/llama-3.3-70b-instruct", "microsoft/phi-4", "deepseek-ai/deepseek-r1"],
  ollama: ["llama3", "mistral", "qwen2.5", "phi3"],
};

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
  function showModelChips(provider) {
    const suggestions = MODEL_SUGGESTIONS[provider] || [];
    modelChips.innerHTML = suggestions
      .map((m) => `<button type="button" class="model-chip" data-model="${m}">${m}</button>`)
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
        errorBox.textContent = data.error || "Something went wrong.";
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
