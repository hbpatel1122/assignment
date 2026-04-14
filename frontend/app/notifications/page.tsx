'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import AppShell from '@/components/layout/AppShell';
import Avatar from '@/components/ui/Avatar';
import { useStore } from '@/store';
import api from '@/lib/api';
import { Notification } from '@/types';
import { formatDistanceToNow } from '@/lib/dateUtils';

const PAGE_LIMIT = 15;

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
      <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </div>
    );
  }
  if (type === 'follow_accepted') {
    return (
      <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}

function SkeletonRow() {
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-52 rounded bg-gray-800 animate-pulse" />
        <div className="h-2.5 w-28 rounded bg-gray-800 animate-pulse" />
      </div>
    </li>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    setNotifications,
    appendNotifications,
    markAllNotifsRead,
    removeNotification,
    clearAllNotifications,
    updateUser,
  } = useStore();

  const [loading, setLoading]             = useState(false);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [hasMore, setHasMore]             = useState(false);
  const [page, setPage]                   = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Fetch page 1 and instantly zero the badge in a single flow —
  // no separate effect so there is no race between fetch and mark-read.
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/notifications?page=1&limit=${PAGE_LIMIT}`);

        // 1. Populate the store with fresh data (sets unreadNotifCount from DB)
        setNotifications(data.notifications, data.unreadCount);
        setHasMore(data.hasMore);
        setPage(1);

        // 2. Instantly zero the badge in the store (synchronous — renders immediately)
        if (data.unreadCount > 0) {
          markAllNotifsRead();
          // Fire-and-forget DB update
          api.put('/notifications/read-all').catch(() => {});
        }
      } catch {
        toast.error('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await api.get(`/notifications?page=${nextPage}&limit=${PAGE_LIMIT}`);
      appendNotifications(data.notifications);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch {
      toast.error('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, appendNotifications]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleAccept = async (notif: Notification) => {
    setActionLoading(notif._id);
    try {
      await api.post(`/users/requests/${notif.sender._id}/accept`);
      await api.delete(`/notifications/${notif._id}`);
      removeNotification(notif._id);
      const { data } = await api.get('/auth/me');
      updateUser(data.user);
      toast.success(`Accepted ${notif.sender.username}'s follow request`);
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

  const handleDelete = async (notif: Notification) => {
    try {
      await api.delete(`/notifications/${notif._id}`);
      removeNotification(notif._id);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete('/notifications/all');
      clearAllNotifications();
      setHasMore(false);
      toast.success('All notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-white font-bold text-xl">Notifications</h1>
              <p className="text-gray-500 text-xs mt-0.5">Auto-deleted after 3 days</p>
            </div>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-red-400 hover:text-red-300 transition px-3 py-1.5 rounded-lg hover:bg-red-500/10"
            >
              Clear all
            </button>
          )}
        </div>

        {/* List card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          {loading ? (
            <ul className="divide-y divide-gray-800/60">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </ul>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-gray-400 font-medium">No notifications</p>
              <p className="text-gray-600 text-sm mt-1">You're all caught up!</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <ul className="divide-y divide-gray-800/60">
                {notifications.map((n) => (
                  <motion.li
                    key={n._id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.18 }}
                    className={`flex items-start gap-4 px-5 py-4 group transition-colors
                      ${!n.read ? 'bg-indigo-500/5' : 'hover:bg-gray-800/30'}`}
                  >
                    {/* Avatar + unread dot */}
                    <div className="relative shrink-0">
                      <button onClick={() => router.push(`/profile/${n.sender.username}`)}>
                        <Avatar user={{ ...n.sender, isOnline: false }} size="sm" />
                      </button>
                      {!n.read && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-gray-900" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2.5">
                        {notifIcon(n.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 leading-snug">
                            <button
                              onClick={() => router.push(`/profile/${n.sender.username}`)}
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
                        <div className="flex gap-2 mt-3 ml-11">
                          <button
                            onClick={() => handleAccept(n)}
                            disabled={!!actionLoading}
                            className="flex-1 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition"
                          >
                            {actionLoading === n._id ? (
                              <span className="flex items-center justify-center gap-1.5">
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Accepting…
                              </span>
                            ) : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDecline(n)}
                            disabled={!!actionLoading}
                            className="flex-1 py-2 text-sm font-semibold bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-xl border border-gray-700 transition"
                          >
                            {actionLoading === `${n._id}-decline` ? (
                              <span className="flex items-center justify-center gap-1.5">
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Declining…
                              </span>
                            ) : 'Decline'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete button (non-request notifications) */}
                    {n.type !== 'follow_request' && (
                      <button
                        onClick={() => handleDelete(n)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-7 h-7 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-red-400"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </motion.li>
                ))}
              </ul>
            </AnimatePresence>
          )}

          {/* Infinite-scroll sentinel / load-more */}
          {!loading && (
            <div ref={loaderRef} className="px-5 py-3 flex items-center justify-center">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-gray-600 text-xs">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Loading more…
                </div>
              ) : hasMore ? (
                <button
                  onClick={loadMore}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition py-1"
                >
                  Load more
                </button>
              ) : notifications.length > 0 ? (
                <p className="text-gray-700 text-xs">You've seen all notifications</p>
              ) : null}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <p className="text-center text-gray-700 text-xs mt-4">
            Notifications are automatically deleted after 3 days
          </p>
        )}
      </div>
    </AppShell>
  );
}
