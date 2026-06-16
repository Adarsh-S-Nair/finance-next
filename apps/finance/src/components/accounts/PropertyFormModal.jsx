"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input } from "@zervo/ui";
import { authFetch } from "../../lib/api/fetch";
import { formatCurrency as formatCurrencyBase } from "../../lib/formatCurrency";

const formatCurrency = (amount) => formatCurrencyBase(amount, true);

const fieldLabel = "block text-xs font-medium text-[var(--color-muted)] mb-1.5";
const selectClass =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-content-bg)] px-3 py-2 text-base outline-none input-focus-bar";

/**
 * Add or edit a manual property. When `property` is null this is a create
 * form; otherwise it pre-fills and exposes a delete action.
 *
 * `mortgageOptions` is the list of the user's loan/mortgage accounts the
 * home can be linked to: [{ id, name, balance }]. Linking lets the accounts
 * page show equity = value − mortgage balance.
 */
export default function PropertyFormModal({
  isOpen,
  onClose,
  onSaved,
  property = null,
  mortgageOptions = [],
}) {
  const isEdit = Boolean(property);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [value, setValue] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [linkedMortgageAccountId, setLinkedMortgageAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // Sync form state whenever the modal opens (or the target property changes).
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (property) {
      setName(property.name ?? "");
      setAddress(property.address ?? "");
      setValue(property.value != null ? String(property.value) : "");
      setPurchasePrice(property.purchasePrice != null ? String(property.purchasePrice) : "");
      setPurchaseDate(property.purchaseDate ?? "");
      setLinkedMortgageAccountId(property.mortgage?.accountId ?? "");
    } else {
      setName("");
      setAddress("");
      setValue("");
      setPurchasePrice("");
      setPurchaseDate("");
      setLinkedMortgageAccountId("");
    }
  }, [isOpen, property]);

  const handleSubmit = async () => {
    setError(null);
    const trimmedName = name.trim();
    const numericValue = Number(value);
    if (!trimmedName) {
      setError("Give your property a name.");
      return;
    }
    if (!value || !Number.isFinite(numericValue) || numericValue < 0) {
      setError("Enter a valid current value.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        address: address.trim() || null,
        value: numericValue,
        purchasePrice: purchasePrice === "" ? null : Number(purchasePrice),
        purchaseDate: purchaseDate || null,
        linkedMortgageAccountId: linkedMortgageAccountId || null,
      };
      const res = await authFetch(
        isEdit ? `/api/properties/${property.id}` : "/api/properties",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!window.confirm("Remove this property from your net worth? This can't be undone.")) {
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      const res = await authFetch(`/api/properties/${property.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't delete the property.");
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Couldn't delete the property.");
    } finally {
      setDeleting(false);
    }
  };

  const busy = submitting || deleting;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? "Edit property" : "Add a property"}
      description={
        isEdit
          ? undefined
          : "Track a home you own as part of your net worth. Link a mortgage to see your equity."
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="text-sm text-[var(--color-danger)] hover:underline disabled:opacity-50"
            >
              {deleting ? "Removing…" : "Remove"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={busy}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add property"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={fieldLabel}>Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Primary home"
            autoFocus
          />
        </div>

        <div>
          <label className={fieldLabel}>Address (optional)</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St"
          />
        </div>

        <div>
          <label className={fieldLabel}>Current value</label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="808000"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Your best estimate — e.g. a Zillow estimate or recent appraisal. Update it anytime.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={fieldLabel}>Purchase price (optional)</label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="630000"
            />
          </div>
          <div>
            <label className={fieldLabel}>Purchase date (optional)</label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={fieldLabel}>Linked mortgage (optional)</label>
          <select
            className={selectClass}
            value={linkedMortgageAccountId}
            onChange={(e) => setLinkedMortgageAccountId(e.target.value)}
          >
            <option value="">No linked mortgage</option>
            {mortgageOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.balance != null ? ` — ${formatCurrency(Math.abs(m.balance))}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Link the loan backing this home to see equity (value minus what you owe).
          </p>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    </Modal>
  );
}
