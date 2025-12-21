"use client";

import { useState, useEffect } from "react";
import PageContainer from "../../../components/PageContainer";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { LuPlus, LuBot, LuTrendingUp, LuTrendingDown, LuDollarSign, LuCalendar } from "react-icons/lu";
import { SiOpenai, SiGooglegemini, SiAnthropic } from "react-icons/si";
import { useUser } from "../../../components/UserProvider";
import { supabase } from "../../../lib/supabaseClient";

// AI Model configurations
const AI_MODELS = {
  'claude-3-opus': {
    name: 'Claude 3 Opus',
    icon: SiAnthropic,
    color: '#D97757',
    description: 'Anthropic\'s most capable model',
  },
  'claude-3-sonnet': {
    name: 'Claude 3 Sonnet',
    icon: SiAnthropic,
    color: '#D97757',
    description: 'Balanced performance and speed',
  },
  'gpt-4o': {
    name: 'GPT-4o',
    icon: SiOpenai,
    color: '#10A37F',
    description: 'OpenAI\'s flagship model',
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    icon: SiOpenai,
    color: '#10A37F',
    description: 'Fast and efficient',
  },
  'gemini-pro': {
    name: 'Gemini Pro',
    icon: SiGooglegemini,
    color: '#4285F4',
    description: 'Google\'s advanced model',
  },
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format percentage
const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

// Portfolio Card Component
function PortfolioCard({ portfolio }) {
  const model = AI_MODELS[portfolio.ai_model] || {
    name: portfolio.ai_model,
    icon: LuBot,
    color: 'var(--color-accent)',
  };
  const ModelIcon = model.icon;

  // Calculate total value (for now just cash, will add holdings later)
  const totalValue = portfolio.current_cash;
  const returnAmount = totalValue - portfolio.starting_capital;
  const returnPercent = ((totalValue - portfolio.starting_capital) / portfolio.starting_capital) * 100;
  const isPositive = returnAmount >= 0;

  const createdDate = new Date(portfolio.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card className="group hover:border-[var(--color-accent)]/30 transition-all duration-200 cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${model.color}15` }}
          >
            <ModelIcon className="w-5 h-5" style={{ color: model.color }} />
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-fg)]">{portfolio.name}</h3>
            <p className="text-xs text-[var(--color-muted)]">{model.name}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          portfolio.status === 'active' 
            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
            : portfolio.status === 'paused'
            ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
            : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
        }`}>
          {portfolio.status.charAt(0).toUpperCase() + portfolio.status.slice(1)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-1">Total Value</p>
            <p className="text-2xl font-semibold text-[var(--color-fg)] tabular-nums">
              {formatCurrency(totalValue)}
            </p>
          </div>
          <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {isPositive ? <LuTrendingUp className="w-4 h-4" /> : <LuTrendingDown className="w-4 h-4" />}
            <span className="text-sm font-medium tabular-nums">{formatPercent(returnPercent)}</span>
          </div>
        </div>

        <div className="h-px bg-[var(--color-border)]" />

        <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
          <div className="flex items-center gap-1.5">
            <LuDollarSign className="w-3.5 h-3.5" />
            <span>Started with {formatCurrency(portfolio.starting_capital)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LuCalendar className="w-3.5 h-3.5" />
            <span>{createdDate}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Create Portfolio Modal
function CreatePortfolioModal({ isOpen, onClose, onCreated }) {
  const { profile } = useUser();
  const [name, setName] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-3-opus');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a portfolio name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('ai_portfolios')
        .insert({
          user_id: profile.id,
          name: name.trim(),
          ai_model: selectedModel,
          starting_capital: 100000,
          current_cash: 100000,
          status: 'active',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      onCreated(data);
      onClose();
      setName('');
      setSelectedModel('claude-3-opus');
    } catch (err) {
      console.error('Error creating portfolio:', err);
      setError(err.message || 'Failed to create portfolio');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-content-bg)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-[var(--color-fg)] mb-4">Create AI Portfolio</h2>

        <div className="space-y-4">
          {/* Portfolio Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">
              Portfolio Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Claude Portfolio"
              className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]"
            />
          </div>

          {/* AI Model Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">
              AI Model
            </label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(AI_MODELS).map(([key, model]) => {
                const ModelIcon = model.icon;
                const isSelected = selectedModel === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedModel(key)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: `${model.color}15` }}
                    >
                      <ModelIcon className="w-4 h-4" style={{ color: model.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-[var(--color-fg)]">{model.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{model.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Starting Capital Info */}
          <div className="flex items-center gap-3 p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
              <LuDollarSign className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-fg)]">Starting Capital</p>
              <p className="text-xs text-[var(--color-muted)]">$100,000 paper money</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
            {isCreating ? 'Creating...' : 'Create Portfolio'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InvestmentsPage() {
  const { profile } = useUser();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchPortfolios();
    }
  }, [profile?.id]);

  const fetchPortfolios = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_portfolios')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPortfolios(data || []);
    } catch (err) {
      console.error('Error fetching portfolios:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioCreated = (newPortfolio) => {
    setPortfolios(prev => [newPortfolio, ...prev]);
  };

  if (loading) {
    return (
      <PageContainer title="Investments">
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] mx-auto mb-4" />
            <p className="text-[var(--color-muted)]">Loading portfolios...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const hasPortfolios = portfolios.length > 0;

  return (
    <PageContainer title="Investments">
      <div className="space-y-6">
        {/* Header with Create Button */}
        {hasPortfolios && (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--color-fg)]">AI Trading Portfolios</h2>
              <p className="text-sm text-[var(--color-muted)]">
                Watch AI models compete in paper trading simulations
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <LuPlus className="w-4 h-4" />
              New Portfolio
            </Button>
          </div>
        )}

        {hasPortfolios ? (
          /* Portfolio Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolios.map(portfolio => (
              <PortfolioCard key={portfolio.id} portfolio={portfolio} />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-24 bg-[var(--color-surface)]/30 rounded-lg border border-[var(--color-border)]/50 border-dashed">
            <div className="mx-auto w-20 h-20 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[var(--color-border)]">
              <LuBot className="h-10 w-10 text-[var(--color-muted)]" />
            </div>
            <h3 className="text-xl font-medium text-[var(--color-fg)] mb-2">
              No AI portfolios yet
            </h3>
            <p className="text-[var(--color-muted)] mb-8 max-w-md mx-auto">
              Create your first AI trading portfolio and watch different AI models compete in paper trading simulations.
            </p>
            <Button size="lg" onClick={() => setShowCreateModal(true)}>
              <LuPlus className="w-4 h-4 mr-2" />
              Create Your First Portfolio
            </Button>
          </div>
        )}
      </div>

      <CreatePortfolioModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handlePortfolioCreated}
      />
    </PageContainer>
  );
}

