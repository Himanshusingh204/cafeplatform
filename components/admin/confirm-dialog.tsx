"use client";

import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
}

/**
 * Accessible replacement for window.confirm. Usage:
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ ... }))) return;
 * and render {dialog} once in the component tree.
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const dialog = (
    <Modal open={opts !== null} onClose={() => settle(false)} title={opts?.title}>
      <p className="text-sm text-muted-foreground">{opts?.message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => settle(false)}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => settle(true)}
          className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90"
        >
          {opts?.confirmLabel ?? "Delete"}
        </button>
      </div>
    </Modal>
  );

  return { confirm, dialog };
}
