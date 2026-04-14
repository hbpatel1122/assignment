'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useStore } from '@/store';
import api from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import { Notification } from '@/types';
import { formatDistanceToNow } from '@/lib/dateUtils';

function notifLabel(n: Notification): string {
  switch (n.type) {
    case 'follow_request':  return 'sent you a follow request';
    case 'follow_accepted': return 'accepted your follow request';
    case 'new_follower':    return 'started following you';
  }
}

function notifIcon(type: Notification['type']) {
  if (type === 'follow_request') {
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </div>
    );
  }
  if (type === 'follow_accepted') {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  // new_follower
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}

interface Props {
  /** When true renders as a full-width sidebar nav row instead of a small icon button */
  navMode?: boolean;
}

export default function NotificationPanel({ navMode = false }: Props) {
  const router = useRouter();
  const {
    notifications, unreadNotifCount,
    setNotifications, prependNotification,
    markNotifRead, markAllNotifsRead,
    removeNotification,
    updateUser,
  } = useStore();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Load notifications on first open
  const fetchNotifications = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.get('/notifications?page=1&limit=20');
      setNotifications(data.notifications, data.unreadCount);
    } catch {
      /* silently ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await fetchNotifications();
      // Mark all as read after opening
      if (unreadNotifCount > 0) {
        markAllNotifsRead();
        api.put('/notifications/read-all').catch(() => {});
      }
    }
  };


  const handleAccept = async (notif: Notification) => {
    setActionLoading(notif._id);
    try {
      await api.post(`/users/requests/${notif.sender._id}/accept`);
      await api.delete(`/notifications/${notif._id}`);
      removeNotification(notif._id);
      const { data } = await api.get('/auth/me');
      updateUser(data.user);
      toast.success(`Accepted ${notif.sender.username}'s request`);
    } catch {
      toast.error('Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (notif: Notification) => {
    setActionLoading(`${notif._id}-decline`);
    try {
      await api.post(`/users/requests/${notif.sender._id}/reject`);
      await api.delete(`/notifications/${notif._id}`);
      removeNotification(notif._id);
      const { data } = await api.get('/auth/me');
      updateUser(data.user);
      toast.success('Request declined');
    } catch {
      toast.error('Failed to decline request');
    } finally {
      setActionLoading(null);
    }
  };

  const goToProfile = (username: string) => {
    setOpen(false);
    router.push(`/profile/${username}`);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell button — sidebar nav style ── */}
      {navMode ? (
        <button
          onClick={handleOpen}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
            ${open ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          {/* icon */}
          <span className={open ? 'text-white' : 'text-gray-400 group-hover:text-white'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </span>
          <span className="font-medium flex-1 text-left">Notifications</span>
          {/* badge */}
          <AnimatePresence>
            {unreadNotifCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold rounded-full
                  ${open ? 'bg-white/20 text-white' : 'bg-red-500 text-white shadow-sm'}`}
              >
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      ) : (
        /* ── Compact icon-only button (mobile / other contexts) ── */
        <button
          onClick={handleOpen}
          className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all
            ${open ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          title="Notifications"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <AnimatePresence>
            {unreadNotifCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow"
              >
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: navMode ? 8 : -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: navMode ? 8 : -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`absolute bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px]
              ${navMode
                ? 'bottom-full mb-2 left-0 right-0 w-auto'
                : 'left-0 top-11 w-80'}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
              <h3 className="text-white font-semibold text-sm">Notifications</h3>
              {notifications.some((n) => !n.read) && (
                <button
                  onClick={() => {
                    markAllNotifsRead();
                    api.put('/notifications/read-all').catch(() => {});
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <ul className="overflow-y-auto flex-1 divide-y divide-gray-800/60">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-full shimmer shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-40 rounded shimmer" />
                      <div className="h-2 w-24 rounded shimmer" />
                    </div>
                  </li>
                ))
              ) : notifications.length === 0 ? (
                <li className="px-4 py-12 text-center">
                  <div className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">No notifications yet</p>
                </li>
              ) : (
                notifications.map((n) => (
                  <motion.li
                    key={n._id}
                    layout
                    className={`flex items-start gap-3 px-4 py-3.5 transition-colors
                      ${!n.read ? 'bg-indigo-500/5' : 'hover:bg-gray-800/40'}`}
                  >
                    {/* Unread dot */}
                    <div className="relative shrink-0 mt-0.5">
                      <button onClick={() => goToProfile(n.sender.username)}>
                        <Avatar
                          user={{ ...n.sender, isOnline: false }}
                          size="sm"
                        />
                      </button>
                      {!n.read && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-gray-900" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        {notifIcon(n.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 leading-snug">
                            <button
                              onClick={() => goToProfile(n.sender.username)}
                              className="font-semibold text-white hover:text-indigo-400 transition"
                            >
                              {n.sender.username}
                            </button>{' '}
                            <span className="text-gray-400">{notifLabel(n)}</span>
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {formatDistanceToNow(n.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Accept / Decline for follow requests */}
                      {n.type === 'follow_request' && (
                        <div className="flex gap-2 mt-2.5 ml-10">
                          <button
                            onClick={() => handleAccept(n)}
                            disabled={!!actionLoading}
                            className="flex-1 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition"
                          >
                            {actionLoading === n._id ? '…' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDecline(n)}
                            disabled={!!actionLoading}
                            className="flex-1 py-1.5 text-xs font-semibold bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg border border-gray-700 transition"
                          >
                            {actionLoading === `${n._id}-decline` ? '…' : 'Decline'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.li>
                ))
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
