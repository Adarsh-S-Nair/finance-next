"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";

type ConfirmDialogProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  requiredText?: string; // if provided, require this text (case-insensitive)
  showRequiredTextUppercase?: boolean; // display placeholder/value uppercased visually
  busy?: boolean;
};

export default function ConfirmDialog({
  isOpen,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  onCancel,
  onConfirm,
  requiredText,
  showRequiredTextUppercase = false,
  busy = false,
}: ConfirmDialogProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) setValue("");
  }, [isOpen]);

  const meetsRequirement = useMemo(() => {
    if (!requiredText) return true;
    return value.trim().toLowerCase() === requiredText.trim().toLowerCase();
  }, [value, requiredText]);

  const handleConfirm = async () => {
    if (!meetsRequirement || busy || submitting) return;
    try {
      setSubmitting(true);
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="relative">
        {/* Header */}
        <h3 className="pr-8 text-lg font-semibold text-[var(--color-fg)]">{title}</h3>

        {/* Warning banner */}
        <div className="mt-3 flex items-center gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-danger),transparent_70%)] bg-[color-mix(in_oklab,var(--color-danger),transparent_90%)] px-3 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" className="text-[var(--color-danger)]" fill="currentColor" aria-hidden>
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          <span className="text-sm font-medium">This action cannot be undone.</span>
        </div>

        {/* Description */}
        {description && (
          <p className="mt-3 text-sm text-[var(--color-muted)]">{description}</p>
        )}

        {/* Typed confirmation */}
        {requiredText && (
          <div className="mt-4">
            <label className="block text-sm font-medium">
              Type {showRequiredTextUppercase ? requiredText.toUpperCase() : requiredText} to confirm.
            </label>
            <Input
              className="mt-2"
              value={showRequiredTextUppercase ? value.toUpperCase() : value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={showRequiredTextUppercase ? requiredText.toUpperCase() : requiredText}
              isInvalid={value.length > 0 && !meetsRequirement}
              autoFocus
            />
          </div>
        )}

        {/* Primary destructive action at bottom */}
        <div className="mt-5">
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={!meetsRequirement || busy || submitting}
            fullWidth
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


