// Vision-capable models per provider (subset of models from upload.js)
const VISION_MODELS = {
  openai:     ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  anthropic:  ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  google:     ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-3-flash-preview"],
  groq:       ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"],
  together:   ["meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo"],
  openrouter: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-2.5-flash"],
  nvidia: [
    "meta/llama-3.2-11b-vision-instruct",
    "meta/llama-3.2-90b-vision-instruct",
    "meta/llama-4-scout-17b-16e-instruct",
    "meta/llama-4-maverick-17b-128e-instruct",
    "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    "nvidia/nemotron-parse",
    "mistralai/mistral-small-3.1-24b-instruct-2503",
    "microsoft/phi-3.5-vision-instruct",
    "microsoft/phi-4-multimodal-instruct",
    "google/gemma-3-27b-it",
  ],
  ollama:     ["llama3.2-vision"],
  mistral:    ["mistral-large-latest"],
};

document.addEventListener('DOMContentLoaded', () => {
    const genBtn          = document.getElementById('genBtn');
    const genBtnText      = document.getElementById('genBtnText');
    const genLog          = document.getElementById('genLog');
    const templateNameInput = document.getElementById('templateName');
    const saveBtn         = document.getElementById('saveBtn');
    const previewBtn      = document.getElementById('refreshPreviewBtn');
    const previewFrame    = document.getElementById('previewFrame');
    const emptyState      = document.getElementById('emptyState');
    const fileInput       = document.getElementById('referenceImage');
    const fileChosen      = document.getElementById('fileChosen');
    const providerSelect  = document.getElementById('providerSelect');
    const modelInput      = document.getElementById('modelInput');
    const testBtn         = document.getElementById('testBtn');
    const statusLight     = document.getElementById('statusLight').querySelector('.light');
    const statusText      = document.getElementById('statusText');
    const modelChips      = document.getElementById('modelChips');

    // Tabs
    const tabBtns   = document.querySelectorAll('.tab-btn');
    const previewTab = document.getElementById('previewTab');
    const codeTab    = document.getElementById('codeTab');

    // CodeMirror
    const editor = CodeMirror.fromTextArea(document.getElementById('htmlEditor'), {
        lineNumbers: true, mode: 'htmlmixed', theme: 'dracula',
        tabSize: 4, indentUnit: 4, lineWrapping: true,
    });

    // ===== Logger =====
    function log(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `log-${type}`;
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        genLog.prepend(div);
    }

    // ===== Status light =====
    function setLight(color, text) {
        statusLight.className = `light ${color}`;
        statusText.textContent = text;
        statusText.className = `status-text ${ color === 'green' ? 'connected' : color === 'red' ? 'failed' : color === 'yellow' ? 'testing' : '' }`;
    }

    // ===== Render model chips =====
    function renderChips(provider) {
        modelChips.innerHTML = '';
        const models = VISION_MODELS[provider] || [];
        models.forEach(m => {
            const chip = document.createElement('span');
            chip.className = 'chip vision';
            chip.textContent = m;
            chip.title = 'Vision model — click to select';
            chip.addEventListener('click', () => {
                modelInput.value = m;
                renderChips(provider);
            });
            modelChips.appendChild(chip);
        });
    }

    // ===== Load providers =====
    fetch('/api/config/providers')
        .then(r => r.json())
        .then(data => {
            providerSelect.innerHTML = '';
            data.availableProviders.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p; opt.textContent = p.charAt(0).toUpperCase() + p.slice(1);
                if (p === data.activeProvider) opt.selected = true;
                providerSelect.appendChild(opt);
            });
            modelInput.value = data.activeModel || '';
            renderChips(data.activeProvider);
        })
        .catch(() => log('Could not load providers', 'error'));

    providerSelect.addEventListener('change', () => {
        renderChips(providerSelect.value);
        const visionModels = VISION_MODELS[providerSelect.value] || [];
        if (visionModels.length) modelInput.value = visionModels[0];
        setLight('gray', 'Not tested');
    });

    // ===== Test button =====
    testBtn.addEventListener('click', async () => {
        const provider = providerSelect.value;
        const model = modelInput.value.trim();
        if (!provider || !model) { setLight('red', 'Select provider & model'); return; }
        testBtn.disabled = true; setLight('yellow', 'Testing...');
        try {
            const res = await fetch('/api/config/test', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, model }),
            });
            const data = await res.json();
            if (data.success) setLight('green', 'Connected');
            else setLight('red', data.error || 'Failed');
        } catch (err) { setLight('red', err.message); }
        finally { testBtn.disabled = false; testBtn.textContent = 'Test'; }
    });

    // ===== File picker =====
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            fileChosen.textContent = fileInput.files[0].name;
            fileChosen.style.display = 'block';
            genBtn.disabled = false;
        }
    });

    // ===== Tabs =====
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.tab === 'preview') {
                previewTab.style.display = 'block';
                codeTab.style.display = 'none';
                if (editor.getValue()) updatePreview();
            } else {
                previewTab.style.display = 'none';
                codeTab.style.display = 'block';
                editor.refresh();
            }
        });
    });

    // ===== Preview =====
    async function updatePreview() {
        const html = editor.getValue();
        if (!html) return;
        try {
            log('Rendering PDF preview...', 'info');
            const response = await fetch('/api/templates/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html }),
            });
            if (!response.ok) throw new Error(await response.text());
            const blob = await response.blob();
            emptyState.style.display = 'none';
            previewFrame.style.display = 'block';
            previewFrame.src = URL.createObjectURL(blob);
            log('Preview ready.', 'success');
        } catch (err) { log(`Preview error: ${err.message}`, 'error'); }
    }

    // ===== Generate =====
    genBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        const provider = providerSelect.value;
        const model = modelInput.value.trim();
        if (!model) { log('Please select a model first.', 'error'); return; }

        genBtn.disabled = true;
        genBtnText.textContent = '⏳ AI is thinking...';
        log(`Starting reconstruction using ${provider} / ${model}...`, 'info');

        // Apply provider/model setting
        try {
            await fetch('/api/config/set', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, model }),
            });
        } catch (e) { /* non-fatal */ }

        const formData = new FormData();
        formData.append('reference_image', file);

        try {
            const response = await fetch('/api/templates/generate', {
                method: 'POST', body: formData,
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);

            editor.setValue(result.html);
            log('Template reconstructed! Switching to code view...', 'success');
            tabBtns[1].click(); // show HTML source
        } catch (err) {
            log(`Generation failed: ${err.message}`, 'error');
        } finally {
            genBtn.disabled = false;
            genBtnText.textContent = '✨ Generate Template';
        }
    });

    // ===== Save =====
    saveBtn.addEventListener('click', async () => {
        const name = templateNameInput.value.trim();
        const html = editor.getValue();
        if (!name || !html) { log('Enter a template name and generate content first.', 'error'); return; }
        try {
            const response = await fetch('/api/templates/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, html }),
            });
            const result = await response.json();
            if (result.success) log(`&#10003; Saved as "${result.name}.ejs"`, 'success');
            else throw new Error(result.error);
        } catch (err) { log(`Save error: ${err.message}`, 'error'); }
    });

    previewBtn.addEventListener('click', updatePreview);
});
