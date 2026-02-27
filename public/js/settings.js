// Model suggestions per provider
const MODEL_SUGGESTIONS = {
    google: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-3-flash-preview"],
    nvidia: ["meta/llama-3.3-70b-instruct", "microsoft/phi-4", "deepseek-ai/deepseek-r1"],
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
