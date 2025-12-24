/**
 * Google Gemini API Client
 * 
 * Uses the Gemini API for AI trading simulations.
 * Free tier available for development/testing.
 * Docs: https://ai.google.dev/docs
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Available Gemini models with their pricing (per million tokens)
 * Free tier has generous limits for development
 */
export const GEMINI_MODELS = {
  'gemini-3-flash-preview': {
    name: 'Gemini 3 Flash Preview',
    inputPrice: 0, // Free tier
    outputPrice: 0, // Free tier
    paidInputPrice: 0.50,
    paidOutputPrice: 3.00,
    contextWindow: 1000000,
    description: 'Free tier available',
  },
};

/**
 * Call the Gemini API with a prompt
 * 
 * @param {string} model - Model ID (e.g., 'gemini-3-flash-preview')
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message/data
 * @param {object} options - Additional options
 * @returns {Promise<{content: string, usage: object}>}
 */
export async function callGemini(model, systemPrompt, userPrompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2000,
        responseMimeType: options.responseMimeType ?? 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} - ${error.error?.message || JSON.stringify(error)}`);
  }

  const data = await response.json();
  
  // Extract the response text
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text || '';
  const finishReason = candidate?.finishReason || 'UNKNOWN';
  
  // Extract usage metadata
  const usageMetadata = data.usageMetadata || {};

  return {
    content,
    finishReason, // 'STOP' = complete, 'MAX_TOKENS' = truncated, 'SAFETY' = blocked, etc.
    usage: {
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    },
    model,
  };
}

/**
 * Estimate the cost of a request based on token usage
 * Returns 0 for free tier models
 * 
 * @param {string} modelId - Model ID
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @param {boolean} usePaidTier - Whether to use paid tier pricing
 * @returns {number} - Estimated cost in USD
 */
export function estimateGeminiCost(modelId, inputTokens, outputTokens, usePaidTier = false) {
  const model = GEMINI_MODELS[modelId];
  if (!model) return 0;
  
  const inputPrice = usePaidTier ? (model.paidInputPrice || model.inputPrice) : model.inputPrice;
  const outputPrice = usePaidTier ? (model.paidOutputPrice || model.outputPrice) : model.outputPrice;
  
  const inputCost = (inputTokens / 1_000_000) * inputPrice;
  const outputCost = (outputTokens / 1_000_000) * outputPrice;
  
  return inputCost + outputCost;
}

