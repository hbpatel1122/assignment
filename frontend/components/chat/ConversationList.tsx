'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useStore } from '@/store';
import api from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import NewChatModal from './NewChatModal';
import { Conversation } from '@/types';
import { formatDistanceToNow } from '@/lib/dateUtils';

type ListTab = 'messages' | 'requests';

/* ─── Shimmer skeleton row ─────────────────────────────────── */
function ConversationSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="flex items-center gap-3 px-4 py-3.5"
    >
      <div className="w-11 h-11 rounded-full shimmer shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <div className="h-3 w-28 rounded-full shimmer" />
          <div className="h-2.5 w-10 rounded-full shimmer shrink-0" />
        </div>
        <div className="h-2.5 w-40 rounded-full shimmer" />
      </div>
    </motion.div>
  );
}

/* ─── Status tick — same geometry as MessageBubble ──────────── */
const DVB = "0 0 22 11";  // double-tick viewBox
const SVB = "0 0 14 11";  // single-tick viewBox
const SW2 = "1.8";
const LC2 = "round" as const;

function StatusIcon({ status }: { status: string }) {
  if (status === 'read') {
    return (
      <svg width="17" height="10" viewBox={DVB} fill="none" className="shrink-0">
        <path d="M0.5 6L4 10L10.5 0.5"  stroke="#53bdeb" strokeWidth={SW2} strokeLinecap={LC2} strokeLinejoin={LC2} />
        <path d="M5.5 6L9 10L15.5 0.5"  stroke="#53bdeb" strokeWidth={SW2} strokeLinecap={LC2} strokeLinejoin={LC2} />
      </svg>
    );
  }
  if (status === 'delivered') {
    return (
      <svg width="17" height="10" viewBox={DVB} fill="none" className="shrink-0">
        <path d="M0.5 6L4 10L10.5 0.5"  stroke="#9ca3af" strokeWidth={SW2} strokeLinecap={LC2} strokeLinejoin={LC2} />
        <path d="M5.5 6L9 10L15.5 0.5"  stroke="#9ca3af" strokeWidth={SW2} strokeLinecap={LC2} strokeLinejoin={LC2} />
      </svg>
    );
  }
  // sent — single tick
  return (
    <svg width="11" height="9" viewBox={SVB} fill="none" className="shrink-0">
      <path d="M0.5 6L4 10L13.5 0.5"    stroke="#6b7280" strokeWidth={SW2} strokeLinecap={LC2} strokeLinejoin={LC2} />
    </svg>
  );
}

/* ─── Main component ───────────────────────────────────────── */
export default function ConversationList() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    conversations, setConversations, appendConversations,
    messageRequests, setMessageRequests, removeMessageRequest, promoteRequestToConversation,
    removeConversation,
    user, onlineUsers,
  } = useStore();

  // Skip shimmer if store already has data (e.g. switching conversations re-mounts this)
  const [loading, setLoading] = useState(conversations.length === 0);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ListTab>('messages');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/conversations?page=1&limit=20').then(({ data }) => {
        setConversations(data.conversations);
        setHasMore(data.hasMore ?? false);
        setPage(1);
      }),
      api.get('/conversations/requests').then(({ data }) => setMessageRequests(data.conversations)),
    ]).finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await api.get(`/conversations?page=${nextPage}&limit=20`);
      appendConversations(data.conversations);
      setHasMore(data.hasMore ?? false);
      setPage(nextPage);
    } catch {
      /* silently ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  const getOther = (c: Conversation) =>
    c.participants.find((p) => p._id !== user?._id) || c.participants[0];

  const unreadCount = conversations.filter((c) =>
    c.lastMessage &&
    c.lastMessage.sender?._id !== user?._id &&
    c.lastMessage.status !== 'read'
  ).length;

  const handleAccept = async (conversationId: string) => {
    setActionLoading(conversationId);
    try {
      const { data } = await api.put(`/conversations/${conversationId}/accept`);
      promoteRequestToConversation(conversationId);
      toast.success('Message request accepted');
      router.push(`/messages/${data.conversation._id}`);
    } catch {
      toast.error('Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (conversationId: string) => {
    setActionLoading(conversationId);
    try {
      await api.delete(`/conversations/${conversationId}/decline`);
      removeMessageRequest(conversationId);
      toast.success('Message request declined');
    } catch {
      toast.error('Failed to decline request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (conversationId: string) => {
    setActionLoading(conversationId);
    setDeleteConfirm(null);
    try {
      await api.delete(`/conversations/${conversationId}`);
      removeConversation(conversationId);
      toast.success('Conversation deleted');
      // If currently viewing this conversation, go back to messages list
      if (pathname === `/messages/${conversationId}`) {
        router.push('/messages');
      }
    } catch {
      toast.error('Failed to delete conversation');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} />

      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-800/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">Messages</h1>
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-indigo-600 text-white text-[11px] font-bold rounded-full shadow-lg shadow-indigo-600/30"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setNewChatOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/25 text-indigo-400 hover:text-indigo-300 rounded-xl text-xs font-medium transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          {/* search hint */}
          <button
            onClick={() => setNewChatOpen(true)}
            className="flex items-center gap-2 w-full bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 rounded-xl px-3 py-2 transition-colors group mb-3"
          >
            <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-400 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <span className="text-gray-500 text-sm group-hover:text-gray-400 transition-colors">Search people…</span>
          </button>

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'messages'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Messages
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'requests'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Requests
              {messageRequests.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-yellow-500 text-black text-[10px] font-bold rounded-full">
                  {messageRequests.length > 9 ? '9+' : messageRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="divide-y divide-gray-800/40">
              {[0, 0.06, 0.12, 0.18, 0.24].map((delay, i) => (
                <ConversationSkeleton key={i} delay={delay} />
              ))}
            </div>
          ) : activeTab === 'messages' ? (
            /* ── Messages Tab ── */
            conversations.length === 0 ? (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-52 text-center px-6"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-600/20 to-violet-600/20 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-gray-300 text-sm font-semibold">No conversations yet</p>
                  <p className="text-gray-600 text-xs mt-1 leading-relaxed mb-4">
                    Start a new chat to connect<br />with someone
                  </p>
                  <button
                    onClick={() => setNewChatOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Start a conversation
                  </button>
                </motion.div>
              </AnimatePresence>
            ) : (
              <>
              <ul className="divide-y divide-gray-800/40">
                <AnimatePresence initial={false}>
                  {conversations.map((c, i) => {
                    const other = getOther(c);
                    const isOnline = onlineUsers.has(other._id);
                    const active = pathname === `/messages/${c._id}`;
                    const isUnread =
                      !!c.lastMessage &&
                      c.lastMessage.sender?._id !== user?._id &&
                      c.lastMessage.status !== 'read';

                    return (
                      <motion.li
                        key={c._id}
                        layout
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12, height: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.22 }}
                        className="group relative"
                      >
                        {/* ── Inline delete confirmation overlay ── */}
                        <AnimatePresence>
                          {deleteConfirm === c._id && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 z-10 flex items-center justify-between gap-2 px-4 bg-gray-900/95 border-l-2 border-red-500/60"
                            >
                              <p className="text-xs text-gray-300">Delete this chat?</p>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => handleDelete(c._id)}
                                  disabled={actionLoading === c._id}
                                  className="px-3 py-1 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-lg transition"
                                >
                                  {actionLoading === c._id ? '…' : 'Delete'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-3 py-1 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <Link
                          href={`/messages/${c._id}`}
                          className={`flex items-center gap-3 px-4 py-3.5 transition-all duration-150 relative
                            ${active ? 'bg-indigo-600/10' : 'hover:bg-gray-800/50'}`}
                        >
                          {active && (
                            <motion.span
                              layoutId="active-bar"
                              className="absolute left-0 top-2 bottom-2 w-0.5 bg-indigo-500 rounded-full"
                            />
                          )}
                          <Avatar user={{ ...other, isOnline }} size="md" showOnline />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className={`text-sm truncate ${
                                isUnread ? 'font-bold text-white' : active ? 'font-semibold text-indigo-300' : 'font-medium text-gray-200'
                              }`}>
                                {other.username}
                              </p>
                              {c.lastMessage && (
                                <span className={`text-[10px] shrink-0 ${isUnread ? 'text-indigo-400 font-medium' : 'text-gray-500'}`}>
                                  {formatDistanceToNow(c.lastMessage.createdAt)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {c.lastMessage ? (
                                <>
                                  {c.lastMessage.sender?._id === user?._id && (
                                    <StatusIcon status={c.lastMessage.status} />
                                  )}
                                  <p className={`text-xs truncate leading-snug ${isUnread ? 'text-gray-300 font-medium' : 'text-gray-500'}`}>
                                    {c.lastMessage.sender?._id === user?._id
                                      ? <span className="text-gray-400">You: </span>
                                      : null}
                                    {c.lastMessage.content}
                                  </p>
                                </>
                              ) : (
                                <p className="text-gray-600 text-xs italic">Start a conversation</p>
                              )}
                            </div>
                          </div>
                          {isUnread && !active && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 shadow-sm shadow-indigo-500/50"
                            />
                          )}

                          {/* Delete button — visible on hover */}
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm(c._id); }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all ml-1"
                            title="Delete conversation"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </Link>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>

              {/* ── Load more button ── */}
              {hasMore && (
                <div className="flex justify-center py-3 px-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/40 rounded-xl transition-all disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Load more conversations'
                    )}
                  </button>
                </div>
              )}
              </>
            )
          ) : (
            /* ── Requests Tab ── */
            messageRequests.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-52 text-center px-6"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-600/15 to-orange-600/15 border border-yellow-500/20 rounded-2xl flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-yellow-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-gray-300 text-sm font-semibold">No message requests</p>
                <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                  Messages from people you<br />don't follow appear here
                </p>
              </motion.div>
            ) : (
              <>
                {/* Info banner */}
                <div className="mx-3 mt-3 mb-1 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <p className="text-yellow-400 text-xs leading-relaxed">
                    These are messages from people you don't follow. Accept to reply, or decline to remove.
                  </p>
                </div>
                <ul className="divide-y divide-gray-800/40 mt-1">
                  <AnimatePresence initial={false}>
                    {messageRequests.map((c, i) => {
                      const other = getOther(c);
                      const isOnline = onlineUsers.has(other._id);
                      const isActioning = actionLoading === c._id;

                      return (
                        <motion.li
                          key={c._id}
                          layout
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12, height: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.22 }}
                          className="px-4 py-3.5"
                        >
                          <div className="flex items-center gap-3 mb-2.5">
                            <Avatar user={{ ...other, isOnline }} size="md" showOnline />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{other.username}</p>
                              {c.lastMessage && (
                                <p className="text-xs text-gray-400 truncate mt-0.5">
                                  {c.lastMessage.content}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-600 shrink-0">
                              {c.lastMessage ? formatDistanceToNow(c.lastMessage.createdAt) : ''}
                            </span>
                          </div>
                          {/* Accept / Decline */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAccept(c._id)}
                              disabled={isActioning}
                              className="flex-1 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg transition-all"
                            >
                              {isActioning ? '…' : 'Accept'}
                            </button>
                            <button
                              onClick={() => handleDecline(c._id)}
                              disabled={isActioning}
                              className="flex-1 py-1.5 text-xs font-semibold bg-gray-800 hover:bg-red-500/20 disabled:opacity-60 text-gray-300 hover:text-red-400 border border-gray-700 hover:border-red-500/30 rounded-lg transition-all"
                            >
                              {isActioning ? '…' : 'Decline'}
                            </button>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}
