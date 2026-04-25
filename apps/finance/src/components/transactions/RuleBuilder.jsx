import React, { useState, useEffect, useRef } from 'react';
import { FiPlus, FiTrash2, FiChevronDown } from 'react-icons/fi';

const FIELD_OPTIONS = [
  { value: 'merchant_name', label: 'Merchant Name', type: 'string' },
  { value: 'description', label: 'Description', type: 'string' },
  { value: 'amount', label: 'Amount', type: 'number' }
];

const STRING_OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' }
];

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'is_greater_than', label: 'is greater than' },
  { value: 'is_less_than', label: 'is less than' }
];

// Compact inline picker used for field and operator chips. Renders as a
// text-only control with a small chevron so it blends into the sentence
// instead of looking like a dropdown button.
function InlinePicker({ value, options, onChange, minWidth }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-fg)] underline decoration-dotted decoration-[var(--color-muted)] underline-offset-4 hover:decoration-[var(--color-fg)] transition-colors"
        style={minWidth ? { minWidth } : undefined}
      >
        <span>{current?.label ?? value}</span>
        <FiChevronDown className="w-3 h-3 text-[var(--color-muted)]" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 min-w-[9rem] rounded-md bg-[var(--color-floating-bg)] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] py-1 z-20"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-1.5 text-sm transition-colors ${
                opt.value === value
                  ? 'text-[var(--color-fg)] bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]'
                  : 'text-[var(--color-floating-fg)] hover:bg-[color-mix(in_oklab,var(--color-floating-fg),transparent_92%)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export default function RuleBuilder({ criteria, initialConditions, categoryName, onRuleChange, onEditCategory }) {
  const [conditions, setConditions] = useState(() => [{
    id: Date.now(),
    field: 'merchant_name',
    operator: 'is',
    value: '',
  }]);

  // Initialize state from props - prioritize initialConditions if provided
  useEffect(() => {
    if (initialConditions && initialConditions.length > 0) {
      setConditions(initialConditions);
      onRuleChange?.(initialConditions);
    } else if (criteria) {
      const singleCondition = [{
        id: Date.now(),
        field: criteria.field || 'merchant_name',
        operator: criteria.operator || 'is',
        value: criteria.value || '',
      }];
      setConditions(singleCondition);
      onRuleChange?.(singleCondition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, initialConditions]);

  const handleConditionChange = (id, key, value) => {
    const newConditions = conditions.map(condition => {
      if (condition.id !== id) return condition;

      const newCondition = { ...condition, [key]: value };

      // Reset operator if field type changes
      if (key === 'field') {
        const fieldType = FIELD_OPTIONS.find(f => f.value === value)?.type;
        const currentFieldType = FIELD_OPTIONS.find(f => f.value === condition.field)?.type;

        if (fieldType !== currentFieldType) {
          newCondition.operator = fieldType === 'number' ? 'equals' : 'is';
        }
      }

      return newCondition;
    });

    setConditions(newConditions);
    onRuleChange?.(newConditions);
  };

  const addCondition = () => {
    const newConditions = [...conditions, {
      id: Date.now(),
      field: 'merchant_name',
      operator: 'is',
      value: ''
    }];
    setConditions(newConditions);
    onRuleChange?.(newConditions);
  };

  const removeCondition = (id) => {
    if (conditions.length > 1) {
      const newConditions = conditions.filter(c => c.id !== id);
      setConditions(newConditions);
      onRuleChange?.(newConditions);
    }
  };

  if (!criteria) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
          Rule
        </h4>
        <span className="text-[11px] text-[var(--color-muted)]">
          Auto-categorise future matches
        </span>
      </div>

      <div className="divide-y divide-[var(--color-border)]/40">
        {conditions.map((condition, index) => {
          const fieldOption = FIELD_OPTIONS.find((o) => o.value === condition.field);
          const operatorOptions = fieldOption?.type === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
          const conjunction = index === 0 ? 'If' : 'and';

          return (
            <div key={condition.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
              <span className="text-sm font-medium text-[var(--color-muted)] w-8 mt-1.5 text-right flex-shrink-0">
                {conjunction}
              </span>
              <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-2">
                <InlinePicker
                  value={condition.field}
                  options={FIELD_OPTIONS}
                  onChange={(v) => handleConditionChange(condition.id, 'field', v)}
                />
                <InlinePicker
                  value={condition.operator}
                  options={operatorOptions}
                  onChange={(v) => handleConditionChange(condition.id, 'operator', v)}
                />
                <input
                  type={fieldOption?.type === 'number' ? 'number' : 'text'}
                  value={condition.value}
                  onChange={(e) => handleConditionChange(condition.id, 'value', e.target.value)}
                  placeholder={fieldOption?.type === 'number' ? '0.00' : 'value'}
                  className="flex-1 min-w-[8rem] bg-transparent text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/70 border-0 border-b border-[var(--color-border)] focus:border-[var(--color-fg)] outline-none px-0 py-1 transition-colors"
                />
              </div>
              {conditions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCondition(condition.id)}
                  className="p-1.5 rounded-md text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors flex-shrink-0"
                  aria-label="Remove condition"
                  title="Remove condition"
                >
                  <FiTrash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="pl-11">
        <button
          type="button"
          onClick={addCondition}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          <FiPlus className="w-3.5 h-3.5" />
          Add condition
        </button>
      </div>

      <div className="flex items-baseline gap-2 flex-wrap pt-3 border-t border-[var(--color-border)]/40">
        <span className="text-sm text-[var(--color-muted)]">Then set category to</span>
        <button
          type="button"
          onClick={onEditCategory}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-fg)] underline decoration-dotted decoration-[var(--color-muted)] underline-offset-4 hover:decoration-[var(--color-fg)] transition-colors"
        >
          <span>{categoryName || 'Select category'}</span>
          <FiChevronDown className="w-3 h-3 text-[var(--color-muted)]" />
        </button>
      </div>
    </div>
  );
}
