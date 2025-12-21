import { callXAI, estimateCost, GROK_MODELS } from '../../../../lib/xaiClient';
import { loadPrompt, fillTemplate } from '../../../../lib/promptLoader';

/**
 * Test endpoint to verify xAI (Grok) API connection
 * GET /api/ai-trading/test
 */
export async function GET(request) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[AI-TRADING] xAI/Grok Test - ${timestamp}`);
  console.log(`${'='.repeat(60)}`);

  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') || 'grok-4-1-fast-reasoning';

    // Validate model
    if (!GROK_MODELS[model]) {
      console.log(`[ERROR] Invalid model: ${model}`);
      return Response.json(
        { error: `Invalid model: ${model}. Available: ${Object.keys(GROK_MODELS).join(', ')}` },
        { status: 400 }
      );
    }

    // Load prompt from YAML
    const prompt = loadPrompt('trading');
    
    // Fill in template variables
    const userPrompt = fillTemplate(prompt.user, {
      name: 'Test Portfolio',
      starting_capital: '100,000',
      current_cash: '100,000',
    });

    console.log(`[PROMPT] Loaded: ${prompt.name} v${prompt.version}`);
    console.log(`[MODEL] ${model}`);
    console.log(`[SYSTEM] ${prompt.system.substring(0, 100)}...`);
    console.log(`[USER] ${userPrompt.substring(0, 100)}...`);

    const startTime = Date.now();
    const result = await callXAI(model, prompt.system, userPrompt, {
      temperature: 0.7,
      maxTokens: 1000,
    });
    const duration = Date.now() - startTime;

    const cost = estimateCost(model, result.usage.inputTokens, result.usage.outputTokens);

    // Log response
    console.log(`\n[RESPONSE] (${duration}ms)`);
    console.log(`${'─'.repeat(40)}`);
    console.log(result.content);
    console.log(`${'─'.repeat(40)}`);
    console.log(`[TOKENS] Input: ${result.usage.inputTokens} | Output: ${result.usage.outputTokens} | Total: ${result.usage.totalTokens}`);
    console.log(`[COST] $${cost.toFixed(6)}`);
    console.log(`${'='.repeat(60)}\n`);

    return Response.json({
      success: true,
      model: result.model,
      response: result.content,
      usage: result.usage,
      estimatedCost: `$${cost.toFixed(6)}`,
      durationMs: duration,
    });
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return Response.json(
      { 
        success: false, 
        error: error.message,
        hint: error.message.includes('XAI_API_KEY') 
          ? 'Add XAI_API_KEY to your .env.local file. Get a key at https://console.x.ai/'
          : undefined
      },
      { status: 500 }
    );
  }
}
