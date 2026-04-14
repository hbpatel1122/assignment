'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import Avatar from '@/components/ui/Avatar';
import ChatSphereLogo from '@/components/ui/ChatSphereLogo';
import { disconnectSocket } from '@/lib/socket';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, conversations, unreadNotifCount } = useStore();

  const unreadCount = conversations.filter(
    (c) => c.lastMessage && c.lastMessage.sender?._id !== user?._id && c.lastMessage.status !== 'read'
  ).length;

  const handleLogout = () => {
    disconnectSocket();
    logout();
    router.push('/auth');
  };

  if (!user) return null;

  const navItems = [
    {
      href: '/people',
      label: 'People',
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: '/messages',
      label: 'Messages',
      badge: unreadCount,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      href: '/posts',
      label: 'Posts',
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  const isProfileActive = pathname.startsWith('/profile');

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900/95 backdrop-blur-xl border-r border-gray-800/60 min-h-screen fixed left-0 top-0 z-30">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-800/60 shrink-0">
          <ChatSphereLogo size={30} />
          <span className="text-white font-bold text-lg tracking-tight">ChatSphere</span>
        </div>

        {/* ── Main Nav ── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                  ${active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/70'}`}
              >
                <span className={`shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                  {item.icon}
                </span>
                <span className="font-medium flex-1 text-sm">{item.label}</span>
                <AnimatePresence>
                  {item.badge > 0 && (
                    <motion.span
                      key="b"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold rounded-full
                        ${active ? 'bg-white/25 text-white' : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'}`}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}

          {/* ── Notifications nav item ── */}
          {(() => {
            const active = pathname.startsWith('/notifications');
            return (
              <Link
                href="/notifications"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                  ${active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/70'}`}
              >
                <span className={`shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </span>
                <span className="font-medium flex-1 text-sm">Notifications</span>
                <AnimatePresence>
                  {unreadNotifCount > 0 && (
                    <motion.span
                      key="notif-badge"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold rounded-full
                        ${active ? 'bg-white/25 text-white' : 'bg-red-500 text-white shadow-sm'}`}
                    >
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })()}
        </nav>

        {/* ── Bottom: Profile + Sign out ── */}
        <div className="px-3 py-4 border-t border-gray-800/60 space-y-0.5 shrink-0">
          {/* Profile */}
          <Link
            href={`/profile/${user.username}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
              ${isProfileActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/70'}`}
          >
            <span className="shrink-0">
              <Avatar user={{ ...user, isOnline: true }} size="sm" showOnline />
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate leading-tight
                ${isProfileActive ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                {user.username}
              </p>
              <p className="text-gray-500 text-xs truncate leading-tight">{user.email}</p>
            </div>
            {/* Follow request badge */}
            {((user.followRequests as string[]) || []).length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold rounded-full
                  ${isProfileActive ? 'bg-white/25 text-white' : 'bg-yellow-500 text-black'}`}
              >
                {((user.followRequests as string[]) || []).length}
              </motion.span>
            )}
          </Link>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 text-sm group"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium group-hover:text-red-400 transition-colors">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/60 flex items-center justify-around px-2 py-1.5 safe-area-bottom">

        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all
                ${active ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <span className="relative">
                {item.icon}
                <AnimatePresence>
                  {item.badge > 0 && (
                    <motion.span
                      key="dot"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-indigo-600 text-white text-[9px] font-bold rounded-full"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Notifications — mobile link */}
        {(() => {
          const active = pathname.startsWith('/notifications');
          return (
            <Link
              href="/notifications"
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all
                ${active ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <span className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <AnimatePresence>
                  {unreadNotifCount > 0 && (
                    <motion.span
                      key="mob-notif-dot"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full"
                    >
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="text-[10px] font-medium">Alerts</span>
            </Link>
          );
        })()}

        {/* Profile */}
        <Link
          href={`/profile/${user.username}`}
          className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all
            ${isProfileActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <span className="relative">
            <Avatar user={{ ...user, isOnline: true }} size="sm" showOnline />
            {((user.followRequests as string[]) || []).length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-yellow-500 text-black text-[9px] font-bold rounded-full"
              >
                {((user.followRequests as string[]) || []).length}
              </motion.span>
            )}
          </span>
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>
    </>
  );
}
