'use client';
import { User } from '@/types';
import { resolveMediaUrl } from '@/lib/api';

interface Props {
  user: Pick<User, 'username' | 'avatar' | 'isOnline'>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showOnline?: boolean;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-2xl',
};

const dotSizes = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

export default function Avatar({ user, size = 'md', showOnline = false }: Props) {
  const initials = user.username?.slice(0, 2).toUpperCase() || '??';

  const colors = [
    'bg-indigo-600', 'bg-violet-600', 'bg-blue-600',
    'bg-pink-600', 'bg-emerald-600', 'bg-orange-600',
  ];
  const colorIdx =
    user.username
      ? user.username.charCodeAt(0) % colors.length
      : 0;

  return (
    <div className="relative inline-flex shrink-0">
      {user.avatar ? (
        <img
          src={resolveMediaUrl(user.avatar)}
          alt={user.username}
          className={`${sizes[size]} rounded-full object-cover ring-2 ring-gray-800`}
        />
      ) : (
        <div
          className={`${sizes[size]} ${colors[colorIdx]} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-gray-800`}
        >
          {initials}
        </div>
      )}
      {showOnline && user.isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${dotSizes[size]} bg-emerald-500 rounded-full border-2 border-gray-900`}
        />
      )}
    </div>
  );
}
