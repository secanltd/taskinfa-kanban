// Client-side model list fetching for LLM providers.
// Always called from the browser — local providers (Ollama, LM Studio) run on the
// user's machine so only the browser can reach them, not the Cloudflare Worker.

export const ANTHROPIC_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-5',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
];

export async function fetchModelsForProvider(
  provider: string,
  baseUrl: string,
  authToken: string
): Promise<string[]> {
  if (provider === 'anthropic') return ANTHROPIC_MODELS;
  if (provider === 'custom') return [];

  const url = baseUrl.replace(/\/$/, '');
  if (!url) throw new Error('No base URL configured for this provider');

  if (provider === 'ollama') {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
    const data = await res.json() as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => m.name).sort();
  }

  // OpenAI-compatible /v1/models (lmstudio, openrouter, litellm)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${url}/v1/models`, { headers });
  if (!res.ok) throw new Error(`Provider returned ${res.status}`);
  const data = await res.json() as { data?: Array<{ id: string }> };
  return (data.data ?? []).map((m) => m.id).sort();
}
