/**
 * xAI (Grok) API Client
 * 
 * Uses the OpenAI-compatible API format that xAI provides.
 * Docs: https://docs.x.ai/docs
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

/**
 * Available Grok models with their pricing (per million tokens)
 */
export const GROK_MODELS = {
  'grok-4-1-fast-reasoning': {
    name: 'Grok 4.1 Fast (Reasoning)',
    inputPrice: 0.20,
    outputPrice: 0.50,
    contextWindow: 2000000,
  },
};

/**
 * Call the xAI API with a prompt
 * 
 * @param {string} model - Model ID (e.g., 'grok-3-mini')
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message/data
 * @param {object} options - Additional options
 * @returns {Promise<{content: string, usage: object}>}
 */
export async function callXAI(model, systemPrompt, userPrompt, options = {}) {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`xAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model: data.model,
  };
}

/**
 * Estimate the cost of a request based on token usage
 * 
 * @param {string} modelId - Model ID
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} - Estimated cost in USD
 */
export function estimateCost(modelId, inputTokens, outputTokens) {
  const model = GROK_MODELS[modelId];
  if (!model) return 0;
  
  const inputCost = (inputTokens / 1_000_000) * model.inputPrice;
  const outputCost = (outputTokens / 1_000_000) * model.outputPrice;
  
  return inputCost + outputCost;
}

