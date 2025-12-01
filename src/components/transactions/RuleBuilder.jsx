import React, { useState, useEffect } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Dropdown from '../ui/Dropdown';

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
  { value: 'is', label: 'is' },
  { value: 'is_greater_than', label: 'is greater than' },
  { value: 'is_less_than', label: 'is less than' }
];

export default function RuleBuilder({ criteria, categoryName, onRuleChange, onEditCategory }) {
  const [conditions, setConditions] = useState([{
    id: Date.now(),
    field: 'merchant_name',
    operator: 'is',
    value: '',
  }]);

  // Initialize state from props
  useEffect(() => {
    if (criteria) {
      setConditions([{
        id: Date.now(),
        field: criteria.field || 'merchant_name',
        operator: criteria.operator || 'is',
        value: criteria.value || '',
      }]);
    }
  }, [criteria]);

  const handleConditionChange = (id, key, value) => {
    setConditions(prev => prev.map(condition => {
      if (condition.id !== id) return condition;

      const newCondition = { ...condition, [key]: value };

      // Reset operator if field type changes
      if (key === 'field') {
        const fieldType = FIELD_OPTIONS.find(f => f.value === value)?.type;
        const currentFieldType = FIELD_OPTIONS.find(f => f.value === condition.field)?.type;

        if (fieldType !== currentFieldType) {
          newCondition.operator = 'is';
        }
      }

      return newCondition;
    }));
  };

  const addCondition = () => {
    setConditions(prev => [...prev, {
      id: Date.now(),
      field: 'merchant_name',
      operator: 'is',
      value: ''
    }]);
  };

  const removeCondition = (id) => {
    if (conditions.length > 1) {
      setConditions(prev => prev.filter(c => c.id !== id));
    }
  };

  if (!criteria) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)]/50 bg-[var(--color-surface)]/50">
        <h4 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
          Category Rule
        </h4>
      </div>

      <div className="p-4 space-y-4">
        {/* Conditions */}
        <div className="space-y-3">
          {conditions.map((condition, index) => {
            const currentFieldOption = FIELD_OPTIONS.find(o => o.value === condition.field);
            const currentFieldLabel = currentFieldOption?.label || condition.field;

            const availableOperators = currentFieldOption?.type === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
            const currentOperatorLabel = availableOperators.find(o => o.value === condition.operator)?.label || condition.operator;

            return (
              <div key={condition.id} className={`flex flex-col gap-2 ${index > 0 ? 'pt-3 border-t border-dashed border-[var(--color-border)]' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--color-muted)] mr-1 w-8 text-right">
                    {index === 0 ? 'If' : 'and'}
                  </span>
                  <Dropdown
                    label={currentFieldLabel}
                    items={FIELD_OPTIONS.map(option => ({
                      label: option.label,
                      onClick: () => handleConditionChange(condition.id, 'field', option.value)
                    }))}
                    size="sm"
                    align="left"
                    className="bg-[var(--color-bg)] border-[var(--color-border)]"
                  />

                  <Dropdown
                    label={currentOperatorLabel}
                    items={availableOperators.map(option => ({
                      label: option.label,
                      onClick: () => handleConditionChange(condition.id, 'operator', option.value)
                    }))}
                    size="sm"
                    align="left"
                    className="bg-[var(--color-bg)] border-[var(--color-border)]"
                  />
                </div>

                <div className="flex items-center gap-2 pl-11">
                  <div className="flex-1">
                    <Input
                      value={condition.value}
                      onChange={(e) => handleConditionChange(condition.id, 'value', e.target.value)}
                      className="w-full bg-[var(--color-bg)] border-[var(--color-border)] focus:border-[var(--color-accent)] h-9 text-sm"
                      placeholder="Value..."
                      type={currentFieldOption?.type === 'number' ? 'number' : 'text'}
                    />
                  </div>

                  {conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="p-2 rounded-lg text-[var(--color-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Remove condition"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Condition Button */}
        <div className="pl-11">
          <button
            onClick={addCondition}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors"
          >
            <FiPlus className="w-3.5 h-3.5" />
            Add condition
          </button>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--color-border)]/30">
          <span className="text-sm font-medium text-[var(--color-muted)] mr-1">Then set category to</span>
          <button
            onClick={onEditCategory}
            className="group flex items-center gap-2 px-3 h-8 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all cursor-pointer"
          >
            <span className="text-xs font-medium text-[var(--color-fg)]">
              {categoryName || "Select Category"}
            </span>
            <FiEdit2 className="w-3.5 h-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
