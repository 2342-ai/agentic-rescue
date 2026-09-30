// Same table as PROVIDERS in pkgs/rescue-cli/bin/rescue-config, for the page.
window.PROVIDERS = [
  { id: "2342ai", label: "2342.ai", url: "https://2342.ai", tags: ["rec", "all"],
    placeholder: "2342.ai API key", model: "2342ai/claude-sonnet-4-5" },
  { id: "groq", label: "Groq", url: "https://console.groq.com/keys", tags: ["free"],
    placeholder: "gsk_…", model: "groq/openai/gpt-oss-120b" },
  { id: "google", label: "Google AI Studio", url: "https://aistudio.google.com/apikey", tags: ["free"],
    placeholder: "AIza…", model: "google/gemini-flash-latest" },
  { id: "openrouter", label: "OpenRouter", url: "https://openrouter.ai/keys", tags: ["free"],
    placeholder: "sk-or-…", model: "openrouter/qwen/qwen3.8-27b:free" },
  { id: "opencode", label: "OpenCode Zen", url: "https://opencode.ai/auth", tags: ["free"],
    placeholder: "OpenCode Zen key", model: "opencode/big-pickle" },
  { id: "anthropic", label: "Anthropic", url: "https://console.anthropic.com/settings/keys", tags: [],
    placeholder: "sk-ant-…", model: "anthropic/claude-sonnet-4-5" },
  { id: "openai", label: "OpenAI", url: "https://platform.openai.com/api-keys", tags: [],
    placeholder: "sk-…", model: "openai/gpt-5.4" },
];
