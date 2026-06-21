import type { HTMLAttributes, ReactNode } from 'react';

type ListItemProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
};

export function ListItem({ actions, className = '', description, leading, meta, title, ...props }: ListItemProps) {
  return (
    <div className={`ui-list-item ${className}`.trim()} {...props}>
      {leading && <div className="ui-list-item__leading">{leading}</div>}
      <div className="ui-list-item__content">
        <div className="ui-list-item__title">
          <strong>{title}</strong>
          {meta && <span>{meta}</span>}
        </div>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ui-list-item__actions">{actions}</div>}
    </div>
  );
}
