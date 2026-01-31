"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Drawer from "../../../components/ui/Drawer";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { LuPlus, LuBot, LuLock, LuChevronRight, LuTrendingUp, LuTrendingDown, LuFlaskConical, LuSparkles, LuTrash2, LuArrowLeftRight } from "react-icons/lu";
import { SiGooglegemini, SiX } from "react-icons/si";
import { FiLoader } from "react-icons/fi";
import { useUser } from "../../../components/UserProvider";
import { supabase } from "../../../lib/supabaseClient";
import LineChart from "../../../components/ui/LineChart";
import { usePaperTradingHeader } from "./PaperTradingHeaderContext";
import { ChartSkeleton, CardSkeleton } from "../../../components/ui/Skeleton";

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

// Format currency with appropriate decimal places
const formatCurrency = (amount) => {
  const absAmount = Math.abs(amount);
  let maxDecimals = 2;

  if (absAmount > 0 && absAmount < 0.01) {
    maxDecimals = 6;
  } else if (absAmount < 1) {
    maxDecimals = 4;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(amount);
};

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
  const [portfolioType, setPortfolioType] = useState('trading'); // 'trading' or 'arbitrage'
  const [selectedExchanges, setSelectedExchanges] = useState(['binance', 'coinbase', 'kraken']);

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

  const AVAILABLE_CRYPTOS_ARBITRAGE = [
    { symbol: 'BTC', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
    { symbol: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
    { symbol: 'SOL', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
    { symbol: 'XRP', name: 'XRP', logo: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
    { symbol: 'DOGE', name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png' },
    { symbol: 'ADA', name: 'Cardano', logo: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
  ];

  const AVAILABLE_EXCHANGES = [
    { id: 'binance', name: 'Binance', logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg' },
    { id: 'coinbase', name: 'Coinbase', logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png' },
    { id: 'kraken', name: 'Kraken', logo: 'https://assets.coingecko.com/markets/images/29/small/kraken.jpg' },
    { id: 'kucoin', name: 'KuCoin', logo: 'https://assets.coingecko.com/markets/images/61/small/kucoin.png' },
    { id: 'bybit', name: 'Bybit', logo: 'https://assets.coingecko.com/markets/images/698/small/bybit_spot.png' },
    { id: 'okx', name: 'OKX', logo: 'https://assets.coingecko.com/markets/images/96/small/WeChat_Image_20220117220452.png' },
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

  const handleExchangeToggle = (exchangeId) => {
    setSelectedExchanges(prev => {
      if (prev.includes(exchangeId)) {
        return prev.filter(e => e !== exchangeId);
      } else {
        return [...prev, exchangeId];
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

    // Arbitrage validation
    if (portfolioType === 'arbitrage') {
      if (selectedExchanges.length < 2) {
        setError('Please select at least 2 exchanges');
        return;
      }
      if (selectedCryptos.length === 0) {
        setError('Please select at least one cryptocurrency');
        return;
      }
    } else if (assetType === 'crypto' && selectedCryptos.length === 0) {
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
        router.push(`/paper-trading/backtest?${params.toString()}`);
        return;
      }

      // Handle arbitrage portfolio creation
      if (portfolioType === 'arbitrage') {
        const response = await fetch('/api/arbitrage/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.id,
            name: name.trim(),
            startingCapital: startingCapital,
            exchanges: selectedExchanges,
            cryptos: selectedCryptos,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create arbitrage portfolio');
        }

        onCreated(result.portfolio);
        handleReset();
        onClose();
        router.push(`/paper-trading/arbitrage/${result.portfolio.id}`);
        return;
      }

      // Regular trading portfolio
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
      router.push(`/paper-trading/${result.portfolio.id}`);
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
    setPortfolioType('trading');
    setSelectedExchanges(['binance', 'coinbase', 'kraken']);
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
      {/* Portfolio Type Selection */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
          Portfolio Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setPortfolioType('trading');
              setPortfolioMode('live');
              if (!nameManuallyEdited) setName('');
            }}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
              portfolioType === 'trading'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                portfolioType === 'trading' ? 'bg-[var(--color-accent)]/20' : 'bg-[var(--color-surface)]'
              }`}>
                <LuBot className={`w-4 h-4 ${portfolioType === 'trading' ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`} />
              </div>
              <div className="text-sm font-medium text-[var(--color-fg)]">AI Trading</div>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              AI-powered stock or crypto trading simulation
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setPortfolioType('arbitrage');
              setPortfolioMode('live');
              if (!nameManuallyEdited) setName('Arbitrage Portfolio');
            }}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
              portfolioType === 'arbitrage'
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-[var(--color-border)] hover:border-emerald-500/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                portfolioType === 'arbitrage' ? 'bg-emerald-500/20' : 'bg-[var(--color-surface)]'
              }`}>
                <LuArrowLeftRight className={`w-4 h-4 ${portfolioType === 'arbitrage' ? 'text-emerald-500' : 'text-[var(--color-muted)]'}`} />
              </div>
              <div className="text-sm font-medium text-[var(--color-fg)]">Arbitrage</div>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              Cross-exchange crypto price arbitrage
            </p>
          </button>
        </div>
      </div>

      {/* Portfolio Mode (only for trading) */}
      {portfolioType === 'trading' && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
            Mode
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
        </div>
      )}

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

      {/* Asset Type (only for trading) */}
      {portfolioType === 'trading' && (
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
      )}

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

      {/* Crypto Assets for regular trading */}
      {portfolioType === 'trading' && !hasAI && (
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

      {/* Arbitrage Options */}
      {portfolioType === 'arbitrage' && (
        <>
          {/* Exchange Selection */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
              Exchanges <span className="text-emerald-500">(min 2)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_EXCHANGES.map((exchange) => {
                const isSelected = selectedExchanges.includes(exchange.id);
                return (
                  <button
                    key={exchange.id}
                    type="button"
                    onClick={() => handleExchangeToggle(exchange.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer ${isSelected
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-[var(--color-border)] hover:border-emerald-500/50'
                    }`}
                  >
                    <img
                      src={exchange.logo}
                      alt={exchange.name}
                      className="w-6 h-6 rounded"
                    />
                    <span className="text-sm font-medium text-[var(--color-fg)]">{exchange.name}</span>
                    {isSelected && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Crypto Selection for Arbitrage */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
              Cryptocurrencies
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABLE_CRYPTOS_ARBITRAGE.map((crypto) => {
                const isSelected = selectedCryptos.includes(crypto.symbol);
                return (
                  <button
                    key={crypto.symbol}
                    type="button"
                    onClick={() => handleCryptoToggle(crypto.symbol)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-pointer ${isSelected
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-[var(--color-border)] hover:border-emerald-500/50'
                    }`}
                  >
                    <img
                      src={crypto.logo}
                      alt={crypto.symbol}
                      className="w-5 h-5 rounded-full"
                    />
                    <span className="text-sm font-medium text-[var(--color-fg)]">{crypto.symbol}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* AI Model (only for stock trading) */}
      {portfolioType === 'trading' && hasAI && (
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

      {/* Backtest Date Range (only for trading) */}
      {portfolioType === 'trading' && portfolioMode === 'backtest' && (
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

  const getDrawerTitle = () => {
    if (portfolioType === 'arbitrage') return 'Create Arbitrage Portfolio';
    if (portfolioMode === 'backtest') return 'Run Backtest';
    return 'Create Portfolio';
  };

  const getDrawerDescription = () => {
    if (portfolioType === 'arbitrage') return 'Cross-exchange crypto arbitrage simulation';
    if (portfolioMode === 'backtest') return 'Simulate trading strategy on historical data';
    return 'Set up a new paper trading simulation';
  };

  const views = [
    {
      id: 'form',
      title: getDrawerTitle(),
      description: getDrawerDescription(),
      content: (
        <div className="relative h-full">
          {isCreating && portfolioType === 'trading' && hasAI && <AIThinkingOverlay />}
          {renderPortfolioForm()}
        </div>
      ),
      showBackButton: false,
    },
  ];

  const renderFooter = () => {
    let isCreateDisabled = false;
    if (portfolioType === 'arbitrage') {
      isCreateDisabled = selectedExchanges.length < 2 || selectedCryptos.length === 0;
    } else if (assetType === 'crypto') {
      isCreateDisabled = selectedCryptos.length === 0;
    }

    const buttonLabel = portfolioType === 'arbitrage'
      ? 'Create Arbitrage Portfolio'
      : (portfolioMode === 'backtest' ? 'Run Backtest' : 'Create Portfolio');

    return (
      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={onClose} disabled={isCreating} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleCreatePortfolio} disabled={isCreating || isCreateDisabled} className="flex-1">
          {isCreating ? (
            <>
              <FiLoader className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            buttonLabel
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

export default function PaperTradingPage() {
  const router = useRouter();
  const { profile } = useUser();
  const { setHeaderActions } = usePaperTradingHeader();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, portfolio: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Register header actions with layout
  useEffect(() => {
    if (setHeaderActions) {
      setHeaderActions({
        onCreateClick: () => setShowCreateModal(true),
      });
    }
  }, [setHeaderActions]);

  // Fetch paper trading portfolios (including arbitrage)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: portfoliosData } = await supabase
          .from('portfolios')
          .select('*')
          .eq('user_id', profile.id)
          .in('type', ['ai_simulation', 'arbitrage_simulation'])
          .order('created_at', { ascending: false });

        setPortfolios(portfoliosData || []);
      } catch (err) {
        console.error('Error fetching paper trading data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  // Calculate aggregate stats
  const stats = useMemo(() => {
    if (portfolios.length === 0) {
      return {
        totalValue: 0,
        totalStarting: 0,
        totalReturn: 0,
        returnPercent: 0,
        winners: 0,
        losers: 0,
      };
    }

    let totalValue = 0;
    let totalStarting = 0;
    let winners = 0;
    let losers = 0;

    portfolios.forEach(p => {
      const starting = parseFloat(p.starting_capital) || 0;
      const current = parseFloat(p.current_cash) || starting;
      totalStarting += starting;
      totalValue += current;
      if (current > starting) winners++;
      else if (current < starting) losers++;
    });

    const totalReturn = totalValue - totalStarting;
    const returnPercent = totalStarting > 0 ? ((totalReturn / totalStarting) * 100) : 0;

    return {
      totalValue,
      totalStarting,
      totalReturn,
      returnPercent,
      winners,
      losers,
    };
  }, [portfolios]);

  const handlePortfolioClick = (portfolio) => {
    if (portfolio.type === 'arbitrage_simulation') {
      router.push(`/paper-trading/arbitrage/${portfolio.id}`);
    } else {
      router.push(`/paper-trading/${portfolio.id}`);
    }
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
      <div className="space-y-6">
        <CardSkeleton className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton className="h-48" />
          <CardSkeleton className="h-48" />
          <CardSkeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <>
      {portfolios.length > 0 ? (
        <div className="space-y-6">
          {/* Stats Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card variant="glass" padding="none" className="p-4">
              <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">
                Total Value
              </div>
              <div className="text-xl font-semibold text-[var(--color-fg)]">
                {formatCurrency(stats.totalValue)}
              </div>
            </Card>
            <Card variant="glass" padding="none" className="p-4">
              <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">
                Total Return
              </div>
              <div className={`text-xl font-semibold ${stats.totalReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stats.totalReturn >= 0 ? '+' : ''}{formatCurrency(stats.totalReturn)}
              </div>
              <div className={`text-xs ${stats.returnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stats.returnPercent >= 0 ? '+' : ''}{stats.returnPercent.toFixed(2)}%
              </div>
            </Card>
            <Card variant="glass" padding="none" className="p-4">
              <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">
                Portfolios
              </div>
              <div className="text-xl font-semibold text-[var(--color-fg)]">
                {portfolios.length}
              </div>
            </Card>
            <Card variant="glass" padding="none" className="p-4">
              <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">
                Win / Loss
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold text-emerald-500">{stats.winners}</span>
                <span className="text-[var(--color-muted)]">/</span>
                <span className="text-xl font-semibold text-rose-500">{stats.losers}</span>
              </div>
            </Card>
          </div>

          {/* Portfolios Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider">
                Your Portfolios
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portfolios.map((portfolio) => (
                <PortfolioCard
                  key={portfolio.id}
                  portfolio={portfolio}
                  onClick={() => handlePortfolioClick(portfolio)}
                  onDelete={() => setDeleteModal({ isOpen: true, portfolio })}
                />
              ))}

              {/* Create New Card */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="group relative glass-panel rounded-xl p-6 border-2 border-dashed border-[var(--color-border)]/50 hover:border-[var(--color-accent)]/50 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-[var(--color-surface)] flex items-center justify-center group-hover:bg-[var(--color-accent)]/10 transition-colors">
                  <LuPlus className="w-6 h-6 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors">
                    Create New Portfolio
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-1">
                    Start a new AI-powered simulation
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 flex items-center justify-center">
              <LuFlaskConical className="w-12 h-12 text-[var(--color-accent)]" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
              <LuSparkles className="w-4 h-4 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-[var(--color-fg)] mb-2">
            Welcome to Paper Trading
          </h2>
          <p className="text-[var(--color-muted)] text-center max-w-md mb-8">
            Practice investing with virtual money. Create AI-powered portfolios that trade automatically,
            or run backtests to see how strategies would have performed.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <LuPlus className="w-4 h-4" />
              Create Your First Portfolio
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-3xl">
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-surface)] flex items-center justify-center mx-auto mb-3">
                <LuBot className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <h3 className="text-sm font-medium text-[var(--color-fg)] mb-1">AI-Powered Trading</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Let AI models make trading decisions based on market analysis
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-surface)] flex items-center justify-center mx-auto mb-3">
                <LuTrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-sm font-medium text-[var(--color-fg)] mb-1">Track Performance</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Monitor gains, losses, and compare different strategies
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-surface)] flex items-center justify-center mx-auto mb-3">
                <LuFlaskConical className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-sm font-medium text-[var(--color-fg)] mb-1">Risk-Free Practice</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Learn and experiment without risking real money
              </p>
            </div>
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
// PORTFOLIO CARD COMPONENT
// ============================================================================

function PortfolioCard({ portfolio, onClick, onDelete }) {
  const [totalValue, setTotalValue] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch latest snapshot
        const { data: snapshotData } = await supabase
          .from('portfolio_snapshots')
          .select('total_value, snapshot_date')
          .eq('portfolio_id', portfolio.id)
          .order('snapshot_date', { ascending: false })
          .limit(30);

        if (snapshotData && snapshotData.length > 0) {
          setTotalValue(parseFloat(snapshotData[0].total_value));
          setSnapshots(snapshotData.reverse());
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
  const returnAmount = currentValue - startingCapital;

  // Handle different portfolio types
  const isArbitrage = portfolio.type === 'arbitrage_simulation';
  const model = isArbitrage
    ? { name: 'Arbitrage', icon: LuArrowLeftRight, color: '#10B981' }
    : (AI_MODELS[portfolio.ai_model] || { name: portfolio.ai_model || 'Manual', icon: LuBot, color: 'var(--color-muted)' });
  const ModelIcon = model.icon;

  const chartData = snapshots.length > 1
    ? snapshots.map(s => ({ value: parseFloat(s.total_value) }))
    : [{ value: startingCapital }, { value: currentValue }];

  const chartColor = percentChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

  return (
    <Card variant="glass" padding="none" className="group relative overflow-hidden">
      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-[var(--color-surface)]/80 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all cursor-pointer"
        title="Delete portfolio"
      >
        <LuTrash2 className="w-3.5 h-3.5 text-[var(--color-muted)] hover:text-red-500" />
      </button>

      <div className="cursor-pointer" onClick={onClick}>
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              <ModelIcon
                className="w-5 h-5"
                style={{ color: model.color === '#000000' ? 'var(--color-fg)' : model.color }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                {portfolio.name}
              </div>
              <div className="text-xs text-[var(--color-muted)] flex items-center gap-1.5">
                <span>{model.name}</span>
                <span className="text-[var(--color-border)]">·</span>
                <span className="capitalize">
                  {isArbitrage ? `${portfolio.metadata?.exchanges?.length || 0} Exchanges` : (portfolio.asset_type || 'Stock')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Chart */}
        <div className="h-16 px-2">
          {chartData.length > 1 && (
            <LineChart
              data={chartData}
              dataKey="value"
              width="100%"
              height={64}
              margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
              strokeColor={chartColor}
              strokeWidth={1.5}
              showArea={true}
              areaOpacity={0.2}
              showDots={false}
              curveType="monotone"
              animationDuration={500}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-2 flex items-end justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--color-fg)] tabular-nums">
              {loading ? '...' : formatCurrency(currentValue)}
            </div>
            <div className={`text-xs tabular-nums ${percentChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {returnAmount >= 0 ? '+' : ''}{formatCurrency(returnAmount)} ({percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%)
            </div>
          </div>
          <div className="flex items-center gap-1 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
            <span className="text-xs">View</span>
            <LuChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Card>
  );
}
