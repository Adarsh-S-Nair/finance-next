"use client";

import { useState, useEffect, useRef } from "react";
import { FiChevronDown } from "react-icons/fi";
import { Button, SegmentedTabs } from "@zervo/ui";
import { authFetch } from "../../lib/api/fetch";
import { formatCurrency as formatCurrencyBase } from "../../lib/formatCurrency";
import AddressAutocomplete from "./AddressAutocomplete";
import FloatingPanel from "../ui/FloatingPanel";

const formatCurrency = (amount) => formatCurrencyBase(amount, true);

/* ── Native form primitives (match CreateGoalOverlay / AddAccountOverlay) ── */

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)] mb-2">
      {children}
    </div>
  );
}

function UnderlineInput({ value, onChange, placeholder, type = "text", prefix }) {
  return (
    <div className="flex items-baseline gap-1.5 border-b border-[var(--color-border)] focus-within:border-[var(--color-fg)] transition-colors input-focus-bar">
      {prefix && <span className="text-[var(--color-muted)] text-base">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={type === "number" ? "decimal" : undefined}
        className={`w-full bg-transparent outline-none text-base py-2 text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/60 ${
          type === "number" ? "tabular-nums" : ""
        }`}
      />
    </div>
  );
}

// Large $ amount input — the hero field for the property's value. Shows raw
// digits while focused, comma-grouped when blurred.
function AmountInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  const display = (() => {
    if (focused || !value) return value;
    const n = Number(value);
    return Number.isFinite(n)
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)
      : value;
  })();
  return (
    <div className="flex items-baseline gap-1 cursor-text">
      <span className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)]">
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/,/g, "");
          if (cleaned === "" || /^\d*\.?\d*$/.test(cleaned)) onChange(cleaned);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="0"
        className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] tabular-nums bg-transparent border-none outline-none p-0 m-0 placeholder:text-[var(--color-muted)]/40"
        style={{ width: `${Math.max((display?.toString().length || 1) * 0.62 + 0.4, 2)}em` }}
      />
    </div>
  );
}

/* ── Mortgage link selector (themed dropdown) ────────────────── */

function MortgageSelect({ options, value, onChange }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <div>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-transparent border-b border-[var(--color-border)] outline-none text-base py-2 text-left"
      >
        <span className={selected ? "text-[var(--color-fg)] truncate" : "text-[var(--color-muted)]/60"}>
          {selected
            ? `${selected.name} — ${formatCurrency(Math.abs(selected.balance))}`
            : "Select an account"}
        </span>
        <FiChevronDown className="h-4 w-4 text-[var(--color-muted)] flex-shrink-0" />
      </button>
      <FloatingPanel anchorRef={anchorRef} open={open} onClose={() => setOpen(false)}>
        <div className="py-1">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-alt)] transition-colors flex items-center justify-between gap-3"
            >
              <span className="text-sm text-[var(--color-fg)] truncate">{o.name}</span>
              <span className="text-xs text-[var(--color-muted)] tabular-nums flex-shrink-0">
                {formatCurrency(Math.abs(o.balance))}
              </span>
            </button>
          ))}
        </div>
      </FloatingPanel>
    </div>
  );
}

/* ── Form ────────────────────────────────────────────────────── */

export default function PropertyForm({
  property = null,
  mortgageOptions = [],
  onSaved,
  onCancel,
}) {
  const isEdit = Boolean(property);

  const [address, setAddress] = useState("");
  const [addressPrimary, setAddressPrimary] = useState("");
  const [nickname, setNickname] = useState("");
  const [value, setValue] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [mortgageMode, setMortgageMode] = useState("none"); // none | link | manual
  const [linkedMortgageAccountId, setLinkedMortgageAccountId] = useState("");
  const [manualMortgageBalance, setManualMortgageBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    if (property) {
      setAddress(property.address ?? "");
      setAddressPrimary("");
      setNickname(property.name ?? "");
      setValue(property.value != null ? String(property.value) : "");
      setPurchasePrice(property.purchasePrice != null ? String(property.purchasePrice) : "");
      if (property.mortgage?.manual) {
        setMortgageMode("manual");
        setManualMortgageBalance(String(property.mortgage.balance ?? ""));
        setLinkedMortgageAccountId("");
      } else if (property.mortgage) {
        setMortgageMode("link");
        setLinkedMortgageAccountId(property.mortgage.accountId ?? "");
        setManualMortgageBalance("");
      } else {
        setMortgageMode("none");
        setLinkedMortgageAccountId("");
        setManualMortgageBalance("");
      }
    } else {
      setAddress("");
      setAddressPrimary("");
      setNickname("");
      setValue("");
      setPurchasePrice("");
      setMortgageMode("none");
      setLinkedMortgageAccountId("");
      setManualMortgageBalance("");
    }
  }, [property]);

  const handleSubmit = async () => {
    setError(null);
    const numericValue = Number(value);
    if (!value || !Number.isFinite(numericValue) || numericValue < 0) {
      setError("Enter a valid current value.");
      return;
    }
    // Name: nickname if given, else the street line of the address, else a
    // sensible fallback. Keeps a single required-feeling field (the address).
    const finalName =
      nickname.trim() ||
      addressPrimary.trim() ||
      (address.split(",")[0] || "").trim() ||
      "Property";

    setSubmitting(true);
    try {
      const payload = {
        name: finalName,
        address: address.trim() || null,
        value: numericValue,
        purchasePrice: purchasePrice === "" ? null : Number(purchasePrice),
        linkedMortgageAccountId:
          mortgageMode === "link" ? linkedMortgageAccountId || null : null,
        manualMortgageBalance:
          mortgageMode === "manual" && manualMortgageBalance !== ""
            ? Number(manualMortgageBalance)
            : null,
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
    } catch (err) {
      setError(err.message || "Couldn't delete the property.");
    } finally {
      setDeleting(false);
    }
  };

  const busy = submitting || deleting;

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Address</SectionLabel>
        <AddressAutocomplete
          value={address}
          onChange={setAddress}
          onPrimaryChange={setAddressPrimary}
          autoFocus={!isEdit}
        />
      </div>

      <div>
        <SectionLabel>Nickname (optional)</SectionLabel>
        <UnderlineInput
          value={nickname}
          onChange={setNickname}
          placeholder={addressPrimary || "e.g. Primary home"}
        />
      </div>

      <div>
        <SectionLabel>Current value</SectionLabel>
        <AmountInput value={value} onChange={setValue} />
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Your best estimate — e.g. a Zillow estimate or recent appraisal. Update it anytime.
        </p>
      </div>

      <div>
        <SectionLabel>Purchase price (optional)</SectionLabel>
        <UnderlineInput
          type="number"
          prefix="$"
          value={purchasePrice}
          onChange={setPurchasePrice}
          placeholder="0"
        />
      </div>

      <div>
        <SectionLabel>Mortgage (optional)</SectionLabel>
        <SegmentedTabs
          size="sm"
          value={mortgageMode}
          onChange={setMortgageMode}
          options={[
            { label: "None", value: "none" },
            { label: "Link account", value: "link" },
            { label: "Enter amount", value: "manual" },
          ]}
        />

        {mortgageMode === "link" && (
          <div className="mt-3">
            {mortgageOptions.length > 0 ? (
              <MortgageSelect
                options={mortgageOptions}
                value={linkedMortgageAccountId}
                onChange={setLinkedMortgageAccountId}
              />
            ) : (
              <p className="text-xs text-[var(--color-muted)]">
                No loan accounts to link yet. Connect one, or switch to “Enter amount”.
              </p>
            )}
          </div>
        )}

        {mortgageMode === "manual" && (
          <div className="mt-3">
            <UnderlineInput
              type="number"
              prefix="$"
              value={manualMortgageBalance}
              onChange={setManualMortgageBalance}
              placeholder="Remaining balance"
            />
            <p className="mt-1.5 text-xs text-[var(--color-muted)]">
              We’ll track this as a liability so your equity and net worth stay accurate.
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex items-center justify-between gap-2 pt-1">
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
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add property"}
          </Button>
        </div>
      </div>
    </div>
  );
}
