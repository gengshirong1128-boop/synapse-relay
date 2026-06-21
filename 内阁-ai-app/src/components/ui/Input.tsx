import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type FieldShellProps = {
  description?: string;
  error?: string;
  label?: string;
};

const describedBy = (existing: unknown, helperId?: string) =>
  [typeof existing === 'string' ? existing : '', helperId || ''].filter(Boolean).join(' ') || undefined;

export function Input({
  className = '',
  description,
  error,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldShellProps) {
  const helperId = useId();
  const helperText = error || description;

  return (
    <label className={`ui-field ${error ? 'ui-field--error' : ''}`.trim()}>
      {label && <span>{label}</span>}
      <input
        {...props}
        aria-describedby={describedBy(props['aria-describedby'], helperText ? helperId : undefined)}
        aria-errormessage={error ? helperId : undefined}
        aria-invalid={Boolean(error)}
        className={`ui-input ${className}`.trim()}
      />
      {helperText && <small id={helperId}>{helperText}</small>}
    </label>
  );
}

export function Textarea({
  className = '',
  description,
  error,
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldShellProps) {
  const helperId = useId();
  const helperText = error || description;

  return (
    <label className={`ui-field ${error ? 'ui-field--error' : ''}`.trim()}>
      {label && <span>{label}</span>}
      <textarea
        {...props}
        aria-describedby={describedBy(props['aria-describedby'], helperText ? helperId : undefined)}
        aria-errormessage={error ? helperId : undefined}
        aria-invalid={Boolean(error)}
        className={`ui-input ${className}`.trim()}
      />
      {helperText && <small id={helperId}>{helperText}</small>}
    </label>
  );
}

export function Select({
  className = '',
  description,
  error,
  label,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldShellProps) {
  const helperId = useId();
  const helperText = error || description;

  return (
    <label className={`ui-field ${error ? 'ui-field--error' : ''}`.trim()}>
      {label && <span>{label}</span>}
      <select
        {...props}
        aria-describedby={describedBy(props['aria-describedby'], helperText ? helperId : undefined)}
        aria-errormessage={error ? helperId : undefined}
        aria-invalid={Boolean(error)}
        className={`ui-input ${className}`.trim()}
      />
      {helperText && <small id={helperId}>{helperText}</small>}
    </label>
  );
}
