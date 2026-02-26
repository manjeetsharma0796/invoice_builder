const { ChatOpenAI } = require("@langchain/openai");
const { ChatAnthropic } = require("@langchain/anthropic");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatMistralAI } = require("@langchain/mistralai");

// Runtime config — changed via API at runtime
let activeProvider = process.env.ACTIVE_PROVIDER || "openai";
let activeModel = process.env.ACTIVE_MODEL || "gpt-4o";

const providers = {
  // ====== Official Providers ======
  openai: () =>
    new ChatOpenAI({
      model: activeModel,
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),

  anthropic: () =>
    new ChatAnthropic({
      model: activeModel,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    }),

  google: () =>
    new ChatGoogleGenerativeAI({
      model: activeModel,
      apiKey: process.env.GOOGLE_API_KEY,
    }),

  mistral: () =>
    new ChatMistralAI({
      model: activeModel,
      apiKey: process.env.MISTRAL_API_KEY,
    }),

  // ====== OpenAI-Compatible Providers ======
  groq: () =>
    new ChatOpenAI({
      model: activeModel,
      openAIApiKey: process.env.GROQ_API_KEY,
      configuration: { baseURL: "https://api.groq.com/openai/v1" },
    }),

  deepseek: () =>
    new ChatOpenAI({
      model: activeModel,
      openAIApiKey: process.env.DEEPSEEK_API_KEY,
      configuration: { baseURL: "https://api.deepseek.com/v1" },
    }),

  together: () =>
    new ChatOpenAI({
      model: activeModel,
      openAIApiKey: process.env.TOGETHER_API_KEY,
      configuration: { baseURL: "https://api.together.xyz/v1" },
    }),

  openrouter: () =>
    new ChatOpenAI({
      model: activeModel,
      openAIApiKey: process.env.OPENROUTER_API_KEY,
      configuration: { baseURL: "https://openrouter.ai/api/v1" },
    }),

  nvidia: () =>
    new ChatOpenAI({
      model: activeModel,
      openAIApiKey: process.env.NVIDIA_API_KEY,
      configuration: { baseURL: "https://integrate.api.nvidia.com/v1" },
    }),

  ollama: () =>
    new ChatOpenAI({
      model: activeModel,
      openAIApiKey: "ollama",
      configuration: {
        baseURL: `${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/v1`,
      },
    }),
};

/**
 * Get LLM instance for the active provider
 */
function getLLM() {
  const factory = providers[activeProvider];
  if (!factory) {
    throw new Error(
      `Unknown provider: "${activeProvider}". Available: ${Object.keys(providers).join(", ")}`
    );
  }
  return factory();
}

/**
 * Set active provider and model at runtime
 */
function setProvider(provider, model) {
  if (!providers[provider]) {
    throw new Error(
      `Unknown provider: "${provider}". Available: ${Object.keys(providers).join(", ")}`
    );
  }
  activeProvider = provider;
  if (model) activeModel = model;
  return { provider: activeProvider, model: activeModel };
}

/**
 * Get current config
 */
function getConfig() {
  return {
    activeProvider,
    activeModel,
    availableProviders: Object.keys(providers),
  };
}

module.exports = { getLLM, setProvider, getConfig };
