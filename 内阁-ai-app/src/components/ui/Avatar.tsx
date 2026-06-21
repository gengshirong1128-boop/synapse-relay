import type { HTMLAttributes } from 'react';

type AvatarStatus = 'online' | 'thinking' | 'idle' | 'offline';
type AvatarSize = 'sm' | 'md' | 'lg';

type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  description?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
};

const initialsFor = (name: string) => {
  const normalized = name.trim();
  if (!normalized) return '?';
  const parts = normalized.split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return normalized.slice(0, 2).toUpperCase();
};

export function Avatar({ className = '', description, name, size = 'md', status = 'idle', title, ...props }: AvatarProps) {
  return (
    <div
      {...props}
      aria-label={description ? `${name}, ${description}` : name}
      className={`ui-avatar ui-avatar--${size} ui-avatar--${status} ${className}`.trim()}
      role={props.role || 'img'}
      title={title || (description ? `${name} - ${description}` : name)}
    >
      <span>{initialsFor(name)}</span>
      <i aria-hidden="true" />
    </div>
  );
}
