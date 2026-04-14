'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useStore } from '@/store';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useTyping } from '@/hooks/useSocket';
import Avatar from '@/components/ui/Avatar';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import { Message, User } from '@/types';
import { formatLastSeen, getMessageDateLabel } from '@/lib/dateUtils';

/* ─── Shimmer skeletons ─────────────────────────────────────── */
function ChatSkeleton() {
  const rows: { own: boolean; w: string }[] = [
    { own: false, w: 'w-48' },
    { own: true,  w: 'w-36' },
    { own: false, w: 'w-56' },
    { own: true,  w: 'w-44' },
    { own: false, w: 'w-32' },
    { own: true,  w: 'w-52' },
  ];
  return (
    <div className="flex flex-col h-full">
      {/* header skeleton */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
        <div className="w-10 h-10 rounded-full shimmer shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-3 w-28 rounded-full shimmer" />
          <div className="h-2 w-16 rounded-full shimmer" />
        </div>
      </div>
      {/* message skeletons */}
      <div className="flex-1 px-4 py-5 space-y-4 overflow-hidden">
        {rows.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.07 }}
            className={`flex items-end gap-2 ${r.own ? 'flex-row-reverse' : ''}`}
          >
            {!r.own && <div className="w-7 h-7 rounded-full shimmer shrink-0" />}
            <div className={`h-10 rounded-2xl shimmer ${r.w}`} />
          </motion.div>
        ))}
      </div>
      {/* input skeleton */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-800">
        <div className="flex-1 h-11 rounded-xl shimmer" />
        <div className="w-11 h-11 rounded-xl shimmer shrink-0" />
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────── */
export default function ChatWindow({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const {
    user, messages, setMessages, prependMessages, addMessage,
    updateConversationLastMessage, typingStates, onlineUsers,
    conversations, addConversation, setActiveConversation,
  } = useStore();

  const [content, setContent] = useState('');
  // Skip skeleton if messages for this conversation are already cached in the store
  const [loading, setLoading] = useState(
    () => (useStore.getState().messages[conversationId] || []).length === 0
  );
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // tracks whether we've done the initial instant-scroll for this conversation
  const hasScrolledRef = useRef(false);

  const conversation = conversations.find((c) => c._id === conversationId);
  const other = conversation?.participants.find((p) => p._id !== user?._id) as User | undefined;
  const isOtherOnline = other ? onlineUsers.has(other._id) : false;

  const conversationMessages = messages[conversationId] || [];

  const typingInConvo = typingStates.filter(
    (t) => t.conversationId === conversationId && t.userId !== user?._id
  );

  const { sendTyping, stopTyping } = useTyping(conversationId, other?._id || '');

  /* register this conversation as "active" so the socket handler can instantly
     mark incoming messages as read while the user has this chat open */
  useEffect(() => {
    setActiveConversation(conversationId);
    return () => { setActiveConversation(null); };
  }, [conversationId]);

  /* load conversation if not in store */
  useEffect(() => {
    if (!conversation) {
      api.get(`/conversations/${conversationId}`).then(({ data }) => {
        addConversation(data.conversation);
      }).catch(() => {
        toast.error('Conversation not found');
        router.push('/messages');
      });
    }
  }, [conversationId, conversation]);

  /* load messages */
  useEffect(() => {
    const cached = (useStore.getState().messages[conversationId] || []).length > 0;
    if (!cached) setLoading(true);
    setPage(1);
    api.get(`/messages/${conversationId}?page=1&limit=40`)
      .then(({ data }) => {
        setMessages(conversationId, data.messages);
        setHasMore(data.hasMore);
      })
      .catch(() => { /* silently ignore load error — show empty state */ })
      .finally(() => setLoading(false));
  }, [conversationId]);

  /* reset scroll tracker whenever we switch to a different conversation */
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [conversationId]);

  /* scroll to bottom: instant on initial load, smooth for new messages */
  useEffect(() => {
    if (loading) return;
    if (!hasScrolledRef.current) {
      hasScrolledRef.current = true;
      endRef.current?.scrollIntoView({ behavior: 'instant' });
    } else {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationMessages.length, loading]);

  /* mark as read — fires whenever messages load, a new message arrives, OR when
     `other` becomes available (race condition: conversation may load after messages).
     Uses fresh store state to avoid stale-closure issues. */
  useEffect(() => {
    if (!other || conversationMessages.length === 0) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('markRead', { conversationId, senderId: other._id });
    } else {
      api.put(`/messages/${conversationId}/read`);
    }
    // Clear unread badge immediately using fresh store state (avoid stale closure)
    const { conversations: freshConvs, user: freshUser } = useStore.getState();
    const conv = freshConvs.find((c) => c._id === conversationId);
    if (conv?.lastMessage && conv.lastMessage.sender?._id !== freshUser?._id) {
      updateConversationLastMessage(conversationId, { ...conv.lastMessage, status: 'read' });
    }
  }, [conversationId, conversationMessages.length, other?._id]); // other?._id ensures this runs when conversation loads after messages

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await api.get(`/messages/${conversationId}?page=${nextPage}&limit=40`);
      prependMessages(conversationId, data.messages);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch {
      /* silently ignore pagination error */
    } finally {
      setLoadingMore(false);
    }
  };

  /* ── emit via socket with fallback + timeout guard ── */
  const emitMessage = (payload: { conversationId: string; content: string; mediaUrl?: string; mediaType?: string }) => {
    return new Promise<Message>((resolve, reject) => {
      const socket = getSocket();
      if (!socket || !socket.connected) { reject(new Error('no-socket')); return; }

      // 10-second timeout so loader never gets permanently stuck
      const timer = setTimeout(() => reject(new Error('timeout')), 10000);

      socket.emit('sendMessage', payload, (res: { message?: Message; error?: string }) => {
        clearTimeout(timer);
        if (res?.error) reject(new Error(res.error));
        else if (res?.message) resolve(res.message);
        else reject(new Error('no-response'));
      });
    });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || uploadingMedia) return;
    if (!content.trim() && !mediaFile) return;
    if (content.trim().length > 2000) { toast.error('Message too long (max 2000 characters)'); return; }

    const text = content.trim();
    setContent('');
    setCharCount(0);
    stopTyping();
    setSending(true);

    try {
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      // Upload media first if attached
      if (mediaFile) {
        setUploadingMedia(true);
        const form = new FormData();
        form.append('media', mediaFile);
        const { data: up } = await api.post('/upload/message', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        mediaUrl = up.url;
        mediaType = 'image';
        setMediaFile(null);
        setMediaPreview(null);
        setUploadingMedia(false);
      }

      const payload = { conversationId, content: text, mediaUrl, mediaType };

      try {
        const msg = await emitMessage(payload);
        addMessage(conversationId, msg);
        updateConversationLastMessage(conversationId, msg);
      } catch (socketErr: unknown) {
        // Socket failed — fall back to HTTP
        const { data } = await api.post('/messages', payload);
        addMessage(conversationId, data.message);
        updateConversationLastMessage(conversationId, data.message);
      }
    } catch {
      toast.error('Failed to send message');
      setContent(text);
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10 MB)'); return; }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);
    setCharCount(val.length);
    if (val) sendTyping();
    else stopTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as unknown as React.FormEvent);
    }
  };

  if (loading) return <ChatSkeleton />;

  const nearLimit = charCount > 1800;

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/70 bg-gray-900/90 backdrop-blur-md sticky top-0 z-10">
        <button
          onClick={() => router.push('/messages')}
          className="md:hidden text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {other && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar user={{ ...other, isOnline: isOtherOnline }} size="md" showOnline />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">
                {other.username}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isOtherOnline ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-emerald-400 text-xs font-medium">Online</span>
                  </>
                ) : (
                  <span className="text-gray-500 text-xs">
                    Last seen {formatLastSeen(other.lastSeen)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
            <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-px">

        {/* load more */}
        {hasMore && (
          <div className="flex justify-center py-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-4 py-1.5 bg-gray-800/80 hover:bg-gray-800 border border-gray-700/50 rounded-full transition-all disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </span>
              ) : (
                'Load older messages'
              )}
            </button>
          </div>
        )}

        {/* empty convo state */}
        {conversationMessages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4"
          >
            {other && (
              <div className="relative">
                <Avatar user={other} size="xl" />
                {isOtherOnline && (
                  <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-gray-950" />
                )}
              </div>
            )}
            <div>
              <p className="text-white font-bold text-lg">{other?.username}</p>
              <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">
                This is the very beginning of your<br />conversation. Say hello! 👋
              </p>
            </div>
          </motion.div>
        ) : (
          conversationMessages.map((msg, i) => {
            const isOwn = msg.sender._id === user?._id;
            const prev = conversationMessages[i - 1];
            const next = conversationMessages[i + 1];
            const showAvatar = !isOwn && (!prev || prev.sender._id !== msg.sender._id);
            const isLastInGroup = !next || next.sender._id !== msg.sender._id;

            // Show date separator when day changes
            const currentLabel = getMessageDateLabel(msg.createdAt);
            const prevLabel = prev ? getMessageDateLabel(prev.createdAt) : null;
            const showDateSep = currentLabel !== prevLabel;

            return (
              <div key={msg._id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 h-px bg-gray-800/60" />
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-900 px-2 shrink-0 select-none">
                      {currentLabel}
                    </span>
                    <div className="flex-1 h-px bg-gray-800/60" />
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                  isLastInGroup={isLastInGroup}
                />
              </div>
            );
          })
        )}

        {/* typing indicator */}
        <AnimatePresence>
          {typingInConvo.map((t) => (
            <TypingIndicator key={t.userId} username={t.username} />
          ))}
        </AnimatePresence>

        <div ref={endRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-800/70 bg-gray-900/90 backdrop-blur-md">

        {/* ── Media preview ── */}
        <AnimatePresence>
          {mediaPreview && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-2 relative inline-block"
            >
              <img src={mediaPreview} alt="preview" className="h-20 w-20 rounded-xl object-cover border border-gray-700" />
              <button
                type="button"
                onClick={() => { setMediaPreview(null); setMediaFile(null); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition"
              >
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={sendMessage} className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleMediaSelect}
          />

          {/* Media attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploadingMedia}
            className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gray-800/80 border border-gray-700/50 text-gray-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shrink-0 disabled:opacity-50"
            title="Attach image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={mediaFile ? 'Add a caption…' : 'Type a message…'}
              maxLength={2000}
              className={`w-full bg-gray-800/80 border rounded-2xl px-4 py-2.5 pr-12 text-white placeholder-gray-500 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/50
                transition-all resize-none
                ${nearLimit ? 'border-amber-500/50' : 'border-gray-700/50'}`}
            />
            <AnimatePresence>
              {nearLimit && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute right-3 bottom-2.5 text-[10px] text-amber-400 font-mono"
                >
                  {2000 - charCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            type="submit"
            disabled={(!content.trim() && !mediaFile) || sending || uploadingMedia}
            whileTap={{ scale: 0.88 }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0
              ${(content.trim() || mediaFile)
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30'
                : 'bg-gray-800 border border-gray-700'
              }
              disabled:opacity-50`}
          >
            {sending || uploadingMedia ? (
              <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
            ) : (
              <svg
                className={`w-4 h-4 transition-colors ${(content.trim() || mediaFile) ? 'text-white' : 'text-gray-500'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
}
