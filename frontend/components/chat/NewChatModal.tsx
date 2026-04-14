'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import { User } from '@/types';
import { useStore } from '@/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NewChatModal({ open, onClose }: Props) {
  const router = useRouter();
  const { addConversation } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* auto-focus input when modal opens */
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  /* debounced search */
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(data.users || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 320);
  };

  const startChat = async (u: User) => {
    setStarting(u._id);
    try {
      const { data } = await api.post('/conversations', { userId: u._id });
      addConversation(data.conversation);
      onClose();
      router.push(`/messages/${data.conversation._id}`);
    } catch {
      toast.error('Could not open conversation');
    } finally {
      setStarting(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.34, 1.1, 0.64, 1] }}
            className="fixed top-[72px] left-1/2 -translate-x-1/2 md:left-[calc(256px+16px)] md:translate-x-0 w-[calc(100vw-32px)] md:w-80 bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800/60">
              <p className="text-white font-semibold text-sm">New Conversation</p>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* search input */}
            <div className="px-3 py-2.5">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  {searching ? (
                    <span className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleChange}
                  placeholder="Search by username…"
                  className="w-full bg-gray-800/80 border border-gray-700/40 rounded-xl pl-9 pr-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                />
              </div>
            </div>

            {/* results */}
            <div className="max-h-72 overflow-y-auto">
              {!query.trim() && (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-500 text-xs">Type a username to search</p>
                </div>
              )}

              {query.trim() && !searching && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <p className="text-gray-500 text-sm">No users found</p>
                  <p className="text-gray-600 text-xs mt-1">Try a different username</p>
                </div>
              )}

              {results.length > 0 && (
                <ul className="pb-2">
                  <AnimatePresence initial={false}>
                    {results.map((u, i) => (
                      <motion.li
                        key={u._id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <button
                          onClick={() => startChat(u)}
                          disabled={starting === u._id}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/60 transition-colors disabled:opacity-60"
                        >
                          <Avatar user={u} size="sm" showOnline />
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-white text-sm font-medium truncate">{u.username}</p>
                            {u.bio && (
                              <p className="text-gray-500 text-xs truncate">{u.bio}</p>
                            )}
                          </div>
                          {starting === u._id ? (
                            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                          ) : (
                            <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
