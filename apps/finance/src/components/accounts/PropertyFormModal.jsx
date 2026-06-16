"use client";

import { Modal } from "@zervo/ui";
import PropertyForm from "./PropertyForm";

/**
 * Modal wrapper around PropertyForm, used to edit/remove an existing property
 * from the accounts page (a row click opens this). Creation lives in the
 * topbar Add-account overlay instead.
 */
export default function PropertyFormModal({
  isOpen,
  onClose,
  onSaved,
  property = null,
  mortgageOptions = [],
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit property">
      {isOpen && (
        <PropertyForm
          property={property}
          mortgageOptions={mortgageOptions}
          onSaved={() => {
            onSaved?.();
            onClose?.();
          }}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
