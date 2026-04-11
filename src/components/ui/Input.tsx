"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import clsx from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement> & { isInvalid?: boolean };

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, isInvalid = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-content-bg)] px-3 py-2 text-base outline-none input-focus-bar",
        isInvalid && "border-[var(--color-danger)]",
        className
      )}
      {...props}
    />
  );
});

export default Input;
