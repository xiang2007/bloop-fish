"use client";

import { useTransition } from "react";
import { TrashIcon } from "./icons";
import { cx } from "./ui";

// Icon or text button that confirms before running a Server Action.
export default function ConfirmButton({
  action,
  fields,
  message,
  label,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  message: string;
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={() => {
        if (!window.confirm(message)) return;
        const formData = new FormData();
        for (const [key, value] of Object.entries(fields)) formData.set(key, value);
        startTransition(() => action(formData));
      }}
      className={cx(
        children
          ? "inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
          : "inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger disabled:opacity-50",
        className,
      )}
    >
      {children ?? <TrashIcon className="size-4" />}
    </button>
  );
}
