"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "../../../components/PageContainer";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Drawer from "../../../components/ui/Drawer";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { LuPlus, LuBot, LuChevronLeft } from "react-icons/lu";
import { SiGooglegemini, SiX } from "react-icons/si";
import { useUser } from "../../../components/UserProvider";
import { supabase } from "../../../lib/supabaseClient";

// Logo display component with error handling
function LogoDisplay({ logo, ticker }) {
  const [imageError, setImageError] = useState(false);

  if (!logo || imageError) {
    return (
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium text-[var(--color-muted)]"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)'
        }}
      >
        {ticker.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={logo}
      alt={ticker}
      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      style={{ border: '1px solid var(--color-border)' }}
      onError={() => setImageError(true)}
    />
  );
}

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

// Format currency with 2 decimal places
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format currency with smaller decimal digits (for display)
const formatCurrencyWithSmallCents = (amount) => {
  const formatted = formatCurrency(amount);
  const parts = formatted.split('.');
  if (parts.length === 2) {
    return (
      <>
        {parts[0]}<span className="text-[0.85em] text-[var(--color-muted)]">.{parts[1]}</span>
      </>
    );
  }
  return formatted;
};

// Format percentage
const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

// Parse a date string (YYYY-MM-DD) as a local date, not UTC
// This prevents timezone issues where "2025-12-22" becomes "2025-12-21" in local time
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Animated counter component for smooth number transitions
function AnimatedCounter({ value, duration = 120 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef(null);

  useEffect(() => {
    if (displayValue === value) return;

    setIsAnimating(true);

    const startValue = displayValue;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easeOutCubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, displayValue]);

  return (
    <span className={isAnimating ? 'transition-all duration-150' : ''}>
      {formatCurrencyWithSmallCents(displayValue)}
    </span>
  );
}

// Rebalance Countdown Component
function RebalanceCountdown({ nextRebalanceDate, rebalanceCadence }) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const nextDate = new Date(nextRebalanceDate);

      // Set time to end of day for the rebalance date
      nextDate.setHours(23, 59, 59, 999);

      const diff = nextDate - now;

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setProgress(100);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });

      // Calculate progress based on cadence
      let totalDays = 30; // Default to monthly
      if (rebalanceCadence === 'daily') totalDays = 1;
      else if (rebalanceCadence === 'weekly') totalDays = 7;
      else if (rebalanceCadence === 'monthly') totalDays = 30;
      else if (rebalanceCadence === 'quarterly') totalDays = 90;
      else if (rebalanceCadence === 'yearly') totalDays = 365;

      // Calculate how many days have passed since last rebalance (or creation)
      const previousDate = new Date(nextDate);
      previousDate.setDate(previousDate.getDate() - totalDays);
      const elapsed = now - previousDate;
      const total = nextDate - previousDate;
      const progressPercent = Math.min(Math.max((elapsed / total) * 100, 0), 100);

      setProgress(progressPercent);
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [nextRebalanceDate, rebalanceCadence]);

  if (!timeRemaining) {
    return (
      <div className="text-sm text-[var(--color-muted)]">Calculating...</div>
    );
  }

  const formatCadence = (cadence) => {
    if (!cadence) return 'Monthly';
    return cadence.charAt(0).toUpperCase() + cadence.slice(1);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-lg font-medium text-[var(--color-fg)] tabular-nums">
        {timeRemaining.days > 0 ? (
          <>{timeRemaining.days}d {timeRemaining.hours}h</>
        ) : timeRemaining.hours > 0 ? (
          <>{timeRemaining.hours}h {timeRemaining.minutes}m</>
        ) : (
          <>{timeRemaining.minutes}m {timeRemaining.seconds}s</>
        )}
      </div>
      <div className="text-right">
        <div className="text-[11px] text-[var(--color-muted)]/60">
          {new Date(nextRebalanceDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })}
        </div>
        <div className="text-[10px] text-[var(--color-muted)]/50">
          {formatCadence(rebalanceCadence)}
        </div>
      </div>
    </div>
  );
}

// Portfolio Detail View Component removed - now in [portfolio_id]/page.jsx

// Create Portfolio Drawer
function CreatePortfolioDrawer({ isOpen, onClose, onCreated }) {
  const { profile } = useUser();
  const [step, setStep] = useState('select'); // 'select', 'alpaca', 'ai'
  
  // AI Portfolio state
  const [name, setName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [startingCapital, setStartingCapital] = useState(100000);
  
  // Alpaca Portfolio state
  const [alpacaName, setAlpacaName] = useState('');
  const [alpacaApiKey, setAlpacaApiKey] = useState('');
  const [alpacaSecretKey, setAlpacaSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  
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

  const handleCreateAI = async () => {
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
      handleReset();
      onClose();
    } catch (err) {
      console.error('Error creating portfolio:', err);
      setError(err.message || 'Failed to create portfolio');
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnectAlpaca = async () => {
    if (!alpacaName.trim()) {
      setError('Please enter a portfolio name');
      return;
    }

    if (!alpacaApiKey.trim()) {
      setError('Please enter your Alpaca API Key');
      return;
    }

    if (!alpacaSecretKey.trim()) {
      setError('Please enter your Alpaca Secret Key');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/portfolios/connect-alpaca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          name: alpacaName.trim(),
          apiKey: alpacaApiKey.trim(),
          secretKey: alpacaSecretKey.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to connect Alpaca account');
      }

      onCreated(result.portfolio);
      handleReset();
      onClose();
    } catch (err) {
      console.error('Error connecting Alpaca account:', err);
      setError(err.message || 'Failed to connect Alpaca account');
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setName('');
    setNameManuallyEdited(false);
    setSelectedModel('gemini-3-flash-preview');
    setStartingCapital(100000);
    setAlpacaName('');
    setAlpacaApiKey('');
    setAlpacaSecretKey('');
    setShowSecretKey(false);
    setError(null);
  };

  useEffect(() => {
    if (isOpen && step === 'ai' && !nameManuallyEdited && !name) {
      const model = AI_MODELS[selectedModel];
      if (model) {
        setName(`${model.name} Portfolio`);
      }
    }
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  const selectedModelInfo = AI_MODELS[selectedModel];

  const AIThinkingOverlay = () => (
    <div className="absolute inset-0 bg-[var(--color-content-bg)]/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
      <div className="mb-6 flex items-center justify-center">
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
      <div className="text-center px-6">
        <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">
          AI is thinking...
        </h3>
        <p className="text-sm text-[var(--color-muted)] max-w-xs">
          {selectedModelInfo?.name || 'The AI'} is analyzing the market and making initial investment decisions
        </p>
      </div>
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

  const renderSelectionScreen = () => (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => setStep('alpaca')}
          className="p-4 rounded-lg border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)] transition-all text-left cursor-pointer"
        >
          <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">Connect Alpaca Account</h3>
          <p className="text-xs text-[var(--color-muted)]">
            Connect your existing Alpaca paper trading account to track your real portfolio
          </p>
        </button>
        
        <button
          type="button"
          onClick={() => setStep('ai')}
          className="p-4 rounded-lg border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)] transition-all text-left cursor-pointer"
        >
          <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">AI Portfolio</h3>
          <p className="text-xs text-[var(--color-muted)]">
            Create a paper trading simulation powered by AI to make investment decisions
          </p>
        </button>
      </div>
    </div>
  );

  const renderAlpacaForm = () => (
    <div className="space-y-6 pt-2">
      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
          Portfolio Name
        </label>
        <input
          type="text"
          value={alpacaName}
          onChange={(e) => setAlpacaName(e.target.value)}
          placeholder="e.g., My Alpaca Portfolio"
          className="w-full px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
          Alpaca API Key
        </label>
        <input
          type="text"
          value={alpacaApiKey}
          onChange={(e) => setAlpacaApiKey(e.target.value)}
          placeholder="Enter your Alpaca API Key"
          className="w-full px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)] font-mono text-sm"
        />
        <p className="text-xs text-[var(--color-muted)] mt-1.5">
          Find this in your Alpaca dashboard under API Keys
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
          Alpaca Secret Key
        </label>
        <div className="relative">
          <input
            type={showSecretKey ? "text" : "password"}
            value={alpacaSecretKey}
            onChange={(e) => setAlpacaSecretKey(e.target.value)}
            placeholder="Enter your Alpaca Secret Key"
            className="w-full px-3 py-2.5 pr-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)] font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowSecretKey(!showSecretKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer"
          >
            {showSecretKey ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-1.5">
          Your secret key will be securely stored and encrypted
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  );

  const renderAIForm = () => (
    <div className={`space-y-6 pt-2 ${isCreating ? 'opacity-0' : ''}`}>
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
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
              Starting Capital
            </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[25000, 50000, 100000, 250000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setStartingCapital(amount)}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${startingCapital === amount
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-accent)]/50'
                    }`}
                >
                  ${amount >= 1000000 ? `${amount / 1000000}M` : `${amount / 1000}K`}
                </button>
              ))}
            </div>
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
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
              AI Model
            </label>
            <div className="space-y-4">
              {AI_PROVIDERS.map((provider) => {
                const ProviderIcon = provider.icon;
                return (
                  <div key={provider.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <ProviderIcon
                        className="w-3.5 h-3.5"
                        style={{ color: provider.color === '#000000' ? 'var(--color-fg)' : provider.color }}
                      />
                      <span className="text-xs font-medium text-[var(--color-muted)]">
                        {provider.name}
                      </span>
                    </div>
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
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${isDisabled
                              ? 'border-[var(--color-border)] opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 cursor-pointer'
                                : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface)] cursor-pointer'
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
  );

  const views = [
    {
      id: 'select',
      title: 'Create Portfolio',
      description: 'Choose how you want to create your portfolio',
      content: renderSelectionScreen(),
      showBackButton: false,
    },
    {
      id: 'alpaca',
      title: 'Connect Alpaca Account',
      description: 'Connect your Alpaca paper trading account',
      content: renderAlpacaForm(),
      showBackButton: true,
    },
    {
      id: 'ai',
      title: 'Create AI Portfolio',
      description: 'Set up a new paper trading simulation',
      content: (
        <div className="relative h-full">
          {isCreating && <AIThinkingOverlay />}
          {renderAIForm()}
        </div>
      ),
      showBackButton: true,
    },
  ];

  const renderFooter = () => {
    if (isCreating) return null;
    
    if (step === 'select') {
      return (
        <div className="flex gap-3 w-full">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      );
    }
    
    if (step === 'alpaca') {
      return (
        <div className="flex gap-3 w-full">
          <Button onClick={handleConnectAlpaca} disabled={isCreating} className="flex-1">
            Connect Account
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex gap-3 w-full">
        <Button onClick={handleCreateAI} disabled={isCreating} className="flex-1">
          Create Portfolio
        </Button>
      </div>
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={isCreating ? undefined : onClose}
      size="md"
      footer={renderFooter()}
      views={views}
      currentViewId={step}
      onViewChange={(viewId) => setStep(viewId)}
      onBack={() => setStep('select')}
    />
  );
}

export default function InvestmentsPage() {
  const router = useRouter();
  const { profile } = useUser();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, portfolio: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch portfolios
  useEffect(() => {
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

    if (profile?.id) {
      fetchPortfolios();
    }
  }, [profile?.id]);

  const handlePortfolioClick = (portfolio) => {
    router.push(`/investments/${portfolio.id}`);
  };

  const handleDeletePortfolio = async (portfolio) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('ai_portfolios')
        .delete()
        .eq('id', portfolio.id);

      if (error) throw error;

      // Refresh portfolios list
      const { data, error: fetchError } = await supabase
        .from('ai_portfolios')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPortfolios(data || []);

      setDeleteModal({ isOpen: false, portfolio: null });
    } catch (err) {
      console.error('Error deleting portfolio:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] mx-auto mb-4" />
            <p className="text-[var(--color-muted)]">Loading portfolios...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">Portfolios</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <LuPlus className="w-4 h-4 mr-2" />
          Create Portfolio
        </Button>
      </div>

      {portfolios.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--color-muted)] mb-4">No portfolios yet</p>
          <Button onClick={() => setShowCreateModal(true)} variant="outline">
            Create your first portfolio
          </Button>
              </div>
      ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((portfolio) => (
                  <PortfolioCard
                    key={portfolio.id}
                    portfolio={portfolio}
              onCardClick={() => handlePortfolioClick(portfolio)}
                  />
                ))}
              </div>
      )}

      <CreatePortfolioDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(newPortfolio) => {
          setPortfolios([newPortfolio, ...portfolios]);
          setShowCreateModal(false);
        }}
      />

      <ConfirmDialog
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, portfolio: null })}
        onConfirm={() => handleDeletePortfolio(deleteModal.portfolio)}
        title={`Delete ${deleteModal.portfolio?.name}`}
        description="This will permanently delete this portfolio and all its trading history. This action cannot be undone."
        confirmLabel="Delete Portfolio"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDeleting}
        busyLabel="Deleting..."
      />
    </PageContainer>
  );
}

// Portfolio Card Component
function PortfolioCard({ portfolio, onCardClick }) {
  const { profile } = useUser();
  const isAlpaca = portfolio.is_alpaca_connected === true;
  
  // Alpaca icon component
  const AlpacaIcon = ({ className, style }) => (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
  
  const model = isAlpaca ? {
    name: 'Alpaca Account',
    icon: AlpacaIcon,
    color: '#4285F4',
  } : (AI_MODELS[portfolio.ai_model] || {
    name: portfolio.ai_model,
    icon: LuBot,
    color: 'var(--color-accent)',
  });
  const ModelIcon = model.icon;

  const [snapshots, setSnapshots] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [alpacaAccount, setAlpacaAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch portfolio snapshots and holdings
  useEffect(() => {
    const fetchData = async () => {
      try {
        // For Alpaca portfolios, fetch live account data
        if (isAlpaca) {
          try {
            const response = await fetch(`/api/portfolios/${portfolio.id}/alpaca-account`);
            if (response.ok) {
              const accountData = await response.json();
              setAlpacaAccount(accountData);
            } else {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              console.error('Failed to fetch Alpaca account data:', response.status, errorData);
            }
          } catch (err) {
            console.error('Error fetching Alpaca account:', err);
          }
        }

        // Fetch snapshots (for both AI and Alpaca portfolios)
        const { data: snapshotsData, error: snapshotsError } = await supabase
          .from('ai_portfolio_snapshots')
          .select('*')
          .eq('portfolio_id', portfolio.id)
          .order('snapshot_date', { ascending: true });

        if (snapshotsError) throw snapshotsError;
        setSnapshots(snapshotsData || []);

        // Fetch current holdings (for both AI and Alpaca portfolios)
        const { data: holdingsData, error: holdingsError } = await supabase
          .from('ai_portfolio_holdings')
          .select('*')
          .eq('portfolio_id', portfolio.id);

        if (holdingsError) throw holdingsError;
        setHoldings(holdingsData || []);
      } catch (err) {
        console.error('Error fetching portfolio data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portfolio.id, isAlpaca]);

  // Calculate current total value
  const currentTotalValue = useMemo(() => {
    // For Alpaca portfolios, use live account data from Alpaca API
    if (isAlpaca && alpacaAccount) {
      // Use equity or portfolio_value from Alpaca (they should be the same)
      return alpacaAccount.equity || alpacaAccount.portfolio_value || 0;
    }

    // For AI portfolios, use snapshots or calculate from cash + holdings
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[snapshots.length - 1];
      return parseFloat(latestSnapshot.total_value) || portfolio.current_cash;
    }

    // If no snapshots, calculate: cash + (sum of holdings value at current/market prices)
    // For now, use avg_cost as proxy for current price (since we'd need to fetch live prices)
    // This gives a reasonable estimate, though actual value may vary with market prices
    let holdingsValue = 0;
    if (holdings.length > 0) {
      holdingsValue = holdings.reduce((sum, holding) => {
        const shares = parseFloat(holding.shares) || 0;
        const avgCost = parseFloat(holding.avg_cost) || 0;
        return sum + (shares * avgCost);
      }, 0);
    }

    const cash = parseFloat(portfolio.current_cash) || 0;
    return cash + holdingsValue;
  }, [snapshots, holdings, portfolio.current_cash, isAlpaca, alpacaAccount]);

  // Process snapshot data for the chart - simple array of values
  const chartData = useMemo(() => {
    if (snapshots.length > 0) {
      return snapshots.map((snapshot) => parseFloat(snapshot.total_value) || 0);
    }

    // If no snapshots, create a simple line from starting capital to current value
    if (currentTotalValue !== portfolio.starting_capital) {
      return [portfolio.starting_capital, currentTotalValue];
    }

    return [portfolio.starting_capital];
  }, [snapshots, currentTotalValue, portfolio.starting_capital]);

  // Calculate percentage change from starting capital
  const percentChange = useMemo(() => {
    const startValue = portfolio.starting_capital;
    const currentValue = currentTotalValue;
    if (startValue === 0) return 0;
    return ((currentValue - startValue) / Math.abs(startValue)) * 100;
  }, [currentTotalValue, portfolio.starting_capital]);

  const returnAmount = currentTotalValue - portfolio.starting_capital;

  // Calculate chart color based on performance
  const chartColor = useMemo(() => {
    return currentTotalValue >= portfolio.starting_capital ? 'var(--color-success)' : 'var(--color-danger)';
  }, [currentTotalValue, portfolio.starting_capital]);

  const createdDate = new Date(portfolio.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Generate smooth path for SVG chart
  const generateSmoothPath = (points) => {
    if (points.length < 2) return "";
    return points.reduce((acc, point, i, a) => {
      if (i === 0) return `M ${point[0]},${point[1]}`;
      const [cpsX, cpsY] = a[i - 1];
      const [cpeX, cpeY] = point;
      const cp1x = cpsX + (cpeX - cpsX) / 3;
      const cp1y = cpsY;
      const cp2x = cpsX + (cpeX - cpsX) * 2 / 3;
      const cp2y = cpeY;
      return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${cpeX},${cpeY}`;
    }, "");
  };

  // Generate chart paths
  const { areaPath, linePath } = useMemo(() => {
    if (!chartData || chartData.length < 2) return { areaPath: "", linePath: "" };

    const width = 100;
    const height = 100;
    const max = Math.max(...chartData);
    const min = Math.min(...chartData);
    const range = max - min || 1;
    // Add padding to prevent flat lines at top/bottom
    const padding = range * 0.2;
    const adjustedMin = min - padding;
    const adjustedRange = range + padding * 2;
    const stepX = width / (chartData.length - 1);

    const points = chartData.map((val, i) => {
      const x = i * stepX;
      // Invert Y because SVG 0 is top
      const y = height - ((val - adjustedMin) / adjustedRange) * height;
      return [x, y];
    });

    const smoothLine = generateSmoothPath(points);
    const area = `${smoothLine} L ${width},${height} L 0,${height} Z`;

    return { areaPath: area, linePath: smoothLine };
  }, [chartData]);

  if (loading) {
    return (
      <Card className="group relative animate-pulse" variant="glass">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-[var(--color-border)] rounded w-20 mb-2" />
            <div className="h-6 bg-[var(--color-border)] rounded w-32" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="group relative overflow-hidden h-40 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
      variant="glass"
      padding="none"
      onClick={onCardClick}
    >
      <div className="p-4 relative z-10">
        <div className="flex items-center justify-between mb-3">
          {/* Header */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${model.color}20` }}
            >
              <ModelIcon
                className="w-4 h-4"
                style={{ color: model.color === '#000000' ? 'var(--color-fg)' : model.color }}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-[var(--color-fg)] truncate">{portfolio.name}</h3>
              <p className="text-xs text-[var(--color-muted)]">{model.name}</p>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <div className="text-lg font-semibold text-[var(--color-fg)] tracking-tight">
            <AnimatedCounter value={currentTotalValue || 0} duration={120} />
          </div>
          <div className={`text-xs font-medium mt-0.5 ${percentChange > 0 ? 'text-emerald-500' :
            percentChange < 0 ? 'text-rose-500' :
              'text-[var(--color-muted)]'
            }`}>
            {returnAmount >= 0 ? '+' : ''}{formatCurrencyWithSmallCents(returnAmount)}
            {' '}
            ({percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%)
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mt-2">
          <span>{formatCurrencyWithSmallCents(portfolio.starting_capital)} initial</span>
          <span>{createdDate}</span>
        </div>
      </div>

      {/* Chart Layer - Background */}
      <div className="absolute bottom-0 left-0 right-0 h-20 w-full z-0 pointer-events-none opacity-30">
        {chartData.length > 1 && (
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id={`portfolioGradient-${portfolio.id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={chartColor === 'var(--color-success)' ? '#10b981' : '#ef4444'} stopOpacity="0.15" />
                <stop offset="100%" stopColor={chartColor === 'var(--color-success)' ? '#10b981' : '#ef4444'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={areaPath}
              fill={`url(#portfolioGradient-${portfolio.id})`}
              className="transition-all duration-1000 ease-out"
            />
            <path
              d={linePath}
              fill="none"
              stroke={chartColor === 'var(--color-success)' ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="transition-all duration-1000 ease-out opacity-40"
            />
          </svg>
        )}
      </div>
    </Card>
  );
}
