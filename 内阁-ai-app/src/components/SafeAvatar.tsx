/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { getProviderAvatar, getProviderColor } from '../providerAvatars';

interface SafeAvatarProps {
  src?: string;
  name: string;
  className?: string;
  id?: string;
  providerId?: string;
}

export const SafeAvatar: React.FC<SafeAvatarProps> = ({ src, name, className = 'w-9 h-9 text-xs', id, providerId }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const getInitial = (fullName: string) => {
    const cleaned = fullName.replace(/[()\[\]【】]/g, '').trim();
    if (!cleaned) return '?';
    if (/[一-龥]/.test(cleaned)) return cleaned.charAt(0);
    return cleaned.charAt(0).toUpperCase();
  };

  const getGradientClass = () => {
    if (providerId) {
      const info = getProviderAvatar(providerId);
      return { background: `linear-gradient(135deg, ${info.color}, ${info.color}88)`, color: '#fff' };
    }
    let hash = 0;
    const value = name || '?';
    for (let i = 0; i < value.length; i += 1) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'from-amber-600 to-amber-800 text-amber-100',
      'from-red-600 to-rose-800 text-red-50',
      'from-emerald-600 to-teal-800 text-emerald-50',
      'from-blue-600 to-indigo-800 text-blue-50',
      'from-purple-600 to-violet-800 text-purple-50',
      'from-orange-500 to-amber-700 text-orange-50',
      'from-pink-600 to-rose-700 text-pink-50',
      'from-cyan-600 to-blue-700 text-cyan-50',
    ];
    return { className: `bg-gradient-to-br ${gradients[Math.abs(hash) % gradients.length]}` };
  };

  const gradient = getGradientClass();

  // If src is provided and hasn't failed, show img
  if (src && src.length > 0 && !imgFailed) {
    return (
      <img
        id={id}
        src={src}
        alt={name}
        className={`${className} rounded-full object-cover shrink-0 border border-white/10`}
        title={name}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      id={id}
      className={`${className} rounded-full flex items-center justify-center font-bold font-display shadow-inner shrink-0 cursor-default select-none border border-white/10 ${gradient.className || ''}`}
      style={gradient.background ? { background: gradient.background, color: gradient.color } : undefined}
      title={name}
    >
      <span>{getInitial(name)}</span>
    </div>
  );
};
