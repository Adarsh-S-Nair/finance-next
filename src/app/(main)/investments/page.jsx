"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Drawer from "../../../components/ui/Drawer";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import PlaidLinkModal from "../../../components/PlaidLinkModal";
import { LuPlus, LuBot, LuLock, LuChevronRight } from "react-icons/lu";
import { SiGooglegemini, SiX } from "react-icons/si";
import { FiLoader } from "react-icons/fi";
import { PiBankFill } from "react-icons/pi";
import { useUser } from "../../../components/UserProvider";
import { supabase } from "../../../lib/supabaseClient";
import LineChart from "../../../components/ui/LineChart";
import { formatDateString } from "../../../lib/portfolioUtils";
import { useInvestmentsHeader } from "./InvestmentsHeaderContext";
import { ChartSkeleton, CardSkeleton } from "../../../components/ui/Skeleton";

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

// Format currency with 2 decimal places
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
      {formatCurrency(displayValue)}
    </span>
  );
}

// Create Portfolio Drawer
function CreatePortfolioDrawer({ isOpen, onClose, onCreated }) {
  const router = useRouter();
  const { profile } = useUser();
  const [step, setStep] = useState('form');

  // Portfolio state
  const [name, setName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [startingCapital, setStartingCapital] = useState(100000);
  const [assetType, setAssetType] = useState('stock');
  const [selectedCryptos, setSelectedCryptos] = useState(['BTC', 'ETH']);
  const [portfolioMode, setPortfolioMode] = useState('live');

  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [backtestStartDate, setBacktestStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return getLocalDateString(date);
  });
  const [backtestEndDate, setBacktestEndDate] = useState(() => {
    return getLocalDateString(new Date());
  });

  const todayLocalString = useMemo(() => getLocalDateString(new Date()), []);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const hasAI = assetType === 'stock';

  const AVAILABLE_CRYPTOS = [
    { symbol: 'BTC', name: 'Bitcoin', chain: 'bitcoin' },
    { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum' },
  ];

  const [cryptoTickers, setCryptoTickers] = useState({});

  const getTrustWalletLogoUrl = (chain) => {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`;
  };

  const MIN_CAPITAL = 1000;
  const MAX_CAPITAL = 10000000;

  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    if (!nameManuallyEdited && hasAI) {
      const model = AI_MODELS[modelId];
      if (model) {
        setName(`${model.name} Portfolio`);
      }
    }
  };

  const handleAssetTypeChange = (type) => {
    if (portfolioMode === 'backtest' && type === 'stock') {
      return;
    }
    setAssetType(type);
    if (!nameManuallyEdited) {
      if (type === 'crypto') {
        setName('Crypto Portfolio');
      } else {
        setName('');
      }
    }
  };

  const handleCryptoToggle = (cryptoSymbol) => {
    setSelectedCryptos(prev => {
      if (prev.includes(cryptoSymbol)) {
        return prev.filter(c => c !== cryptoSymbol);
      } else {
        return [...prev, cryptoSymbol];
      }
    });
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    setNameManuallyEdited(true);
  };

  const handleCreatePortfolio = async () => {
    if (portfolioMode === 'live' && !name.trim()) {
      setError('Please enter a portfolio name');
      return;
    }

    if (startingCapital < MIN_CAPITAL) {
      setError(`Starting capital must be at least ${formatCurrency(MIN_CAPITAL)}`);
      return;
    }

    if (assetType === 'crypto' && selectedCryptos.length === 0) {
      setError('Please select at least one cryptocurrency');
      return;
    }

    if (portfolioMode === 'backtest') {
      const startDate = new Date(backtestStartDate);
      const endDate = new Date(backtestEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate >= endDate) {
        setError('Start date must be before end date');
        return;
      }

      if (endDate > today) {
        setError('End date cannot be in the future');
        return;
      }
    }

    setIsCreating(true);
    setError(null);

    try {
      if (portfolioMode === 'backtest') {
        const response = await fetch('/api/ai-trading/backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startingCapital: startingCapital,
            assetType: assetType,
            cryptoAssets: assetType === 'crypto' ? selectedCryptos : null,
            startDate: backtestStartDate,
            endDate: backtestEndDate,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to run backtest');
        }

        handleReset();
        onClose();
        const params = new URLSearchParams({
          data: JSON.stringify(result.backtest),
        });
        router.push(`/investments/backtest?${params.toString()}`);
        return;
      }

      const response = await fetch('/api/ai-trading/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          name: name.trim(),
          aiModel: hasAI ? selectedModel : null,
          startingCapital: startingCapital,
          assetType: assetType,
          cryptoAssets: assetType === 'crypto' ? selectedCryptos : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to initialize portfolio');
      }

      onCreated(result.portfolio);
      handleReset();
      onClose();
      router.push(`/investments/${result.portfolio.id}`);
    } catch (err) {
      console.error('Error creating portfolio:', err);
      setError(err.message || 'Failed to create portfolio');
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    setStep('form');
    setName('');
    setNameManuallyEdited(false);
    setSelectedModel('gemini-3-flash-preview');
    setStartingCapital(100000);
    setAssetType('stock');
    setSelectedCryptos(['BTC', 'ETH']);
    setPortfolioMode('live');
    const date = new Date();
    date.setDate(date.getDate() - 30);
    setBacktestStartDate(getLocalDateString(date));
    setBacktestEndDate(getLocalDateString(new Date()));
    setError(null);
  };

  useEffect(() => {
    if (isOpen && !nameManuallyEdited) {
      if (hasAI) {
        const model = AI_MODELS[selectedModel];
        if (model) {
          setName(`${model.name} Portfolio`);
        }
      } else if (assetType === 'crypto') {
        setName('Crypto Portfolio');
      }
    }
  }, [isOpen, hasAI, selectedModel, assetType]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCryptoTickers = async () => {
      try {
        const cryptoSymbols = AVAILABLE_CRYPTOS.map(c => c.symbol);
        const { data: existingTickers } = await supabase
          .from('tickers')
          .select('symbol, name, logo, asset_type')
          .in('symbol', cryptoSymbols);

        const tickerMap = {};
        if (existingTickers) {
          existingTickers.forEach(ticker => {
            tickerMap[ticker.symbol] = ticker;
          });
        }

        AVAILABLE_CRYPTOS.forEach(crypto => {
          if (!tickerMap[crypto.symbol]) {
            tickerMap[crypto.symbol] = {
              symbol: crypto.symbol,
              name: crypto.name,
              logo: getTrustWalletLogoUrl(crypto.chain),
            };
          } else {
            if (!tickerMap[crypto.symbol].name) {
              tickerMap[crypto.symbol].name = crypto.name;
            }
            if (!tickerMap[crypto.symbol].logo) {
              tickerMap[crypto.symbol].logo = getTrustWalletLogoUrl(crypto.chain);
            }
          }
        });

        setCryptoTickers(tickerMap);
      } catch (err) {
        console.error('Error fetching crypto tickers:', err);
        const fallbackMap = {};
        AVAILABLE_CRYPTOS.forEach(crypto => {
          fallbackMap[crypto.symbol] = {
            symbol: crypto.symbol,
            name: crypto.name,
            logo: getTrustWalletLogoUrl(crypto.chain),
          };
        });
        setCryptoTickers(fallbackMap);
      }
    };

    fetchCryptoTickers();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  useEffect(() => {
    if (portfolioMode === 'backtest' && assetType === 'stock') {
      setAssetType('crypto');
      if (!nameManuallyEdited) {
        setName('Crypto Portfolio');
      }
    }
  }, [portfolioMode]);

  const selectedModelInfo = hasAI ? AI_MODELS[selectedModel] : null;

  const AIThinkingOverlay = () => {
    if (!hasAI) return null;

    return (
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
  };

  const renderPortfolioForm = () => (
    <div className={`space-y-6 pt-2 ${isCreating ? 'opacity-0' : ''}`}>
      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
          Portfolio Mode
        </label>
        <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 inline-flex w-full">
          <div
            className="absolute top-1 bottom-1 bg-[var(--color-accent)] rounded-md transition-all duration-200 ease-out"
            style={{
              left: portfolioMode === 'live' ? '4px' : '50%',
              width: 'calc(50% - 4px)',
            }}
          />
          <button
            type="button"
            onClick={() => setPortfolioMode('live')}
            className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-medium transition-colors duration-200 cursor-pointer rounded-md flex items-center justify-center gap-2 ${portfolioMode === 'live'
              ? 'text-[var(--color-on-accent)]'
              : 'text-[var(--color-fg)] hover:text-[var(--color-accent)]'
              }`}
          >
            LIVE
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPortfolioMode('backtest')}
            className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-medium transition-colors duration-200 cursor-pointer rounded-md ${portfolioMode === 'backtest'
              ? 'text-[var(--color-on-accent)]'
              : 'text-[var(--color-fg)] hover:text-[var(--color-accent)]'
              }`}
          >
            Backtest
          </button>
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-1.5">
          {portfolioMode === 'live'
            ? 'Creates and saves a portfolio to your account'
            : 'Runs a simulation without saving to your account'}
        </p>
      </div>

      {portfolioMode === 'live' && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
            Portfolio Name
          </label>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder={assetType === 'crypto' ? 'Crypto Portfolio' : 'e.g., My Portfolio'}
            className="w-full px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
          Asset Type
        </label>
        <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 inline-flex w-full">
          <div
            className="absolute top-1 bottom-1 bg-[var(--color-accent)] rounded-md transition-all duration-200 ease-out"
            style={{
              left: assetType === 'stock' ? '4px' : '50%',
              width: 'calc(50% - 4px)',
            }}
          />
          <button
            type="button"
            onClick={() => handleAssetTypeChange('stock')}
            disabled={portfolioMode === 'backtest'}
            className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-medium transition-colors duration-200 rounded-md flex items-center justify-center gap-1.5 ${portfolioMode === 'backtest'
              ? 'opacity-50 cursor-not-allowed text-[var(--color-muted)]'
              : assetType === 'stock'
                ? 'text-[var(--color-on-accent)] cursor-pointer'
                : 'text-[var(--color-fg)] hover:text-[var(--color-accent)] cursor-pointer'
              }`}
          >
            Stock
            {portfolioMode === 'backtest' && <LuLock className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => handleAssetTypeChange('crypto')}
            className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-medium transition-colors duration-200 cursor-pointer rounded-md ${assetType === 'crypto'
              ? 'text-[var(--color-on-accent)]'
              : 'text-[var(--color-fg)] hover:text-[var(--color-accent)]'
              }`}
          >
            Crypto
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
          Starting Capital
        </label>
        <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 inline-flex w-full">
          {(() => {
            const capitalOptions = [25000, 50000, 100000, 250000];
            const selectedIndex = capitalOptions.indexOf(startingCapital);
            const width = 'calc(25% - 3px)';
            const left = selectedIndex >= 0 ? `calc(${selectedIndex * 25}% + 4px)` : '4px';
            return (
              <div
                className="absolute top-1 bottom-1 bg-[var(--color-accent)] rounded-md transition-all duration-200 ease-out"
                style={{ left: left, width: width }}
              />
            );
          })()}
          {[25000, 50000, 100000, 250000].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setStartingCapital(amount)}
              className={`relative z-10 flex-1 py-2.5 px-2 text-sm font-medium transition-colors duration-200 cursor-pointer rounded-md ${startingCapital === amount
                ? 'text-[var(--color-on-accent)]'
                : 'text-[var(--color-fg)] hover:text-[var(--color-accent)]'
                }`}
            >
              ${amount >= 1000000 ? `${amount / 1000000}M` : `${amount / 1000}K`}
            </button>
          ))}
        </div>
      </div>

      {!hasAI && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
            Crypto Assets
          </label>
          <div className="space-y-2">
            {AVAILABLE_CRYPTOS.map((crypto) => {
              const isSelected = selectedCryptos.includes(crypto.symbol);
              const tickerData = cryptoTickers[crypto.symbol];
              const logoUrl = tickerData?.logo || getTrustWalletLogoUrl(crypto.chain);
              const displayName = tickerData?.name || crypto.name;

              return (
                <button
                  key={crypto.symbol}
                  type="button"
                  onClick={() => handleCryptoToggle(crypto.symbol)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 cursor-pointer'
                    : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface)] cursor-pointer'
                    }`}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={crypto.symbol}
                      className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                      style={{ border: '1px solid var(--color-border)' }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium text-[var(--color-muted)]"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                    >
                      {crypto.symbol.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-fg)]">{displayName}</p>
                    <p className="text-xs text-[var(--color-muted)]">{crypto.symbol}</p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
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
      )}

      {hasAI && (
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
      )}

      {portfolioMode === 'backtest' && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--color-muted)] mb-1.5">Start Date</label>
              <input
                type="date"
                value={backtestStartDate}
                onChange={(e) => setBacktestStartDate(e.target.value)}
                max={backtestEndDate}
                className="w-full px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-muted)] mb-1.5">End Date</label>
              <input
                type="date"
                value={backtestEndDate}
                onChange={(e) => setBacktestEndDate(e.target.value)}
                max={todayLocalString}
                min={backtestStartDate}
                className="w-full px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  );

  const views = [
    {
      id: 'form',
      title: portfolioMode === 'backtest' ? 'Run Backtest' : 'Create Portfolio',
      description: portfolioMode === 'backtest'
        ? 'Simulate trading strategy on historical data'
        : 'Set up a new paper trading simulation',
      content: (
        <div className="relative h-full">
          {isCreating && hasAI && <AIThinkingOverlay />}
          {renderPortfolioForm()}
        </div>
      ),
      showBackButton: false,
    },
  ];

  const renderFooter = () => {
    const isCreateDisabled = assetType === 'crypto' && selectedCryptos.length === 0;

    return (
      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={onClose} disabled={isCreating} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleCreatePortfolio} disabled={isCreating || isCreateDisabled} className="flex-1">
          {isCreating ? (
            <>
              <FiLoader className="h-4 w-4 mr-2 animate-spin" />
              {portfolioMode === 'backtest' ? 'Running...' : 'Creating...'}
            </>
          ) : (
            portfolioMode === 'backtest' ? 'Run Backtest' : 'Create Portfolio'
          )}
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

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function InvestmentsPage() {
  const router = useRouter();
  const { profile } = useUser();
  const { setHeaderActions } = useInvestmentsHeader();
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [chartTimeRange, setChartTimeRange] = useState('ALL');
  const [sparklineData, setSparklineData] = useState({});

  // Register header actions with layout
  useEffect(() => {
    if (setHeaderActions) {
      setHeaderActions({
        onConnectClick: () => setShowLinkModal(true),
      });
    }
  }, [setHeaderActions]);

  // Fetch investment portfolios and holdings
  useEffect(() => {
    const fetchData = async () => {
      try {
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

        if (plaidPortfoliosError) throw plaidPortfoliosError;

        setInvestmentPortfolios(plaidPortfoliosData || []);

        const accountIds = (plaidPortfoliosData || [])
          .map(p => p.source_account?.id)
          .filter(id => id);

        if (accountIds.length > 0) {
          const { data: accountSnapshotsData } = await supabase
            .from('account_snapshots')
            .select('*')
            .in('account_id', accountIds)
            .order('recorded_at', { ascending: true });

          setPortfolioSnapshots(accountSnapshotsData || []);
        }

        const allTickers = (plaidPortfoliosData || []).flatMap(p =>
          (p.holdings || []).map(h => h.ticker.toUpperCase())
        );

        const uniqueTickers = [...new Set(allTickers)];

        if (uniqueTickers.length > 0) {
          // Fetch ticker metadata (logos, names, sectors, asset_type) from our DB
          const { data: tickersData } = await supabase
            .from('tickers')
            .select('symbol, logo, name, sector, asset_type')
            .in('symbol', uniqueTickers);

          const tickerMap = {};
          (tickersData || []).forEach(t => {
            tickerMap[t.symbol] = t;
          });

          // Initialize quotes map with ticker metadata
          const quotesMap = {};
          uniqueTickers.forEach(ticker => {
            quotesMap[ticker] = {
              price: null,
              logo: tickerMap[ticker]?.logo || null,
              name: tickerMap[ticker]?.name || null,
              sector: tickerMap[ticker]?.sector || null,
              assetType: tickerMap[ticker]?.asset_type || 'stock',
            };
          });

          // Fetch current prices from the quotes API
          try {
            const quoteResponse = await fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(',')}`);
            if (quoteResponse.ok) {
              const quoteData = await quoteResponse.json();
              // quoteData.quotes is an object: { AAPL: { price, cached, cachedAt }, ... }
              Object.entries(quoteData.quotes || {}).forEach(([symbol, data]) => {
                if (quotesMap[symbol]) {
                  quotesMap[symbol].price = data.price;
                }
              });
            }
          } catch (err) {
            console.error('Error fetching quotes:', err);
          }

          setStockQuotes(quotesMap);
        }

        // Combine holdings from all portfolios, filtering out cash holdings
        const combinedHoldings = [];
        (plaidPortfoliosData || []).forEach(portfolio => {
          (portfolio.holdings || []).forEach(h => {
            const ticker = (h.ticker || '').toUpperCase();
            const assetType = h.asset_type || quotesMap[ticker]?.assetType || 'stock';
            // Filter out cash holdings - they belong in the allocation section, not holdings display
            const isCashHolding = assetType === 'cash' || ticker.startsWith('CUR:') || ticker === 'USD';
            if (!isCashHolding) {
              combinedHoldings.push({
                ...h,
                portfolioId: portfolio.id,
                portfolioName: portfolio.name,
                assetType: assetType
              });
            }
          });
        });
        setAllHoldings(combinedHoldings);

        // Fetch AI portfolios
        const { data: aiPortfoliosData } = await supabase
          .from('portfolios')
          .select('*')
          .eq('user_id', profile.id)
          .eq('type', 'ai_trading')
          .order('created_at', { ascending: false });

        setPortfolios(aiPortfoliosData || []);
      } catch (err) {
        console.error('Error fetching investment data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id, refreshTrigger]);

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    if (!investmentPortfolios.length) {
      return {
        totalHoldingsValue: 0,
        cash: 0,
        totalPortfolioValue: 0,
        cashPercentage: 0,
        holdingsWithValues: []
      };
    }

    const holdingsWithValues = [];
    let totalHoldingsValue = 0;
    let totalCash = 0;

    investmentPortfolios.forEach(portfolio => {
      // Process each holding in this portfolio
      (portfolio.holdings || []).forEach(h => {
        const ticker = (h.ticker || '').toUpperCase();
        const quote = stockQuotes[ticker];
        const shares = h.shares || 0;
        const avgCost = h.avg_cost || 0;
        const assetType = h.asset_type || quote?.assetType || 'stock';
        
        // Check if this is a cash holding
        const isCashHolding = assetType === 'cash' || ticker.startsWith('CUR:') || ticker === 'USD';
        
        if (isCashHolding) {
          // Cash holdings: the value IS the cash amount (price is always 1.0)
          const cashValue = shares * 1.0; // shares represents the dollar amount
          totalCash += cashValue;
        } else {
          // Non-cash holdings: calculate value at current market price
          const currentPrice = quote?.price || null;
          const priceForCalc = currentPrice !== null ? currentPrice : avgCost;
          const value = shares * priceForCalc;
          
          totalHoldingsValue += value;

          const existing = holdingsWithValues.find(hv => hv.ticker === ticker);
          if (existing) {
            existing.shares += shares;
            existing.value += value;
            // Weight average cost when combining
            const totalShares = existing.shares;
            existing.avgCost = ((existing.avgCost * (totalShares - shares)) + (avgCost * shares)) / totalShares;
          } else {
            holdingsWithValues.push({
              ticker,
              shares,
              avgCost,
              currentPrice,
              value,
              logo: quote?.logo || null,
              name: quote?.name || null,
              sector: quote?.sector || null,
              assetType
            });
          }
        }
      });
    });

    const cash = totalCash;
    const totalPortfolioValue = totalHoldingsValue + cash;
    const cashPercentage = totalPortfolioValue > 0 ? (cash / totalPortfolioValue) * 100 : 0;

    holdingsWithValues.sort((a, b) => b.value - a.value);

    return {
      totalHoldingsValue,
      cash,
      totalPortfolioValue,
      cashPercentage,
      holdingsWithValues
    };
  }, [investmentPortfolios, stockQuotes]);

  // Fetch sparkline data for holdings
  useEffect(() => {
    const tickers = portfolioMetrics.holdingsWithValues.map(h => h.ticker);
    if (tickers.length === 0) return;

    const fetchSparklineData = async () => {
      const now = new Date();
      let startDate = new Date();
      
      // Calculate start date based on time range
      switch (chartTimeRange) {
        case '1W': startDate.setDate(now.getDate() - 7); break;
        case '1M': startDate.setMonth(now.getMonth() - 1); break;
        case '3M': startDate.setMonth(now.getMonth() - 3); break;
        case 'YTD': startDate = new Date(now.getFullYear(), 0, 1); break;
        case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
        case 'ALL': startDate.setFullYear(now.getFullYear() - 5); break;
        default: startDate.setMonth(now.getMonth() - 1);
      }

      const startTs = Math.floor(startDate.getTime() / 1000);
      const endTs = Math.floor(now.getTime() / 1000);
      const sparklines = {};

      // Fetch sparkline data for each ticker
      await Promise.all(tickers.map(async (ticker) => {
        try {
          const response = await fetch(
            `/api/market-data/historical-range?ticker=${ticker}&start=${startTs}&end=${endTs}&interval=1d`
          );
          if (response.ok) {
            const data = await response.json();
            // Extract just the prices for the sparkline
            sparklines[ticker] = (data.prices || []).map(p => p.price);
          }
        } catch (err) {
          console.error(`Error fetching sparkline for ${ticker}:`, err);
        }
      }));

      setSparklineData(sparklines);
    };

    fetchSparklineData();
  }, [portfolioMetrics.holdingsWithValues, chartTimeRange]);

  const handlePortfolioClick = (portfolio) => {
    router.push(`/investments/${portfolio.id}`);
  };

  const handleDeletePortfolio = async (portfolio) => {
    if (!portfolio) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/ai-trading/delete?portfolioId=${portfolio.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete portfolio');
      setPortfolios(prev => prev.filter(p => p.id !== portfolio.id));
      setDeleteModal({ isOpen: false, portfolio: null });
    } catch (err) {
      console.error('Error deleting portfolio:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-2/3 flex flex-col gap-6">
          <ChartSkeleton />
        </div>
        <div className="lg:w-1/3 flex flex-col gap-4">
          <CardSkeleton className="h-48" />
          <CardSkeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <>
      {investmentPortfolios.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Panel - 2/3 width */}
          <div className="lg:w-2/3 flex flex-col gap-6">
            <PortfolioChartCard
              portfolioMetrics={portfolioMetrics}
              snapshots={portfolioSnapshots}
              holdings={portfolioMetrics.holdingsWithValues}
              timeRange={chartTimeRange}
              onTimeRangeChange={setChartTimeRange}
            />

            {/* Holdings List */}
            <HoldingsList
              holdings={portfolioMetrics.holdingsWithValues}
              sparklineData={sparklineData}
            />
          </div>

          {/* Side Panel - 1/3 width */}
          <div className="lg:w-1/3 flex flex-col gap-4">
            <AccountsSummary
              portfolioMetrics={portfolioMetrics}
              accounts={investmentPortfolios}
              stockQuotes={stockQuotes}
            />

            <PaperPortfoliosList
              portfolios={portfolios}
              onPortfolioClick={handlePortfolioClick}
              onCreateClick={() => setShowCreateModal(true)}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3">
            <div className="text-center py-16 bg-[var(--color-surface)]/30 rounded-xl border border-[var(--color-border)]/50 border-dashed">
              <div className="mx-auto w-16 h-16 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-4 border border-[var(--color-border)]">
                <PiBankFill className="h-8 w-8 text-[var(--color-muted)]" />
              </div>
              <p className="text-[var(--color-fg)] font-medium mb-2">No investment accounts connected</p>
              <p className="text-sm text-[var(--color-muted)] mb-6 max-w-sm mx-auto">
                Connect your brokerage accounts to see your portfolio and holdings here.
              </p>
              <Button onClick={() => setShowLinkModal(true)}>
                Connect Account
              </Button>
            </div>
          </div>

          <div className="lg:w-1/3 flex flex-col gap-4">
            <PaperPortfoliosList
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
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      <ConfirmDialog
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, portfolio: null })}
        onConfirm={() => handleDeletePortfolio(deleteModal.portfolio)}
        title={`Delete ${deleteModal.portfolio?.name}`}
        description="This will permanently delete this portfolio and all its trading history."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDeleting}
        busyLabel="Deleting..."
      />
    </>
  );
}

// ============================================================================
// PORTFOLIO CHART CARD - Clean minimal design with historical price interpolation
// ============================================================================

function PortfolioChartCard({ portfolioMetrics, snapshots, holdings, timeRange, onTimeRangeChange }) {
  const { profile } = useUser();
  const totalValue = portfolioMetrics.totalPortfolioValue;
  const cashValue = portfolioMetrics.cash;
  const setTimeRange = onTimeRangeChange;
  const [activeIndex, setActiveIndex] = useState(null);
  const [historicalPrices, setHistoricalPrices] = useState({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // Get the oldest snapshot date as portfolio creation date
  const oldestSnapshotDate = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return new Date();
    const dates = snapshots.map(s => new Date(s.recorded_at));
    return new Date(Math.min(...dates));
  }, [snapshots]);

  // Calculate the date range based on time range selection
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate = new Date(oldestSnapshotDate);

    switch (timeRange) {
      case '1W': 
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7); 
        break;
      case '1M': 
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1); 
        break;
      case '3M': 
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3); 
        break;
      case 'YTD': 
        startDate = new Date(now.getFullYear(), 0, 1); 
        break;
      case '1Y': 
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1); 
        break;
      default: // 'ALL'
        startDate = new Date(oldestSnapshotDate);
    }

    // If start date is before oldest snapshot, use oldest snapshot
    if (startDate < oldestSnapshotDate) {
      startDate = new Date(oldestSnapshotDate);
    }

    return { startDate, endDate: now };
  }, [timeRange, oldestSnapshotDate]);

  // Get unique tickers from holdings
  const tickers = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    return [...new Set(holdings.map(h => h.ticker))];
  }, [holdings]);

  // Determine the appropriate interval based on time range
  const { interval, maxPoints } = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    
    // Choose interval to get ~40 data points
    // Yahoo Finance limits: 1m (7 days), 5m/15m/30m/1h (60 days), 1d (unlimited)
    if (diffDays <= 2) {
      // Less than 2 days: use 1-hour interval
      return { interval: '1h', maxPoints: 40 };
    } else if (diffDays <= 7) {
      // 2-7 days: use 1-hour interval
      return { interval: '1h', maxPoints: 40 };
    } else if (diffDays <= 60) {
      // 1 week to 2 months: use 1-hour interval (will get more points, we'll sample)
      return { interval: '1h', maxPoints: 40 };
    } else {
      // More than 2 months: use daily interval
      return { interval: '1d', maxPoints: 40 };
    }
  }, [dateRange]);

  // Fetch historical prices for all tickers using range API
  useEffect(() => {
    if (tickers.length === 0) return;

    const fetchHistoricalPrices = async () => {
      setIsLoadingPrices(true);
      const pricesMap = {};

      try {
        const { startDate, endDate } = dateRange;
        const startTs = Math.floor(startDate.getTime() / 1000);
        const endTs = Math.floor(endDate.getTime() / 1000);

        // Fetch prices for each ticker in parallel using the range API
        const promises = tickers.map(async (ticker) => {
          try {
            const response = await fetch(
              `/api/market-data/historical-range?ticker=${ticker}&start=${startTs}&end=${endTs}&interval=${interval}`
            );
            if (response.ok) {
              const data = await response.json();
              return { ticker, prices: data.prices || [] };
            }
          } catch (err) {
            console.error(`Error fetching historical prices for ${ticker}:`, err);
          }
          return { ticker, prices: [] };
        });

        const results = await Promise.all(promises);
        results.forEach(({ ticker, prices }) => {
          pricesMap[ticker] = prices;
        });

        setHistoricalPrices(pricesMap);
      } catch (err) {
        console.error('Error fetching historical prices:', err);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchHistoricalPrices();
  }, [tickers, dateRange, interval]);

  // Generate 39 evenly spaced historical timestamps + 1 current timestamp for the chart
  const chartTimestamps = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const startTs = startDate.getTime();
    const endTs = endDate.getTime();
    const diffMs = endTs - startTs;
    
    // Generate 59 historical points, the 60th will be "now" with current value
    const HISTORICAL_POINTS = 59;
    const timestamps = [];
    
    for (let i = 0; i < HISTORICAL_POINTS; i++) {
      const ts = startTs + (diffMs * i / HISTORICAL_POINTS);
      timestamps.push(Math.floor(ts / 1000)); // Unix timestamp in seconds
    }
    
    // Add current timestamp as the last point
    const nowTs = Math.floor(Date.now() / 1000);
    timestamps.push(nowTs);
    
    console.log(`[Chart] Generated ${timestamps.length} timestamps from ${new Date(timestamps[0] * 1000).toISOString()} to ${new Date(timestamps[timestamps.length - 1] * 1000).toISOString()}`);
    return timestamps;
  }, [dateRange]);

  // Helper to find the closest price for a given timestamp
  const findPriceAtTimestamp = (pricesArray, targetTs) => {
    if (!pricesArray || pricesArray.length === 0) return null;
    
    // Find the closest price at or before the target timestamp
    let closest = null;
    for (const item of pricesArray) {
      if (item.timestamp <= targetTs) {
        closest = item.price;
      } else {
        break; // Array is sorted, no need to continue
      }
    }
    
    // If no price found before target, use the first available price
    if (closest === null && pricesArray.length > 0) {
      closest = pricesArray[0].price;
    }
    
    return closest;
  };

  // Calculate chart data based on historical prices
  const displayChartData = useMemo(() => {
    if (chartTimestamps.length === 0) return [];

    const diffDays = (dateRange.endDate - dateRange.startDate) / (24 * 60 * 60 * 1000);
    const isShortRange = diffDays <= 7;

    // Helper to format date string
    const formatDate = (date) => {
      if (isShortRange) {
        return date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      } else {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        });
      }
    };

    // If no holdings, just show a flat line at total value
    if (!holdings || holdings.length === 0) {
      return chartTimestamps.map(ts => {
        const date = new Date(ts * 1000);
        return {
          timestamp: ts,
          dateString: formatDate(date),
          date,
          value: totalValue
        };
      });
    }

    // Calculate portfolio value for each timestamp (first 39 points)
    const chartData = chartTimestamps.slice(0, -1).map((ts) => {
      let portfolioValue = cashValue; // Start with cash
      const date = new Date(ts * 1000);

      holdings.forEach(holding => {
        const ticker = holding.ticker;
        const shares = holding.shares;
        const tickerPrices = historicalPrices[ticker] || [];
        
        // Get the price for this timestamp
        let price = findPriceAtTimestamp(tickerPrices, ts);
        
        // Fallback to current price or avg cost if no historical price found
        if (price === null) {
          price = holding.currentPrice || holding.avgCost || 0;
        }

        portfolioValue += shares * price;
      });

      return {
        timestamp: ts,
        dateString: formatDate(date),
        date,
        value: portfolioValue
      };
    });

    // Add the current portfolio value as the final (40th) data point
    const now = new Date();
    chartData.push({
      timestamp: Math.floor(now.getTime() / 1000),
      dateString: formatDate(now),
      date: now,
      value: totalValue // Use the actual current portfolio value
    });

    return chartData;
  }, [chartTimestamps, holdings, historicalPrices, cashValue, totalValue, dateRange]);

  // Log chart data for debugging
  useEffect(() => {
    if (displayChartData.length > 0) {
      console.log(`[Chart] Generated ${displayChartData.length} data points:`, 
        displayChartData.slice(0, 3).map(d => `${d.dateString}: $${d.value.toFixed(2)}`).join(', '),
        '...',
        displayChartData.slice(-1).map(d => `${d.dateString}: $${d.value.toFixed(2)}`).join('')
      );
    }
  }, [displayChartData]);

  // Calculate chart color and percent change
  const chartColor = useMemo(() => {
    if (displayChartData.length < 2) return 'var(--color-success)';
    return displayChartData[displayChartData.length - 1].value >= displayChartData[0].value
      ? 'var(--color-success)'
      : 'var(--color-danger)';
  }, [displayChartData]);

  // When hovering, show hovered data point; otherwise show the last data point (current value)
  const displayData = activeIndex !== null && displayChartData[activeIndex]
    ? displayChartData[activeIndex]
    : displayChartData[displayChartData.length - 1] || { value: totalValue, dateString: 'Now', date: new Date() };

  const startValue = displayChartData[0]?.value || totalValue;
  const percentChange = startValue > 0
    ? ((displayData.value - startValue) / startValue) * 100
    : 0;
  const returnAmount = displayData.value - startValue;

  // Always show all time range options
  const availableRanges = ['1W', '1M', '3M', 'YTD', '1Y', 'ALL'];

  const handleMouseMove = (data, index) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const activeTextColor = isDarkMode ? 'var(--color-on-accent)' : '#fff';

  return (
    <Card variant="glass" padding="none">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">
              Portfolio Value
            </div>
            <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight">
              <AnimatedCounter value={displayData.value} />
            </div>
            <div className={`text-xs font-medium mt-0.5 ${percentChange > 0 ? 'text-emerald-500' : percentChange < 0 ? 'text-rose-500' : 'text-[var(--color-muted)]'}`}>
              {returnAmount >= 0 ? '+' : ''}{formatCurrency(returnAmount)}
              {' '}({percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%)
            </div>
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            {displayData?.dateString || 'Today'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="pt-4 pb-2 relative">
        {isLoadingPrices && (
          <div className="absolute top-6 right-6 z-10">
            <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {displayChartData.length > 0 ? (
          <div
            className="w-full focus:outline-none relative"
            tabIndex={-1}
            style={{ height: '200px' }}
            onMouseLeave={handleMouseLeave}
          >
            <LineChart
              data={displayChartData}
              dataKey="value"
              width="100%"
              height={200}
              margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
              strokeColor={chartColor}
              strokeWidth={2}
              showArea={true}
              areaOpacity={0.35}
              showDots={false}
              dotRadius={5}
              dotColor={chartColor}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              showTooltip={false}
              gradientId="portfolioChartGradient"
              curveType="monotone"
              animationDuration={800}
              xAxisDataKey="dateString"
              yAxisDomain={['dataMin', 'dataMax']}
            />
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-[var(--color-muted)] text-sm">
            No chart data available
          </div>
        )}
      </div>

      {/* Time Range Selector */}
      <div className="mt-2 pt-2 px-6 pb-4 border-t border-[var(--color-border)]/50">
        <div className="flex justify-between items-center w-full">
          {availableRanges.map((range) => {
            const isActive = timeRange === range;
            return (
              <div key={range} className="flex-1 flex justify-center">
                <button
                  onClick={() => setTimeRange(range)}
                  className="relative px-3 py-1 text-[10px] font-bold rounded-full transition-colors text-center cursor-pointer outline-none"
                  style={{ color: isActive ? activeTextColor : 'var(--color-muted)' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="portfolioTimeRange"
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

// ============================================================================
// HOLDINGS LIST - Clean list like accounts page
// ============================================================================

// Mini sparkline component
function MiniSparkline({ data, width = 80, height = 24, maxPoints = 20 }) {
  if (!data || data.length < 2) return null;

  // Sample data if it has too many points
  let sampledData = data;
  if (data.length > maxPoints) {
    const step = (data.length - 1) / (maxPoints - 1);
    sampledData = [];
    for (let i = 0; i < maxPoints; i++) {
      const index = Math.round(i * step);
      sampledData.push(data[index]);
    }
  }

  const min = Math.min(...sampledData);
  const max = Math.max(...sampledData);
  const range = max - min || 1;
  
  // Determine if trend is up or down
  const isUp = sampledData[sampledData.length - 1] >= sampledData[0];
  const color = isUp ? '#10b981' : '#f43f5e'; // emerald-500 / rose-500

  // Create SVG path with smooth curves
  const points = sampledData.map((value, i) => {
    const x = (i / (sampledData.length - 1)) * width;
    const y = height - 2 - ((value - min) / range) * (height - 4); // Add padding
    return { x, y };
  });

  // Create smooth curve using quadratic bezier
  let pathD = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    pathD += ` Q ${prev.x},${prev.y} ${midX},${(prev.y + curr.y) / 2}`;
  }
  // Connect to last point
  const last = points[points.length - 1];
  pathD += ` L ${last.x},${last.y}`;

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HoldingsList({ holdings, sparklineData = {} }) {
  if (!holdings || holdings.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="px-1 flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider">
          Holdings
        </h2>
        <span className="text-xs text-[var(--color-muted)]">
          {holdings.length} {holdings.length === 1 ? 'position' : 'positions'}
        </span>
      </div>

      <div className="space-y-1">
        {holdings.map((holding) => {
          // Use stored values from portfolioMetrics
          const currentPrice = holding.currentPrice;
          const avgCost = holding.avgCost;
          const value = holding.value;
          const sparkline = sparklineData[holding.ticker];

          // Calculate gain/loss percentage and amount if we have current price and avg cost
          let gainPercent = null;
          let gainAmount = null;
          if (currentPrice !== null && avgCost > 0) {
            gainPercent = ((currentPrice - avgCost) / avgCost) * 100;
            gainAmount = (currentPrice - avgCost) * holding.shares;
          }

          return (
            <div
              key={holding.ticker}
              className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-[var(--color-surface)]/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{
                    background: holding.logo ? 'transparent' : 'var(--color-surface)',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  {holding.logo ? (
                    <img src={holding.logo} alt={holding.ticker} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-[var(--color-muted)]">
                      {holding.ticker.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--color-fg)]">{holding.ticker}</span>
                    {holding.name && (
                      <span className="text-xs text-[var(--color-muted)] truncate max-w-[140px]">{holding.name}</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {holding.shares.toFixed(2)} shares {currentPrice !== null && `@ ${formatCurrency(currentPrice)}`}
                  </div>
                </div>
              </div>

              {/* Mini sparkline */}
              <div className="flex-shrink-0 mx-4 flex items-center justify-center" style={{ width: 70 }}>
                <MiniSparkline data={sparkline} width={70} height={24} maxPoints={20} />
              </div>

              <div className="text-right">
                <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                  {formatCurrency(value)}
                </div>
                {gainPercent !== null ? (
                  <div className={`text-xs tabular-nums ${Math.abs(gainPercent) < 0.005 ? 'text-[var(--color-muted)]' : gainPercent > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {gainAmount >= 0 ? '+' : ''}{formatCurrency(gainAmount)} ({gainPercent > 0.005 ? '+' : ''}{gainPercent.toFixed(2)}%)
                  </div>
                ) : (
                  <div className="text-xs text-[var(--color-muted)]">-</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ACCOUNTS SUMMARY - Minimal design
// ============================================================================

function AccountsSummary({ portfolioMetrics, accounts, stockQuotes }) {
  const investedPercent = portfolioMetrics.totalPortfolioValue > 0
    ? ((portfolioMetrics.totalHoldingsValue / portfolioMetrics.totalPortfolioValue) * 100)
    : 0;

  // Calculate each account's value properly: holdings at market price + cash from holdings
  const accountsWithValues = useMemo(() => {
    return accounts.map(portfolio => {
      const account = portfolio.source_account;
      const institution = account?.institutions;
      const accountName = account?.name || 'Account';

      // Calculate holdings value and cash from actual holdings
      let holdingsValue = 0;
      let cashValue = 0;
      
      (portfolio.holdings || []).forEach(h => {
        const ticker = (h.ticker || '').toUpperCase();
        const quote = stockQuotes[ticker];
        const shares = h.shares || 0;
        const assetType = h.asset_type || quote?.assetType || 'stock';
        
        // Check if this is a cash holding
        const isCashHolding = assetType === 'cash' || ticker.startsWith('CUR:') || ticker === 'USD';
        
        if (isCashHolding) {
          // Cash holdings: value = shares (which is the dollar amount)
          cashValue += shares * 1.0;
        } else {
          // Non-cash: use market price or avg cost
          const price = quote?.price || h.avg_cost || 0;
          holdingsValue += shares * price;
        }
      });

      // Total = holdings at market price + cash from holdings
      const totalValue = holdingsValue + cashValue;

      return {
        id: portfolio.id,
        name: accountName,
        institutionName: institution?.name || 'Brokerage',
        institutionLogo: institution?.logo,
        totalValue
      };
    });
  }, [accounts, stockQuotes]);

  const cashPercent = 100 - investedPercent;

  return (
    <Card variant="glass" padding="none">
      {/* Allocation Bar */}
      <div className="p-5 pb-4">
        <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-3">
          Allocation
        </div>
        
        <div className="h-1.5 rounded-full overflow-hidden bg-[var(--color-surface)] flex">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-500"
            style={{ width: `${investedPercent}%` }}
          />
        </div>

        {/* Holdings & Cash - stacked */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
              <span className="text-xs text-[var(--color-muted)]">Holdings</span>
            </div>
            <span className="text-xs text-[var(--color-fg)] tabular-nums">
              {formatCurrency(portfolioMetrics.totalHoldingsValue)} <span className="text-[var(--color-muted)]">({investedPercent.toFixed(0)}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-muted)]">Cash</span>
            </div>
            <span className="text-xs text-[var(--color-fg)] tabular-nums">
              {formatCurrency(portfolioMetrics.cash)} <span className="text-[var(--color-muted)]">({cashPercent.toFixed(0)}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Accounts */}
      {accountsWithValues.length > 0 && (
        <div className="px-5 pb-5">
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-3">
            Linked Accounts
          </div>
          <div className="space-y-2">
            {accountsWithValues.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--color-surface)]/40"
              >
                {account.institutionLogo ? (
                  <img
                    src={account.institutionLogo}
                    alt=""
                    className="w-6 h-6 rounded-md object-contain flex-shrink-0 bg-white p-0.5"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-[var(--color-surface)]">
                    <PiBankFill className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-fg)] truncate">
                    {account.name}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    {account.institutionName}
                  </div>
                </div>
                <div className="text-xs font-medium text-[var(--color-fg)] tabular-nums">
                  {formatCurrency(account.totalValue)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// PAPER PORTFOLIOS LIST - Clean minimal design
// ============================================================================

function PaperPortfoliosList({ portfolios, onPortfolioClick, onCreateClick }) {
  return (
    <Card variant="glass" padding="none">
      <div className="p-5 flex items-center justify-between">
        <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">
          Paper Trading
        </div>
        <button
          onClick={onCreateClick}
          className="text-xs text-[var(--color-accent)] hover:underline cursor-pointer flex items-center gap-1"
        >
          <LuPlus className="w-3 h-3" />
          New
        </button>
      </div>

      {portfolios.length > 0 ? (
        <div className="px-3 pb-3 space-y-1">
          {portfolios.slice(0, 5).map((portfolio) => (
            <PortfolioRow
              key={portfolio.id}
              portfolio={portfolio}
              onClick={() => onPortfolioClick(portfolio)}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 pb-5">
          <div className="text-center py-6 rounded-lg border border-dashed border-[var(--color-border)]/50">
            <p className="text-sm text-[var(--color-muted)] mb-2">No paper portfolios yet</p>
            <button
              onClick={onCreateClick}
              className="text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
            >
              Create your first
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function PortfolioRow({ portfolio, onClick }) {
  const [totalValue, setTotalValue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: snapshotData } = await supabase
          .from('portfolio_snapshots')
          .select('total_value')
          .eq('portfolio_id', portfolio.id)
          .order('snapshot_date', { ascending: false })
          .limit(1);

        if (snapshotData && snapshotData.length > 0) {
          setTotalValue(parseFloat(snapshotData[0].total_value));
        } else {
          setTotalValue(parseFloat(portfolio.current_cash) || parseFloat(portfolio.starting_capital));
        }
      } catch (err) {
        setTotalValue(parseFloat(portfolio.current_cash) || parseFloat(portfolio.starting_capital));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portfolio.id, portfolio.current_cash, portfolio.starting_capital]);

  const startingCapital = parseFloat(portfolio.starting_capital) || 0;
  const currentValue = totalValue ?? startingCapital;
  const percentChange = startingCapital > 0
    ? ((currentValue - startingCapital) / startingCapital) * 100
    : 0;

  const model = AI_MODELS[portfolio.ai_model] || { name: portfolio.ai_model, icon: LuBot };
  const ModelIcon = model.icon;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface)]/50 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <ModelIcon className="w-4 h-4 text-[var(--color-muted)]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)] truncate">{portfolio.name}</div>
        <div className="text-xs text-[var(--color-muted)]">{model.name}</div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
          {loading ? '...' : formatCurrency(currentValue)}
        </div>
        <div className={`text-xs tabular-nums ${percentChange > 0 ? 'text-emerald-500' : percentChange < 0 ? 'text-rose-500' : 'text-[var(--color-muted)]'}`}>
          {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
        </div>
      </div>

      <LuChevronRight className="w-4 h-4 text-[var(--color-muted)]/50 group-hover:text-[var(--color-muted)] flex-shrink-0" />
    </div>
  );
}
