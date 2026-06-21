import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'text';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className = '',
  disabled,
  icon,
  isLoading = false,
  size = 'md',
  type = 'button',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading && <span aria-hidden="true" className="ui-button__spinner" />}
      {!isLoading && icon}
      {children && <span className="ui-button__label">{children}</span>}
    </button>
  );
}
