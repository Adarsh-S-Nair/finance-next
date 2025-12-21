/**
 * Initialize a new AI portfolio with first trading decisions
 * 
 * This endpoint:
 * 1. Creates the portfolio in the database
 * 2. Calls the AI model with the trading prompt
 * 3. Logs the response and initial trades
 * 4. Returns the created portfolio with AI response
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadPrompt, fillTemplate } from '../../../../lib/promptLoader';
import { callGemini } from '../../../../lib/geminiClient';

// Mark route as dynamic to avoid build-time analysis
export const dynamic = 'force-dynamic';

// Lazy create Supabase client to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request) {
  try {
    // Create Supabase client (lazy, only when actually needed)
    const supabase = getSupabaseClient();
    
    const body = await request.json();
    const { userId, name, aiModel, startingCapital } = body;

    // Validate required fields
    if (!userId || !name || !aiModel || !startingCapital) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name, aiModel, startingCapital' },
        { status: 400 }
      );
    }

    console.log('\n========================================');
    console.log('🚀 INITIALIZING AI PORTFOLIO');
    console.log('========================================');
    console.log(`Portfolio: ${name}`);
    console.log(`AI Model: ${aiModel}`);
    console.log(`Starting Capital: $${startingCapital.toLocaleString()}`);
    console.log('----------------------------------------');

    // 1. Create the portfolio in the database first
    const { data: portfolio, error: insertError } = await supabase
      .from('ai_portfolios')
      .insert({
        user_id: userId,
        name: name.trim(),
        ai_model: aiModel,
        starting_capital: startingCapital,
        current_cash: startingCapital,
        status: 'initializing', // Start in initializing state
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      throw new Error(`Failed to create portfolio: ${insertError.message}`);
    }

    console.log(`✅ Portfolio created with ID: ${portfolio.id}`);

    // 2. Load and fill the trading prompt
    const tradingPrompt = loadPrompt('trading');
    const userPrompt = fillTemplate(tradingPrompt.user, {
      name: name,
      starting_capital: startingCapital.toLocaleString(),
      current_cash: startingCapital.toLocaleString(),
    });

    console.log('\n📝 PROMPT SENT TO AI:');
    console.log('--- System Prompt ---');
    console.log(tradingPrompt.system);
    console.log('--- User Prompt ---');
    console.log(userPrompt);
    console.log('----------------------------------------');

    // 3. Call the AI model
    let aiResponse;
    try {
      if (aiModel.startsWith('gemini')) {
        aiResponse = await callGemini(
          aiModel,
          tradingPrompt.system,
          userPrompt,
          { temperature: 0.7, maxTokens: 2000 }
        );
      } else {
        // For now, only Gemini is supported
        throw new Error(`Model ${aiModel} is not yet supported`);
      }

      console.log('\n🤖 AI RESPONSE:');
      console.log('--- Raw Response ---');
      console.log(aiResponse.content);
      console.log('--- Token Usage ---');
      console.log(`Input: ${aiResponse.usage.inputTokens}, Output: ${aiResponse.usage.outputTokens}, Total: ${aiResponse.usage.totalTokens}`);
      console.log('----------------------------------------');

    } catch (aiError) {
      console.error('❌ AI API error:', aiError);
      
      // Update portfolio status to error (if portfolio was created)
      if (portfolio?.id) {
        await supabase
          .from('ai_portfolios')
          .update({ status: 'error' })
          .eq('id', portfolio.id);
      }

      throw new Error(`AI model error: ${aiError.message}`);
    }

    // 4. Parse the AI response (try to extract JSON)
    let parsedResponse = null;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
        console.log('\n📊 PARSED TRADING DECISIONS:');
        console.log(JSON.stringify(parsedResponse, null, 2));
      }
    } catch (parseError) {
      console.warn('⚠️ Could not parse JSON from AI response:', parseError.message);
    }

    // 5. Update portfolio status to active
    const { data: updatedPortfolio, error: updateError } = await supabase
      .from('ai_portfolios')
      .update({ status: 'active' })
      .eq('id', portfolio.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update portfolio status:', updateError);
    }

    console.log('\n✅ PORTFOLIO INITIALIZATION COMPLETE');
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      portfolio: updatedPortfolio || portfolio,
      aiResponse: {
        content: aiResponse.content,
        parsed: parsedResponse,
        usage: aiResponse.usage,
      },
    });

  } catch (error) {
    console.error('❌ Portfolio initialization failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize portfolio' },
      { status: 500 }
    );
  }
}

