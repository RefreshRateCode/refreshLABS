import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Modal from "./Modal";
import { Button } from "./ui";

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<
  ((message: string, kind?: ToastKind) => void) | undefined
>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within FeedbackProvider");
  return ctx;
}

const toastStyles: Record<ToastKind, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
  info: "border-line bg-surface2 text-content",
};

/* ------------------------------------------------------------------ */
/* Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
};

const ConfirmContext = createContext<
  ((opts: ConfirmOpts) => Promise<boolean>) | undefined
>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within FeedbackProvider");
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const pushToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const [confirmState, setConfirmState] = useState<
    (ConfirmOpts & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, resolve });
      }),
    [],
  );

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <ToastContext.Provider value={pushToast}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        {/* Toast stack */}
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg shadow-black/30 backdrop-blur ${toastStyles[t.kind]}`}
            >
              {t.message}
            </div>
          ))}
        </div>

        {/* Confirm dialog */}
        <Modal
          open={!!confirmState}
          title={confirmState?.title ?? ""}
          onClose={() => closeConfirm(false)}
          width="max-w-md"
        >
          {confirmState?.message && (
            <p className="text-sm text-muted">{confirmState.message}</p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => closeConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant={confirmState?.danger ? "danger" : "primary"}
              onClick={() => closeConfirm(true)}
            >
              {confirmState?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </Modal>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
