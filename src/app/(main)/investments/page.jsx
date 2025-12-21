"use client";

import { useState, useEffect } from "react";
import PageContainer from "../../../components/PageContainer";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Drawer from "../../../components/ui/Drawer";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { LuPlus, LuBot, LuTrendingUp, LuTrendingDown, LuTrash2 } from "react-icons/lu";
import { SiGooglegemini, SiX } from "react-icons/si";
import { useUser } from "../../../components/UserProvider";
import { supabase } from "../../../lib/supabaseClient";

// AI Provider and Model configurations
const AI_PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    icon: SiGooglegemini,
    color: '#4285F4',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Free tier - best for testing' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    icon: SiX,
    color: '#000000',
    models: [
      { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast', description: 'Reasoning - $0.20/$0.50 per M tokens', disabled: true },
    ],
  },
];

// Flat lookup for model info
const AI_MODELS = {};
AI_PROVIDERS.forEach(provider => {
  provider.models.forEach(model => {
    AI_MODELS[model.id] = {
      ...model,
      icon: provider.icon,
      color: provider.color,
      provider: provider.name,
    };
  });
});

// Starting capital presets
const CAPITAL_PRESETS = [10000, 50000, 100000, 500000, 1000000];

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
function PortfolioCard({ portfolio, onDeleteClick }) {
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
    <Card className="group relative">
      {/* Delete button - appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteClick(portfolio);
        }}
        className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-muted)] hover:text-rose-500 hover:bg-rose-500/10"
        title="Delete portfolio"
      >
        <LuTrash2 className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${model.color}20` }}
        >
          <ModelIcon 
            className="w-5 h-5" 
            style={{ color: model.color === '#000000' ? 'var(--color-fg)' : model.color }} 
          />
        </div>
        <div className="min-w-0">
          <h3 className="font-medium text-[var(--color-fg)] truncate">{portfolio.name}</h3>
          <p className="text-xs text-[var(--color-muted)]">{model.name}</p>
        </div>
      </div>

      {/* Value */}
      <div className="mb-3">
        <div className="text-2xl font-semibold text-[var(--color-fg)] tabular-nums tracking-tight">
          {formatCurrency(totalValue)}
        </div>
        <div className={`text-xs font-medium mt-0.5 ${
          isPositive ? 'text-emerald-500' : returnPercent < 0 ? 'text-rose-500' : 'text-[var(--color-muted)]'
        }`}>
          {returnAmount >= 0 ? '+' : ''}{formatCurrency(returnAmount)}
          {' '}
          ({formatPercent(returnPercent)})
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)] pt-3 border-t border-[var(--color-border)]">
        <span>{formatCurrency(portfolio.starting_capital)} initial</span>
        <span>{createdDate}</span>
      </div>
    </Card>
  );
}

// Create Portfolio Drawer
function CreatePortfolioDrawer({ isOpen, onClose, onCreated }) {
  const { profile } = useUser();
  const [name, setName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [startingCapital, setStartingCapital] = useState(100000);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  // Capital bounds
  const MIN_CAPITAL = 1000;
  const MAX_CAPITAL = 10000000;

  // Auto-fill name when model changes (unless user manually edited)
  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    if (!nameManuallyEdited) {
      const model = AI_MODELS[modelId];
      if (model) {
        setName(`${model.name} Portfolio`);
      }
    }
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    setNameManuallyEdited(true);
  };

  const handleCapitalInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9,]/g, '').replace(/,/g, '');
    if (value === '') {
      setStartingCapital(MIN_CAPITAL);
    } else {
      const numValue = parseInt(value, 10);
      setStartingCapital(Math.max(MIN_CAPITAL, Math.min(MAX_CAPITAL, numValue)));
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a portfolio name');
      return;
    }

    if (startingCapital < MIN_CAPITAL) {
      setError(`Starting capital must be at least ${formatCurrency(MIN_CAPITAL)}`);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Call the API to create portfolio and get AI's initial trading decisions
      const response = await fetch('/api/ai-trading/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          name: name.trim(),
          aiModel: selectedModel,
          startingCapital: startingCapital,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to initialize portfolio');
      }

      onCreated(result.portfolio);
      onClose();
      // Reset form
      setName('');
      setNameManuallyEdited(false);
      setSelectedModel('gemini-3-flash-preview');
      setStartingCapital(100000);
    } catch (err) {
      console.error('Error creating portfolio:', err);
      setError(err.message || 'Failed to create portfolio');
    } finally {
      setIsCreating(false);
    }
  };

  // Set initial name on mount
  useEffect(() => {
    if (isOpen && !nameManuallyEdited && !name) {
      const model = AI_MODELS[selectedModel];
      if (model) {
        setName(`${model.name} Portfolio`);
      }
    }
  }, [isOpen]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const selectedModelInfo = AI_MODELS[selectedModel];

  // AI Thinking Loading Component
  const AIThinkingOverlay = () => (
    <div className="absolute inset-0 bg-[var(--color-content-bg)]/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
      {/* Animated brain/thinking graphic */}
      <div className="relative mb-6">
        {/* Outer pulsing ring */}
        <div className="absolute inset-0 w-24 h-24 rounded-full bg-[var(--color-accent)]/20 animate-ping" style={{ animationDuration: '2s' }} />
        {/* Middle ring */}
        <div className="absolute inset-2 w-20 h-20 rounded-full bg-[var(--color-accent)]/30 animate-pulse" />
        {/* Inner circle with icon */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 border border-[var(--color-accent)]/30 flex items-center justify-center">
          {selectedModelInfo && (
            <selectedModelInfo.icon 
              className="w-10 h-10 animate-pulse" 
              style={{ 
                color: selectedModelInfo.color === '#000000' ? 'var(--color-fg)' : selectedModelInfo.color,
                animationDuration: '1.5s'
              }} 
            />
          )}
        </div>
      </div>
      
      {/* Text */}
      <div className="text-center px-6">
        <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">
          AI is thinking...
        </h3>
        <p className="text-sm text-[var(--color-muted)] max-w-xs">
          {selectedModelInfo?.name || 'The AI'} is analyzing the market and making initial investment decisions
        </p>
      </div>

      {/* Animated dots */}
      <div className="flex gap-1.5 mt-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--color-accent)]"
            style={{
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={isCreating ? undefined : onClose}
      title="Create AI Portfolio"
      description="Set up a new paper trading simulation"
      size="md"
      footer={
        !isCreating && (
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
              Create Portfolio
            </Button>
          </div>
        )
      }
    >
      <div className="relative h-full">
        {isCreating && <AIThinkingOverlay />}
        <div className={`space-y-6 pt-2 ${isCreating ? 'opacity-0' : ''}`}>
        {/* Portfolio Name */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
            Portfolio Name
          </label>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g., My Claude Portfolio"
            className="w-full px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Starting Capital */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
            Starting Capital
          </label>
          {/* Preset Options */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[25000, 50000, 100000, 250000].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setStartingCapital(amount)}
                className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                  startingCapital === amount
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-accent)]/50'
                }`}
              >
                ${amount >= 1000000 ? `${amount / 1000000}M` : `${amount / 1000}K`}
              </button>
            ))}
          </div>
          {/* Custom Amount Input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">$</span>
            <input
              type="text"
              value={startingCapital.toLocaleString()}
              onChange={handleCapitalInputChange}
              className="w-full pl-7 pr-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)] tabular-nums"
            />
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1.5">
            Simulated paper money for trading
          </p>
        </div>

        {/* AI Model Selection - Grouped by Provider */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
            AI Model
          </label>
          <div className="space-y-4">
            {AI_PROVIDERS.map((provider) => {
              const ProviderIcon = provider.icon;
              return (
                <div key={provider.id}>
                  {/* Provider Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <ProviderIcon 
                      className="w-3.5 h-3.5" 
                      style={{ color: provider.color === '#000000' ? 'var(--color-fg)' : provider.color }} 
                    />
                    <span className="text-xs font-medium text-[var(--color-muted)]">
                      {provider.name}
                    </span>
                  </div>
                  {/* Models List */}
                  <div className="space-y-1.5">
                    {provider.models.map((model) => {
                      const isSelected = selectedModel === model.id;
                      const isDisabled = model.disabled;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => !isDisabled && handleModelSelect(model.id)}
                          disabled={isDisabled}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                            isDisabled
                              ? 'border-[var(--color-border)] opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                              : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface)]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[var(--color-fg)]">{model.name}</p>
                              {isDisabled && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-muted)]">
                                  Coming soon
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-muted)]">{model.description}</p>
                          </div>
                          {isSelected && !isDisabled && (
                            <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0 ml-3">
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
              );
            })}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
        </div>
      </div>
    </Drawer>
  );
}

export default function InvestmentsPage() {
  const { profile } = useUser();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, portfolio: null });
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteClick = (portfolio) => {
    setDeleteModal({ isOpen: true, portfolio });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.portfolio) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('ai_portfolios')
        .delete()
        .eq('id', deleteModal.portfolio.id);
      
      if (error) throw error;
      setPortfolios(prev => prev.filter(p => p.id !== deleteModal.portfolio.id));
      setDeleteModal({ isOpen: false, portfolio: null });
    } catch (err) {
      console.error('Error deleting portfolio:', err);
    } finally {
      setIsDeleting(false);
    }
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
              <PortfolioCard 
                key={portfolio.id} 
                portfolio={portfolio} 
                onDeleteClick={handleDeleteClick}
              />
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

      <CreatePortfolioDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handlePortfolioCreated}
      />

      <ConfirmDialog
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, portfolio: null })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteModal.portfolio?.name || 'Portfolio'}`}
        description="This will permanently delete this portfolio and all its trading history."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDeleting}
        busyLabel="Deleting..."
      />
    </PageContainer>
  );
}

