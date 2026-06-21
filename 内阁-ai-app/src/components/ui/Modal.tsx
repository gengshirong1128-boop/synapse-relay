import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

type ModalProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({ children, description, footer, isOpen, onClose, title }: ModalProps) {
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    window.setTimeout(() => {
      const firstFocusable = panel?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable || panel)?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="ui-modal" role="presentation">
      <button aria-label="Close modal" className="ui-modal__scrim" type="button" onClick={onClose} />
      <section
        ref={panelRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="ui-modal__panel"
        role="dialog"
        tabIndex={-1}
      >
        <header className="ui-modal__header">
          <div>
            <strong id={titleId}>{title}</strong>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <Button aria-label="Close" size="icon" variant="ghost" onClick={onClose}>
            <X size={15} />
          </Button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </section>
    </div>
  );
}
