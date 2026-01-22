"use client";

import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { useUser } from "../UserProvider";
import * as Icons from "lucide-react";
import DynamicIcon from "../DynamicIcon";
import { FiTag } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateBudgetModal({ isOpen, onClose, onCreated }) {
  const { user } = useUser();
  const [step, setStep] = useState(1); // 1: Monthly Income, 2: Select Scope (Group/Category), 3: Set Amount
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Income state
  const [calculatedIncome, setCalculatedIncome] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [incomeMonths, setIncomeMonths] = useState(0);
  const [incomeBreakdown, setIncomeBreakdown] = useState([]); // Array of { month, income }

  // Selection state
  const [selectedScope, setSelectedScope] = useState(null); // { id, label, type: 'category', ... }
  const [amount, setAmount] = useState("");
  const [categorySpendingHistory, setCategorySpendingHistory] = useState([]); // Monthly spending for selected category
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [slideDirection, setSlideDirection] = useState(1); // 1 = forward, -1 = back

  // Fetch income data on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedScope(null);
      setAmount("");
      setSearchTerm("");
      setMonthlyIncome("");
      setIncomeBreakdown([]);
      fetchIncomeData();
    }
  }, [isOpen]);

  async function fetchIncomeData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/spending-earning?userId=${user.id}&months=6`); // Fetch more months to ensure we have enough completed ones
      const data = await res.json();

      if (data.data && data.data.length > 0) {
        // Filter out current month (incomplete) and unsupported months
        const completedMonths = data.data.filter(m => !m.isCurrentMonth);

        // Use only the last 3 COMPLETED months for calculation
        const last3Months = completedMonths.slice(-3);

        if (last3Months.length > 0) {
          // Store the monthly breakdown for the chart
          const breakdown = last3Months.map(month => ({
            month: month.month, // e.g., "Jan", "Feb"
            income: Math.round(month.earning || 0)
          }));
          setIncomeBreakdown(breakdown);

          // Calculate average monthly income from the available completed months (up to 3)
          const totalIncome = last3Months.reduce((sum, month) => sum + (month.earning || 0), 0);
          const avgIncome = Math.round(totalIncome / last3Months.length);
          setCalculatedIncome(avgIncome);
          setMonthlyIncome(avgIncome.toString());
          setIncomeMonths(last3Months.length);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOptions() {
    setLoading(true);
    try {
      // Fetch individual categories (not groups) for more granular budgeting
      // Use forBudget=true to get complete months only for accurate averaging
      const res = await fetch(`/api/transactions/spending-by-category?userId=${user.id}&days=120&forBudget=true`);
      const data = await res.json();

      // Use actual complete months from API for accurate averaging
      const months = data.completeMonths || 1;

      // Ensure data.categories exists before processing
      const allCategories = (data.categories || [])
        .filter(c => c.total_spent > 0 && c.label !== 'Account Transfer')
        .sort((a, b) => b.total_spent - a.total_spent);

      // Take all categories
      const categoryOptions = allCategories.map(c => ({
        id: c.id,
        label: c.label,
        type: 'category',
        spent: c.total_spent,
        monthlyAvg: Math.round(c.total_spent / months),
        hexColor: c.hex_color || '#6B7280',
        iconName: c.icon_name,
        iconLib: c.icon_lib
      }));

      setOptions(categoryOptions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Fetch spending history for a specific category
  async function fetchCategorySpendingHistory(category) {
    if (!category) return;

    try {
      let queryParams = `userId=${user.id}&months=6&includeCategoryIds=${category.id}`; // Fetch last 6 months for history

      const res = await fetch(`/api/transactions/spending-earning?${queryParams}`);
      const data = await res.json();

      if (data.data && data.data.length > 0) {
        // Filter out incomplete current month if needed, or keep it depending on desired UX
        // Usually budget history looks better with complete months
        const validMonths = data.data.filter(m => !m.isCurrentMonth);
        const last4Months = validMonths.slice(-4); // Show last 4 complete months

        const history = last4Months.map(month => ({
          month: month.month,
          monthName: month.monthName?.slice(0, 3) || month.month,
          spending: Math.round(month.spending || 0)
        }));
        setCategorySpendingHistory(history);
      } else {
        setCategorySpendingHistory([]);
      }
    } catch (e) {
      console.error("Error fetching category history:", e);
      setCategorySpendingHistory([]);
    }
  }

  // Fetch recent transactions for context
  async function fetchRecentTransactions(category) {
    if (!category) return;
    setLoadingTransactions(true);
    try {
      let queryParams = `userId=${user.id}&limit=50&includeCategoryIds=${category.id}`;

      const res = await fetch(`/api/transactions?${queryParams}`);
      const data = await res.json();

      if (data.transactions) {
        setRecentTransactions(data.transactions);
      }
    } catch (e) {
      console.error("Error fetching transactions:", e);
    } finally {
      setLoadingTransactions(false);
    }
  }

  // When a category is selected, fetch its spending history
  const handleCategorySelect = async (opt) => {
    setSlideDirection(1);
    setStep(3);
    setAmount(opt.monthlyAvg.toString()); // Initialize budget amount
    setCategorySpendingHistory([]); // Clear while loading
    setRecentTransactions([]);

    // Fetch data in parallel
    fetchCategorySpendingHistory(opt);
    fetchRecentTransactions(opt);

    try {
      const res = await fetch(`/api/transactions/category-history?userId=${user.id}&categoryId=${opt.id}&months=4`);
      const data = await res.json();

      if (data.data && data.data.length > 0) {
        const history = data.data.map(month => ({
          month: month.monthName,
          spending: month.spending
        }));
        setCategorySpendingHistory(history);

        // Recalculate monthly average based on actual complete months
        const totalSpending = history.reduce((sum, month) => sum + month.spending, 0);
        const actualMonthlyAvg = history.length > 0 ? Math.round(totalSpending / history.length) : 0;

        // Update selectedScope with the recalculated average
        setSelectedScope({
          ...opt,
          monthlyAvg: actualMonthlyAvg
        });
      } else {
        // If no data, show empty state
        setCategorySpendingHistory([]);
      }
    } catch (e) {
      console.error('Error fetching category history:', e);
      setCategorySpendingHistory([]);
    }
  };

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleIncomeNext = () => {
    if (monthlyIncome) {
      setStep(2);
      fetchOptions();
    }
  };

  const handleSubmit = async () => {
    // Single create (legacy or step 3 specific if needed)
    if (!selectedScope) return;
    await createBudget(selectedScope, amount || selectedScope.monthlyAvg);
  };

  const handleCreateAll = async () => {
    // Create budget for ALL displayed options
    setLoading(true);
    try {
      const promises = options.map(opt =>
        createBudget(opt, opt.monthlyAvg)
      );
      await Promise.all(promises);
      onCreated();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Error creating budgets');
    } finally {
      setLoading(false);
    }
  };

  const createBudget = async (scope, budgetAmount) => {
    const payload = {
      userId: user.id,
      amount: parseFloat(budgetAmount),
      period: 'monthly',
      [scope.type === 'group' ? 'category_group_id' : 'category_id']: scope.id
    };

    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Failed to create budget');
    return res.json();
  };

  const getModalTitle = () => {
    switch (step) {
      case 1: return "Your Monthly Income";
      case 2: return "Select a Category";
      case 3: return selectedScope?.label || "Category Details";
      default: return "";
    }
  };

  const getModalDescription = () => {
    switch (step) {
      case 1: return "Let's start by confirming your average monthly income.";
      case 2: return "Choose a category to set a spending limit for.";
      case 3: return "Here's how much you've spent on this category.";
      default: return "";
    }
  };

  // Navigation component with back, pagination, and next
  const StepNavigation = ({ onBack, onNext, nextDisabled, nextLabel = 'Next', showBack = true, disabledTooltip }) => {
    const handleBack = () => {
      setSlideDirection(-1);
      onBack?.();
    };
    const handleNext = () => {
      setSlideDirection(1);
      onNext?.();
    };

    const NextButton = (
      <Button size="sm" onClick={handleNext} disabled={nextDisabled} className="font-normal text-xs px-3 h-7">
        {nextLabel}
      </Button>
    );

    return (
      <div className="flex items-center justify-between pt-4 mt-auto">
        {/* Back button */}
        <div className="w-16">
          {showBack && step > 1 && (
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 font-normal text-xs px-2 h-7">
              <Icons.ChevronLeft className="w-3 h-3" />
              Back
            </Button>
          )}
        </div>

        {/* Pagination bubbles - only show 2 steps visually */}
        <div className="flex justify-center gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                // Step 2 is active for both step 2 and 3 (subsection)
                (s === step) || (s === 2 && step === 3)
                  ? 'bg-[var(--color-accent)]'
                  : 'bg-[var(--color-border)]'
                }`}
            />
          ))}
        </div>

        {/* Next button */}
        <div className="w-16 flex justify-end">
          {onNext && (
            nextDisabled && disabledTooltip ? (
              <div title={disabledTooltip} className="cursor-not-allowed">
                {NextButton}
              </div>
            ) : NextButton
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <div className="flex flex-col">
        {/* Custom Header - Lighter styling */}
        <div className="mb-4">
          <h3 className="text-lg font-normal text-[var(--color-fg)]">{getModalTitle()}</h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">{getModalDescription()}</p>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ x: slideDirection * 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: slideDirection * -20, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {step === 1 ? (
              <div className="flex flex-col h-full">
                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-8 w-full">
                      {/* Skeleton for income display */}
                      <div className="flex-1">
                        <div className="h-10 w-32 bg-[var(--color-border)] rounded animate-pulse mb-2" />
                        <div className="h-3 w-40 bg-[var(--color-border)] rounded animate-pulse" />
                      </div>
                      {/* Skeleton for chart */}
                      <div className="flex items-end gap-3">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div className="h-2 w-8 bg-[var(--color-border)] rounded animate-pulse" />
                            <div className="w-7 bg-[var(--color-border)] rounded animate-pulse" style={{ height: `${20 + i * 15}px` }} />
                            <div className="h-2 w-6 bg-[var(--color-border)] rounded animate-pulse" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="flex items-center gap-8 w-full">
                        {/* Left side - Average Income Display */}
                        <div className="flex-1">
                          <span className="text-4xl font-medium text-[var(--color-fg)]">
                            ${monthlyIncome ? parseFloat(monthlyIncome).toLocaleString() : '0'}
                          </span>
                          <p className="text-xs text-[var(--color-muted)] mt-1">average monthly income</p>
                        </div>

                        {/* Right side - Income Breakdown Chart */}
                        {incomeBreakdown.length > 0 && (
                          <div className="flex items-end gap-3">
                            {(() => {
                              const maxIncome = Math.max(...incomeBreakdown.map(i => i.income));
                              return incomeBreakdown.map((item, idx) => {
                                const heightPx = maxIncome > 0 ? Math.max((item.income / maxIncome) * 80, 16) : 16;
                                // Format month from "2025-10" to "Oct"
                                const monthLabel = (() => {
                                  if (item.month && item.month.includes('-')) {
                                    const [year, monthNum] = item.month.split('-');
                                    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                                    return date.toLocaleDateString('en-US', { month: 'short' });
                                  }
                                  return item.month;
                                })();
                                return (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                                      ${(item.income / 1000).toFixed(1)}k
                                    </span>
                                    <div
                                      className="w-7 bg-[var(--color-accent)]/60 rounded-sm"
                                      style={{ height: `${heightPx}px` }}
                                    />
                                    <span className="text-[10px] text-[var(--color-muted)]">
                                      {monthLabel}
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                  </>
                )}
              </div>
            ) : step === 2 ? (
              <div className="flex flex-col">
                {/* Income Summary Bar */}
                {(() => {
                  const income = parseFloat(monthlyIncome || 0);
                  const totalBudget = options.reduce((sum, opt) => sum + opt.monthlyAvg, 0);
                  const remaining = Math.max(0, income - totalBudget);
                  const usedPercent = income > 0 ? (totalBudget / income) * 100 : 0;
                  return (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-lg font-medium text-[var(--color-fg)]">${remaining.toLocaleString()}</span>
                          <span className="text-xs text-[var(--color-muted)] ml-1">remaining</span>
                        </div>
                        <span className="text-xs text-[var(--color-muted)]">
                          ${totalBudget.toLocaleString()} / ${income.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                          style={{ width: `${Math.min(usedPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Horizontal scrollable category cards */}
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                  {loading ? (
                    // Skeleton cards
                    <>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-48 shrink-0 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                          <div className="w-10 h-10 rounded-full bg-[var(--color-border)] animate-pulse mb-3" />
                          <div className="h-4 w-24 bg-[var(--color-border)] rounded animate-pulse mb-2" />
                          <div className="h-3 w-16 bg-[var(--color-border)] rounded animate-pulse mb-2" />
                          <div className="h-1.5 w-full bg-[var(--color-border)] rounded animate-pulse" />
                        </div>
                      ))}
                    </>
                  ) : options.length === 0 ? (
                    <div className="text-center py-12 text-[var(--color-muted)] text-sm w-full">
                      No spending categories found
                    </div>
                  ) : (
                    options.map(opt => {
                      const incomePercent = monthlyIncome ? (opt.monthlyAvg / parseFloat(monthlyIncome)) * 100 : 0;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleCategorySelect(opt)}
                          className="w-48 shrink-0 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-hover)] transition-all text-left snap-start"
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                            style={{ backgroundColor: opt.hexColor }}
                          >
                            <DynamicIcon
                              iconLib={opt.iconLib}
                              iconName={opt.iconName}
                              className="w-4 h-4 text-white"
                              fallback={FiTag}
                            />
                          </div>
                          <div className="text-sm font-medium text-[var(--color-fg)] truncate mb-1">
                            {opt.label}
                          </div>
                          <div className="text-xs text-[var(--color-muted)] tabular-nums mb-2">
                            ${opt.monthlyAvg.toLocaleString()}/mo
                          </div>
                          {/* Income proportion bar */}
                          <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(incomePercent, 100)}%`,
                                backgroundColor: opt.hexColor
                              }}
                            />
                          </div>
                          <div className="text-[10px] text-[var(--color-muted)] mt-1">
                            {incomePercent.toFixed(0)}% of income
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

              </div>
            ) : step === 3 ? (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Header + Chart Row */}
                <div className="flex items-center justify-between mb-6 shrink-0">
                  {/* Left: Category Info */}
                  <div className="flex flex-row items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm shrink-0"
                      style={{ backgroundColor: selectedScope?.hexColor }}
                    >
                      <DynamicIcon
                        iconLib={selectedScope?.iconLib}
                        iconName={selectedScope?.iconName}
                        className="w-6 h-6 text-white"
                        fallback={FiTag}
                      />
                    </div>
                    <div>
                      <span className="text-3xl font-medium text-[var(--color-fg)] tracking-tight block">
                        ${selectedScope?.monthlyAvg.toLocaleString()}
                      </span>
                      <p className="text-xs text-[var(--color-muted)] font-medium">average per month</p>
                    </div>
                  </div>

                  {/* Right: History Chart */}
                  <div className="flex items-end gap-2 h-16 pb-1">
                    {categorySpendingHistory.length === 0 ? (
                      // Skeleton
                      [1, 2, 3, 4].map(i => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div
                            className="w-6 bg-[var(--color-border)] rounded-sm animate-pulse"
                            style={{ height: `${20 + i * 8}px` }}
                          />
                        </div>
                      ))
                    ) : (
                      categorySpendingHistory.map((item, idx) => {
                        const maxSpend = Math.max(...categorySpendingHistory.map(i => i.spending));
                        const heightPx = maxSpend > 0 ? Math.max((item.spending / maxSpend) * 40, 8) : 8;
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1 group relative">
                            <div
                              className="w-6 rounded-sm transition-all"
                              style={{
                                height: `${heightPx}px`,
                                backgroundColor: selectedScope?.hexColor,
                              }}
                            />
                            <span className="text-[9px] text-[var(--color-muted)] mt-0.5">
                              {item.monthName || item.month}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Highest Transactions List */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2 sticky top-0 bg-[var(--color-background)] py-1 z-10">
                    Highest Transactions
                  </h4>

                  {loadingTransactions ? (
                    <div className="space-y-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center justify-between py-2 px-1">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-[var(--color-border)] animate-pulse" />
                            <div className="space-y-1">
                              <div className="h-3 w-24 bg-[var(--color-border)] rounded animate-pulse" />
                              <div className="h-2 w-16 bg-[var(--color-border)] rounded animate-pulse" />
                            </div>
                          </div>
                          <div className="h-3 w-12 bg-[var(--color-border)] rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : recentTransactions.length === 0 ? (
                    <div className="text-center py-4 text-[var(--color-muted)] text-sm italic">
                      No recent transactions
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {recentTransactions
                        .filter(tx => parseFloat(tx.amount) < 0)
                        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                        .slice(0, 4)
                        .map(tx => (
                          <div key={tx.id} className="flex items-center justify-between py-2 px-2 hover:bg-[var(--color-surface)] rounded-lg transition-colors group">
                            <div className="flex items-center gap-3 overflow-hidden">
                              {/* Icon / Logo */}
                              <div
                                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center overflow-hidden"
                                style={{
                                  backgroundColor: tx.icon_url ? 'transparent' : (tx.category_hex_color || 'var(--color-border)')
                                }}
                              >
                                {tx.icon_url ? (
                                  <img
                                    src={tx.icon_url}
                                    alt={tx.merchant_name || tx.description}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'block';
                                      e.target.parentElement.style.backgroundColor = tx.category_hex_color || 'var(--color-border)';
                                    }}
                                  />
                                ) : null}
                                <DynamicIcon
                                  iconLib={tx.category_icon_lib}
                                  iconName={tx.category_icon_name}
                                  className="w-4 h-4 text-white"
                                  fallback={FiTag}
                                  style={{ display: tx.icon_url ? 'none' : 'block' }}
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="text-sm font-medium text-[var(--color-fg)] truncate group-hover:text-[var(--color-accent)] transition-colors">
                                  {tx.merchant_name || tx.description || 'Unknown Transaction'}
                                </div>
                                <div className="text-xs text-[var(--color-muted)]">
                                  {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                            </div>
                            <span className={`text-sm font-medium whitespace-nowrap ml-2 ${parseFloat(tx.amount) > 0 ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
                              {parseFloat(tx.amount) < 0 ? '' : '+'}${Math.abs(parseFloat(tx.amount)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Navigation - fixed at bottom, outside AnimatePresence */}
        <StepNavigation
          showBack={step > 1}
          onBack={() => {
            setSlideDirection(-1);
            setStep(step === 3 ? 2 : 1);
          }}
          onNext={
            step === 1
              ? handleIncomeNext
              : step === 2
                ? handleCreateAll
                : step === 3
                  ? handleSubmit
                  : undefined
          }
          nextDisabled={
            step === 1
              ? !monthlyIncome
              : step === 2
                ? loading
                : step === 3
                  // Block if amount exceeds income or is invalid
                  ? !amount || parseFloat(amount) <= 0 || (monthlyIncome && parseFloat(amount) > parseFloat(monthlyIncome))
                  : false
          }
          disabledTooltip={
            step === 3 && monthlyIncome && parseFloat(amount || 0) > parseFloat(monthlyIncome)
              ? `Budget cannot exceed monthly income ($${parseFloat(monthlyIncome).toLocaleString()})`
              : undefined
          }
          nextLabel={step === 2 ? (loading ? "Creating..." : "Create All") : step === 3 ? "Create Budget" : "Next"}
        />
      </div>
    </Modal >
  );
}
