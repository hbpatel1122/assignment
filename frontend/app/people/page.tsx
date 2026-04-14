'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import AppShell from '@/components/layout/AppShell';
import Loader from '@/components/ui/Loader';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';
import { useStore } from '@/store';
import { UserWithStatus } from '@/types';

export default function PeoplePage() {
  const router = useRouter();
  const { user: me, onlineUsers } = useStore();

  // ── default list state ──
  const [allUsers, setAllUsers] = useState<UserWithStatus[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // ── search state ──
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserWithStatus[]>([]);
  const [searching, setSearching] = useState(false);

  const [followLoading, setFollowLoading] = useState<string | null>(null);

  // sentinel div for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isSearching = query.trim().length > 0;

  // ── fetch one page of users ──
  const fetchPage = useCallback(async (p: number, replace = false) => {
    if (p === 1) replace = true;
    p === 1 ? setInitialLoading(true) : setLoadingMore(true);
    try {
      const { data } = await api.get(`/users?page=${p}`);
      const incoming = (data.users as UserWithStatus[]).filter(u => u._id !== me?._id);
      setAllUsers(prev => replace ? incoming : [...prev, ...incoming]);
      setHasMore(data.hasMore);
      setPage(p);
    } catch {
      toast.error('Failed to load users');
      setHasMore(false);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, [me?._id]);

  useEffect(() => { fetchPage(1, true); }, [fetchPage]);

  // ── IntersectionObserver for infinite scroll ──
  useEffect(() => {
    if (isSearching) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !initialLoading) {
          fetchPage(page + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isSearching, hasMore, loadingMore, initialLoading, page, fetchPage]);

  // ── search ──
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults((data.users as UserWithStatus[]).filter(u => u._id !== me?._id));
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [me?._id]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    const t = setTimeout(() => search(val), 350);
    return () => clearTimeout(t);
  };

  // ── follow / unfollow ──
  const patchList = useCallback((id: string, patch: Partial<UserWithStatus>) => {
    const apply = (list: UserWithStatus[]) =>
      list.map(u => u._id === id ? { ...u, ...patch } : u);
    setAllUsers(apply);
    setSearchResults(apply);
  }, []);

  const handleFollow = async (u: UserWithStatus) => {
    setFollowLoading(u._id);
    try {
      if (u.isFollowing || u.hasRequested) {
        await api.post(`/users/${u._id}/unfollow`);
        patchList(u._id, { isFollowing: false, hasRequested: false });
        toast.success(u.hasRequested ? `Request cancelled` : `Unfollowed ${u.username}`);
      } else {
        const { data: res } = await api.post(`/users/${u._id}/follow`);
        const requested = res.status === 'requested';
        patchList(u._id, { isFollowing: !requested, hasRequested: requested });
        toast.success(requested ? `Request sent to ${u.username}` : `Following ${u.username}`);
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setFollowLoading(null);
    }
  };

  const startChat = async (userId: string) => {
    const id = toast.loading('Opening conversation…');
    try {
      const { data } = await api.post('/conversations', { userId });
      toast.success('Conversation ready!', { id });
      router.push(`/messages/${data.conversation._id}`);
    } catch {
      toast.error('Could not open conversation', { id });
    }
  };

  const displayList = isSearching ? searchResults : allUsers;
  const isLoading = isSearching ? searching : initialLoading;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">People</h1>
          <p className="text-gray-400 text-sm">
            {isSearching ? 'Search results' : 'Discover people on ChatSphere'}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {searching ? (
              <Loader size="sm" color="bg-indigo-400" />
            ) : (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search by username or email…"
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl pl-11 pr-10 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSearchResults([]); }}
              className="absolute inset-y-0 right-4 flex items-center text-gray-500 hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* List */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div key="initial-loader"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex justify-center py-16">
              <Loader size="lg" color="bg-indigo-500" />
            </motion.div>
          )}

          {!isLoading && displayList.length === 0 && (
            <motion.div key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-16">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-400 font-medium">
                {isSearching ? 'No users found' : 'No other users yet'}
              </p>
              <p className="text-gray-600 text-sm mt-1">
                {isSearching ? 'Try a different search term' : 'Invite friends to join ChatSphere'}
              </p>
            </motion.div>
          )}

          {!isLoading && displayList.length > 0 && (
            <motion.ul key="list"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-3">
              {displayList.map((u, i) => {
                return (
                  <motion.li
                    key={u._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 5) * 0.06 }}
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-3 sm:p-4 hover:border-indigo-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Avatar + Info — full area clickable */}
                      <button
                        onClick={() => router.push(`/profile/${u.username}`)}
                        className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left"
                      >
                        <span className="shrink-0">
                          <Avatar user={{ ...u, isOnline: onlineUsers.has(u._id) }} size="lg" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white font-semibold text-sm hover:text-indigo-400 transition max-w-[120px] sm:max-w-none truncate">
                              {u.username}
                            </span>
                            {u.profileType === 'private' && (
                              <span className="shrink-0 bg-gray-800 border border-gray-700 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                Private
                              </span>
                            )}
                          </span>
                          {u.bio && (
                            <span className="block text-gray-500 text-xs mt-0.5 truncate">{u.bio}</span>
                          )}
                        </span>
                      </button>

                      {/* Actions — icon-only on mobile, icon+label on sm+ */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Message */}
                        <button
                          onClick={() => startChat(u._id)}
                          title="Message"
                          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white rounded-xl transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </button>

                        {/* Follow / Unfollow */}
                        <button
                          onClick={() => handleFollow(u)}
                          disabled={followLoading === u._id}
                          className={`flex items-center gap-1 px-2.5 py-1.5 sm:px-3 text-xs rounded-xl transition font-medium ${
                            u.isFollowing
                              ? 'bg-gray-800 text-white border border-gray-700 hover:border-red-500/40 hover:text-red-400'
                              : u.hasRequested
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {followLoading === u._id ? (
                            <Loader size="sm" />
                          ) : u.isFollowing ? (
                            <>
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="hidden sm:inline">Following</span>
                            </>
                          ) : u.hasRequested ? (
                            <>
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="hidden sm:inline">Requested</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="hidden sm:inline">Follow</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        {/* Infinite scroll sentinel + load-more loader */}
        {!isSearching && (
          <div ref={sentinelRef} className="py-6 flex justify-center">
            {loadingMore && <Loader size="md" color="bg-indigo-500" />}
          </div>
        )}
      </div>
    </AppShell>
  );
}
