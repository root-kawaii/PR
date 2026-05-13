import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { ui } from "./ui-classes";

export type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: ui.modalSizeSm,
  md: ui.modalSizeMd,
  lg: ui.modalSizeLg,
  xl: ui.modalSizeXl,
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  footer,
  closeOnOverlay = true,
  closeOnEsc = true,
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  return (
    <div
      className={ui.modalOverlay}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${ui.modalPanelBase} ${SIZE_CLASS[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={ui.modalHeader}>
          <h2 id={titleId} className="text-lg font-bold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={ui.iconButton}
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </header>
        <div className={ui.modalBody}>{children}</div>
        {footer && <footer className={ui.modalFooter}>{footer}</footer>}
      </div>
    </div>
  );
}

export default Modal;
