// Model suggestions per provider
const MODEL_SUGGESTIONS = {
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  google: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "mistral-medium-latest"],
  groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  together: ["meta-llama/Llama-3-70b-chat-hf", "mistralai/Mixtral-8x7B-Instruct-v0.1"],
  openrouter: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash"],
  nvidia: ["meta/llama-3.3-70b-instruct", "microsoft/phi-4", "deepseek-ai/deepseek-r1"],
  ollama: ["llama3", "mistral", "qwen2.5", "phi3"],
};

document.addEventListener("DOMContentLoaded", async () => {
  const providerSelect = document.getElementById("providerSelect");
  const modelInput = document.getElementById("modelInput");
  const modelSuggestions = document.getElementById("modelSuggestions");
  const settingsForm = document.getElementById("settingsForm");
  const statusBox = document.getElementById("statusBox");

  // Load current config
  try {
    const res = await fetch("/api/config/providers");
    const config = await res.json();

    // Populate provider dropdown
    providerSelect.innerHTML = "";
    config.availableProviders.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (p === config.activeProvider) opt.selected = true;
      providerSelect.appendChild(opt);
    });

    modelInput.value = config.activeModel;
    showModelSuggestions(config.activeProvider);
  } catch (err) {
    providerSelect.innerHTML = '<option value="">Error loading</option>';
  }

  // Update suggestions when provider changes
  providerSelect.addEventListener("change", () => {
    const provider = providerSelect.value;
    showModelSuggestions(provider);

    // Auto-fill with first suggestion
    const suggestions = MODEL_SUGGESTIONS[provider];
    if (suggestions && suggestions.length > 0) {
      modelInput.value = suggestions[0];
    }
  });

  // Show model suggestions as clickable chips
  function showModelSuggestions(provider) {
    const suggestions = MODEL_SUGGESTIONS[provider] || [];
    modelSuggestions.innerHTML = suggestions
      .map((m) => `<span class="suggestion-chip" data-model="${m}">${m}</span>`)
      .join("");

    // Click to fill
    modelSuggestions.querySelectorAll(".suggestion-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        modelInput.value = chip.dataset.model;
      });
    });
  }

  // Save settings
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusBox.style.display = "none";

    const provider = providerSelect.value;
    const model = modelInput.value.trim();

    if (!provider || !model) {
      showStatus("Please select a provider and enter a model name.", "error");
      return;
    }

    try {
      const res = await fetch("/api/config/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });

      const data = await res.json();

      if (data.success) {
        showStatus(`Saved! Now using ${data.provider} / ${data.model}`, "success");
      } else {
        showStatus(data.error || "Failed to save.", "error");
      }
    } catch (err) {
      showStatus(`Network error: ${err.message}`, "error");
    }
  });

  function showStatus(msg, type) {
    statusBox.textContent = msg;
    statusBox.className = `status-box ${type}`;
    statusBox.style.display = "block";
  }
});
