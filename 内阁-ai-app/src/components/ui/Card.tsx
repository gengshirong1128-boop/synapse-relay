import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'subtle' | 'interactive';
};

export function Card({ children, className = '', padding = 'md', variant = 'default', ...props }: CardProps) {
  return (
    <div className={`ui-card ui-card--${variant} ui-card--pad-${padding} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`ui-card__header ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`ui-card__body ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
