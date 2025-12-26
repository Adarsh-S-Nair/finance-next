"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import PageContainer from "../../../components/PageContainer";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Drawer from "../../../components/ui/Drawer";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import PlaidLinkModal from "../../../components/PlaidLinkModal";
import { LuPlus, LuBot, LuChevronLeft } from "react-icons/lu";
import { SiGooglegemini, SiX } from "react-icons/si";
import { useUser } from "../../../components/UserProvider";
import { supabase } from "../../../lib/supabaseClient";
import LineChart from "../../../components/ui/LineChart";
import { formatDateString } from "../../../lib/portfolioUtils";

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
  const [investmentPortfolios, setInvestmentPortfolios] = useState([]);
  const [allHoldings, setAllHoldings] = useState([]);
  const [stockQuotes, setStockQuotes] = useState({});
  const [portfolioSnapshots, setPortfolioSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, portfolio: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [investmentTransactions, setInvestmentTransactions] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch investment portfolios and holdings
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all plaid investment portfolios for this user
        // Include account balance (source of truth for cash)
        const { data: plaidPortfoliosData, error: plaidPortfoliosError } = await supabase
          .from('portfolios')
          .select(`
            *,
            holdings(id, ticker, shares, avg_cost),
            source_account:accounts!portfolios_source_account_id_fkey(
              id,
              name,
              balances,
              institutions(name, logo)
            )
          `)
          .eq('user_id', profile.id)
          .eq('type', 'plaid_investment')
          .order('created_at', { ascending: false });

        if (plaidPortfoliosError) {
          console.error('Error fetching portfolios:', plaidPortfoliosError);
          throw plaidPortfoliosError;
        }

        setInvestmentPortfolios(plaidPortfoliosData || []);

        // Fetch account snapshots for investment accounts (use these as baseline)
        const accountIds = (plaidPortfoliosData || [])
          .map(p => p.source_account?.id)
          .filter(id => id); // Remove nulls

        if (accountIds.length > 0) {
          const { data: accountSnapshotsData, error: accountSnapshotsError } = await supabase
            .from('account_snapshots')
            .select('*')
            .in('account_id', accountIds)
            .order('recorded_at', { ascending: true });

          if (accountSnapshotsError) {
            console.error('Error fetching account snapshots:', accountSnapshotsError);
            setPortfolioSnapshots([]);
          } else {
            // Store account snapshots in portfolioSnapshots state for now
            // We'll transform them in the chart component
            setPortfolioSnapshots(accountSnapshotsData || []);
          }
        } else {
          setPortfolioSnapshots([]);
        }

        // Aggregate all holdings from all portfolios
        const holdingsMap = new Map(); // To combine duplicate tickers across portfolios

        (plaidPortfoliosData || []).forEach((portfolio) => {
          (portfolio.holdings || []).forEach(holding => {
            const ticker = holding.ticker.toUpperCase();
            const shares = parseFloat(holding.shares) || 0;
            const avgCost = parseFloat(holding.avg_cost) || 0;
            const costBasis = shares * avgCost;

            if (holdingsMap.has(ticker)) {
              const existing = holdingsMap.get(ticker);
              // Sum shares and cost basis for weighted average
              existing.shares += shares;
              existing.totalCostBasis += costBasis;
              existing.avg_cost = existing.shares > 0 ? existing.totalCostBasis / existing.shares : 0;
            } else {
              holdingsMap.set(ticker, {
                ticker: ticker,
                shares: shares,
                totalCostBasis: costBasis,
                avg_cost: avgCost,
              });
            }
          });
        });

        const holdingsArray = Array.from(holdingsMap.values());

        // Fetch ticker logos and info
        if (holdingsArray.length > 0) {
          const tickers = holdingsArray.map(h => h.ticker);
          const { data: tickersData } = await supabase
            .from('tickers')
            .select('symbol, logo, name, sector')
            .in('symbol', tickers);

          const tickerMap = new Map();
          if (tickersData) {
            tickersData.forEach(t => {
              tickerMap.set(t.symbol, { logo: t.logo, name: t.name, sector: t.sector });
            });
          }

          const holdingsWithLogos = holdingsArray.map(holding => ({
            ...holding,
            logo: tickerMap.get(holding.ticker)?.logo || null,
            name: tickerMap.get(holding.ticker)?.name || null,
            sector: tickerMap.get(holding.ticker)?.sector || null,
          }));

          setAllHoldings(holdingsWithLogos);

          // Fetch stock quotes
          const tickerList = tickers.join(',');
          try {
            const quotesRes = await fetch(`/api/market-data/quotes?tickers=${tickerList}`);
            if (quotesRes.ok) {
              const quotesData = await quotesRes.json();
              setStockQuotes(quotesData.quotes || {});
            }
          } catch (quotesErr) {
            console.error('Error fetching stock quotes:', quotesErr);
          }
        } else {
          setAllHoldings([]);
        }

        // Fetch paper trading portfolios (AI and Alpaca)
        const { data: portfoliosData, error: portfoliosError } = await supabase
          .from('ai_portfolios')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });

        if (portfoliosError) throw portfoliosError;
        setPortfolios(portfoliosData || []);

        // Fetch investment transactions
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*, account:accounts(name, institutions(name, logo))')
          .eq('transaction_source', 'investments')
          .in('account_id', accountIds.length > 0 ? accountIds : ['no-accounts'])
          .order('date', { ascending: false })
          .limit(50);

        if (!transactionsError && transactionsData) {
          setInvestmentTransactions(transactionsData);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id, refreshTrigger]);

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

  // Calculate combined portfolio metrics (must be before conditional return)
  const portfolioMetrics = useMemo(() => {
    // Calculate portfolio value as: sum(holdings * shares * current_price) + cash
    // Holdings come ONLY from investment portfolios (plaid_investment), not paper trading
    // Cash = account balance - (holdings value at cost basis, approximate)

    let totalAccountBalance = 0; // Total from account balances
    let totalHoldingsValue = 0; // Holdings value at current market prices

    // Get account balances (for investment accounts, this is the total: cash + holdings)
    investmentPortfolios.forEach((portfolio) => {
      const balances = portfolio.source_account?.balances;
      const accountBalance = typeof balances?.current === 'string'
        ? parseFloat(balances.current)
        : (balances?.current || 0);

      totalAccountBalance += accountBalance;
    });

    // Calculate holdings value using CURRENT market prices
    // allHoldings already only includes holdings from investment portfolios (plaid_investment)
    allHoldings.forEach((holding) => {
      const ticker = holding.ticker.toUpperCase();
      const quote = stockQuotes[ticker];
      const currentPrice = quote?.price || holding.avg_cost || 0;
      const shares = parseFloat(holding.shares) || 0;
      const value = shares * currentPrice;
      totalHoldingsValue += value;
    });

    // Calculate cash: account balance - holdings value (approximate)
    // For investment accounts, account balance = cash + holdings (at institution's valuation)
    // We use current market prices for holdings, so cash = account balance - holdings at current prices
    const cash = totalAccountBalance - totalHoldingsValue;

    // Total portfolio value = holdings at current prices + cash
    // This ensures we use current market prices for holdings
    const totalPortfolioValue = totalHoldingsValue + cash;

    // Calculate holdings with current values
    const holdingsWithValues = allHoldings.map(holding => {
      const ticker = holding.ticker.toUpperCase();
      const quote = stockQuotes[ticker];
      const currentPrice = quote?.price || holding.avg_cost || 0;
      const shares = holding.shares || 0;
      const value = shares * currentPrice;
      const avgCost = holding.avg_cost || 0;

      return {
        ...holding,
        currentPrice,
        value,
        avgCost,
        percentage: totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0,
      };
    }).sort((a, b) => b.value - a.value);

    return {
      cash: cash,
      totalHoldingsValue,
      totalPortfolioValue,
      holdingsWithValues,
      cashPercentage: totalPortfolioValue > 0 ? (cash / totalPortfolioValue) * 100 : 0,
    };
  }, [investmentPortfolios, allHoldings, stockQuotes]);

  // Calculate sector data from holdings
  const sectorData = useMemo(() => {
    const sectorMap = new Map();

    portfolioMetrics.holdingsWithValues.forEach((holding) => {
      const sector = holding.sector || 'Other';
      const value = holding.value || 0;

      if (sectorMap.has(sector)) {
        sectorMap.set(sector, sectorMap.get(sector) + value);
      } else {
        sectorMap.set(sector, value);
      }
    });

    const totalValue = portfolioMetrics.totalHoldingsValue;

    const sectors = Array.from(sectorMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return sectors;
  }, [portfolioMetrics.holdingsWithValues, portfolioMetrics.totalHoldingsValue]);

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
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-sm font-bold tracking-[0.2em] text-[var(--color-fg)] uppercase" style={{ fontFamily: 'var(--font-poppins)' }}>Investments</h1>
        <Button
          size="sm"
          variant="matte"
          onClick={() => setShowLinkModal(true)}
          className="gap-1.5 !rounded-full pl-3 pr-4"
        >
          <LuPlus className="w-3.5 h-3.5" />
          Connect
        </Button>
      </div>

      {/* Main Investment Portfolio View */}
      {investmentPortfolios.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Panel - 2/3 width */}
          <div className="lg:w-2/3 flex flex-col gap-6">
            {/* Portfolio Value Chart Card */}
            <CombinedPortfolioChartCard
              portfolioMetrics={portfolioMetrics}
              snapshots={portfolioSnapshots}
            />

            {/* Investment Transactions Card */}
            <InvestmentTransactionsCard
              transactions={investmentTransactions}
            />
          </div>

          {/* Side Panel - 1/3 width */}
          <div className="lg:w-1/3 flex flex-col gap-4">
            {/* Portfolio Summary Card */}
            <PortfolioSummaryCard
              portfolioMetrics={portfolioMetrics}
              holdingsCount={allHoldings.length}
              accounts={investmentPortfolios}
            />

            {/* Investment Accounts Carousel */}
            {investmentPortfolios.length > 0 && (
              <InvestmentAccountsCard accounts={investmentPortfolios} stockQuotes={stockQuotes} />
            )}

            {/* Holdings & Sectors Card */}
            <HoldingsCard
              holdings={portfolioMetrics.holdingsWithValues}
              stockQuotes={stockQuotes}
              sectors={sectorData}
            />

            {/* Paper Trading Card */}
            <PaperTradingCard
              portfolios={portfolios}
              onPortfolioClick={handlePortfolioClick}
              onCreateClick={() => setShowCreateModal(true)}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* No Investment Accounts Message - Full Width */}
          <div className="lg:w-2/3">
            <div className="text-center py-16 bg-[var(--color-surface)]/30 rounded-2xl border border-[var(--color-border)]/50 border-dashed">
              <p className="text-[var(--color-muted)] mb-4">No investment accounts connected yet</p>
              <p className="text-sm text-[var(--color-muted)]/80">
                Connect your investment accounts from the Accounts page to see your portfolio here
              </p>
            </div>
          </div>

          {/* Side Panel - Paper Trading Only */}
          <div className="lg:w-1/3 flex flex-col gap-4">
            <PaperTradingCard
              portfolios={portfolios}
              onPortfolioClick={handlePortfolioClick}
              onCreateClick={() => setShowCreateModal(true)}
            />
          </div>
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

      <PlaidLinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        defaultAccountType="investment"
        onSuccess={() => {
          // Trigger refresh of investments data
          setRefreshTrigger(prev => prev + 1);
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

// Combined Portfolio Chart Card Component
function CombinedPortfolioChartCard({ portfolioMetrics, snapshots }) {
  const { profile } = useUser();
  const totalValue = portfolioMetrics.totalPortfolioValue;
  const [timeRange, setTimeRange] = useState('ALL');
  const [activeIndex, setActiveIndex] = useState(null);

  // Get EST minute key for grouping snapshots
  // EST is UTC-5, so we subtract 5 hours from UTC
  const getESTMinuteKey = (utcDate) => {
    // Convert UTC to EST (subtract 5 hours)
    const estTime = utcDate.getTime() - (5 * 60 * 60 * 1000);
    const estDate = new Date(estTime);
    // Round to nearest minute
    estDate.setSeconds(0, 0);
    estDate.setMilliseconds(0);
    // Return as ISO string for grouping
    return estDate.toISOString();
  };

  // Use account snapshots - these are account_snapshots, not portfolio_snapshots
  const aggregatedChartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      return [];
    }

    // Group snapshots by minute (in EST) and aggregate balances
    const snapshotsByMinute = new Map();

    snapshots.forEach(snapshot => {
      const utcDate = new Date(snapshot.recorded_at);
      // Group by EST minute
      const minuteKey = getESTMinuteKey(utcDate);
      const balance = parseFloat(snapshot.current_balance) || 0;

      if (snapshotsByMinute.has(minuteKey)) {
        // Sum balances for all accounts in the same minute
        const existing = snapshotsByMinute.get(minuteKey);
        existing.value += balance;
        // Keep the earliest date in this minute group
        if (utcDate < existing.date) {
          existing.date = utcDate;
        }
      } else {
        snapshotsByMinute.set(minuteKey, {
          date: utcDate,
          value: balance
        });
      }
    });

    // Convert to array and sort by date
    let chartData = Array.from(snapshotsByMinute.values())
      .map((data) => ({
        date: data.date,
        dateString: data.date.toISOString(),
        value: data.value
      }))
      .sort((a, b) => a.date - b.date);

    // Limit to max 40 data points, spread evenly
    const maxPoints = 40;
    if (chartData.length > maxPoints) {
      const step = Math.floor(chartData.length / maxPoints);
      chartData = chartData.filter((_, index) => index % step === 0 || index === chartData.length - 1);
    }

    // Always include current value as the last point
    const currentDateTime = new Date();
    const lastPoint = chartData[chartData.length - 1];
    const currentMinuteKey = getESTMinuteKey(currentDateTime);

    // Only add current point if it's in a different minute from the last snapshot
    if (!lastPoint || getESTMinuteKey(lastPoint.date) !== currentMinuteKey) {
      chartData.push({
        date: currentDateTime,
        dateString: currentDateTime.toISOString(),
        value: totalValue || 0
      });
    } else {
      // Update last point with current value
      lastPoint.value = totalValue || 0;
    }

    return chartData;
  }, [snapshots, totalValue]);

  // Filter chart data based on time range
  const filteredData = useMemo(() => {
    if (aggregatedChartData.length === 0) return [];
    if (timeRange === 'ALL') return aggregatedChartData;

    const now = new Date();
    let startDate = new Date(now);

    switch (timeRange) {
      case '1W':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return aggregatedChartData;
    }

    // Filter data based on start date
    const filtered = aggregatedChartData.filter(item => item.date >= startDate);
    // If there isn't enough data for the selected range, show all available data
    if (filtered.length === 0 && aggregatedChartData.length > 0) {
      return aggregatedChartData;
    }
    return filtered;
  }, [aggregatedChartData, timeRange]);

  // Display chart data (always include current value as the last point)
  // Note: filteredData is already sorted ascending (oldest first) from aggregatedChartData
  const displayChartData = useMemo(() => {
    if (filteredData.length === 0) {
      // If no filtered data, try to show at least a line from most recent snapshot to current value
      if (aggregatedChartData.length === 0) {
        return [];
      }
      // Use the most recent snapshot as start, current value as end
      const latestSnapshot = aggregatedChartData[aggregatedChartData.length - 1];
      const currentDateTime = new Date();
      return [
        latestSnapshot,
        {
          date: currentDateTime,
          dateString: currentDateTime.toISOString(),
          value: totalValue || 0,
        }
      ];
    }

    // filteredData is already sorted by date (ascending - oldest first)
    // The aggregatedChartData logic already handles adding/updating today's value
    // So we can use filteredData directly
    return filteredData;
  }, [filteredData, aggregatedChartData, totalValue]);

  // Calculate percentage change from first value in filtered/display data
  const percentChange = useMemo(() => {
    if (displayChartData.length === 0) {
      return 0;
    }
    const startValue = displayChartData[0].value;
    const currentValue = totalValue || 0;

    if (startValue === 0) {
      return 0;
    }

    return ((currentValue - startValue) / Math.abs(startValue)) * 100;
  }, [displayChartData, totalValue]);

  const returnAmount = useMemo(() => {
    if (displayChartData.length === 0) return 0;
    const startValue = displayChartData[0].value;
    return (totalValue || 0) - startValue;
  }, [displayChartData, totalValue]);

  // Calculate chart color based on performance
  const chartColor = useMemo(() => {
    if (displayChartData.length < 2) return 'var(--color-accent)';
    const startValue = displayChartData[0].value;
    const endValue = displayChartData[displayChartData.length - 1].value;
    return endValue >= startValue ? 'var(--color-success)' : 'var(--color-danger)';
  }, [displayChartData]);

  const availableRanges = useMemo(() => {
    return ['1W', '1M', '3M', 'YTD', '1Y', 'ALL'];
  }, []);

  const handleMouseMove = (data, index) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  // For accent color styling
  const validAccentColor = '#00f3ff';
  const isDefaultAccent = !profile?.accent_color || profile.accent_color === validAccentColor;
  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const activeTextColor = (isDarkMode && isDefaultAccent) ? 'var(--color-on-accent)' : '#fff';

  // Get date/time in EST for display (shows hovered point or last point)
  const displayDateTime = useMemo(() => {
    if (displayChartData.length === 0) return null;

    // Use activeIndex if hovering, otherwise use last point
    const point = activeIndex !== null && displayChartData[activeIndex]
      ? displayChartData[activeIndex]
      : displayChartData[displayChartData.length - 1];

    if (!point) return null;

    const date = new Date(point.dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    };
  }, [displayChartData, activeIndex]);

  return (
    <Card variant="glass" padding="none">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
        <div className="flex items-start justify-between mb-1">
          <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">
            Portfolio Value
          </div>
          {displayDateTime && (
            <div className="text-right">
              <div className="text-xs text-[var(--color-muted)] font-medium">
                {displayDateTime.date}
              </div>
              <div className="text-xs text-[var(--color-muted)]/80">
                {displayDateTime.time} EST
              </div>
            </div>
          )}
        </div>
        <div className="text-3xl font-medium text-[var(--color-fg)] tracking-tight tabular-nums mb-2">
          <AnimatedCounter value={totalValue || 0} duration={120} />
        </div>
        <div className={`text-xs font-medium ${percentChange > 0 ? 'text-emerald-500' :
          percentChange < 0 ? 'text-rose-500' :
            'text-[var(--color-muted)]'
          }`}>
          {returnAmount >= 0 ? '+' : ''}{formatCurrencyWithSmallCents(returnAmount)}
          {' '}
          ({percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%)
        </div>
      </div>

      {/* Chart */}
      <div className="pt-4 pb-2">
        {displayChartData.length > 0 ? (
          <div
            className="w-full focus:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none relative"
            tabIndex={-1}
            style={{ outline: 'none', height: '240px' }}
            onMouseLeave={handleMouseLeave}
          >
            <LineChart
              data={displayChartData}
              dataKey="value"
              width="100%"
              height={240}
              margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
              strokeColor={chartColor}
              strokeWidth={2}
              showArea={true}
              areaOpacity={0.15}
              showDots={false}
              dotRadius={4}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              showTooltip={false}
              gradientId={`combinedPortfolioChartGradient`}
              curveType="monotone"
              animationDuration={800}
              xAxisDataKey="dateString"
            />
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-[var(--color-muted)]/60 text-sm">
            Chart data will appear here once snapshots are available
          </div>
        )}
      </div>

      {/* Time Range Selector */}
      <div className="mt-2 pt-2 px-4 sm:px-6 pb-4 border-t border-[var(--color-border)]/50">
        <div className="flex justify-between items-center w-full">
          {availableRanges.map((range) => {
            const isActive = timeRange === range;

            return (
              <div key={range} className="flex-1 flex justify-center">
                <button
                  onClick={() => setTimeRange(range)}
                  className="relative px-3 py-1 text-[10px] font-bold rounded-full transition-colors text-center cursor-pointer outline-none focus:outline-none"
                  style={{
                    color: isActive ? activeTextColor : 'var(--color-muted)'
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="combinedPortfolioTimeRange"
                      className="absolute inset-0 bg-[var(--color-accent)] rounded-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${!isActive ? "hover:text-[var(--color-fg)]" : ""}`}>
                    {range}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// Holdings Card Component (similar to portfolio detail page)
function HoldingsCard({ holdings, stockQuotes, sectors = [] }) {
  return (
    <Card variant="glass" padding="none">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Holdings</div>
      </div>
      {holdings.length > 0 ? (
        <div className="pb-2">
          {holdings.slice(0, 10).map((holding) => {
            const quote = stockQuotes[holding.ticker];
            const currentPrice = quote?.price || null;
            const avgCost = holding.avgCost;

            let gainPercent = null;
            let currentValue = holding.value;

            if (currentPrice && avgCost > 0) {
              gainPercent = ((currentPrice - avgCost) / avgCost) * 100;
              currentValue = holding.shares * currentPrice;
            }

            const hasQuote = gainPercent !== null;

            return (
              <div
                key={holding.ticker}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--color-surface)]/20 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={{
                      background: holding.logo ? 'transparent' : 'var(--color-surface)',
                      border: '1px solid var(--color-border)/50'
                    }}
                  >
                    {holding.logo ? (
                      <img src={holding.logo} alt={holding.ticker} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-medium text-[var(--color-muted)]">{holding.ticker.slice(0, 2)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                      {holding.ticker}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {holding.shares.toFixed(2)} shares
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                    {formatCurrency(currentValue)}
                  </div>
                  {hasQuote ? (
                    <div className={`text-xs tabular-nums ${Math.abs(gainPercent) < 0.005 ? 'text-[var(--color-muted)]' :
                      gainPercent > 0 ? 'text-emerald-500' :
                        'text-rose-500'
                      }`}>
                      {gainPercent > 0.005 ? '+' : ''}{gainPercent.toFixed(2)}%
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--color-muted)]">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <div className="text-[var(--color-muted)]/60 text-[13px]">
            No holdings yet
          </div>
        </div>
      )}

      {/* Sectors Section */}
      {sectors && sectors.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-[var(--color-border)]/30">
          <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide mb-2">Sectors</div>
          <div className="flex flex-wrap gap-1.5">
            {sectors.map((sector) => (
              <div
                key={sector.name}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-surface)]/60 border border-[var(--color-border)]/30"
              >
                <span className="text-[10px] text-[var(--color-muted)]">{sector.name}</span>
                <span className="text-[10px] font-medium text-[var(--color-fg)] tabular-nums">
                  {sector.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// Portfolio Summary Card Component
function PortfolioSummaryCard({ portfolioMetrics, holdingsCount, accounts = [] }) {
  const investedPercentage = 100 - portfolioMetrics.cashPercentage;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (investedPercentage / 100) * circumference;

  return (
    <Card variant="glass" padding="none">
      <div className="px-4 pt-4 pb-3">
        <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Summary</div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-5">
          {/* Donut Chart */}
          <div className="relative w-[80px] h-[80px] flex-shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="url(#summaryGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
              />
              <defs>
                <linearGradient id="summaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
                {investedPercentage.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Stats - Right aligned values */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">Cash</span>
              <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                {formatCurrencyWithSmallCents(portfolioMetrics.cash)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">Invested</span>
              <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                {formatCurrencyWithSmallCents(portfolioMetrics.totalHoldingsValue)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Investment Accounts Card Component - Clean Carousel
function InvestmentAccountsCard({ accounts, stockQuotes = {} }) {
  const scrollContainerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Sort accounts by balance (highest first)
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const balanceA = a.source_account?.balances?.current || 0;
      const balanceB = b.source_account?.balances?.current || 0;
      return balanceB - balanceA;
    });
  }, [accounts]);

  // Handle scroll to update active index
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / cardWidth);
    setActiveIndex(Math.min(newIndex, sortedAccounts.length - 1));
  };

  // Navigate to specific index
  const scrollToIndex = (index) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardWidth = container.offsetWidth;
    container.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
    setActiveIndex(index);
  };

  if (sortedAccounts.length === 0) return null;

  return (
    <Card variant="glass" padding="none">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">
          Accounts
        </div>
        {sortedAccounts.length > 1 && (
          <div className="text-[10px] text-[var(--color-muted)]">
            {activeIndex + 1} / {sortedAccounts.length}
          </div>
        )}
      </div>

      <div className="pb-4">
        {/* Carousel Container */}
        <div className="overflow-hidden">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex gap-0 overflow-x-auto snap-x snap-mandatory"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {sortedAccounts.map((portfolio) => {
              const account = portfolio.source_account;
              if (!account) return null;
              const institution = account.institutions;

              // Get balances from account
              const balances = account.balances || {};
              const currentBalance = balances.current || 0;

              // Calculate holdings value at CURRENT MARKET PRICE
              const holdingsValue = (portfolio.holdings || []).reduce((sum, h) => {
                const ticker = (h.ticker || '').toUpperCase();
                const quote = stockQuotes[ticker];
                // Use current price if available, otherwise fall back to avg_cost
                const price = quote?.price || h.avg_cost || 0;
                return sum + ((h.shares || 0) * price);
              }, 0);

              // Cash is remainder (account balance minus current holdings value)
              const cashValue = Math.max(0, currentBalance - holdingsValue);
              const holdingsPercent = currentBalance > 0 ? (holdingsValue / currentBalance) * 100 : 0;

              return (
                <div
                  key={portfolio.id}
                  className="flex-shrink-0 w-full px-4 snap-center"
                >
                  {/* Clean Card Design */}
                  <div
                    className="rounded-xl p-4 border"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-border)'
                    }}
                  >
                    {/* Institution Header */}
                    <div className="flex items-center gap-2.5 mb-4">
                      {institution?.logo ? (
                        <img
                          src={institution.logo}
                          alt=""
                          className="w-8 h-8 rounded-lg object-contain"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-[var(--color-accent)]">
                            {(institution?.name || 'B')[0]}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                          {account.name}
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          {institution?.name || 'Brokerage'}
                        </div>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="mb-4">
                      <div className="text-xl font-semibold text-[var(--color-fg)] tabular-nums">
                        {formatCurrency(currentBalance)}
                      </div>
                    </div>

                    {/* Allocation Bar */}
                    <div className="mb-3">
                      <div className="w-full h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${holdingsPercent}%`,
                            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                          }}
                        />
                      </div>
                    </div>

                    {/* Holdings vs Cash */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
                        <span className="text-[var(--color-muted)]">Holdings</span>
                        <span className="text-[var(--color-fg)] font-medium tabular-nums">{formatCurrency(holdingsValue)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-muted)]/30" />
                        <span className="text-[var(--color-muted)]">Cash</span>
                        <span className="text-[var(--color-fg)] font-medium tabular-nums">{formatCurrency(cashValue)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dots */}
        {sortedAccounts.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {sortedAccounts.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToIndex(index)}
                className={`h-1 rounded-full transition-all cursor-pointer ${index === activeIndex
                  ? 'bg-[var(--color-accent)] w-3'
                  : 'bg-[var(--color-muted)]/25 w-1 hover:bg-[var(--color-muted)]/40'
                  }`}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// Sectors Card Component
function SectorsCard({ sectors }) {
  return (
    <Card variant="glass" padding="md">
      <div className="mb-3">
        <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Sectors</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sectors.map((sector) => (
          <div
            key={sector.name}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-surface)]/60 border border-[var(--color-border)]/30"
          >
            <span className="text-[10px] text-[var(--color-muted)]">{sector.name}</span>
            <span className="text-[10px] font-medium text-[var(--color-fg)] tabular-nums">
              {sector.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Investment Transactions Card Component
function InvestmentTransactionsCard({ transactions }) {
  const [tickerLogos, setTickerLogos] = useState({});

  // Fetch ticker logos on mount
  useEffect(() => {
    const fetchLogos = async () => {
      if (!transactions || transactions.length === 0) return;

      // Get unique tickers from transactions
      const tickers = [...new Set(
        transactions
          .map(t => t.investment_details?.ticker)
          .filter(Boolean)
      )];

      if (tickers.length === 0) return;

      try {
        const { data } = await supabase
          .from('tickers')
          .select('symbol, logo')
          .in('symbol', tickers);

        if (data) {
          const logoMap = {};
          data.forEach(t => {
            logoMap[t.symbol] = t.logo;
          });
          setTickerLogos(logoMap);
        }
      } catch (err) {
        console.error('Error fetching ticker logos:', err);
      }
    };

    fetchLogos();
  }, [transactions]);

  if (!transactions || transactions.length === 0) {
    return (
      <Card variant="glass" padding="none">
        <div className="px-5 pt-5 pb-3">
          <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Recent Transactions</div>
        </div>
        <div className="px-5 py-10 text-center">
          <div className="text-[var(--color-muted)]/60 text-sm">
            No investment transactions yet
          </div>
          <p className="text-xs text-[var(--color-muted)]/40 mt-2">
            Transactions will appear here when you buy or sell securities
          </p>
        </div>
      </Card>
    );
  }

  // Helper to get accent color for transaction type
  const getAccentColor = (type, subtype) => {
    const normalizedType = (type || '').toLowerCase();
    const normalizedSubtype = (subtype || '').toLowerCase();

    if (normalizedType === 'buy' || normalizedSubtype === 'buy') {
      return { color: '#10b981', isBuy: true, isSell: false, isTransfer: false };
    } else if (normalizedType === 'sell' || normalizedSubtype === 'sell') {
      return { color: '#ef4444', isBuy: false, isSell: true, isTransfer: false };
    } else if (normalizedType === 'dividend' || normalizedSubtype === 'dividend') {
      return { color: '#8b5cf6', isBuy: false, isSell: false, isDividend: true, isTransfer: false };
    } else if (normalizedType === 'fee') {
      return { color: '#f59e0b', isBuy: false, isSell: false, isTransfer: false };
    } else if (normalizedType === 'transfer' || normalizedSubtype === 'contribution' || normalizedSubtype === 'transfer') {
      return { color: '#3b82f6', isBuy: false, isSell: false, isTransfer: true };
    }
    // Other types - blue as default
    return { color: '#3b82f6', isBuy: false, isSell: false, isTransfer: true };
  };

  return (
    <Card variant="glass" padding="none">
      <div className="px-5 pt-5 pb-3">
        <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Recent Transactions</div>
      </div>
      <div className="pb-2">
        {transactions.slice(0, 5).map((transaction) => {
          const details = transaction.investment_details || {};
          const accent = getAccentColor(details.type, details.subtype);
          const ticker = details.ticker || null;
          const logo = ticker ? tickerLogos[ticker] : null;
          const quantity = details.quantity ? parseFloat(details.quantity) : null;
          const price = details.price ? parseFloat(details.price) : null;
          const amount = Math.abs(parseFloat(transaction.amount) || 0);
          const date = transaction.date
            ? new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '-';

          // Format shares with direction indicator
          const sharesText = quantity !== null
            ? `${accent.isBuy ? '+' : accent.isSell ? '-' : ''}${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)} shares`
            : null;

          // Better title for non-ticker transactions
          const title = ticker
            ? ticker
            : accent.isTransfer
              ? 'Cash Transfer'
              : 'Transaction';

          return (
            <div
              key={transaction.id}
              className="px-5 py-2.5 hover:bg-[var(--color-surface)]/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Ticker Logo */}
                {logo ? (
                  <img
                    src={logo}
                    alt={ticker}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    style={{ border: '1px solid var(--color-border)' }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-muted)'
                    }}
                  >
                    {ticker ? ticker.slice(0, 2) : '$'}
                  </div>
                )}

                {/* Transaction Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--color-fg)]">
                    {title}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    {sharesText && (
                      <span style={{ color: accent.isBuy ? '#10b981' : accent.isSell ? '#ef4444' : undefined }}>
                        {sharesText}
                      </span>
                    )}
                    {sharesText && price !== null && (
                      <span className="mx-1.5 text-[var(--color-border)]">•</span>
                    )}
                    {price !== null && (
                      <span>@ {formatCurrency(price)}</span>
                    )}
                    {!sharesText && price === null && accent.isTransfer && (
                      <span>Account contribution</span>
                    )}
                    {!sharesText && price === null && !accent.isTransfer && (
                      <span>{details.security_name || 'Investment activity'}</span>
                    )}
                  </div>
                </div>

                {/* Amount & Date */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-medium tabular-nums ${accent.isSell || accent.isDividend ? 'text-emerald-500' : 'text-[var(--color-fg)]'
                    }`}>
                    {accent.isSell || accent.isDividend ? '+' : ''}{formatCurrency(amount)}
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)]/60">
                    {date}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Paper Trading Card Component with Carousel
function PaperTradingCard({ portfolios, onPortfolioClick, onCreateClick }) {
  const scrollContainerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Handle scroll to update active index
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / cardWidth);
    setActiveIndex(Math.min(newIndex, portfolios.length - 1));
  };

  // Navigate to specific index
  const scrollToIndex = (index) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardWidth = container.offsetWidth;
    container.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
    setActiveIndex(index);
  };

  // Navigate prev/next
  const goToPrev = () => {
    if (activeIndex > 0) scrollToIndex(activeIndex - 1);
  };

  const goToNext = () => {
    if (activeIndex < portfolios.length - 1) scrollToIndex(activeIndex + 1);
  };

  return (
    <Card variant="glass" padding="none">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">
          Paper Trading
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 font-medium transition-colors cursor-pointer"
        >
          <LuPlus className="w-3 h-3" />
          New
        </button>
      </div>

      {portfolios.length > 0 ? (
        <div className="pb-3">
          {/* Carousel with Side Arrows */}
          <div className="flex items-center gap-1">
            {/* Prev Arrow */}
            {portfolios.length > 1 && (
              <button
                onClick={goToPrev}
                disabled={activeIndex === 0}
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${activeIndex === 0
                  ? 'text-[var(--color-muted)]/20 cursor-not-allowed'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Carousel Container */}
            <div className="flex-1 overflow-hidden">
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex gap-0 overflow-x-auto snap-x snap-mandatory"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {portfolios.map((portfolio) => (
                  <MiniPortfolioCard
                    key={portfolio.id}
                    portfolio={portfolio}
                    onClick={() => onPortfolioClick(portfolio)}
                  />
                ))}
              </div>
            </div>

            {/* Next Arrow */}
            {portfolios.length > 1 && (
              <button
                onClick={goToNext}
                disabled={activeIndex === portfolios.length - 1}
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${activeIndex === portfolios.length - 1
                  ? 'text-[var(--color-muted)]/20 cursor-not-allowed'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* Dots */}
          {portfolios.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {portfolios.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToIndex(index)}
                  className={`h-1 rounded-full transition-all cursor-pointer ${index === activeIndex
                    ? 'bg-[var(--color-accent)] w-3'
                    : 'bg-[var(--color-muted)]/25 w-1 hover:bg-[var(--color-muted)]/40'
                    }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <div className="text-[var(--color-muted)]/60 text-[13px] mb-2">
            No paper trading portfolios yet
          </div>
          <button
            onClick={onCreateClick}
            className="text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
          >
            Create your first
          </button>
        </div>
      )}
    </Card>
  );
}

// Mini Portfolio Card Component (for carousel)
function MiniPortfolioCard({ portfolio, onClick }) {
  const isAlpaca = portfolio.is_alpaca_connected === true;
  const [totalValue, setTotalValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sparklineData, setSparklineData] = useState([]);

  const AlpacaIcon = ({ className, style }) => (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const model = isAlpaca ? {
    name: 'Alpaca',
    icon: AlpacaIcon,
    color: '#4285F4',
  } : (AI_MODELS[portfolio.ai_model] || {
    name: portfolio.ai_model,
    icon: LuBot,
    color: '#8b5cf6',
  });
  const ModelIcon = model.icon;

  // Fetch total value and sparkline data from snapshots
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get recent snapshots for sparkline (last 14 days)
        const { data: snapshotData } = await supabase
          .from('ai_portfolio_snapshots')
          .select('total_value, snapshot_date')
          .eq('portfolio_id', portfolio.id)
          .order('snapshot_date', { ascending: true })
          .limit(14);

        if (snapshotData && snapshotData.length > 0) {
          setTotalValue(parseFloat(snapshotData[snapshotData.length - 1].total_value));
          setSparklineData(snapshotData.map(s => parseFloat(s.total_value)));
        } else {
          // Fallback to cash if no snapshots
          setTotalValue(parseFloat(portfolio.current_cash) || parseFloat(portfolio.starting_capital));
          setSparklineData([]);
        }
      } catch (err) {
        console.error('Error fetching portfolio value:', err);
        setTotalValue(parseFloat(portfolio.current_cash) || parseFloat(portfolio.starting_capital));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portfolio.id, portfolio.current_cash, portfolio.starting_capital]);

  // Calculate returns
  const startingCapital = parseFloat(portfolio.starting_capital) || 0;
  const currentValue = totalValue ?? startingCapital;
  const percentChange = startingCapital > 0
    ? ((currentValue - startingCapital) / startingCapital) * 100
    : 0;

  // Generate sparkline path
  const generateSparklinePath = () => {
    if (sparklineData.length < 2) return null;
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const width = 60;
    const height = 24;
    const padding = 2;

    const points = sparklineData.map((value, index) => {
      const x = (index / (sparklineData.length - 1)) * width;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  };

  const sparklinePath = generateSparklinePath();

  return (
    <div
      className="flex-shrink-0 w-full px-2 py-1 snap-center cursor-pointer group"
      onClick={onClick}
    >
      <div
        className="relative rounded-xl p-4 transition-all duration-300 group-hover:scale-[1.02] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.04) 50%, rgba(236, 72, 153, 0.02) 100%)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        {/* Animated floating orbs */}
        <div
          className="absolute w-20 h-20 rounded-full blur-2xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
            top: '-20%',
            right: '-10%',
            animation: 'miniFloat1 6s ease-in-out infinite'
          }}
        />
        <div
          className="absolute w-16 h-16 rounded-full blur-xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
            bottom: '-15%',
            left: '-5%',
            animation: 'miniFloat2 8s ease-in-out infinite'
          }}
        />

        {/* Header with Icon and Name */}
        <div className="relative flex items-center gap-3 mb-3">
          <ModelIcon
            className="w-5 h-5 flex-shrink-0"
            style={{ color: '#8b5cf6' }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--color-fg)] truncate">{portfolio.name}</div>
            <div className="text-[11px] text-[var(--color-muted)]">{model.name}</div>
          </div>

          {/* Mini Sparkline */}
          {sparklinePath && (
            <div className="flex-shrink-0">
              <svg width="60" height="24" className="overflow-visible">
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={percentChange >= 0 ? '#10b981' : '#ef4444'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.8 }}
                />
              </svg>
            </div>
          )}
        </div>

        {/* Value and Returns */}
        <div className="relative flex items-end justify-between">
          <div>
            <div className="text-lg font-normal text-[var(--color-fg)] tabular-nums">
              {loading ? (
                <span className="text-[var(--color-muted)]">...</span>
              ) : (
                formatCurrency(currentValue)
              )}
            </div>
            <div className={`text-xs font-medium tabular-nums ${percentChange > 0 ? 'text-emerald-500' :
              percentChange < 0 ? 'text-rose-500' :
                'text-[var(--color-muted)]'
              }`}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
            </div>
          </div>
          <div className="text-[11px] text-[var(--color-muted)]">
            {formatCurrency(startingCapital)} initial
          </div>
        </div>

        {/* CSS for floating animations */}
        <style jsx>{`
          @keyframes miniFloat1 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
            50% { transform: translate(-8px, 10px) scale(1.1); opacity: 0.7; }
          }
          @keyframes miniFloat2 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
            50% { transform: translate(10px, -8px) scale(1.15); opacity: 0.6; }
          }
        `}</style>
      </div>
    </div>
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
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]/30 animate-pulse">
        <div className="w-6 h-6 rounded bg-[var(--color-border)]" />
        <div className="flex-1">
          <div className="h-3 bg-[var(--color-border)] rounded w-24 mb-1" />
          <div className="h-3 bg-[var(--color-border)] rounded w-16" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)]/40 hover:bg-[var(--color-surface)]/60 border border-[var(--color-border)]/30 cursor-pointer transition-all group"
      onClick={onCardClick}
    >
      {/* AI Model Icon */}
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${model.color}15` }}
      >
        <ModelIcon
          className="w-3.5 h-3.5"
          style={{ color: model.color === '#000000' ? 'var(--color-fg)' : model.color }}
        />
      </div>

      {/* Portfolio Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[var(--color-fg)] truncate">{portfolio.name}</h3>
          <span className="text-[10px] text-[var(--color-muted)]/60 hidden sm:inline">{model.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>{formatCurrency(portfolio.starting_capital)} initial</span>
          <span className="text-[var(--color-border)]">•</span>
          <span>{createdDate}</span>
        </div>
      </div>

      {/* Value & Returns */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
          {formatCurrency(currentTotalValue || 0)}
        </div>
        <div className={`text-xs tabular-nums ${percentChange > 0 ? 'text-emerald-500' :
          percentChange < 0 ? 'text-rose-500' :
            'text-[var(--color-muted)]'
          }`}>
          {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
        </div>
      </div>

      {/* Chevron */}
      <svg
        className="w-4 h-4 text-[var(--color-muted)]/50 group-hover:text-[var(--color-muted)] transition-colors flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
