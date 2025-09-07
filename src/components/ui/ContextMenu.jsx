"use client";

import { useState, useRef, useEffect, useCallback, cloneElement } from 'react';
import clsx from 'clsx';

const ContextMenu = ({ 
  trigger, 
  children, 
  align = 'right',
  className = '',
  onOpen,
  onClose 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const handleTriggerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
    if (!isOpen) {
      onOpen?.();
    } else {
      onClose?.();
    }
  };

  const handleClose = useCallback(() => {
    console.log('ContextMenu: handleClose called');
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
        onClose?.();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className={clsx("relative", className)} ref={ref}>
      <div onClick={handleTriggerClick} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div
          role="menu"
          className={clsx(
            "absolute mt-2 w-48 overflow-hidden rounded-lg bg-[var(--color-bg)] shadow-xl z-50",
            "border border-[color-mix(in_oklab,var(--color-border),transparent_50%)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {Array.isArray(children) 
            ? children.map((child, index) => {
                console.log('ContextMenu: processing child', index, 'type:', child?.type?.name, 'isContextMenuItem:', child?.type === ContextMenuItem);
                return child && child.type === ContextMenuItem 
                  ? cloneElement(child, { key: index, onClose: handleClose })
                  : child;
              })
            : (() => {
                console.log('ContextMenu: processing single child, type:', children?.type?.name, 'isContextMenuItem:', children?.type === ContextMenuItem);
                return children && children.type === ContextMenuItem
                  ? cloneElement(children, { onClose: handleClose })
                  : children;
              })()}
        </div>
      )}
    </div>
  );
};

const ContextMenuItem = ({ 
  children, 
  onClick, 
  disabled = false,
  className = '',
  icon,
  onClose,
  destructive = false,
  ...props 
}) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      console.log('ContextMenuItem: handleClick called, onClose:', !!onClose);
      // Close the menu first
      onClose?.();
      // Then call the onClick handler
      if (onClick) {
        onClick();
      }
    }
  };

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      disabled={disabled}
      className={clsx(
        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer",
        "hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]",
        "focus:outline-none focus:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        destructive && "text-[var(--color-danger)] hover:text-[var(--color-danger)]",
        className
      )}
      {...props}
    >
      {icon && <span className="h-4 w-4 shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
};

const ContextMenuSeparator = () => (
  <div className="h-px bg-[color-mix(in_oklab,var(--color-border),transparent_50%)]" />
);

export { ContextMenu, ContextMenuItem, ContextMenuSeparator };
